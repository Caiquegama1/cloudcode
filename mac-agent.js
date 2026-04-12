/**
 * MAC AGENT — CLOUDCODE Remote Control
 * Roda localmente no Mac, conecta ao servidor CLOUDCODE via WebSocket
 * e executa comandos enviados pelo chat.
 *
 * Uso:
 *   node mac-agent.js
 *
 * Variáveis de ambiente (opcional):
 *   MAC_AGENT_TOKEN=meu-token-secreto
 *   CLOUDCODE_WS_URL=ws://localhost:4242
 */

'use strict';

const { exec, spawn } = require('child_process');
const WebSocket = require('ws');
const os = require('os');

// ═══ CONFIGURAÇÃO ═══
const WS_URL     = process.env.CLOUDCODE_WS_URL  || 'ws://localhost:4242';
const TOKEN      = process.env.MAC_AGENT_TOKEN    || 'soma-mac-agent-token';
const AGENT_ID   = `mac-agent-${os.hostname().split('.')[0]}`;
const RECONNECT_MS = 4000;

let ws = null;
let connected = false;

// ═══ COMANDOS PERMITIDOS (whitelist de prefixos) ═══
const ALLOWED_PREFIXES = [
  'open ',       // abrir apps: open -a 'Figma'
  'osascript',   // AppleScript
  'say ',        // text-to-speech
  'cd ',         // mudar diretório (limitado)
  'ls',          // listar
  'echo ',       // echo
  'npm ',        // npm scripts
  'node ',       // node scripts
  'python3 ',    // python
  'git ',        // git
  'curl ',       // curl (limitado)
  'pbcopy',      // clipboard
  'pbpaste',     // clipboard
  'screencapture', // screenshot
];

// Comandos sempre bloqueados
const BLOCKED_PATTERNS = [
  /rm\s+-rf/i,
  /sudo\s+rm/i,
  /mkfs/i,
  /dd\s+if=/i,
  /format/i,
  /diskutil\s+erase/i,
  /shutdown/i,
  /reboot/i,
  />/,              // redirecionamento de output para arquivos (segurança)
  /\|.*rm/i,
];

function isAllowed(cmd) {
  if (!cmd || typeof cmd !== 'string') return false;
  const trimmed = cmd.trim().toLowerCase();

  // Checar padrões bloqueados
  for (const pat of BLOCKED_PATTERNS) {
    if (pat.test(trimmed)) return false;
  }

  // Checar whitelist
  for (const prefix of ALLOWED_PREFIXES) {
    if (trimmed.startsWith(prefix.toLowerCase()) || trimmed === prefix.trim()) {
      return true;
    }
  }
  return false;
}

function execCommand(cmd, timeout = 15000) {
  return new Promise((resolve) => {
    const proc = exec(cmd, { timeout, maxBuffer: 1024 * 256 }, (err, stdout, stderr) => {
      if (err) {
        resolve({ ok: false, error: err.message, stdout, stderr });
      } else {
        resolve({ ok: true, stdout: stdout.trim(), stderr: stderr.trim() });
      }
    });
    // Safety: kill if timeout exceeded
    setTimeout(() => {
      try { proc.kill(); } catch {}
    }, timeout + 500);
  });
}

function send(obj) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    try { ws.send(JSON.stringify(obj)); } catch {}
  }
}

function connect() {
  if (ws) {
    try { ws.terminate(); } catch {}
  }

  console.log(`[MAC AGENT] Conectando em ${WS_URL}/mac-agent ...`);

  try {
    ws = new WebSocket(`${WS_URL}/mac-agent`, {
      headers: { 'x-mac-agent-token': TOKEN, 'x-agent-id': AGENT_ID },
    });
  } catch (e) {
    console.error('[MAC AGENT] Falha ao criar WebSocket:', e.message);
    scheduleReconnect();
    return;
  }

  ws.on('open', () => {
    connected = true;
    console.log(`[MAC AGENT] Conectado como "${AGENT_ID}"`);
    send({ type: 'handshake', agentId: AGENT_ID, platform: process.platform, hostname: os.hostname() });
  });

  ws.on('message', async (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    if (msg.type === 'ping') {
      send({ type: 'pong' });
      return;
    }

    if (msg.type === 'execute') {
      const { command, requestId } = msg;
      console.log(`[MAC AGENT] Executando: ${command}`);

      if (!isAllowed(command)) {
        send({ type: 'result', requestId, ok: false, error: `Comando bloqueado por segurança: "${command}"` });
        return;
      }

      send({ type: 'executing', requestId, command });
      const result = await execCommand(command);
      send({ type: 'result', requestId, ...result, command });
    }
  });

  ws.on('close', (code) => {
    connected = false;
    console.log(`[MAC AGENT] Desconectado (${code}). Reconectando em ${RECONNECT_MS}ms...`);
    scheduleReconnect();
  });

  ws.on('error', (err) => {
    if (err.code !== 'ECONNREFUSED') {
      console.error('[MAC AGENT] Erro WebSocket:', err.message);
    }
  });
}

function scheduleReconnect() {
  setTimeout(connect, RECONNECT_MS);
}

// ═══ INICIAR ═══
console.log(`[MAC AGENT] Iniciando — ${AGENT_ID}`);
console.log(`[MAC AGENT] Token: ${TOKEN}`);
console.log(`[MAC AGENT] Servidor: ${WS_URL}`);
connect();
