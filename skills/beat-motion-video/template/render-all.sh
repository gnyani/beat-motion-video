#!/bin/bash
# Render in N parallel chunks and join them losslessly. Usage: N=2 ./render-all.sh [SUB] [OUT]
# N=2 is safe on 8 GB of RAM; raise it on bigger machines. Long renders: run with nohup ... & and poll.
set -e
SUB=${1:-5}; OUT=${2:-out/silent.mp4}; N=${N:-2}
FPS=$(python3 -c "import json;print(json.load(open('config.json'))['fps'])")
TOTAL=$(python3 -c "import json;c=json.load(open('config.json'));print(round(c['end']*c['fps']))")
mkdir -p out/chunks; rm -f out/chunks/*
for k in $(seq 0 $((N-1))); do
  S=$(python3 -c "print($TOTAL*$k//$N/$FPS)"); E=$(python3 -c "print($TOTAL*($k+1)//$N/$FPS)")
  node render.mjs --sub=$SUB --start=$S --end=$E --port=$((9070+k)) --out=out/chunks/c$k.mp4 > out/chunks/log$k.txt 2>&1 &
done
wait
for k in $(seq 0 $((N-1))); do echo "file 'c$k.mp4'"; done > out/chunks/list.txt
ffmpeg -y -v error -f concat -safe 0 -i out/chunks/list.txt -c copy $OUT
ffprobe -v error -count_frames -show_entries stream=nb_read_frames,r_frame_rate -of csv $OUT
