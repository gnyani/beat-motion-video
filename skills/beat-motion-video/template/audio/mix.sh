#!/bin/bash
# Mix music (optional) + SFX, then two-pass loudnorm to -14 LUFS with true peak under -1 dBFS after AAC.
# Music comes from config.json: music.file (path), music.offset (seconds into the track so its downbeats land on
# the film's bar(0)), music.fadeOut. Leave music.file empty for an SFX-only mix.
# Only use music you are licensed to use in ads and social posts. Never commit or share the music file.
set -e
read END FILE OFF FADE <<< $(python3 -c "import json;c=json.load(open('config.json'));m=c['music'];print(c['end'],m['file'] or '-',m['offset'],m['fadeOut'])")
python3 audio/sfx.py
FS=$(python3 -c "print($END-$FADE)")
if [ "$FILE" != "-" ]; then
  ffmpeg -y -v error -ss $OFF -t $END -i "$FILE" -i audio/sfx.wav -filter_complex \
   "[0:a]aresample=48000,afade=t=in:d=0.008,afade=t=out:st=$FS:d=$FADE,volume=0.9[m];[1:a]atrim=0:$END[s];[m][s]amix=inputs=2:normalize=0,aresample=192000,alimiter=limit=0.5:attack=3:release=60:level=false,aresample=48000[mix]" \
   -map "[mix]" -c:a pcm_s16le audio/premix.wav
else
  ffmpeg -y -v error -i audio/sfx.wav -af "atrim=0:$END,aresample=48000" -c:a pcm_s16le audio/premix.wav
fi
J=$(ffmpeg -hide_banner -i audio/premix.wav -af loudnorm=I=-14:TP=-2.5:LRA=11:print_format=json -f null - 2>&1 | sed -n '/{/,/}/p')
read II TP LRA TH OFFS <<< $(echo "$J" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d['input_i'],d['input_tp'],d['input_lra'],d['input_thresh'],d['target_offset'])")
ffmpeg -y -v error -i audio/premix.wav -af "loudnorm=I=-14:TP=-2.5:LRA=11:measured_I=$II:measured_TP=$TP:measured_LRA=$LRA:measured_thresh=$TH:offset=$OFFS:linear=true,aresample=192000,alimiter=limit=0.708:attack=1:release=60:level=false,aresample=48000" -c:a pcm_s16le audio/final.wav
ffmpeg -hide_banner -i audio/final.wav -af ebur128=peak=true -f null - 2>&1 | grep -E "^\s+(I|Peak):"
