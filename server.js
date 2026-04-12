const express = require('express');
const WebSocket = require('ws');
const pty = require('node-pty');
const http = require('http');
const path = require('path');
const os = require('os');
const fs = require('fs');
const multer = require('multer');
const { execFile, spawn } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

// ═══ GLOBAL ERROR HANDLERS — previne crash silencioso ═══
process.on('uncaughtException', (err) => {
  console.error('[CLOUDCODE] Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[CLOUDCODE] Unhandled Rejection:', reason);
});

// Load .env from dev root or packaged resources
const envCandidates = [
  path.join(__dirname, '.env'),
  process.resourcesPath ? path.join(process.resourcesPath, '.env') : null,
  path.join(path.dirname(process.execPath), '.env'),
].filter(Boolean);

for (const envPath of envCandidates) {
  if (!fs.existsSync(envPath)) continue;

  fs.readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
    const [key, ...val] = line.split('=');
    if (key && val.length) process.env[key.trim()] = val.join('=').trim();
  });

  break;
}

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// ═══ MAC AGENT STATE ═══
const MAC_AGENT_TOKEN = process.env.MAC_AGENT_TOKEN || 'soma-mac-agent-token';
let macClient = null;
let macAgentInfo = {};
const macPendingRequests = {};

// ═══ COMMAND QUEUE (aprovação antes de execução) ═══
const CMD_WHITELIST = ['open', 'cd', 'ls', 'node', 'npm', 'cat', 'echo', 'pwd', 'which', 'env', 'git', 'python', 'python3', 'brew', 'curl'];
const CMD_BLACKLIST = ['rm', 'sudo', 'chmod', 'chown', 'shutdown', 'reboot', 'mkfs', 'dd', 'kill', 'pkill', 'mv /'];
const pendingCommands = {};   // id → { id, command, status, createdAt, resolve, reject, timer }
const executedCommands = [];  // log histórico

