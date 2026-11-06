#!/bin/bash
# Hook SessionStart: o que este script imprime entra no contexto da sessão.
# Mantém curto (contexto é orçamento): só o estado atual, não o histórico.
BRAIN="${BRAIN:-$HOME/Documents/BRAIN}"
echo "BRAIN: $BRAIN — data de hoje: $(date '+%Y-%m-%d %H:%M')"
if [ -f "$BRAIN/agentes/progresso.md" ]; then
  echo "--- Últimas entradas de agentes/progresso.md ---"
  tail -n 25 "$BRAIN/agentes/progresso.md"
fi
if [ -f "$BRAIN/agentes/fila.md" ]; then
  echo "--- Tarefas abertas (agentes/fila.md) ---"
  grep -E '^\s*- \[ \]' "$BRAIN/agentes/fila.md" | head -n 10
fi
exit 0
