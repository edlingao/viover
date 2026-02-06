package adapters

import (
	"context"
	"encoding/base64"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/edlingao/viover/internal/viover/core"
	"github.com/labstack/echo/v4"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type App struct {
	ctx            context.Context
	Microphone     *core.Microphone
	echo           *echo.Echo
	store          *core.Store
	currentProject *core.Project
}

func NewApp() *App {
	e := echo.New()
	videoGroup := e.Group("/videos")
	videoGroup.GET("/*", VideoHandler)
	audioGroup := e.Group("/audio")
	audioGroup.GET("/*", AudioHandler)

	go func() {
		if err := e.Start(":8080"); err != nil {
			log.Println("Echo server error:", err)
		}
	}()

	return &App{
		echo: e,
	}
}

func (a *App) Startup(ctx context.Context) {
	a.ctx = ctx
	a.Microphone = core.NewMicrophone(ctx)
	configDir, _ := os.UserConfigDir()
	vioverDir := filepath.Join(configDir, "viover")
	store, err := core.NewStore(vioverDir)
	if err != nil {
		log.Println("Error creating store:", err)
	}
	a.store = store
}

func (a *App) ListDevices() []core.DeviceInfo {
	return a.Microphone.List()
}

func (a *App) SelectDevice(uuid string) core.DeviceInfo {
	return a.Microphone.SelectDevice(uuid)
}

func (a *App) GetSelectedDevice() core.DeviceInfo {
	return a.Microphone.GetSelectedDevice()
}

func (a *App) ListProjects() []core.ProjectMeta {
	if a.store == nil {
		return []core.ProjectMeta{}
	}
	return a.store.ListProjects()
}

func (a *App) CreateProject(title string) (*core.Project, error) {
	dir, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title:                "Select Project Location",
		CanCreateDirectories: true,
	})
	if err != nil || dir == "" {
		return nil, err
	}
	projectPath := filepath.Join(dir, sanitizeFilename(title))
	if err := os.MkdirAll(projectPath, 0755); err != nil {
		return nil, err
	}
	if err := os.MkdirAll(filepath.Join(projectPath, "recordings"), 0755); err != nil {
		return nil, err
	}
	project := core.NewProject(title, projectPath)
	if err := project.Save(); err != nil {
		return nil, err
	}
	if err := a.store.AddProject(project); err != nil {
		return nil, err
	}
	a.currentProject = project
	return project, nil
}

func (a *App) OpenProject(id string) (*core.Project, error) {
	meta := a.store.GetProject(id)
	if meta == nil {
		return nil, nil
	}
	project, err := core.LoadProject(meta.Path)
	if err != nil {
		return nil, err
	}
	a.currentProject = project
	return project, nil
}

func (a *App) GetCurrentProject() *core.Project {
	return a.currentProject
}

func (a *App) UpdateProjectTitle(id, title string) error {
	if a.currentProject != nil && a.currentProject.ID == id {
		a.currentProject.Title = title
		if err := a.currentProject.Save(); err != nil {
			return err
		}
	}
	return a.store.UpdateProject(id, title)
}

func (a *App) DeleteProject(id string) error {
	meta := a.store.GetProject(id)
	if meta != nil {
		os.RemoveAll(meta.Path)
	}
	if a.currentProject != nil && a.currentProject.ID == id {
		a.currentProject = nil
	}
	return a.store.RemoveProject(id)
}

func (a *App) CloseProject() {
	a.currentProject = nil
}

func (a *App) SelectVideo() (*core.Video, error) {
	if a.currentProject == nil {
		return nil, nil
	}
	selection, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title:   "Select Video File",
		Filters: []runtime.FileFilter{{DisplayName: "Video Files", Pattern: "*.mp4;*.avi;*.mkv;*.mov;*.webm"}},
	})
	if err != nil || selection == "" {
		return nil, err
	}
	destPath := filepath.Join(a.currentProject.Path, filepath.Base(selection))
	if selection != destPath {
		if err := copyFile(selection, destPath); err != nil {
			return nil, err
		}
	}
	video := &core.Video{
		ID:       filepath.Base(destPath),
		FileName: filepath.Base(destPath),
		FilePath: destPath,
	}
	a.currentProject.SetVideo(video)
	if err := a.currentProject.Save(); err != nil {
		return nil, err
	}
	return video, nil
}