function generateCmdId() {
  return `cmd_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function isCommandSafe(cmd) {
  const lower = cmd.trim().toLowerCase();
  // Blacklist: rejeitar imediatamente
  for (const bad of CMD_BLACKLIST) {
    if (lower.startsWith(bad) || lower.includes(` ${bad} `) || lower.includes(`;${bad}`) || lower.includes(`&&${bad}`)) {
      return { safe: false, reason: `Comando bloqueado: "${bad}"` };
    }
  }
  // Whitelist: pelo menos um prefixo deve bater
  const firstWord = lower.split(/\s+/)[0];
  if (!CMD_WHITELIST.includes(firstWord)) {
    return { safe: false, reason: `"${firstWord}" não está na whitelist de comandos permitidos` };
  }
  return { safe: true };
}

const UPLOAD_DIR = path.join(os.tmpdir(), 'cloudcode-uploads');
const DATA_DIR = path.join(__dirname, 'data');
const CLIENTS_FILE = path.join(DATA_DIR, 'clients.json');
const MAX_TREE_ITEMS = 2500;
const MAX_FILE_RESULTS = 4000;
const MAX_SEARCH_RESULTS = 200;
const MAX_FILE_BYTES = 1024 * 1024 * 2;

const IGNORED_NAMES = new Set([
  '.git',
  'node_modules',
  '.next',
  'dist',
  'build',
  'coverage',
  '.DS_Store',
]);

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(CLIENTS_FILE)) fs.writeFileSync(CLIENTS_FILE, '[]', 'utf8');

function readClients() {
  try {
    return JSON.parse(fs.readFileSync(CLIENTS_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function writeClients(clients) {
  fs.writeFileSync(CLIENTS_FILE, JSON.stringify(clients, null, 2), 'utf8');
}

function normalizeFilePath(targetPath) {
  return path.resolve(targetPath);
}

function getDefaultWorkspace() {
  const candidates = [
    process.env.CLOUDCODE_WORKSPACE,
    path.join(os.homedir(), 'Desktop', 'vsoma-terminal'),
    path.join(os.homedir(), 'Desktop'),
    path.join(os.homedir(), 'Documents'),
    os.homedir(),
  ];

  for (const candidate of candidates) {
    const normalized = ensureExistingDirectory(candidate);
    if (normalized) return normalized;
  }

  return os.homedir();
}

function ensureExistingDirectory(rootPath) {
  if (!rootPath) return null;
  const normalized = normalizeFilePath(rootPath);
  if (!fs.existsSync(normalized)) return null;
  if (!fs.statSync(normalized).isDirectory()) return null;
  return normalized;
}

function shouldIgnore(name) {
  return IGNORED_NAMES.has(name);
}

function isTextBuffer(buffer) {
  const sample = buffer.subarray(0, Math.min(buffer.length, 4096));
  return !sample.includes(0);
}

function sortEntries(entries) {
  return entries.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name, 'pt-BR');
  });
}

function buildTree(rootPath, depth = 4) {
  let seen = 0;

  function walk(currentPath, currentDepth) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    const children = [];

    for (const entry of entries) {
      if (shouldIgnore(entry.name)) continue;
      if (seen >= MAX_TREE_ITEMS) break;

      const absolutePath = path.join(currentPath, entry.name);
      const node = {
        name: entry.name,
        path: absolutePath,
        type: entry.isDirectory() ? 'directory' : 'file',
      };

      seen += 1;

      if (entry.isDirectory() && currentDepth > 0) {
        try {
          node.children = walk(absolutePath, currentDepth - 1);
        } catch {
          node.children = [];
        }
      }

      children.push(node);
    }

    return sortEntries(children);
  }

  return walk(rootPath, depth);
}

function collectFiles(rootPath) {
  const files = [];

  function walk(currentPath) {
    if (files.length >= MAX_FILE_RESULTS) return;

    const entries = fs.readdirSync(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      if (shouldIgnore(entry.name)) continue;
      if (files.length >= MAX_FILE_RESULTS) break;

      const absolutePath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        walk(absolutePath);
      } else if (entry.isFile()) {
        files.push(absolutePath);
      }
    }
  }

  walk(rootPath);

  return files;
}

async function searchWorkspace(rootPath, query) {
  const lowered = query.toLowerCase();
  try {
    const { stdout } = await execFileAsync('rg', [
      '--line-number',
      '--color',
      'never',
      '--hidden',
      '--glob',
      '!.git',
      '--glob',
      '!node_modules',
      '--glob',
      '!dist',
      '--glob',
      '!build',
      '--glob',
      '!coverage',
      query,
      rootPath,
    ]);
    return stdout
      .split('\n')
      .filter(Boolean)
      .slice(0, MAX_SEARCH_RESULTS)
      .map((line) => {
        const firstColon = line.indexOf(':');
        const secondColon = line.indexOf(':', firstColon + 1);
        return {
          path: line.slice(0, firstColon),
          line: Number(line.slice(firstColon + 1, secondColon)) || 1,
          preview: line.slice(secondColon + 1).trim() || '(linha vazia)',
        };
      });
  } catch {}

  const results = [];
  const files = collectFiles(rootPath);

  for (const filePath of files) {
    if (results.length >= MAX_SEARCH_RESULTS) break;

    let stats;
    try {
      stats = fs.statSync(filePath);
    } catch {
      continue;
    }

    if (stats.size > MAX_FILE_BYTES) continue;

    let content;
    try {
      const buffer = fs.readFileSync(filePath);
      if (!isTextBuffer(buffer)) continue;
      content = buffer.toString('utf8');
    } catch {
      continue;
    }

    const lines = content.split('\n');

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (!line.toLowerCase().includes(lowered)) continue;

      results.push({
        path: filePath,
        line: index + 1,
        preview: line.trim() || '(linha vazia)',
      });

      if (results.length >= MAX_SEARCH_RESULTS) break;
    }
  }

  return results;
}

async function getGitStatus(rootPath) {
  try {
    const { stdout } = await execFileAsync('/usr/bin/git', ['-C', rootPath, 'status', '--porcelain=1', '-b']);
    const lines = stdout.split('\n').filter(Boolean);
    const branchLine = lines.shift() || '';
    const branch = branchLine.replace(/^##\s*/, '');

    const files = lines.map((line) => ({
      indexStatus: line.slice(0, 1).trim() || ' ',
      worktreeStatus: line.slice(1, 2).trim() || ' ',
      path: line.slice(3).trim(),
    }));

    return { branch, files };
  } catch {
    return { branch: 'sem git', files: [] };
  }
}

async function getGitDiff(rootPath, targetPath) {
  try {
    const { stdout } = await execFileAsync('/usr/bin/git', ['-C', rootPath, 'diff', '--', targetPath]);
    return stdout;
  } catch {
    return '';
  }
}

async function stageGitPaths(rootPath, paths = []) {
  const args = ['-C', rootPath, 'add'];
  if (Array.isArray(paths) && paths.length > 0) {
    args.push('--', ...paths);
  } else {
    args.push('-A');
  }

  await execFileAsync('/usr/bin/git', args);
}

async function commitGit(rootPath, message) {
  const { stdout } = await execFileAsync('/usr/bin/git', ['-C', rootPath, 'commit', '-m', message]);
  return stdout.trim();
}

function guessMediaType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  return 'application/octet-stream';
}

let claudeBinPromise;
let claudeInfoPromise;

async function resolveClaudeBinary() {
  if (claudeBinPromise) return claudeBinPromise;

  claudeBinPromise = (async () => {
    // Primeiro: tentar o shell wrapper (mais estável no Electron)
    const wrapperPath = path.join(__dirname, 'claude-wrapper.sh');
    if (fs.existsSync(wrapperPath)) {
      // Garantir permissão de execução
      try { fs.chmodSync(wrapperPath, '755'); } catch {}
      return wrapperPath;
    }

    const directCandidates = [
      process.env.CLAUDE_CLI_PATH,
      '/usr/local/bin/claude',
      '/opt/homebrew/bin/claude',
      '/usr/bin/claude',
    ].filter(Boolean);

    for (const candidate of directCandidates) {
      if (fs.existsSync(candidate)) return candidate;
    }

    try {
      const { stdout } = await execFileAsync('/usr/bin/which', ['claude']);
      const resolved = stdout.trim();
      if (resolved) return resolved;
    } catch {}

    try {
      const { stdout } = await execFileAsync('/bin/zsh', ['-lc', 'which claude']);
      const resolved = stdout.trim();
      if (resolved) return resolved;
    } catch {}

    throw new Error('Claude Code CLI não encontrado no sistema.');
  })();

  return claudeBinPromise;
}

async function getClaudeInfo() {
  if (claudeInfoPromise) return claudeInfoPromise;

  claudeInfoPromise = (async () => {
    const bin = await resolveClaudeBinary();
    const { stdout } = await execFileAsync(bin, ['--version']);
    return {
      path: bin,
      version: stdout.trim(),
    };
  })();

  return claudeInfoPromise;
}

function mapModel(model) {
  if (!model) return 'sonnet';
  const lowered = String(model).toLowerCase();
  if (lowered.includes('opus')) return 'opus';
  if (lowered.includes('haiku')) return 'haiku';
  return 'sonnet';
}

// ═══ SOMACRANIO ═══
// Vault fixo do Obsidian — só este diretório é acessível pelo SOMACRANIO
const SOMACRANIO_PATH = process.env.SOMACRANIO_PATH || '/Users/prod.caiq/DIGITAI SOMA - CEREBRO MESTRE';

// ═══ ANTHROPIC API DIRECT MODE ═══
// Suporte a chamadas diretas à API sem depender do Claude CLI

let activeClaudeAccount = 1; // 1 = CLAUDE_API_KEY_1, 2 = CLAUDE_API_KEY_2

function getActiveApiKey(account) {
  const acc = account || activeClaudeAccount;
  if (acc === 2) return process.env.CLAUDE_API_KEY_2 || null;
  return process.env.CLAUDE_API_KEY_1 || null;
}

function hasApiKey() {
  return !!(process.env.CLAUDE_API_KEY_1 || process.env.CLAUDE_API_KEY_2);
}

function mapModelToAPI(model) {
  if (!model) return 'claude-sonnet-4-5';
  const lowered = String(model).toLowerCase();
  if (lowered.includes('opus'))  return 'claude-opus-4-5';
  if (lowered.includes('haiku')) return 'claude-haiku-4-5-20251001';
  return 'claude-sonnet-4-5';   // padrão seguro — disponível na API
}

// Helper: termina SSE com erro visível no frontend
function sseError(res, msg) {
  try {
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    }
  } catch {}
}

// Streaming via Anthropic API (SSE nativo)
function callClaudeAPIStream({ prompt, model, account, res, sessionId }) {
  const https = require('https');
  const apiKey = getActiveApiKey(account);

  if (!apiKey) {
    console.error('[CLAUDE] Nenhuma API key configurada. Verifique CLAUDE_API_KEY_1 no Railway.');
    sseError(res, 'API Key não configurada. Adicione CLAUDE_API_KEY_1 nas variáveis de ambiente.');
    return Promise.resolve();
  }

  const modelId = mapModelToAPI(model);
  const syntheticSessionId = sessionId || `api_${Date.now()}`;

  const body = JSON.stringify({
    model: modelId,
    max_tokens: 8192,
    stream: true,
    messages: [{ role: 'user', content: prompt }],
  });

  console.log(`[CLAUDE] → model=${modelId} account=${account || activeClaudeAccount} keyPrefix=${apiKey.slice(0,12)}...`);

  // Envia evento de sessão imediato
  res.write(`data: ${JSON.stringify({
    type: 'session',
    sessionId: syntheticSessionId,
    model: modelId,
    mode: 'api',
  })}\n\n`);

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(body),
      },
    }, (apiRes) => {
      const status = apiRes.statusCode;
      console.log(`[CLAUDE] ← HTTP ${status}`);

      // ── Erro HTTP (4xx / 5xx): ler body inteiro e propagar ──
      if (status !== 200) {
        let errBody = '';
        apiRes.on('data', c => (errBody += c));
        apiRes.on('end', () => {
          let msg = `Anthropic API retornou HTTP ${status}`;
          try {
            const parsed = JSON.parse(errBody);
            msg = parsed?.error?.message || parsed?.message || msg;
          } catch {}
          console.error(`[CLAUDE] Erro API: ${msg} | body: ${errBody.slice(0, 300)}`);
          sseError(res, msg);
          resolve();
        });
        return;
      }

      // ── Resposta 200: processar SSE ──
      let buffer = '';
      let gotText = false;

      apiRes.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop(); // guarda linha incompleta

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (!data || data === '[DONE]') continue;

          let event;
          try { event = JSON.parse(data); } catch { continue; }

          if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
            gotText = true;
            if (!res.writableEnded) {
              res.write(`data: ${JSON.stringify({
                type: 'text',
                text: event.delta.text,
                sessionId: syntheticSessionId,
              })}\n\n`);
            }
          }

          if (event.type === 'message_stop') {
            console.log(`[CLAUDE] ✓ message_stop gotText=${gotText}`);
            if (!res.writableEnded) {
              res.write(`data: ${JSON.stringify({ type: 'done', sessionId: syntheticSessionId })}\n\n`);
              res.write('data: [DONE]\n\n');
              res.end();
            }
            resolve();
          }

          if (event.type === 'error') {
            const errMsg = event.error?.message || 'Erro da API Anthropic';
            console.error(`[CLAUDE] Erro SSE: ${errMsg}`);
            sseError(res, errMsg);
            resolve();
          }
        }
      });

      apiRes.on('end', () => {
        console.log(`[CLAUDE] apiRes end — writableEnded=${res.writableEnded} gotText=${gotText}`);
        if (!res.writableEnded) {
          res.write(`data: ${JSON.stringify({ type: 'done', sessionId: syntheticSessionId })}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
        }
        resolve();
      });

      apiRes.on('error', (err) => {
        console.error(`[CLAUDE] apiRes error: ${err.message}`);
        sseError(res, err.message);
        resolve();
      });
    });

    req.on('error', (err) => {
      console.error(`[CLAUDE] req error: ${err.message}`);
      sseError(res, `Erro de conexão com Anthropic: ${err.message}`);
      resolve();
    });

    req.write(body);
    req.end();

    // Abortar se cliente fechar conexão
    res.on('close', () => { try { req.destroy(); } catch {} });
  });
}

