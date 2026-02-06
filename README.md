# Viover

Desktop application for recording character voices for videos. Built with Wails (Go + SolidJS) featuring a Frutiger Aero-inspired design.

## Features

- **Project Management**: Create, edit, and delete projects with SQLite storage
- **Video Support**: Import videos (MP4, AVI, MKV, MOV, WebM) with playback controls
- **Character Tracks**: Add characters with custom names and colors
- **Audio Recording**: Record voice lines at specific timecodes for each character
- **Timeline**: Visual timeline with character tracks and recording markers
- **Export**: Export recordings to WAV, MP3, or FLAC formats
- **Keyboard Shortcuts**: Full keyboard navigation support
- **Modern UI**: Frutiger Aero style with glassmorphism effects and Nunito font

## Requirements

- Go 1.23+
- Node.js 18+
- pnpm
- Wails CLI v2

### Install Wails CLI

```bash
go install github.com/wailsapp/wails/v2/cmd/wails@latest
```

## Development

### Run in Development Mode

```bash
wails dev
```

### Build for Production

```bash
wails build
```

The built application will be in the `build/bin` directory.

### Run Tests

```bash
go test ./... -v
```

## Usage

### Creating a Project

1. Launch the application
2. Enter a project name and click "Create"
3. Select a folder where the project files will be stored

### Adding a Video

1. Open a project
2. Click on the video area or wait for the drop zone
3. Select a video file - it will be copied to the project folder

### Recording Character Voices

1. Add a character using the "+ Character" button or press `C`
2. Select the character by clicking on their row in the timeline or use `Up/Down` arrows
3. Position the playhead at the desired timecode
4. Select your microphone from the dropdown
5. Click "Record" or press `R` to start recording
6. Click "Stop" or press `R` again to finish

### Timeline Controls

- **Scroll**: Mouse wheel to zoom in/out
- **Shift+Scroll**: Horizontal scroll
- **Click**: Click on the timeline or ruler to seek
- **Drag**: Drag the playhead to scrub through the video

### Editing Characters

- Double-click character name to rename
- Click the color dot to change track color
- Select a character and click the X to delete

### Exporting

1. Click the "Export" button in the header
2. Select format (WAV, MP3, or FLAC)
3. Choose an export location
4. Files will be named with character name and timecode

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Space | Play/Pause video |
| R | Start/Stop recording (when character selected) |
| C | Add new character |
| Left Arrow | Seek back 5 seconds |
| Right Arrow | Seek forward 5 seconds |
| Shift + Left | Seek back 1 second |
| Shift + Right | Seek forward 1 second |
| Up Arrow | Select previous character |
| Down Arrow | Select next character |
| Home | Go to start |
| End | Go to end |
| ? | Toggle shortcuts help |
| Escape | Close menus/dialogs |

## Project Structure

```
viover/
├── main.go                    # Application entry point
├── config/                    # Wails configuration
├── internal/viover/
│   ├── adapters/              # Wails bindings (App.go)
│   └── core/                  # Domain models and business logic
│       ├── project.go         # Project, Character, Recording models
│       ├── store.go           # SQLite storage
│       └── microphone.go      # Audio recording
├── web/
│   └── app/                   # SolidJS frontend
│       └── src/
│           ├── App.tsx        # Main app component
│           ├── css/main.css   # Frutiger Aero styles
│           └── components/    # UI components
└── wails.json                 # Wails project config
```

## Data Storage

Project metadata is stored in SQLite at:
- macOS: `~/Library/Application Support/viover/viover.db`
- Windows: `%APPDATA%/viover/viover.db`
- Linux: `~/.config/viover/viover.db`

Project files (videos, recordings) are stored in the user-selected project directory.

## License

MIT
