#!/bin/zsh
# CLOUDCODE — Shell wrapper pro Claude Code CLI
# Resolve problemas de file descriptor/signal handling
# quando spawned direto do Electron via child_process

# Carregar ambiente completo do shell
source ~/.zshrc 2>/dev/null || true
source ~/.zprofile 2>/dev/null || true

# Inicializar NVM se disponível
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh" 2>/dev/null || true

# Garantir PATH inclui locais comuns do claude + NVM
NVM_NODE_BIN=$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null | tail -1)
export PATH="/usr/local/bin:/opt/homebrew/bin:$HOME/.npm-global/bin:$HOME/.local/bin:${NVM_NODE_BIN}:$PATH"

# Encontrar o binário do claude
CLAUDE_BIN=""
if command -v claude &>/dev/null; then
  CLAUDE_BIN="$(command -v claude)"
elif [ -f "/usr/local/bin/claude" ]; then
  CLAUDE_BIN="/usr/local/bin/claude"
elif [ -f "/opt/homebrew/bin/claude" ]; then
  CLAUDE_BIN="/opt/homebrew/bin/claude"
fi

if [ -z "$CLAUDE_BIN" ]; then
  echo '{"type":"error","error":"Claude Code CLI não encontrado no sistema"}' >&2
  exit 1
fi

# Executar claude com todos os argumentos passados
exec "$CLAUDE_BIN" "$@"