function buildClaudePrompt({ prompt, currentFile, selection, screenshotPath, workspaceRoot }) {
  const sections = [];

  sections.push('Você está rodando dentro do CLOUDCODE, um editor local minimalista estilo IDE.');

  if (workspaceRoot) {
    sections.push(`Workspace atual: ${workspaceRoot}`);
  }

  if (currentFile) {
    sections.push(`Arquivo ativo: ${currentFile}`);
  }

  if (selection) {
    sections.push(`Seleção atual no editor:\n${selection}`);
  }

  if (screenshotPath) {
    sections.push(`Uma captura de tela foi salva em: ${screenshotPath}\nSe útil, use suas ferramentas para inspecionar esse arquivo e responder com base nele.`);
  }

  sections.push(`Pedido do usuário:\n${prompt}`);

  return sections.join('\n\n');
}

// Serve root - detect mobile vs desktop
app.get('/', (req, res) => {
  const ua = req.headers['user-agent'] || '';
  const file = ua.includes('CLOUDCODE-iOS') ? 'mobile.html' : 'index.html';
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.sendFile(path.join(__dirname, 'public', file));
});

// Static files (index: false to avoid conflict with route above)
app.use(express.static(path.join(__dirname, 'public'), {
  index: false,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
    }
  },
}));
app.use(express.json({ limit: '16mb' }));

// Status
app.get('/api/status', async (req, res) => {
  const apiMode = hasApiKey();

  if (apiMode) {
    // Modo API direta — não precisa do CLI
    return res.json({
      hasKey: true,
      chatMode: 'api',
      activeAccount: activeClaudeAccount,
      accounts: {
        1: { label: 'caiquegama1', hasKey: !!process.env.CLAUDE_API_KEY_1 },
        2: { label: 'digitaisoma', hasKey: !!process.env.CLAUDE_API_KEY_2 },
      },
      defaultWorkspace: getDefaultWorkspace(),
    });
  }

  // Modo CLI (fallback)
  try {
    const claude = await getClaudeInfo();
    res.json({
      hasKey: true,
      chatMode: 'claude-code',
      claude,
      defaultWorkspace: getDefaultWorkspace(),
    });
  } catch (error) {
    res.json({
      hasKey: false,
      chatMode: 'claude-code',
      error: error.message,
      defaultWorkspace: getDefaultWorkspace(),
    });
  }
});

