#!/bin/bash
# Briefing diário (somente leitura): lê o BRAIN e escreve o plano do dia. Não executa nada externo.
BRAIN="${BRAIN:-$HOME/Documents/BRAIN}"
OUT="$BRAIN/diario/$(date +%F)-briefing.md"
mkdir -p "$BRAIN/diario"
cd "$BRAIN" || exit 1
perl -e 'alarm shift; exec @ARGV' 900 \
  claude -p "Leia contexto/PROTOCOLO.md, indice.md, agentes/progresso.md e agentes/fila.md.
Escreva em pt-BR, até 15 linhas: (1) onde cada projeto parou, (2) 3 prioridades de hoje com a conta correta,
(3) a primeira ação de 2–5 minutos. Não invente; marque o que não tiver evidência." \
  --allowedTools "Read,Grep,Glob" --output-format text > "$OUT" 2>&1
echo "✓ $OUT"
