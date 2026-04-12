#!/bin/bash
# CLOUDCODE - Start server + Cloudflare Tunnel
# Uso: ./start-cloudcode.sh

cd "$(dirname "$0")"

# Matar processos anteriores
echo "[CLOUDCODE] Limpando processos anteriores..."
pkill -f "node server.js" 2>/dev/null
pkill -f "cloudflared tunnel" 2>/dev/null
sleep 1

# Iniciar server
echo "[CLOUDCODE] Iniciando server..."
nohup node server.js > /tmp/cloudcode-server.log 2>&1 &
SERVER_PID=$!
sleep 2

# Checar se subiu
if ! lsof -ti :4242 > /dev/null 2>&1; then
  echo "[CLOUDCODE] ERRO: Server nao iniciou. Veja /tmp/cloudcode-server.log"
  exit 1
fi
echo "[CLOUDCODE] Server rodando (PID: $SERVER_PID)"

# Iniciar tunnel
echo "[CLOUDCODE] Iniciando Cloudflare Tunnel..."
cloudflared tunnel --url http://localhost:4242 > /tmp/cloudflared-quick.log 2>&1 &
TUNNEL_PID=$!
sleep 6

# Pegar URL
URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' /tmp/cloudflared-quick.log | head -1)

if [ -z "$URL" ]; then
  echo "[CLOUDCODE] ERRO: Tunnel nao iniciou. Veja /tmp/cloudflared-quick.log"
  exit 1
fi

# Salvar URL
echo "$URL" > /tmp/cloudcode-url.txt

echo ""
echo "=========================================="
echo "  CLOUDCODE - ONLINE"
echo "=========================================="
echo ""
echo "  Local:  http://localhost:4242"
echo "  Remote: $URL"
echo ""
echo "  Abre no iPhone e instala como PWA!"
echo "=========================================="
echo ""
echo "  Para parar: ./stop-cloudcode.sh"
echo ""

# Manter rodando
wait
