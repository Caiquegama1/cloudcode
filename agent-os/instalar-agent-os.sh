#!/bin/bash
# Instala o "Agent OS" do Caíque no Mac. Seguro para rodar de novo: nunca sobrescreve sem backup.
# Uso: cd agent-os && ./instalar-agent-os.sh            (instala)
#      ./instalar-agent-os.sh --com-briefing             (também agenda o briefing diário via launchd)
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
C="$HOME/.claude"
BRAIN="${BRAIN:-$HOME/Documents/BRAIN}"
BK="$HOME/.agent-os-backup/$(date +%Y%m%d-%H%M%S)"

copiar() { # copiar <origem> <destino>  — faz backup se o destino existir e for diferente
  if [ -e "$2" ] && ! cmp -s "$1" "$2"; then mkdir -p "$BK/$(dirname "${2#$HOME/}")"; cp "$2" "$BK/${2#$HOME/}"; fi
  mkdir -p "$(dirname "$2")"; cp "$1" "$2"
}

echo "▸ 1/5 Claude Code"
if ! command -v claude >/dev/null; then
  echo "  Instalando Claude Code (instalador oficial)..."
  curl -fsSL https://claude.ai/install.sh | bash
fi
claude --version || { echo "  Abra um terminal novo e rode de novo."; exit 1; }

echo "▸ 2/5 Regras, subagentes, skills e hooks em $C"
copiar "$DIR/claude/CLAUDE.md" "$C/CLAUDE.md"
for f in "$DIR"/claude/agents/*.md; do copiar "$f" "$C/agents/$(basename "$f")"; done
for s in retomar fechar; do copiar "$DIR/claude/skills/$s/SKILL.md" "$C/skills/$s/SKILL.md"; done
for h in "$DIR"/claude/hooks/*.sh; do copiar "$h" "$C/hooks/$(basename "$h")"; chmod +x "$C/hooks/$(basename "$h")"; done

if [ -f "$C/settings.json" ]; then
  cp "$DIR/claude/settings.json" "$C/settings.agent-os.json"
  echo "  ⚠ Você já tem settings.json. NÃO sobrescrevi. Junte os blocos 'hooks' e 'permissions'"
  echo "    de $C/settings.agent-os.json no seu settings.json (ou peça ao Claude: /update-config)."
else
  cp "$DIR/claude/settings.json" "$C/settings.json"
fi

echo "▸ 3/5 BRAIN em $BRAIN (só cria o que falta)"
mkdir -p "$BRAIN"/{contexto,projetos,diario,fontes/videos,agentes/logs}
for f in fila.md progresso.md; do [ -f "$BRAIN/agentes/$f" ] || cp "$DIR/brain-modelo/agentes/$f" "$BRAIN/agentes/$f"; done
[ -f "$BRAIN/indice.md" ] || printf "# Índice do BRAIN\n\n- contexto/PROTOCOLO.md — regras\n- projetos/ — uma ficha por projeto\n- agentes/fila.md — tarefas\n- agentes/progresso.md — estado atual\n" > "$BRAIN/indice.md"
[ -f "$BRAIN/contexto/PROTOCOLO.md" ] || printf "# PROTOCOLO\n\n(preencha: como você trabalha, prioridades, o que agentes podem fazer sozinhos)\n" > "$BRAIN/contexto/PROTOCOLO.md"

echo "▸ 4/5 Loops em ~/.agent-os"
mkdir -p "$HOME/.agent-os/loops"
cp "$DIR"/loops/*.sh "$DIR/0-transcrever-video.sh" "$HOME/.agent-os/loops/"
chmod +x "$HOME"/.agent-os/loops/*.sh

echo "▸ 5/5 Agendamento"
if [ "${1:-}" = "--com-briefing" ]; then
  P="$HOME/Library/LaunchAgents/com.caique.briefing.plist"
  sed "s#__HOME__#$HOME#g" "$DIR/launchd/com.caique.briefing.plist" > "$P"
  launchctl bootout "gui/$(id -u)" "$P" 2>/dev/null || true
  launchctl bootstrap "gui/$(id -u)" "$P"
  echo "  Briefing agendado (seg–sex 7h47). Teste agora: launchctl kickstart gui/$(id -u)/com.caique.briefing"
else
  echo "  Pulado (rode com --com-briefing para agendar)."
fi

[ -d "$BK" ] && echo "Backup dos arquivos substituídos: $BK"
echo "✓ Instalado (configurado, ainda não testado). Teste: cd $BRAIN && claude  →  digite /retomar"
