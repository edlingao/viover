package core

import (
	"context"
	"fmt"
	"log"
	"math"
	"os"
	"path/filepath"
	"slices"
	"sync"
	"time"

	"github.com/gen2brain/malgo"
	"github.com/go-audio/audio"
	"github.com/go-audio/wav"
	"github.com/google/uuid"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type Microphone struct {
	selectedDevice DeviceInfo
	devices        []DeviceInfo
	filePath       string
	ctx            context.Context
	isRecording    bool
	stopChan       chan struct{}
	mu             sync.Mutex
	vizBuffer      []int16
	vizMu          sync.Mutex
	inputGainDB    float64
	gainMu         sync.RWMutex
}

type DeviceInfo struct {
	DevicesName string         `json:"devices_name"`
	DeviceID    malgo.DeviceID `json:"-"`
	UUID        string         `json:"id"`
}

func NewMicrophone(ctx context.Context) *Microphone {
	mc := &Microphone{
		ctx:      ctx,
		stopChan: make(chan struct{}),
	}
	list := mc.List()
	if len(list) > 0 {
		mc.selectedDevice = list[0]
	}
	return mc
}

func (m *Microphone) SetFilePath(path string) {
	m.filePath = path
}

func (m *Microphone) List() []DeviceInfo {
	devices := make([]DeviceInfo, 0)
	ctx, err := malgo.InitContext(nil, malgo.ContextConfig{}, nil)
	if err != nil {
		return devices
	}
	defer ctx.Uninit()

	infos, err := ctx.Devices(malgo.Capture)
	if err != nil {
		return devices
	}

	for _, info := range infos {
		full, _ := ctx.DeviceInfo(malgo.Capture, info.ID, malgo.Shared)
		uid := uuid.NewString()
		devices = append(devices, DeviceInfo{
			DevicesName: full.Name(),
			DeviceID:    info.ID,
			UUID:        uid,
		})
	}
	m.devices = devices
	return devices
}

func (m *Microphone) SelectDevice(deviceID string) DeviceInfo {
	deviceIndex := slices.IndexFunc(m.devices, func(d DeviceInfo) bool {
		return d.UUID == deviceID
	})
	if deviceIndex == -1 {
		return DeviceInfo{}
	}
	m.selectedDevice = m.devices[deviceIndex]
	return m.selectedDevice
}

func (m *Microphone) GetSelectedDevice() DeviceInfo {
	return m.selectedDevice
}

func (m *Microphone) SetInputGain(gainDB float64) {
	m.gainMu.Lock()
	defer m.gainMu.Unlock()
	m.inputGainDB = math.Max(-12.0, math.Min(12.0, gainDB))
}

func (m *Microphone) GetInputGain() float64 {
	m.gainMu.RLock()
	defer m.gainMu.RUnlock()
	return m.inputGainDB
}

func DBToLinear(db float64) float64 {
	return math.Pow(10, db/20)
}

func (m *Microphone) Record() bool {
	ctx, err := malgo.InitContext(nil, malgo.ContextConfig{}, nil)
	if err != nil {
		return false
	}
	defer ctx.Uninit()

	file, err := os.Create(m.filePath + "/test.wav")
	if err != nil {
		log.Println("Error creating file:", err)
		return false
	}

	enc := wav.NewEncoder(file, 44100, 16, 1, 1)
	defer enc.Close()

	var samples []int16

	onRecvFrames := func(_, inputSamples []byte, frameCount uint32) {
		for i := 0; i < len(inputSamples); i += 2 {
			sample := int16(inputSamples[i]) | int16(inputSamples[i+1])<<8
			samples = append(samples, sample)
		}
	}

	deviceConfig := malgo.DefaultDeviceConfig(malgo.Capture)
	deviceConfig.Capture.Format = malgo.FormatS16
	deviceConfig.Capture.Channels = 1
	deviceConfig.Capture.DeviceID = m.selectedDevice.DeviceID.Pointer()
	deviceConfig.SampleRate = 44100

	callbacks := malgo.DeviceCallbacks{
		Data: onRecvFrames,
	}

	device, err := malgo.InitDevice(ctx.Context, deviceConfig, callbacks)
	if err != nil {
		return false
	}

	device.Start()
	time.Sleep(5 * time.Second)
	device.Stop()

	intBuf := &audio.IntBuffer{
		Data: int16ToInt(samples),
		Format: &audio.Format{
			SampleRate:  44100,
			NumChannels: 1,
		},
	}

	enc.Write(intBuf)
	runtime.EventsEmit(m.ctx, "audio-sample", samples)
	return true
}

func (m *Microphone) RecordToFile(dir, characterID string, timecode float64) (*Recording, error) {
	m.mu.Lock()
	if m.isRecording {
		m.mu.Unlock()
		return nil, fmt.Errorf("already recording")
	}
	m.isRecording = true
	m.stopChan = make(chan struct{})
	m.mu.Unlock()

	ctx, err := malgo.InitContext(nil, malgo.ContextConfig{}, nil)
	if err != nil {
		m.mu.Lock()
		m.isRecording = false
		m.mu.Unlock()
		return nil, err
	}
	defer ctx.Uninit()

	recordingID := uuid.NewString()
	filename := fmt.Sprintf("%s_%d.wav", recordingID[:8], int(timecode*1000))
	filePath := filepath.Join(dir, filename)

	file, err := os.Create(filePath)
	if err != nil {
		m.mu.Lock()
		m.isRecording = false
		m.mu.Unlock()
		return nil, err
	}

	enc := wav.NewEncoder(file, 44100, 16, 1, 1)

	var samples []int16
	var samplesMu sync.Mutex

	m.gainMu.RLock()
	gainLinear := DBToLinear(m.inputGainDB)
	m.gainMu.RUnlock()

	onRecvFrames := func(_, inputSamples []byte, frameCount uint32) {
		samplesMu.Lock()
		for i := 0; i+1 < len(inputSamples); i += 2 {
			sample := int16(inputSamples[i]) | int16(inputSamples[i+1])<<8
			scaled := float64(sample) * gainLinear
			if scaled > 32767 {
				scaled = 32767
			} else if scaled < -32768 {
				scaled = -32768
			}
			samples = append(samples, int16(scaled))
		}
		samplesMu.Unlock()

		m.vizMu.Lock()
		for i := 0; i+1 < len(inputSamples); i += 2 {
			sample := int16(inputSamples[i]) | int16(inputSamples[i+1])<<8
			scaled := float64(sample) * gainLinear
			if scaled > 32767 {
				scaled = 32767
			} else if scaled < -32768 {
				scaled = -32768
			}
			m.vizBuffer = append(m.vizBuffer, int16(scaled))
		}
		if len(m.vizBuffer) > 44100 {
			m.vizBuffer = m.vizBuffer[len(m.vizBuffer)-44100:]
		}
		m.vizMu.Unlock()
	}

	deviceConfig := malgo.DefaultDeviceConfig(malgo.Capture)
	deviceConfig.Capture.Format = malgo.FormatS16
	deviceConfig.Capture.Channels = 1
	deviceConfig.Capture.DeviceID = m.selectedDevice.DeviceID.Pointer()
	deviceConfig.SampleRate = 44100

	callbacks := malgo.DeviceCallbacks{
		Data: onRecvFrames,
	}

	device, err := malgo.InitDevice(ctx.Context, deviceConfig, callbacks)
	if err != nil {
		file.Close()
		os.Remove(filePath)
		m.mu.Lock()
		m.isRecording = false
		m.mu.Unlock()
		return nil, err
	}

	runtime.EventsEmit(m.ctx, "recording-started", characterID)
	device.Start()

	ticker := time.NewTicker(2 * time.Second)
	tickerDone := make(chan struct{})
	go func() {
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				m.vizMu.Lock()
				if len(m.vizBuffer) > 0 {
					vizSamples := m.downsampleForViz(m.vizBuffer, 128)
					runtime.EventsEmit(m.ctx, "audio-sample", vizSamples)
					m.vizBuffer = nil
				}
				m.vizMu.Unlock()
			case <-tickerDone:
				return
			}
		}
	}()

	<-m.stopChan
	close(tickerDone)

	device.Stop()
	time.Sleep(100 * time.Millisecond)

	samplesMu.Lock()
	actualDuration := float64(len(samples)) / 44100.0
	intBuf := &audio.IntBuffer{
		Data: int16ToInt(samples),
		Format: &audio.Format{
			SampleRate:  44100,
			NumChannels: 1,
		},
	}
	samplesMu.Unlock()

	enc.Write(intBuf)
	enc.Close()
	file.Close()

	m.mu.Lock()
	m.isRecording = false
	m.mu.Unlock()

	m.vizMu.Lock()
	m.vizBuffer = nil
	m.vizMu.Unlock()

	runtime.EventsEmit(m.ctx, "recording-stopped", characterID)

	return &Recording{
		ID:          recordingID,
		CharacterID: characterID,
		FilePath:    filePath,
		Timecode:    timecode,
		Duration:    actualDuration,
		Volume:      1.0,
	}, nil
}

