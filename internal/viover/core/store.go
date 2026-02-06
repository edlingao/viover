package core

import (
	"database/sql"
	"os"
	"path/filepath"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

type ProjectMeta struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	Path      string `json:"path"`
	CreatedAt string `json:"created_at,omitempty"`
	UpdatedAt string `json:"updated_at,omitempty"`
}

type Store struct {
	db *sql.DB
}

func NewStore(configDir string) (*Store, error) {
	if err := os.MkdirAll(configDir, 0755); err != nil {
		return nil, err
	}

	dbPath := filepath.Join(configDir, "viover.db")
	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return nil, err
	}

	store := &Store{db: db}
	if err := store.migrate(); err != nil {
		db.Close()
		return nil, err
	}

	return store, nil
}

func (s *Store) migrate() error {
	schema := `
	CREATE TABLE IF NOT EXISTS projects (
		id TEXT PRIMARY KEY,
		title TEXT NOT NULL,
		path TEXT NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_projects_title ON projects(title);
	CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at);
	`

	_, err := s.db.Exec(schema)
	return err
}

func (s *Store) AddProject(p *Project) error {
	now := time.Now().Format(time.RFC3339)
	_, err := s.db.Exec(
		`INSERT INTO projects (id, title, path, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
		p.ID, p.Title, p.Path, now, now,
	)
	return err
}

func (s *Store) RemoveProject(id string) error {
	_, err := s.db.Exec(`DELETE FROM projects WHERE id = ?`, id)
	return err
}

func (s *Store) UpdateProject(id, title string) error {
	now := time.Now().Format(time.RFC3339)
	_, err := s.db.Exec(
		`UPDATE projects SET title = ?, updated_at = ? WHERE id = ?`,
		title, now, id,
	)
	return err
}

func (s *Store) GetProject(id string) *ProjectMeta {
	row := s.db.QueryRow(`SELECT id, title, path, created_at, updated_at FROM projects WHERE id = ?`, id)
	var p ProjectMeta
	var createdAt, updatedAt sql.NullString
	if err := row.Scan(&p.ID, &p.Title, &p.Path, &createdAt, &updatedAt); err != nil {
		return nil
	}
	if createdAt.Valid {
		p.CreatedAt = createdAt.String
	}
	if updatedAt.Valid {
		p.UpdatedAt = updatedAt.String
	}
	return &p
}

func (s *Store) ListProjects() []ProjectMeta {
	rows, err := s.db.Query(`SELECT id, title, path, created_at, updated_at FROM projects ORDER BY updated_at DESC`)
	if err != nil {
		return []ProjectMeta{}
	}
	defer rows.Close()

	var projects []ProjectMeta
	for rows.Next() {
		var p ProjectMeta
		var createdAt, updatedAt sql.NullString
		if err := rows.Scan(&p.ID, &p.Title, &p.Path, &createdAt, &updatedAt); err != nil {
			continue
		}
		if createdAt.Valid {
			p.CreatedAt = createdAt.String
		}
		if updatedAt.Valid {
			p.UpdatedAt = updatedAt.String
		}
		projects = append(projects, p)
	}
	return projects
}

func (s *Store) Close() error {
	if s.db != nil {
		return s.db.Close()
	}
	return nil
}
