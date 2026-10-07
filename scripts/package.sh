#!/bin/bash
# Builds dist/beat-motion-video.zip for uploading in Claude (Customize > Skills > Upload a skill).
set -e
cd "$(dirname "$0")/.."
mkdir -p dist; rm -f dist/beat-motion-video.zip
(cd skills && zip -qr ../dist/beat-motion-video.zip beat-motion-video -x '*/node_modules/*' '*/out/*' '*/stills/*' '*.wav' '.DS_Store')
unzip -l dist/beat-motion-video.zip | tail -1
