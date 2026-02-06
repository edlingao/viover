package core

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"

	"github.com/go-audio/audio"
	"github.com/go-audio/wav"
	"github.com/mewkiz/flac"
	"github.com/mewkiz/flac/frame"
	"github.com/mewkiz/flac/meta"
)

func findFFmpeg() string {
	exe, err := os.Executable()
	if err != nil {
		return "ffmpeg"
	}
	exeDir := filepath.Dir(exe)

	var candidates []string
	if runtime.GOOS == "darwin" {
		candidates = []string{
			filepath.Join(exeDir, "..", "Resources", "ffmpeg"),
			filepath.Join(exeDir, "ffmpeg"),
			filepath.Join(exeDir, "..", "..", "..", "bin", "ffmpeg"),
		}
	} else if runtime.GOOS == "windows" {
		candidates = []string{
			filepath.Join(exeDir, "ffmpeg.exe"),
			filepath.Join(exeDir, "bin", "ffmpeg.exe"),
		}
	} else {
		candidates = []string{
			filepath.Join(exeDir, "ffmpeg"),
			filepath.Join(exeDir, "bin", "ffmpeg"),
		}
	}

	for _, path := range candidates {
		if _, err := os.Stat(path); err == nil {
			return path
		}
	}
	return "ffmpeg"
}

func ExportAudio(src, dst string, format string, volume float64) error {
	switch format {
	case "wav":
		return exportToWAV(src, dst, volume)
	case "mp3":
		return exportToMP3(src, dst, volume)
	case "flac":
		return exportToFLAC(src, dst, volume)
	default:
		return fmt.Errorf("unsupported format: %s", format)
	}
}

func readAndScaleWAV(src string, volume float64) (*audio.IntBuffer, int, error) {
	srcFile, err := os.Open(src)
	if err != nil {
		return nil, 0, err
	}
	defer srcFile.Close()

	decoder := wav.NewDecoder(srcFile)
	if !decoder.IsValidFile() {
		return nil, 0, fmt.Errorf("invalid WAV file: %s", src)
	}

	buf, err := decoder.FullPCMBuffer()
	if err != nil {
		return nil, 0, err
	}

	for i, sample := range buf.Data {
		scaled := float64(sample) * volume
		if scaled > 32767 {
			scaled = 32767
		} else if scaled < -32768 {
			scaled = -32768
		}
		buf.Data[i] = int(scaled)
	}

	return buf, int(decoder.BitDepth), nil
}

func exportToWAV(src, dst string, volume float64) error {
	buf, bitDepth, err := readAndScaleWAV(src, volume)
	if err != nil {
		return err
	}

	dstFile, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer dstFile.Close()

	enc := wav.NewEncoder(dstFile, buf.Format.SampleRate, bitDepth, buf.Format.NumChannels, 1)
	defer enc.Close()

	return enc.Write(buf)
}

func exportToMP3(src, dst string, volume float64) error {
	tmpWav := dst + ".tmp.wav"
	if err := exportToWAV(src, tmpWav, volume); err != nil {
		return err
	}
	defer os.Remove(tmpWav)

	ffmpegPath := findFFmpeg()
	cmd := exec.Command(ffmpegPath, "-y", "-i", tmpWav, "-codec:a", "libmp3lame", "-q:a", "2", dst)
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("ffmpeg error: %w (ffmpeg path: %s)", err, ffmpegPath)
	}
	return nil
}

func exportToFLAC(src, dst string, volume float64) error {
	buf, bitsPerSample, err := readAndScaleWAV(src, volume)
	if err != nil {
		return err
	}

	dstFile, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer dstFile.Close()

	info := &meta.StreamInfo{
		SampleRate:    uint32(buf.Format.SampleRate),
		NChannels:     uint8(buf.Format.NumChannels),
		BitsPerSample: uint8(bitsPerSample),
		NSamples:      uint64(len(buf.Data)),
	}

	enc, err := flac.NewEncoder(dstFile, info)
	if err != nil {
		return err
	}
	defer enc.Close()

	const samplesPerBlock = 4096
	for i := 0; i < len(buf.Data); i += samplesPerBlock {
		end := i + samplesPerBlock
		if end > len(buf.Data) {
			end = len(buf.Data)
		}

		blockSamples := buf.Data[i:end]
		subframes := make([]*frame.Subframe, buf.Format.NumChannels)
		for ch := 0; ch < buf.Format.NumChannels; ch++ {
			samples := make([]int32, len(blockSamples))
			for j, s := range blockSamples {
				samples[j] = int32(s)
			}
			subframes[ch] = &frame.Subframe{
				Samples: samples,
			}
		}

		f := &frame.Frame{
			Subframes: subframes,
		}
		if err := enc.WriteFrame(f); err != nil {
			return err
		}
	}

	return nil
}

func ApplyVolumeToWAV(src, dst string, volume float64) error {
	return exportToWAV(src, dst, volume)
}
