# Audio Conversion Script (PowerShell)
# Converts M4A files to MP3 for cross-platform browser compatibility
#
# Prerequisites: ffmpeg must be installed and in PATH
#   Windows: choco install ffmpeg OR download from https://ffmpeg.org/download.html
#
# Usage: powershell -ExecutionPolicy Bypass -File scripts\convert-audio.ps1

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Split-Path -Parent $ScriptDir
$SoundEffectsDir = Join-Path $ProjectDir "MultiPlayerClient\public\assets\SoundEffects"
$MusicDir = Join-Path $ProjectDir "MultiPlayerClient\public\assets\Music"

Write-Host "Audio Conversion Script" -ForegroundColor Cyan
Write-Host "======================" -ForegroundColor Cyan
Write-Host ""

# Check if ffmpeg is installed
$ffmpeg = Get-Command ffmpeg -ErrorAction SilentlyContinue
if (-not $ffmpeg) {
    Write-Host "ERROR: ffmpeg is not installed or not in PATH." -ForegroundColor Red
    Write-Host ""
    Write-Host "Install ffmpeg first:"
    Write-Host "  1. Download from https://ffmpeg.org/download.html"
    Write-Host "  2. Extract to a folder (e.g., C:\ffmpeg)"
    Write-Host "  3. Add the bin folder to your PATH environment variable"
    Write-Host "  OR use: choco install ffmpeg"
    exit 1
}

Write-Host "ffmpeg found: $($ffmpeg.Source)"
Write-Host ""

function Convert-M4AToMP3 {
    param (
        [string]$Dir,
        [string]$Label
    )

    Write-Host "Processing $Label..." -ForegroundColor Yellow
    Write-Host "Directory: $Dir"
    Write-Host ""

    if (-not (Test-Path $Dir)) {
        Write-Host "  Directory not found, skipping." -ForegroundColor Gray
        return
    }

    $count = 0
    $m4aFiles = Get-ChildItem -Path $Dir -Filter "*.m4a" -ErrorAction SilentlyContinue

    foreach ($m4aFile in $m4aFiles) {
        $basename = [System.IO.Path]::GetFileNameWithoutExtension($m4aFile.Name)
        $mp3File = Join-Path $Dir "$basename.mp3"

        if (Test-Path $mp3File) {
            Write-Host "  [SKIP] $basename.mp3 already exists" -ForegroundColor Gray
        } else {
            Write-Host "  [CONVERT] $($m4aFile.Name) -> $basename.mp3" -ForegroundColor Green
            $result = & ffmpeg -i $m4aFile.FullName -codec:a libmp3lame -qscale:a 2 $mp3File -y -loglevel warning 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Host "           Done!" -ForegroundColor Green
                $count++
            } else {
                Write-Host "           FAILED!" -ForegroundColor Red
                Write-Host $result
            }
        }
    }

    Write-Host "  Converted $count files in $Label"
    Write-Host ""
}

# Convert Sound Effects
Convert-M4AToMP3 -Dir $SoundEffectsDir -Label "Sound Effects"

# Convert Music
Convert-M4AToMP3 -Dir $MusicDir -Label "Music"

Write-Host "======================" -ForegroundColor Cyan
Write-Host "Conversion complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Update src/assets.ts to change .m4a extensions to .mp3"
Write-Host "2. Run 'npm run test:run' to verify all assets are valid"
Write-Host "3. Test in browser with 'npm run dev'"
