#!/bin/bash
# Post-build script to bundle ffmpeg into the macOS .app

APP_PATH="$1"
if [ -z "$APP_PATH" ]; then
    echo "Usage: bundle-ffmpeg.sh <path-to-app>"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FFMPEG_SRC="$PROJECT_ROOT/bin/ffmpeg"
FFMPEG_DST="$APP_PATH/Contents/Resources/ffmpeg"

if [ ! -f "$FFMPEG_SRC" ]; then
    echo "Error: ffmpeg not found at $FFMPEG_SRC"
    exit 1
fi

echo "Copying ffmpeg to $FFMPEG_DST"
cp "$FFMPEG_SRC" "$FFMPEG_DST"
chmod +x "$FFMPEG_DST"
echo "Done bundling ffmpeg"