func (a *App) GetVideoURL() string {
	if a.currentProject == nil || a.currentProject.Video == nil {
		return ""
	}
	return "http://localhost:8080/videos/" + a.currentProject.Video.FilePath
}

func (a *App) AddCharacter(name, color string) (*core.Character, error) {
	if a.currentProject == nil {
		return nil, nil
	}
	character := core.NewCharacter(name, color)
	a.currentProject.AddCharacter(character)
	if err := a.currentProject.Save(); err != nil {
		return nil, err
	}
	return character, nil
}

func (a *App) UpdateCharacter(id, name, color string) error {
	if a.currentProject == nil {
		return nil
	}
	a.currentProject.UpdateCharacter(id, name, color)
	return a.currentProject.Save()
}

func (a *App) DeleteCharacter(id string) error {
	if a.currentProject == nil {
		return nil
	}
	for _, r := range a.currentProject.Recordings {
		if r.CharacterID == id {
			os.Remove(r.FilePath)
		}
	}
	a.currentProject.RemoveCharacter(id)
	return a.currentProject.Save()
}

func (a *App) RecordAudio(characterID string, timecode float64) (*core.Recording, error) {
	if a.currentProject == nil {
		return nil, nil
	}
	recordingPath := filepath.Join(a.currentProject.Path, "recordings")
	recording, err := a.Microphone.RecordToFile(recordingPath, characterID, timecode)
	if err != nil {
		return nil, err
	}
	a.currentProject.AddRecording(recording)
	if err := a.currentProject.Save(); err != nil {
		return nil, err
	}
	return recording, nil
}

func (a *App) StopRecording() {
	a.Microphone.StopRecording()
}

func (a *App) DeleteRecording(id string) error {
	if a.currentProject == nil {
		return nil
	}
	for _, r := range a.currentProject.Recordings {
		if r.ID == id {
			os.Remove(r.FilePath)
			break
		}
	}
	a.currentProject.RemoveRecording(id)
	return a.currentProject.Save()
}

func (a *App) GetRecordingWaveform(recordingID string) ([]int, error) {
	if a.currentProject == nil {
		return nil, nil
	}
	for _, r := range a.currentProject.Recordings {
		if r.ID == recordingID {
			return core.GetWaveformPeaks(r.FilePath, 128)
		}
	}
	return nil, nil
}

func (a *App) UpdateRecordingTimecode(recordingID string, newTimecode float64) error {
	if a.currentProject == nil {
		return nil
	}
	a.currentProject.UpdateRecordingTimecode(recordingID, newTimecode)
	return a.currentProject.Save()
}

func (a *App) UpdateRecordingVolume(recordingID string, volume float64) error {
	if a.currentProject == nil {
		return nil
	}
	a.currentProject.UpdateRecordingVolume(recordingID, volume)
	return a.currentProject.Save()
}

func (a *App) UpdateRecordingGain(recordingID string, gainDB float64) error {
	if a.currentProject == nil {
		return nil
	}
	a.currentProject.UpdateRecordingGain(recordingID, gainDB)
	return a.currentProject.Save()
}

func (a *App) SetMicrophoneGain(gainDB float64) {
	a.Microphone.SetInputGain(gainDB)
}

func (a *App) GetMicrophoneGain() float64 {
	return a.Microphone.GetInputGain()
}

