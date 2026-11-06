#!/bin/bash
# Hook PreToolUse (Bash): bloqueia comandos perigosos ou que expõem segredos.
# Exit 2 = bloqueia; a mensagem em stderr volta para o Claude como motivo.
INPUT=$(cat)

bloquear() { echo "Bloqueado pelo guarda: $1. Peça confirmação ao Caíque." >&2; exit 2; }

echo "$INPUT" | grep -qE 'rm -rf (/|~|\$HOME)([" ]|$)'             && bloquear "rm -rf em pasta raiz/home"
echo "$INPUT" | grep -qE 'git push[^"]*(--force|-f)( |")'          && bloquear "push forçado"
echo "$INPUT" | grep -qE 'security (find|dump)-(generic|internet)-password|dump-keychain' && bloquear "leitura do Keychain"
echo "$INPUT" | grep -qE '(cat|less|head|tail|cp|curl)[^"]*\.env([" ]|$)' && bloquear "leitura/envio de .env"
echo "$INPUT" | grep -qE 'sk-ant-[A-Za-z0-9_-]{10,}|ghp_[A-Za-z0-9]{20,}' && bloquear "segredo em texto no comando"
exit 0
