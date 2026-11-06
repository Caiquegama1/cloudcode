#!/bin/bash
# Loop de agente (estilo "Ralph"): uma tarefa da fila por volta, com verificação e limite.
# Uso: ./loop-fila.sh [max_voltas]   (padrão 3)
# Para parar a qualquer momento: crie o arquivo ~/Documents/BRAIN/agentes/PARAR
set -uo pipefail

BRAIN="${BRAIN:-$HOME/Documents/BRAIN}"
MAX="${1:-3}"
LOG="$BRAIN/agentes/logs"; mkdir -p "$LOG"
TIMEOUT=1800   # 30 min por volta

PROMPT='Você está rodando em loop sem supervisão.
1. Leia ~/Documents/BRAIN/agentes/fila.md e pegue a PRIMEIRA tarefa "- [ ]".
   Se não houver, responda exatamente FILA_VAZIA e pare.
2. Leia o PROTOCOLO e a ficha do projeto da tarefa. Respeite conta/ambiente.
3. Execute só essa tarefa. Nada externo (e-mail, deploy, post, pagamento): se precisar, registre como pendente e pare.
4. Peça ao subagente verificador para checar contra o critério "pronto quando".
5. Só se APROVADO, marque [x] na fila. Em qualquer caso, registre em agentes/progresso.md no formato da skill /fechar.'

for i in $(seq 1 "$MAX"); do
  [ -f "$BRAIN/agentes/PARAR" ] && { echo "PARAR encontrado. Saindo."; break; }
  STAMP=$(date '+%Y%m%d-%H%M%S')
  echo "▸ Volta $i/$MAX — log: $LOG/$STAMP.json"
  cd "$BRAIN"
  # perl alarm = timeout nativo do macOS (sem instalar coreutils)
  perl -e 'alarm shift; exec @ARGV' "$TIMEOUT" \
    claude -p "$PROMPT" \
      --permission-mode acceptEdits \
      --allowedTools "Read,Edit,Write,Grep,Glob,Task,Bash(git *),Bash(ls *)" \
      --output-format json > "$LOG/$STAMP.json" 2>&1
  grep -q "FILA_VAZIA" "$LOG/$STAMP.json" && { echo "Fila vazia."; break; }
done
echo "✓ Loop terminou. Veja $BRAIN/agentes/progresso.md"
