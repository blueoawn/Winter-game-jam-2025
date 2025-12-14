#!/bin/bash
# Audio Conversion Script
# Converts M4A files to MP3 for cross-platform browser compatibility
#
# Prerequisites: ffmpeg must be installed
#   Ubuntu: sudo apt install ffmpeg
#   macOS: brew install ffmpeg
#   Windows: choco install ffmpeg OR download from ffmpeg.org
#
# Usage: bash scripts/convert-audio.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SOUND_EFFECTS_DIR="$PROJECT_DIR/public/assets/SoundEffects"
MUSIC_DIR="$PROJECT_DIR/public/assets/Music"

echo "Audio Conversion Script"
echo "======================"
echo ""

# Check if ffmpeg is installed
if ! command -v ffmpeg &> /dev/null; then
    echo "ERROR: ffmpeg is not installed."
    echo ""
    echo "Install ffmpeg first:"
    echo "  Ubuntu/Debian: sudo apt install ffmpeg"
    echo "  macOS:         brew install ffmpeg"
    echo "  Windows:       choco install ffmpeg"
    exit 1
fi

echo "ffmpeg found: $(which ffmpeg)"
echo ""

convert_m4a_to_mp3() {
    local dir="$1"
    local label="$2"

    echo "Processing $label..."
    echo "Directory: $dir"
    echo ""

    if [ ! -d "$dir" ]; then
        echo "  Directory not found, skipping."
        return
    fi

    local count=0
    for m4a_file in "$dir"/*.m4a; do
        if [ -f "$m4a_file" ]; then
            local basename=$(basename "$m4a_file" .m4a)
            local mp3_file="$dir/$basename.mp3"

            if [ -f "$mp3_file" ]; then
                echo "  [SKIP] $basename.mp3 already exists"
            else
                echo "  [CONVERT] $basename.m4a -> $basename.mp3"
                ffmpeg -i "$m4a_file" -codec:a libmp3lame -qscale:a 2 "$mp3_file" -y -loglevel warning
                if [ $? -eq 0 ]; then
                    echo "           Done!"
                    ((count++))
                else
                    echo "           FAILED!"
                fi
            fi
        fi
    done

    echo "  Converted $count files in $label"
    echo ""
}

# Convert Sound Effects
convert_m4a_to_mp3 "$SOUND_EFFECTS_DIR" "Sound Effects"

# Convert Music
convert_m4a_to_mp3 "$MUSIC_DIR" "Music"

echo "======================"
echo "Conversion complete!"
echo ""
echo "Next steps:"
echo "1. Update src/assets.ts to change .m4a extensions to .mp3"
echo "2. Run 'npm run test:run' to verify all assets are valid"
echo "3. Test in browser with 'npm run dev'"