// GetAudioData returns base64-encoded audio data (Wails has issues with large byte arrays)
func (a *App) GetAudioData(recordingID string) (string, error) {
	log.Printf("[GetAudioData] Called with recordingID: %s", recordingID)

	if a.currentProject == nil {
		log.Println("[GetAudioData] ERROR: No current project!")
		return "", nil
	}

	for _, r := range a.currentProject.Recordings {
		if r.ID == recordingID {
			data, err := os.ReadFile(r.FilePath)
			if err != nil {
				log.Printf("[GetAudioData] ERROR: %v", err)
				return "", err
			}

			// Return base64-encoded data
			encoded := base64.StdEncoding.EncodeToString(data)
			log.Printf("[GetAudioData] SUCCESS! Read %d bytes, encoded to %d chars", len(data), len(encoded))
			return encoded, nil
		}
	}

	log.Printf("[GetAudioData] Recording not found: %s", recordingID)
	return "", nil
}

type ExportOptions struct {
	Format           string             `json:"format"`
	CharacterVolumes map[string]float64 `json:"characterVolumes"`
	MasterVolume     float64            `json:"masterVolume"`
}

func (a *App) ExportRecordings(format string) (string, error) {
	return a.ExportRecordingsWithOptions(ExportOptions{
		Format:           format,
		CharacterVolumes: make(map[string]float64),
		MasterVolume:     1.0,
	})
}

func (a *App) ExportRecordingsWithOptions(opts ExportOptions) (string, error) {
	if a.currentProject == nil {
		return "", nil
	}
	if opts.Format != "wav" && opts.Format != "mp3" && opts.Format != "flac" {
		return "", fmt.Errorf("unsupported format: %s", opts.Format)
	}
	dir, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title:                "Select Export Location",
		CanCreateDirectories: true,
	})
	if err != nil || dir == "" {
		return "", err
	}
	exportDir := filepath.Join(dir, a.currentProject.Title+"_export")
	if err := os.MkdirAll(exportDir, 0755); err != nil {
		return "", err
	}
	for _, r := range a.currentProject.Recordings {
		var characterName string
		charVol := 1.0
		for _, c := range a.currentProject.Characters {
			if c.ID == r.CharacterID {
				characterName = c.Name
				if v, ok := opts.CharacterVolumes[c.ID]; ok {
					charVol = v
				}
				break
			}
		}
		if characterName == "" {
			characterName = "Unknown"
		}
		recVol := r.Volume
		if recVol == 0 {
			recVol = 1.0
		}
		gainLinear := core.DBToLinear(r.GainDB)
		finalVol := opts.MasterVolume * charVol * recVol * gainLinear
		destName := sanitizeFilename(characterName) + "_" + formatTimecode(r.Timecode) + "." + opts.Format
		destPath := filepath.Join(exportDir, destName)
		if err := core.ExportAudio(r.FilePath, destPath, opts.Format, finalVol); err != nil {
			log.Println("Export error:", err)
		}
	}
	return exportDir, nil
}

func VideoHandler(c echo.Context) error {
	path := c.Param("*")
	return c.File(path)
}

func AudioHandler(c echo.Context) error {
	path := c.Param("*")
	return c.File(path)
}

func copyFile(src, dst string) error {
	source, err := os.Open(src)
	if err != nil {
		return err
	}
	defer source.Close()
	dest, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer dest.Close()
	_, err = io.Copy(dest, source)
	return err
}

func sanitizeFilename(name string) string {
	replacer := strings.NewReplacer("/", "_", "\\", "_", ":", "_", "*", "_", "?", "_", "\"", "_", "<", "_", ">", "_", "|", "_")
	return replacer.Replace(name)
}

func formatTimecode(seconds float64) string {
	mins := int(seconds) / 60
	secs := int(seconds) % 60
	frames := int((seconds - float64(int(seconds))) * 30)
	return strings.ReplaceAll(strings.ReplaceAll(
		strings.Join([]string{
			padInt(mins),
			padInt(secs),
			padInt(frames),
		}, "-"),
		":", "-"), " ", "")
}

func padInt(n int) string {
	if n < 10 {
		return "0" + string(rune('0'+n))
	}
	return string(rune('0'+n/10)) + string(rune('0'+n%10))
}
