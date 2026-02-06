package core

import (
	"encoding/json"
	"math"
	"os"
	"path/filepath"
	"time"

	"github.com/google/uuid"
)

type Project struct {
	ID         string       `json:"id"`
	Title      string       `json:"title"`
	Path       string       `json:"path"`
	Video      *Video       `json:"video,omitempty"`
	Characters []*Character `json:"characters"`
	Recordings []*Recording `json:"recordings"`
	CreatedAt  time.Time    `json:"created_at"`
	UpdatedAt  time.Time    `json:"updated_at"`
}

type Video struct {
	ID        string `json:"id"`
	FileName  string `json:"file_name"`
	FilePath  string `json:"file_path"`
	Thumbnail string `json:"thumbnail"`
}

type Character struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Color string `json:"color"`
}

type Recording struct {
	ID          string  `json:"id"`
	CharacterID string  `json:"character_id"`
	FilePath    string  `json:"file_path"`
	Timecode    float64 `json:"timecode"`
	Duration    float64 `json:"duration"`
	Volume      float64 `json:"volume"`
	GainDB      float64 `json:"gain_db"`
}

func NewProject(title, path string) *Project {
	return &Project{
		ID:         uuid.NewString(),
		Title:      title,
		Path:       path,
		Characters: make([]*Character, 0),
		Recordings: make([]*Recording, 0),
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}
}

func NewCharacter(name, color string) *Character {
	return &Character{
		ID:    uuid.NewString(),
		Name:  name,
		Color: color,
	}
}

func NewRecording(characterID, filePath string, timecode, duration float64) *Recording {
	return &Recording{
		ID:          uuid.NewString(),
		CharacterID: characterID,
		FilePath:    filePath,
		Timecode:    timecode,
		Duration:    duration,
		Volume:      1.0,
	}
}

func (p *Project) SetVideo(v *Video) {
	p.Video = v
	p.UpdatedAt = time.Now()
}

func (p *Project) AddCharacter(c *Character) {
	p.Characters = append(p.Characters, c)
	p.UpdatedAt = time.Now()
}

func (p *Project) RemoveCharacter(id string) {
	for i, c := range p.Characters {
		if c.ID == id {
			p.Characters = append(p.Characters[:i], p.Characters[i+1:]...)
			break
		}
	}
	newRecordings := make([]*Recording, 0)
	for _, r := range p.Recordings {
		if r.CharacterID != id {
			newRecordings = append(newRecordings, r)
		}
	}
	p.Recordings = newRecordings
	p.UpdatedAt = time.Now()
}

func (p *Project) UpdateCharacter(id, name, color string) {
	for _, c := range p.Characters {
		if c.ID == id {
			c.Name = name
			c.Color = color
			break
		}
	}
	p.UpdatedAt = time.Now()
}

func (p *Project) AddRecording(r *Recording) {
	p.Recordings = append(p.Recordings, r)
	p.UpdatedAt = time.Now()
}

func (p *Project) RemoveRecording(id string) {
	for i, r := range p.Recordings {
		if r.ID == id {
			p.Recordings = append(p.Recordings[:i], p.Recordings[i+1:]...)
			break
		}
	}
	p.UpdatedAt = time.Now()
}

func (p *Project) UpdateRecordingTimecode(id string, newTimecode float64) {
	for _, r := range p.Recordings {
		if r.ID == id {
			r.Timecode = newTimecode
			break
		}
	}
	p.UpdatedAt = time.Now()
}

func (p *Project) UpdateRecordingVolume(id string, volume float64) {
	for _, r := range p.Recordings {
		if r.ID == id {
			r.Volume = math.Max(0.0, math.Min(1.0, volume))
			break
		}
	}
	p.UpdatedAt = time.Now()
}

func (p *Project) UpdateRecordingGain(id string, gainDB float64) {
	for _, r := range p.Recordings {
		if r.ID == id {
			r.GainDB = math.Max(-12.0, math.Min(12.0, gainDB))
			break
		}
	}
	p.UpdatedAt = time.Now()
}

func (p *Project) GetRecordingsForCharacter(characterID string) []*Recording {
	recordings := make([]*Recording, 0)
	for _, r := range p.Recordings {
		if r.CharacterID == characterID {
			recordings = append(recordings, r)
		}
	}
	return recordings
}

func (p *Project) Save() error {
	projectFile := filepath.Join(p.Path, "project.json")
	data, err := json.MarshalIndent(p, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(projectFile, data, 0644)
}

func LoadProject(path string) (*Project, error) {
	projectFile := filepath.Join(path, "project.json")
	data, err := os.ReadFile(projectFile)
	if err != nil {
		return nil, err
	}
	var project Project
	if err := json.Unmarshal(data, &project); err != nil {
		return nil, err
	}
	return &project, nil
}