// Conta ativa (API mode)
app.get('/api/account', (req, res) => {
  res.json({
    activeAccount: activeClaudeAccount,
    accounts: {
      1: { label: 'caiquegama1', hasKey: !!process.env.CLAUDE_API_KEY_1 },
      2: { label: 'digitaisoma', hasKey: !!process.env.CLAUDE_API_KEY_2 },
    },
  });
});

app.post('/api/account', (req, res) => {
  const { account } = req.body || {};
  // Accept both "account_1"/"account_2" strings and integers 1/2
  let num;
  if (typeof account === 'string' && account.startsWith('account_')) {
    num = parseInt(account.replace('account_', ''), 10);
  } else {
    num = Number(account);
  }
  if (num !== 1 && num !== 2) {
    return res.status(400).json({ error: 'account deve ser 1 ou 2.' });
  }
  if (num === 1 && !process.env.CLAUDE_API_KEY_1) {
    return res.status(400).json({ error: 'CLAUDE_API_KEY_1 não configurada.' });
  }
  if (num === 2 && !process.env.CLAUDE_API_KEY_2) {
    return res.status(400).json({ error: 'CLAUDE_API_KEY_2 não configurada.' });
  }
  activeClaudeAccount = num;
  res.json({ ok: true, activeAccount: activeClaudeAccount });
});

// ═══ SOMACRANIO ENDPOINTS ═══
// Acessa exclusivamente o vault do Obsidian definido em SOMACRANIO_PATH

app.get('/api/somacranio/tree', (req, res) => {
  const vaultPath = SOMACRANIO_PATH;
  if (!fs.existsSync(vaultPath)) {
    return res.status(404).json({ error: `Vault não encontrado: ${vaultPath}` });
  }

  function walkMd(dir, depth = 0) {
    if (depth > 8) return [];
    let items = [];
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch (e) { return []; }

    for (const entry of entries) {
      // Ignorar pastas ocultas, .obsidian, _trash, etc.
      if (entry.name.startsWith('.') || entry.name.startsWith('_')) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const children = walkMd(fullPath, depth + 1);
        if (children.length > 0) {
          items.push({ name: entry.name, path: fullPath, type: 'directory', children });
        }
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        items.push({ name: entry.name, path: fullPath, type: 'file' });
      }
    }
    // Pastas primeiro, depois arquivos, ambos em ordem alfabética
    items.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name, 'pt-BR');
    });
    return items;
  }

  const tree = walkMd(vaultPath);
  res.json({ root: vaultPath, tree });
});

app.get('/api/somacranio/file', (req, res) => {
  const filePath = req.query.path;
  if (!filePath) return res.status(400).json({ error: 'path obrigatório.' });

  // Segurança: só arquivos dentro do vault
  const resolved = path.resolve(filePath);
  const vaultResolved = path.resolve(SOMACRANIO_PATH);
  if (!resolved.startsWith(vaultResolved)) {
    return res.status(403).json({ error: 'Acesso negado: fora do vault.' });
  }
  if (!resolved.endsWith('.md')) {
    return res.status(400).json({ error: 'Apenas arquivos .md são permitidos.' });
  }
  if (!fs.existsSync(resolved)) {
    return res.status(404).json({ error: 'Arquivo não encontrado.' });
  }

  const content = fs.readFileSync(resolved, 'utf8');
  res.json({ path: resolved, content });
});

