package core

import (
	"testing"
)

func TestNewStore(t *testing.T) {
	tmpDir := t.TempDir()
	store, err := NewStore(tmpDir)
	if err != nil {
		t.Fatalf("Failed to create store: %v", err)
	}
	defer store.Close()
	if store == nil {
		t.Error("Expected store to be created")
	}
	projects := store.ListProjects()
	if len(projects) != 0 {
		t.Errorf("Expected empty projects, got %d", len(projects))
	}
}

func TestStoreAddProject(t *testing.T) {
	tmpDir := t.TempDir()
	store, _ := NewStore(tmpDir)
	defer store.Close()
	p := NewProject("Test Project", "/tmp/test")
	err := store.AddProject(p)
	if err != nil {
		t.Fatalf("Failed to add project: %v", err)
	}
	projects := store.ListProjects()
	if len(projects) != 1 {
		t.Errorf("Expected 1 project, got %d", len(projects))
	}
	if projects[0].Title != "Test Project" {
		t.Errorf("Expected title 'Test Project', got '%s'", projects[0].Title)
	}
}

func TestStoreGetProject(t *testing.T) {
	tmpDir := t.TempDir()
	store, _ := NewStore(tmpDir)
	defer store.Close()
	p := NewProject("Find Me", "/tmp/find")
	store.AddProject(p)
	found := store.GetProject(p.ID)
	if found == nil {
		t.Error("Expected to find project")
	}
	if found.Title != "Find Me" {
		t.Errorf("Expected title 'Find Me', got '%s'", found.Title)
	}
	notFound := store.GetProject("non-existent")
	if notFound != nil {
		t.Error("Expected nil for non-existent project")
	}
}

func TestStoreRemoveProject(t *testing.T) {
	tmpDir := t.TempDir()
	store, _ := NewStore(tmpDir)
	defer store.Close()
	p := NewProject("Remove Me", "/tmp/remove")
	store.AddProject(p)
	err := store.RemoveProject(p.ID)
	if err != nil {
		t.Fatalf("Failed to remove project: %v", err)
	}
	projects := store.ListProjects()
	if len(projects) != 0 {
		t.Errorf("Expected 0 projects, got %d", len(projects))
	}
}

func TestStoreUpdateProject(t *testing.T) {
	tmpDir := t.TempDir()
	store, _ := NewStore(tmpDir)
	defer store.Close()
	p := NewProject("Original", "/tmp/orig")
	store.AddProject(p)
	err := store.UpdateProject(p.ID, "Updated")
	if err != nil {
		t.Fatalf("Failed to update project: %v", err)
	}
	found := store.GetProject(p.ID)
	if found.Title != "Updated" {
		t.Errorf("Expected title 'Updated', got '%s'", found.Title)
	}
}

func TestStoreListProjects(t *testing.T) {
	tmpDir := t.TempDir()
	store, _ := NewStore(tmpDir)
	defer store.Close()
	store.AddProject(NewProject("A", "/a"))
	store.AddProject(NewProject("B", "/b"))
	store.AddProject(NewProject("C", "/c"))
	list := store.ListProjects()
	if len(list) != 3 {
		t.Errorf("Expected 3 projects, got %d", len(list))
	}
}

func TestStorePersistence(t *testing.T) {
	tmpDir := t.TempDir()
	store1, _ := NewStore(tmpDir)
	p := NewProject("Persist", "/tmp/persist")
	store1.AddProject(p)
	store1.Close()

	store2, err := NewStore(tmpDir)
	if err != nil {
		t.Fatalf("Failed to reload store: %v", err)
	}
	defer store2.Close()
	projects := store2.ListProjects()
	if len(projects) != 1 {
		t.Errorf("Expected 1 project after reload, got %d", len(projects))
	}
	if projects[0].Title != "Persist" {
		t.Errorf("Expected title 'Persist', got '%s'", projects[0].Title)
	}
}
