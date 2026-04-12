#!/bin/bash
# ═══════════════════════════════════════════
# CLOUDCODE — Instalação
# ═══════════════════════════════════════════

echo ""
echo "  ▸ Instalando dependências..."
npm install --silent

echo "  ▸ Pronto! Iniciando CLOUDCODE..."
echo ""
node server.js &

sleep 1
open http://localhost:4242

echo ""
echo "  CLOUDCODE rodando em http://localhost:4242"
echo "  Para parar: Ctrl+C"
echo ""
wait