func (m *Microphone) StopRecording() {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.isRecording {
		close(m.stopChan)
	}
}

func (m *Microphone) IsRecording() bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.isRecording
}

func (m *Microphone) downsampleForViz(samples []int16, targetLen int) []int {
	if len(samples) <= targetLen {
		result := make([]int, len(samples))
		for i, v := range samples {
			result[i] = int(v)
		}
		return result
	}
	result := make([]int, targetLen)
	step := len(samples) / targetLen
	for i := 0; i < targetLen; i++ {
		start := i * step
		end := start + step
		if end > len(samples) {
			end = len(samples)
		}
		var peak int16
		for j := start; j < end; j++ {
			if samples[j] > peak {
				peak = samples[j]
			} else if -samples[j] > peak {
				peak = -samples[j]
			}
		}
		result[i] = int(peak)
	}
	return result
}

func int16ToInt(data []int16) []int {
	intData := make([]int, len(data))
	for i, v := range data {
		intData[i] = int(v)
	}
	return intData
}

func GetWaveformPeaks(filePath string, numPeaks int) ([]int, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	decoder := wav.NewDecoder(file)
	if !decoder.IsValidFile() {
		return nil, fmt.Errorf("invalid WAV file")
	}

	buf, err := decoder.FullPCMBuffer()
	if err != nil {
		return nil, err
	}

	samples := buf.Data
	if len(samples) == 0 {
		return []int{}, nil
	}

	if numPeaks <= 0 {
		numPeaks = 128
	}

	if len(samples) <= numPeaks {
		result := make([]int, len(samples))
		for i, v := range samples {
			if v < 0 {
				v = -v
			}
			result[i] = v
		}
		return result, nil
	}

	result := make([]int, numPeaks)
	step := len(samples) / numPeaks
	for i := 0; i < numPeaks; i++ {
		start := i * step
		end := start + step
		if end > len(samples) {
			end = len(samples)
		}
		var peak int
		for j := start; j < end; j++ {
			v := samples[j]
			if v < 0 {
				v = -v
			}
			if v > peak {
				peak = v
			}
		}
		result[i] = peak
	}
	return result, nil
}
