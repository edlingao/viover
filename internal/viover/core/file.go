package core

import (
	"log"
	"os"

)

type VideoFile struct {
	Path     string `json:"path"`
	URL      string `json:"url"`
	duration int64  // Duration in seconds
}

func GetVideoFile(path string) *VideoFile {
	file, err := os.Open(path)
	if err != nil {
		log.Println("Error opening video file:", err)
		return &VideoFile{}
	}
	defer file.Close()

	return &VideoFile{
		Path: path,
	}
}

func (m *VideoFile) GetDuration() int64 {
	// Calculate duration logic here
	fileInfo, err := os.Stat(m.Path)
	if err != nil {
		log.Println("Error getting file info:", err)
		return 0
	}

	m.duration = fileInfo.Size() / (1024 * 1024) // Example: size in MB as duration

	return m.duration
}

func (m *VideoFile) GetURL() string {
	return "http://localhost:8080/videos/" + m.Path
}