// Workspace
app.get('/api/workspace/tree', (req, res) => {
  const root = ensureExistingDirectory(req.query.root);
  if (!root) return res.status(400).json({ error: 'Workspace inválido.' });

  try {
    res.json({
      root,
      tree: buildTree(root),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/workspace/files', (req, res) => {
  const root = ensureExistingDirectory(req.query.root);
  if (!root) return res.status(400).json({ error: 'Workspace inválido.' });

  try {
    res.json({
      root,
      files: collectFiles(root),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/file', (req, res) => {
  const targetPath = req.query.path;
  if (!targetPath) return res.status(400).json({ error: 'Arquivo não informado.' });

  const absolutePath = normalizeFilePath(targetPath);
  if (!fs.existsSync(absolutePath)) return res.status(404).json({ error: 'Arquivo não encontrado.' });

  try {
    const buffer = fs.readFileSync(absolutePath);
    if (!isTextBuffer(buffer)) {
      return res.status(400).json({ error: 'Arquivo binário não suportado no editor.' });
    }

    res.json({
      path: absolutePath,
      content: buffer.toString('utf8'),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/file', (req, res) => {
  const { path: targetPath, content = '' } = req.body || {};
  if (!targetPath) return res.status(400).json({ error: 'Arquivo não informado.' });

  const absolutePath = normalizeFilePath(targetPath);

  try {
    fs.writeFileSync(absolutePath, content, 'utf8');
    res.json({ ok: true, path: absolutePath });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/search', async (req, res) => {
  const root = ensureExistingDirectory(req.query.root);
  const query = String(req.query.q || '').trim();

  if (!root) return res.status(400).json({ error: 'Workspace inválido.' });
  if (!query) return res.json({ root, results: [] });

  try {
    res.json({
      root,
      results: await searchWorkspace(root, query),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/git/status', async (req, res) => {
  const root = ensureExistingDirectory(req.query.root);
  if (!root) return res.status(400).json({ error: 'Workspace inválido.' });

  res.json(await getGitStatus(root));
});

app.get('/api/git/diff', async (req, res) => {
  const root = ensureExistingDirectory(req.query.root);
  const targetPath = req.query.path;
  if (!root || !targetPath) return res.status(400).json({ error: 'Parâmetros inválidos.' });

  res.json({
    path: targetPath,
    diff: await getGitDiff(root, targetPath),
  });
});

app.post('/api/git/stage', async (req, res) => {
  const root = ensureExistingDirectory(req.body?.root);
  const paths = Array.isArray(req.body?.paths) ? req.body.paths : [];
  if (!root) return res.status(400).json({ error: 'Workspace inválido.' });

  try {
    await stageGitPaths(root, paths);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/git/commit', async (req, res) => {
  const root = ensureExistingDirectory(req.body?.root);
  const message = String(req.body?.message || '').trim();
  if (!root) return res.status(400).json({ error: 'Workspace inválido.' });
  if (!message) return res.status(400).json({ error: 'Mensagem de commit vazia.' });

  try {
    const output = await commitGit(root, message);
    res.json({ ok: true, output });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload dir for ad-hoc assets
const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => cb(null, `${Date.now()}_${file.originalname}`),
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
  res.json({ path: req.file.path, name: req.file.originalname, mediaType: guessMediaType(req.file.path) });
});

// ═══ TRANSCRIÇÃO DE ÁUDIO (Whisper) ═══
const audioUpload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => cb(null, `audio_${Date.now()}.webm`),
  }),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB — limite do Whisper
  fileFilter: (req, file, cb) => {
    // Aceita qualquer mimetype de áudio/vídeo (webm, ogg, mp4, wav, m4a…)
    const ok = /^(audio|video)\//.test(file.mimetype) || file.originalname.match(/\.(webm|ogg|mp3|wav|m4a|mp4)$/i);
    cb(null, !!ok);
  },
});

app.post('/api/transcribe', audioUpload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Nenhum arquivo de áudio enviado.' });
  }

  const OPENAI_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_KEY) {
    // Limpar arquivo e retornar erro claro
    try { fs.unlinkSync(req.file.path); } catch {}
    return res.status(503).json({
      error: 'OPENAI_API_KEY não configurada. Adicione ao .env para usar transcrição Whisper.',
    });
  }

  try {
    const https = require('https');
    const fileBuffer = fs.readFileSync(req.file.path);
    const fileName = req.file.filename;

    // Montar multipart/form-data manualmente para chamar a API do OpenAI
    const boundary = `----WhisperBoundary${Date.now()}`;
    const CRLF = '\r\n';

    const metaPart =
      `--${boundary}${CRLF}` +
      `Content-Disposition: form-data; name="model"${CRLF}${CRLF}` +
      `whisper-1${CRLF}`;

    const langPart =
      `--${boundary}${CRLF}` +
      `Content-Disposition: form-data; name="language"${CRLF}${CRLF}` +
      `pt${CRLF}`;

    const fileHeader =
      `--${boundary}${CRLF}` +
      `Content-Disposition: form-data; name="file"; filename="${fileName}"${CRLF}` +
      `Content-Type: audio/webm${CRLF}${CRLF}`;

    const closing = `${CRLF}--${boundary}--${CRLF}`;

    const body = Buffer.concat([
      Buffer.from(metaPart, 'utf8'),
      Buffer.from(langPart, 'utf8'),
      Buffer.from(fileHeader, 'utf8'),
      fileBuffer,
      Buffer.from(closing, 'utf8'),
    ]);

    const options = {
      hostname: 'api.openai.com',
      path: '/v1/audio/transcriptions',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      },
    };

    const text = await new Promise((resolve, reject) => {
      const req2 = https.request(options, (r) => {
        let raw = '';
        r.on('data', (chunk) => (raw += chunk));
        r.on('end', () => {
          try {
            const json = JSON.parse(raw);
            if (json.error) return reject(new Error(json.error.message || 'Erro Whisper'));
            resolve(json.text || '');
          } catch {
            reject(new Error('Resposta inválida da API OpenAI'));
          }
        });
      });
      req2.on('error', reject);
      req2.write(body);
      req2.end();
    });

    try { fs.unlinkSync(req.file.path); } catch {}
    res.json({ text });
  } catch (err) {
    try { fs.unlinkSync(req.file.path); } catch {}
    console.error('[TRANSCRIBE]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══ TTS — Text to Speech (OpenAI) ═══
app.post('/api/tts', async (req, res) => {
  const { text, voice = 'nova', speed = 1.0 } = req.body || {};
  if (!text) return res.status(400).json({ error: 'Texto não informado' });

  const OPENAI_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_KEY) {
    return res.status(503).json({ error: 'OPENAI_API_KEY não configurada' });
  }

  try {
    const https = require('https');
    const payload = JSON.stringify({ model: 'tts-1', input: text.slice(0, 4096), voice, speed });

    const audioData = await new Promise((resolve, reject) => {
      const r = https.request({
        hostname: 'api.openai.com',
        path: '/v1/audio/speech',
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENAI_KEY}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      }, (resp) => {
        const chunks = [];
        resp.on('data', c => chunks.push(c));
        resp.on('end', () => {
          const buf = Buffer.concat(chunks);
          // Verificar se é JSON de erro
          if (resp.headers['content-type'] && resp.headers['content-type'].includes('json')) {
            try { return reject(new Error(JSON.parse(buf.toString()).error?.message || 'Erro TTS')); } catch {}
          }
          resolve(buf);
        });
      });
      r.on('error', reject);
      r.write(payload);
      r.end();
    });

    res.set({ 'Content-Type': 'audio/mpeg', 'Content-Length': audioData.length });
    res.send(audioData);
  } catch (err) {
    console.error('[TTS]', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/capture-screen', (req, res) => {
  if (process.platform !== 'darwin') {
    return res.status(400).json({ error: 'Captura nativa disponível apenas no macOS.' });
  }

  const capturePath = path.join(UPLOAD_DIR, `capture_${Date.now()}.png`);

  execFile('/usr/sbin/screencapture', ['-x', capturePath], (error) => {
    const exists = fs.existsSync(capturePath);
    const size = exists ? fs.statSync(capturePath).size : 0;

    if (!exists || size === 0) {
      if (exists) fs.unlinkSync(capturePath);
      return res.status(400).json({ error: 'Falha ao capturar a tela.' });
    }

    if (error) {
      return res.status(500).json({ error: 'Falha ao capturar a tela.' });
    }

    res.json({
      path: capturePath,
      name: path.basename(capturePath),
      mediaType: 'image/png',
    });
  });
});

// ═══ SKILLS ═══
const skills = [
  {
    id: 'soma_post_engine',
    name: 'SOMA Post Engine',
    description: 'Sistema de criacao de posts com logica de engajamento',
    prompt: `CONTEXTO:
Voce e especialista em social media da Digital SOMA.

TEMA:
{{input}}

PROCESSO:
1. Identifique o angulo mais interessante do tema
2. Crie um gancho forte
3. Desenvolva o conteudo de forma simples
4. Adicione emocao ou identificacao
5. Finalize com CTA

OUTPUT:
- GANCHO
- TEXTO
- CTA
- HASHTAGS

FOCO:
Engajamento e compartilhamento`,
  },
  {
    id: 'soma_reels_system',
    name: 'SOMA Reels System',
    description: 'Sistema de criacao de videos curtos',
    prompt: `CONTEXTO:
Voce cria videos com alto potencial de retencao.

TEMA:
{{input}}

PROCESSO:
1. Criar hook imediato (0-2s)
2. Quebrar expectativa
3. Entregar valor rapido
4. Inserir micro-climax
5. Finalizar com CTA

OUTPUT:
[0-2s] Hook
[2-6s] Desenvolvimento
[6-10s] Insight
[10-15s] CTA

EXTRA:
Sugira texto na tela`,
  },
  {
    id: 'soma_content_machine',
    name: 'SOMA Content Machine',
    description: 'Transforma uma ideia em multiplos conteudos',
    prompt: `CONTEXTO:
Voce transforma ideias em conteudo multiplataforma.

BASE:
{{input}}

PROCESSO:
1. Identificar ideia central
2. Adaptar para formatos diferentes
3. Maximizar alcance

OUTPUT:

- 1 Post Instagram
- 1 Roteiro Reels
- 1 Carrossel
- 1 Ideia viral

FOCO:
Escala de conteudo`,
  },
  {
    id: 'soma_growth_analysis',
    name: 'SOMA Growth Analysis',
    description: 'Diagnostico estrategico de crescimento',
    prompt: `CONTEXTO:
Voce e estrategista de marketing.

BASE:
{{input}}

PROCESSO:
1. Diagnosticar situacao atual
2. Identificar gargalos
3. Mapear oportunidades
4. Criar plano de acao

OUTPUT:

- Diagnostico
- Erros principais
- Oportunidades
- Plano pratico

FOCO:
Crescimento`,
  },
  {
    id: 'soma_offer_builder',
    name: 'SOMA Offer Builder',
    description: 'Cria ofertas que vendem',
    prompt: `CONTEXTO:
Voce cria ofertas irresistiveis.

PRODUTO:
{{input}}

PROCESSO:
1. Identificar dor principal
2. Criar promessa forte
3. Definir beneficios claros
4. Reduzir objecoes
5. Criar CTA forte

OUTPUT:

- Headline
- Promessa
- Beneficios
- Quebra de objecao
- CTA

FOCO:
Conversao`,
  },
];

function runSkill(skill, input) {
  return skill.prompt.replace('{{input}}', input);
}

app.get('/api/skills', (req, res) => {
  res.json(skills.map(({ id, name, description }) => ({ id, name, description })));
});

// ═══ CLIENTS ═══
app.get('/api/clients', (req, res) => {
  res.json(readClients());
});

app.post('/api/clients/create', (req, res) => {
  const { name, niche, tone, description, visualMood, visualLighting, visualColor, visualReference } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Nome e obrigatorio.' });

  const clients = readClients();
  const client = {
    id: String(Date.now()),
    name: name.trim(),
    niche: (niche || '').trim(),
    tone: (tone || '').trim(),
    description: (description || '').trim(),
    visualStyle: {
      mood: (visualMood || '').trim(),
      lighting: (visualLighting || '').trim(),
      color: (visualColor || '').trim(),
      reference: (visualReference || '').trim(),
    },
    createdAt: new Date().toISOString(),
  };
  clients.push(client);
  writeClients(clients);
  res.json(client);
});

app.post('/api/clients/delete', (req, res) => {
  const { id } = req.body || {};
  if (!id) return res.status(400).json({ error: 'ID e obrigatorio.' });

  let clients = readClients();
  const before = clients.length;
  clients = clients.filter((c) => c.id !== id);
  if (clients.length === before) return res.status(404).json({ error: 'Cliente nao encontrado.' });
  writeClients(clients);
  res.json({ ok: true });
});

app.post('/api/skills/run', async (req, res) => {
  const { skillId, input, clientId } = req.body || {};

  if (!skillId || !input) {
    return res.status(400).json({ error: 'skillId e input sao obrigatorios.' });
  }

  const skill = skills.find((s) => s.id === skillId);
  if (!skill) {
    return res.status(404).json({ error: 'Skill nao encontrada.' });
  }

  let clientContext = '';
  if (clientId) {
    const clients = readClients();
    const client = clients.find((c) => c.id === clientId);
    if (client) {
      clientContext = `CLIENTE:\nNome: ${client.name}\nNicho: ${client.niche}\nTom de voz: ${client.tone}\nDescricao: ${client.description}\n`;
      if (client.visualStyle) {
        const vs = client.visualStyle;
        if (vs.mood || vs.lighting || vs.color || vs.reference) {
          clientContext += `\nESTILO VISUAL:\n`;
          if (vs.mood) clientContext += `Mood: ${vs.mood}\n`;
          if (vs.lighting) clientContext += `Lighting: ${vs.lighting}\n`;
          if (vs.color) clientContext += `Color palette: ${vs.color}\n`;
          if (vs.reference) clientContext += `Referencia: ${vs.reference}\n`;
        }
      }
      clientContext += '\n';
    }
  }

  const prompt = clientContext + runSkill(skill, input);
  const model = req.body.model || 'sonnet';
  const workspaceRoot = req.body.workspaceRoot;
  const account = req.body.account;
  const cwd = ensureExistingDirectory(workspaceRoot) || process.env.HOME;

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // ═══ MODO API DIRETA ═══
  if (hasApiKey()) {
    return callClaudeAPIStream({ prompt, model, account, res });
  }

  // ═══ MODO CLI (fallback) ═══
  try {
    const claudeBin = await resolveClaudeBinary();
    const args = [
      '-p',
      '--output-format',
      'stream-json',
      '--verbose',
      '--permission-mode',
      'bypassPermissions',
      '--model',
      mapModel(model),
      prompt,
    ];

    const child = spawn(claudeBin, args, {
      cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdoutBuffer = '';
    let stderrBuffer = '';
    let knownSessionId = null;
    let sentAssistantText = false;

    // ═══ HEARTBEAT — mantém conexão SSE viva (skills) ═══
    const heartbeat = setInterval(() => {
      if (!res.writableEnded) res.write(': heartbeat\n\n');
    }, 15000);

    child.stdout.on('data', (chunk) => {
      stdoutBuffer += chunk.toString();
      const lines = stdoutBuffer.split('\n');
      stdoutBuffer = lines.pop();

      for (const line of lines) {
        if (!line.trim()) continue;

        let event;
        try {
          event = JSON.parse(line);
        } catch {
          continue;
        }

        if (event.session_id && !knownSessionId) {
          knownSessionId = event.session_id;
        }

        if (event.type === 'system' && event.subtype === 'init') {
          res.write(`data: ${JSON.stringify({
            type: 'session',
            sessionId: event.session_id,
            skillName: skill.name,
          })}\n\n`);
          continue;
        }

        if (event.type === 'assistant' && Array.isArray(event.message?.content)) {
          const text = event.message.content
            .filter((block) => block.type === 'text')
            .map((block) => block.text)
            .join('');

          if (text) {
            sentAssistantText = true;
            res.write(`data: ${JSON.stringify({
              type: 'text',
              text,
              sessionId: event.session_id || knownSessionId,
            })}\n\n`);
          }
          continue;
        }

        if (event.type === 'result') {
          clearInterval(heartbeat);
          if (!sentAssistantText && event.result) {
            res.write(`data: ${JSON.stringify({
              type: 'text',
              text: event.result,
              sessionId: event.session_id || knownSessionId,
            })}\n\n`);
          }

          res.write(`data: ${JSON.stringify({
            type: 'done',
            sessionId: event.session_id || knownSessionId,
          })}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
        }
      }
    });

    child.stderr.on('data', (chunk) => {
      stderrBuffer += chunk.toString();
    });

    child.on('error', (error) => {
      clearInterval(heartbeat);
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
      }
    });

    child.on('close', (code) => {
      clearInterval(heartbeat);
      if (res.writableEnded) return;
      const message = stderrBuffer.trim() || `Claude Code saiu com codigo ${code}`;
      res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
      res.end();
    });

    res.on('close', () => {
      clearInterval(heartbeat);
      if (!res.writableEnded) child.kill('SIGTERM');
    });
  } catch (error) {
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
});

// Claude Code chat
app.post('/chat', async (req, res) => {
  const {
    prompt,
    sessionId,
    model = 'sonnet',
    workspaceRoot,
    currentFile,
    selection,
    screenshotPath,
    account,
  } = req.body || {};

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt vazio.' });
  }

  const cwd = ensureExistingDirectory(workspaceRoot) || process.env.HOME;

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // ═══ MODO API DIRETA ═══
  if (hasApiKey()) {
    const fullPrompt = buildClaudePrompt({ prompt, currentFile, selection, screenshotPath, workspaceRoot: cwd });
    return callClaudeAPIStream({ prompt: fullPrompt, model, account, res, sessionId });
  }

  // ═══ MODO CLI (fallback) ═══
  try {
    const claudeBin = await resolveClaudeBinary();
    const args = [
      '-p',
      '--output-format',
      'stream-json',
      '--verbose',
      '--permission-mode',
      'bypassPermissions',
      '--model',
      mapModel(model),
    ];

    if (sessionId) {
      args.push('--resume', sessionId);
    }

    args.push(
      buildClaudePrompt({
        prompt,
        currentFile,
        selection,
        screenshotPath,
        workspaceRoot: cwd,
      }),
    );

    const child = spawn(claudeBin, args, {
      cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdoutBuffer = '';
    let stderrBuffer = '';
    let knownSessionId = sessionId || null;
    let sentAssistantText = false;

    // ═══ HEARTBEAT — mantém conexão SSE viva ═══
    const heartbeat = setInterval(() => {
      if (!res.writableEnded) {
        res.write(': heartbeat\n\n');
      }
    }, 15000);

    child.stdout.on('data', (chunk) => {
      stdoutBuffer += chunk.toString();
      const lines = stdoutBuffer.split('\n');
      stdoutBuffer = lines.pop();

      for (const line of lines) {
        if (!line.trim()) continue;

        let event;
        try {
          event = JSON.parse(line);
        } catch {
          continue;
        }

        if (event.session_id && !knownSessionId) {
          knownSessionId = event.session_id;
        }

        if (event.type === 'system' && event.subtype === 'init') {
          res.write(`data: ${JSON.stringify({
            type: 'session',
            sessionId: event.session_id,
            model: event.model,
            claudeVersion: event.claude_code_version,
            mcpServers: event.mcp_servers || [],
          })}\n\n`);
          continue;
        }

        if (event.type === 'assistant' && Array.isArray(event.message?.content)) {
          const text = event.message.content
            .filter((block) => block.type === 'text')
            .map((block) => block.text)
            .join('');

          if (text) {
            sentAssistantText = true;
            res.write(`data: ${JSON.stringify({
              type: 'text',
              text,
              sessionId: event.session_id || knownSessionId,
            })}\n\n`);
          }
          continue;
        }

        if (event.type === 'result') {
          clearInterval(heartbeat);
          if (!sentAssistantText && event.result) {
            res.write(`data: ${JSON.stringify({
              type: 'text',
              text: event.result,
              sessionId: event.session_id || knownSessionId,
            })}\n\n`);
          }

          res.write(`data: ${JSON.stringify({
            type: 'done',
            sessionId: event.session_id || knownSessionId,
          })}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
        }
      }
    });

    child.stderr.on('data', (chunk) => {
      stderrBuffer += chunk.toString();
    });

    child.on('error', (error) => {
      clearInterval(heartbeat);
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
      }
    });

    child.on('close', (code) => {
      clearInterval(heartbeat);
      if (res.writableEnded) return;
      const message = stderrBuffer.trim() || `Claude Code saiu com código ${code}`;
      res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
      res.end();
    });

    res.on('close', () => {
      clearInterval(heartbeat);
      if (!res.writableEnded) child.kill('SIGTERM');
    });
  } catch (error) {
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
});

// Status do Mac Agent
app.get('/api/mac/status', (req, res) => {
  const connected = macClient && macClient.readyState === WebSocket.OPEN;
  res.json({ connected, agent: connected ? macAgentInfo : null });
});

// ── FILA DE APROVAÇÃO DE COMANDOS ──

// Submeter comando → entra na fila como "pending"
app.post('/api/mac/execute', (req, res) => {
  const { command } = req.body || {};
  if (!command) return res.status(400).json({ error: 'Comando não informado' });
  if (!macClient || macClient.readyState !== WebSocket.OPEN) {
    return res.status(503).json({ error: 'Mac Agent não conectado. Rode: node mac-agent.js' });
  }

  const safeCheck = isCommandSafe(command);
  if (!safeCheck.safe) {
    return res.status(403).json({ error: safeCheck.reason });
  }

  const id = generateCmdId();
  pendingCommands[id] = { id, command, status: 'pending', createdAt: Date.now() };
  res.json({ status: 'pending', id, message: 'Aguardando aprovação em /api/commands/pending' });
});

// Listar comandos pendentes
app.get('/api/commands/pending', (req, res) => {
  const list = Object.values(pendingCommands).filter(c => c.status === 'pending');
  res.json({ pending: list, total: list.length });
});

// Aprovar comando → executa via WebSocket
app.post('/api/commands/approve', (req, res) => {
  const { id } = req.body || {};
  const cmd = pendingCommands[id];
  if (!cmd) return res.status(404).json({ error: `Comando ${id} não encontrado` });
  if (cmd.status !== 'pending') return res.status(400).json({ error: `Comando já ${cmd.status}` });

  if (!macClient || macClient.readyState !== WebSocket.OPEN) {
    return res.status(503).json({ error: 'Mac Agent desconectado' });
  }

  cmd.status = 'approved';
  const requestId = `mac-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const resultPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      delete macPendingRequests[requestId];
      reject(new Error('Timeout: Mac Agent não respondeu em 20s'));
    }, 20000);
    macPendingRequests[requestId] = { resolve, reject, timer };
  });

  macClient.send(JSON.stringify({ type: 'execute', command: cmd.command, requestId }));

  resultPromise
    .then(result => {
      executedCommands.push({ command: cmd.command, status: 'approved', executedAt: Date.now(), result });
      delete pendingCommands[id];
      res.json({ ok: true, id, ...result });
    })
    .catch(err => {
      executedCommands.push({ command: cmd.command, status: 'error', executedAt: Date.now(), error: err.message });
      delete pendingCommands[id];
      res.status(500).json({ ok: false, id, error: err.message });
    });
});

// Rejeitar comando
app.post('/api/commands/reject', (req, res) => {
  const { id } = req.body || {};
  const cmd = pendingCommands[id];
  if (!cmd) return res.status(404).json({ error: `Comando ${id} não encontrado` });
  cmd.status = 'rejected';
  executedCommands.push({ command: cmd.command, status: 'rejected', executedAt: Date.now() });
  delete pendingCommands[id];
  res.json({ ok: true, id, message: 'Comando rejeitado' });
});

// Log de comandos executados
app.get('/api/commands/log', (req, res) => {
  res.json({ log: executedCommands.slice(-50) }); // últimos 50
});

// ═══ WebSocket — roteamento por path ═══
wss.on('connection', (ws, req) => {
  const url = (req.url || '').split('?')[0];

  // ── MAC AGENT ──
  if (url === '/mac-agent') {
    const token = req.headers['x-mac-agent-token'] || '';
    if (token !== MAC_AGENT_TOKEN) {
      ws.send(JSON.stringify({ type: 'error', error: 'Token inválido' }));
      ws.close(4001, 'Unauthorized');
      return;
    }

    // Apenas 1 Mac Agent por vez
    if (macClient && macClient.readyState === WebSocket.OPEN) {
      console.log('[MAC AGENT] Novo agent substituindo anterior');
      macClient.close(1001, 'Replaced by new agent');
    }

    macClient = ws;
    macAgentInfo = {
      agentId: req.headers['x-agent-id'] || 'mac-agent',
      connectedAt: new Date().toISOString(),
    };
    console.log(`[MAC AGENT] Conectado: ${macAgentInfo.agentId}`);

    // Ping periódico
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }));
    }, 30000);

    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch { return; }

      if (msg.type === 'handshake') {
        Object.assign(macAgentInfo, msg);
        console.log(`[MAC AGENT] Handshake: ${msg.hostname} (${msg.platform})`);
        return;
      }

      if (msg.type === 'pong') return;

      // Resultado de execução — resolver a promise pendente
      if (msg.type === 'result' && msg.requestId) {
        const pending = macPendingRequests[msg.requestId];
        if (pending) {
          clearTimeout(pending.timer);
          delete macPendingRequests[msg.requestId];
          pending.resolve({ stdout: msg.stdout || '', stderr: msg.stderr || '', ok: !!msg.ok, error: msg.error });
        }
      }
    });

    ws.on('close', () => {
      clearInterval(pingInterval);
      if (macClient === ws) {
        macClient = null;
        macAgentInfo = {};
        console.log('[MAC AGENT] Desconectado');
      }
    });

    ws.on('error', (err) => {
      console.error('[MAC AGENT] Erro WS:', err.message);
    });

    return; // ← não cai no handler de terminal
  }

  // ── TERMINAL PTY (comportamento original) ──
  console.log('🔌 Novo cliente WebSocket conectado');

  const shell = os.platform() === 'darwin' ? 'zsh' : 'bash';

  const ptyProcess = pty.spawn(shell, [], {
    name: 'xterm-256color',
    cols: 220,
    rows: 50,
    cwd: process.env.HOME,
    env: process.env,
  });

  ptyProcess.onData((data) => {
    if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'output', data }));
  });

  ptyProcess.onExit(({ exitCode }) => {
    if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'exit', code: exitCode }));
  });

  ws.on('message', (msg) => {
    try {
      const parsed = JSON.parse(msg);
      if (parsed.type === 'input') ptyProcess.write(parsed.data);
      if (parsed.type === 'resize') ptyProcess.resize(parsed.cols, parsed.rows);
    } catch {}
  });

  ws.on('close', () => {
    ptyProcess.kill();
  });
});

const PORT = process.env.PORT || 4242;
server.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 Server rodando com WebSocket');
  console.log(`\n  CLOUDCODE v2 → http://localhost:${PORT}\n`);
  console.log(`  Rede local  → http://0.0.0.0:${PORT}\n`);
});

// Health check endpoint pro Electron saber que o server tá pronto
app.get('/health', (req, res) => res.json({ ok: true, ts: Date.now() }));

module.exports = server;
