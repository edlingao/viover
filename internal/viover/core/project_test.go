package core

import (
	"os"
	"path/filepath"
	"testing"
)

func TestNewProject(t *testing.T) {
	p := NewProject("Test Project", "/tmp/test")
	if p.ID == "" {
		t.Error("Expected project ID to be set")
	}
	if p.Title != "Test Project" {
		t.Errorf("Expected title 'Test Project', got '%s'", p.Title)
	}
	if p.Path != "/tmp/test" {
		t.Errorf("Expected path '/tmp/test', got '%s'", p.Path)
	}
	if len(p.Characters) != 0 {
		t.Error("Expected empty characters slice")
	}
	if len(p.Recordings) != 0 {
		t.Error("Expected empty recordings slice")
	}
}

func TestNewCharacter(t *testing.T) {
	c := NewCharacter("John", "#ff0000")
	if c.ID == "" {
		t.Error("Expected character ID to be set")
	}
	if c.Name != "John" {
		t.Errorf("Expected name 'John', got '%s'", c.Name)
	}
	if c.Color != "#ff0000" {
		t.Errorf("Expected color '#ff0000', got '%s'", c.Color)
	}
}

func TestNewRecording(t *testing.T) {
	r := NewRecording("char-1", "/path/to/file.wav", 10.5, 5.0)
	if r.ID == "" {
		t.Error("Expected recording ID to be set")
	}
	if r.CharacterID != "char-1" {
		t.Errorf("Expected character ID 'char-1', got '%s'", r.CharacterID)
	}
	if r.Timecode != 10.5 {
		t.Errorf("Expected timecode 10.5, got %f", r.Timecode)
	}
	if r.Duration != 5.0 {
		t.Errorf("Expected duration 5.0, got %f", r.Duration)
	}
}

func TestProjectAddCharacter(t *testing.T) {
	p := NewProject("Test", "/tmp")
	c := NewCharacter("Alice", "#00ff00")
	p.AddCharacter(c)
	if len(p.Characters) != 1 {
		t.Errorf("Expected 1 character, got %d", len(p.Characters))
	}
	if p.Characters[0].Name != "Alice" {
		t.Errorf("Expected character name 'Alice', got '%s'", p.Characters[0].Name)
	}
}

func TestProjectRemoveCharacter(t *testing.T) {
	p := NewProject("Test", "/tmp")
	c := NewCharacter("Bob", "#0000ff")
	p.AddCharacter(c)
	r := NewRecording(c.ID, "/path.wav", 0, 1)
	p.AddRecording(r)
	p.RemoveCharacter(c.ID)
	if len(p.Characters) != 0 {
		t.Errorf("Expected 0 characters, got %d", len(p.Characters))
	}
	if len(p.Recordings) != 0 {
		t.Errorf("Expected 0 recordings after character removal, got %d", len(p.Recordings))
	}
}

func TestProjectUpdateCharacter(t *testing.T) {
	p := NewProject("Test", "/tmp")
	c := NewCharacter("Charlie", "#ffffff")
	p.AddCharacter(c)
	p.UpdateCharacter(c.ID, "Charles", "#000000")
	if p.Characters[0].Name != "Charles" {
		t.Errorf("Expected name 'Charles', got '%s'", p.Characters[0].Name)
	}
	if p.Characters[0].Color != "#000000" {
		t.Errorf("Expected color '#000000', got '%s'", p.Characters[0].Color)
	}
}

func TestProjectAddRecording(t *testing.T) {
	p := NewProject("Test", "/tmp")
	r := NewRecording("char-1", "/file.wav", 5.0, 2.0)
	p.AddRecording(r)
	if len(p.Recordings) != 1 {
		t.Errorf("Expected 1 recording, got %d", len(p.Recordings))
	}
}

func TestProjectRemoveRecording(t *testing.T) {
	p := NewProject("Test", "/tmp")
	r := NewRecording("char-1", "/file.wav", 5.0, 2.0)
	p.AddRecording(r)
	p.RemoveRecording(r.ID)
	if len(p.Recordings) != 0 {
		t.Errorf("Expected 0 recordings, got %d", len(p.Recordings))
	}
}

func TestProjectGetRecordingsForCharacter(t *testing.T) {
	p := NewProject("Test", "/tmp")
	r1 := NewRecording("char-1", "/a.wav", 0, 1)
	r2 := NewRecording("char-2", "/b.wav", 1, 1)
	r3 := NewRecording("char-1", "/c.wav", 2, 1)
	p.AddRecording(r1)
	p.AddRecording(r2)
	p.AddRecording(r3)
	recordings := p.GetRecordingsForCharacter("char-1")
	if len(recordings) != 2 {
		t.Errorf("Expected 2 recordings for char-1, got %d", len(recordings))
	}
}

func TestProjectSaveAndLoad(t *testing.T) {
	tmpDir := t.TempDir()
	p := NewProject("Save Test", tmpDir)
	c := NewCharacter("Test Char", "#123456")
	p.AddCharacter(c)
	r := NewRecording(c.ID, "/test.wav", 1.5, 3.0)
	p.AddRecording(r)
	err := p.Save()
	if err != nil {
		t.Fatalf("Failed to save project: %v", err)
	}
	projectFile := filepath.Join(tmpDir, "project.json")
	if _, err := os.Stat(projectFile); os.IsNotExist(err) {
		t.Error("Expected project.json to exist")
	}
	loaded, err := LoadProject(tmpDir)
	if err != nil {
		t.Fatalf("Failed to load project: %v", err)
	}
	if loaded.Title != "Save Test" {
		t.Errorf("Expected title 'Save Test', got '%s'", loaded.Title)
	}
	if len(loaded.Characters) != 1 {
		t.Errorf("Expected 1 character, got %d", len(loaded.Characters))
	}
	if len(loaded.Recordings) != 1 {
		t.Errorf("Expected 1 recording, got %d", len(loaded.Recordings))
	}
}
