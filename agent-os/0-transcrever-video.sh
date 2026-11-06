#!/bin/bash
# Transcreve um vídeo do YouTube NO SEU MAC (uso pessoal).
# 1º tenta a legenda do próprio YouTube (rápido). Se não houver, baixa só o áudio e usa Whisper local (Apple Silicon).
# Uso: ./0-transcrever-video.sh "https://www.youtube.com/watch?v=EzcXGtjNm5E"
set -euo pipefail

URL="${1:?Passe a URL do vídeo}"
OUT="${BRAIN:-$HOME/Documents/BRAIN}/fontes/videos"
mkdir -p "$OUT"
cd "$OUT"

command -v brew >/dev/null || { echo "Instale o Homebrew: https://brew.sh"; exit 1; }
command -v yt-dlp >/dev/null || brew install yt-dlp
command -v ffmpeg  >/dev/null || brew install ffmpeg

ID=$(yt-dlp --get-id "$URL")
echo "▸ Vídeo $ID — tentando legenda do YouTube..."
yt-dlp --skip-download --write-auto-subs --write-subs --sub-langs "pt.*" \
       --convert-subs srt -o "$ID" "$URL" || true

SRT=$(ls "$ID"*.srt 2>/dev/null | head -1 || true)
if [ -n "$SRT" ]; then
  # limpa numeração/tempos e linhas repetidas da legenda automática
  grep -vE '^[0-9]+$|-->|^\s*$' "$SRT" | awk '!seen[$0]++' > "$ID.txt"
else
  echo "▸ Sem legenda. Baixando áudio e transcrevendo com Whisper local..."
  yt-dlp -x --audio-format mp3 -o "$ID.%(ext)s" "$URL"
  VENV="$HOME/.venvs/whisper"
  [ -d "$VENV" ] || python3 -m venv "$VENV"
  "$VENV/bin/pip" install -q --upgrade mlx-whisper
  "$VENV/bin/mlx_whisper" "$ID.mp3" --model mlx-community/whisper-large-v3-turbo \
       --language pt --output-format txt --output-dir .
fi

echo "✓ Transcrição: $OUT/$ID.txt"
echo "Próximo passo: abra o Claude Code e peça:"
echo "  claude \"Leia $OUT/$ID.txt e gere $OUT/$ID-resumo.md com conceitos, passos e ferramentas citadas\""
