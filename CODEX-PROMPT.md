# CLOUDCODE — Prompt para Codex

## O QUE É
CLOUDCODE é um app desktop macOS (Electron) que combina um terminal web real (xterm.js + node-pty) com um chat integrado com Claude (Anthropic API) com streaming SSE. Interface branca, minimalista, estilo Claude Desktop.

## ESTRUTURA DO PROJETO
```
vsoma-terminal/
├── .env                    ← ANTHROPIC_API_KEY=sk-ant-api03-...
├── package.json
├── CLOUDCODE.js            ← Electron entry point
├── server.js               ← Express + WebSocket + Anthropic API proxy
├── public/
│   └── index.html          ← Frontend completo (HTML + CSS + JS inline)
├── assets/
│   ├── icon.svg
│   ├── icon.png
│   └── icon.icns
└── node_modules/
```

## COMO RODAR
```bash
cd ~/Desktop/vsoma-terminal
npm install --include=dev
npx electron .
```

## COMO BUILDAR
```bash
npm run build   # gera .dmg via electron-builder
```

---

## ARQUIVO: package.json
```json
{
  "name": "cloudcode",
  "version": "2.0.0",
  "description": "CLOUDCODE — AI Terminal Desktop App",
  "main": "CLOUDCODE.js",
  "scripts": {
    "start": "electron .",
    "server": "node server.js",
    "build": "electron-builder --mac",
    "dist": "electron-builder --mac --publish never"
  },
  "dependencies": {
    "express": "^4.18.2",
    "multer": "^1.4.5-lts.1",
    "node-pty": "^1.0.0",
    "ws": "^8.16.0"
  },
  "devDependencies": {
    "electron": "^41.1.1",
    "electron-builder": "^26.8.1",
    "electron-rebuild": "^3.2.9"
  },
  "build": {
    "appId": "com.digitaisoma.cloudcode",
    "productName": "CLOUDCODE",
    "mac": {
      "category": "public.app-category.developer-tools",
      "target": ["dmg"],
      "icon": "assets/icon.icns",
      "darkModeSupport": true
    },
    "files": [
      "CLOUDCODE.js",
      "server.js",
      "public/**/*",
      "node_modules/**/*",
      "assets/**/*"
    ],
    "extraResources": [],
    "asar": false
  }
}
```

---

## ARQUIVO: CLOUDCODE.js (Electron)
```javascript
const { app, BrowserWindow, Menu, shell, globalShortcut } = require('electron');
const path = require('path');

// ── Start the Express + WS server ──
let serverProcess;
function startServer() {
  return new Promise((resolve) => {
    const server = require('./server');
    setTimeout(resolve, 800);
  });
}

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 18 },
    backgroundColor: '#FFFFFF',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    show: false,
  });

  mainWindow.loadURL('http://localhost:4242');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ── App Menu ──
function buildMenu() {
  const template = [
    {
      label: 'CLOUDCODE',
      submenu: [
        { label: 'Sobre CLOUDCODE', role: 'about' },
        { type: 'separator' },
        { label: 'Preferências...', accelerator: 'CmdOrCtrl+,', click: () => {} },
        { type: 'separator' },
        { label: 'Ocultar CLOUDCODE', role: 'hide' },
        { label: 'Ocultar Outros', role: 'hideOthers' },
        { label: 'Mostrar Tudo', role: 'unhide' },
        { type: 'separator' },
        { label: 'Sair', accelerator: 'CmdOrCtrl+Q', role: 'quit' },
      ],
    },
    {
      label: 'Editar',
      submenu: [
        { label: 'Desfazer', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: 'Refazer', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo' },
        { type: 'separator' },
        { label: 'Cortar', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: 'Copiar', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: 'Colar', accelerator: 'CmdOrCtrl+V', role: 'paste' },
        { label: 'Selecionar Tudo', accelerator: 'CmdOrCtrl+A', role: 'selectAll' },
      ],
    },
    {
      label: 'Visualização',
      submenu: [
        { label: 'Recarregar', accelerator: 'CmdOrCtrl+R', role: 'reload' },
        { label: 'Forçar Recarga', accelerator: 'CmdOrCtrl+Shift+R', role: 'forceReload' },
        { type: 'separator' },
        { label: 'Tela Cheia', accelerator: 'F11', role: 'togglefullscreen' },
        { type: 'separator' },
        { label: 'DevTools', accelerator: 'CmdOrCtrl+Shift+I', role: 'toggleDevTools' },
      ],
    },
    {
      label: 'Janela',
      submenu: [
        { label: 'Minimizar', accelerator: 'CmdOrCtrl+M', role: 'minimize' },
        { label: 'Zoom', role: 'zoom' },
        { type: 'separator' },
        { label: 'Fechar', accelerator: 'CmdOrCtrl+W', role: 'close' },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── App lifecycle ──
app.whenReady().then(async () => {
  await startServer();
  buildMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.setName('CLOUDCODE');
```

---

## ARQUIVO: server.js (Backend)
```javascript
const express = require('express');
const { WebSocketServer } = require('ws');
const pty = require('node-pty');
const http = require('http');
const path = require('path');
const os = require('os');
const fs = require('fs');
const multer = require('multer');

// Load .env
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [key, ...val] = line.split('=');
    if (key && val.length) process.env[key.trim()] = val.join('=').trim();
  });
}

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Upload dir
const UPLOAD_DIR = path.join(os.tmpdir(), 'cloudcode-uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '8mb' }));

// ── API Key status
app.get('/api/status', (req, res) => {
  res.json({ hasKey: !!process.env.ANTHROPIC_API_KEY });
});

// ── File Upload
const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => cb(null, Date.now() + '_' + file.originalname),
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
  res.json({ path: req.file.path, name: req.file.originalname });
});

// ── Chat (Anthropic API streaming)
app.post('/chat', async (req, res) => {
  const { messages, model = 'claude-sonnet-4-6', apiKey } = req.body;

  const key = apiKey || process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return res.status(401).json({ error: 'API key não configurada.' });
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const https = require('https');

    const body = JSON.stringify({
      model,
      max_tokens: 8096,
      stream: true,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    });

    const options = {
      hostname: 'api.anthropic.com',
      port: 443,
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const apiReq = https.request(options, (apiRes) => {
      if (apiRes.statusCode !== 200) {
        let errBody = '';
        apiRes.on('data', d => errBody += d);
        apiRes.on('end', () => {
          try {
            const parsed = JSON.parse(errBody);
            res.write(`data: ${JSON.stringify({ error: parsed.error?.message || errBody })}\n\n`);
          } catch {
            res.write(`data: ${JSON.stringify({ error: `HTTP ${apiRes.statusCode}` })}\n\n`);
          }
          res.end();
        });
        return;
      }

      let buffer = '';
      apiRes.on('data', chunk => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (payload === '[DONE]') { res.write('data: [DONE]\n\n'); continue; }
          try {
            const obj = JSON.parse(payload);
            if (obj.type === 'content_block_delta' && obj.delta?.type === 'text_delta') {
              res.write(`data: ${JSON.stringify({ text: obj.delta.text })}\n\n`);
            }
          } catch {}
        }
      });

      apiRes.on('end', () => {
        res.write('data: [DONE]\n\n');
        res.end();
      });
    });

    apiReq.on('error', err => {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    });

    apiReq.write(body);
    apiReq.end();

    req.on('close', () => apiReq.destroy());

  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

// ── Terminal WebSocket
wss.on('connection', (ws) => {
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

  ws.on('close', () => ptyProcess.kill());
});

const PORT = process.env.PORT || 4242;
server.listen(PORT, () => {
  console.log(`\n  CLOUDCODE v2 → http://localhost:${PORT}\n`);
});

module.exports = server;
```

---

## ARQUIVO: public/index.html (Frontend COMPLETO)

O frontend está em `public/index.html` — é um arquivo único com HTML + CSS + JS inline.

### Features atuais:
- **Sidebar** com histórico de chats, botão "Novo chat", botão "Terminal"
- **Chat centralizado** estilo Claude Desktop (max-width 680px)
- **Welcome screen** com mascote nuvem animada + "O que posso ajudar?"
- **Input area** com: textarea auto-resize, botão anexar arquivo, botão imagem, seletor de modelo (Haiku 4.5 / Sonnet 4 / Opus 4), botão enviar
- **Botão /compactar** — resume o chat atual via Claude API e abre novo chat com o contexto compactado
- **Barra de uso MAX 20x** — mostra contagem de mensagens da sessão com barra de progresso
- **Streaming SSE** com cursor animado e renderização Markdown (marked.js + highlight.js)
- **Code blocks** com botões Copiar/Ocultar e syntax highlighting
- **Terminal** com xterm.js, múltiplas abas, botões Autorizar e Planejar
- **Top bar** draggable com logo CLOUDCODE, tabs Chat/Terminal, status pill
- **Bottom bar** com shell info, tamanho do terminal, modelo ativo
- **Atalhos**: Cmd+1 (Chat), Cmd+2 (Terminal), Cmd+T (nova aba), Cmd+W (fechar aba), Cmd+K (novo chat), Cmd+Shift+K (compactar)
- **Context menu** no terminal (copiar, colar, limpar, nova sessão)
- **Drag & drop** de arquivos com overlay visual
- **API key banner** — aparece se não houver key no servidor nem no localStorage
- **Tema**: fundo branco, accent #7C5CFC (violeta), fonte Inter, border-radius arredondados

### O que o Codex precisa fazer:
1. **Ler o index.html existente** em `public/index.html` — ele já está funcional
2. **Verificar se a API key no .env é válida** — se der "invalid x-api-key", o usuário precisa gerar uma nova em platform.claude.com/settings/keys
3. **Rodar `npm install --include=dev`** para garantir que electron e dependências estão instaladas
4. **Rodar `npx electron-rebuild`** para recompilar node-pty para o Electron
5. **Testar com `npx electron .`** para verificar que tudo funciona
6. **Buildar com `npm run build`** para gerar o CLOUDCODE.app / .dmg

### Problemas conhecidos e soluções:
- **node-pty precisa ser recompilado** para Electron: rodar `npx electron-rebuild` antes de buildar
- **A API key antiga era inválida**: já foi substituída, mas se der erro de auth novamente, gerar nova key
- **O status "Conectando..."** é do WebSocket do terminal — ele conecta quando você abre a aba Terminal
- **electron-builder precisa de `--include=dev`** no npm install porque Electron é devDependency

---

## .env (criar se não existir)
```
ANTHROPIC_API_KEY=SUA_KEY_AQUI
```

---

## COMANDOS RÁPIDOS
```bash
# Instalar dependências
cd ~/Desktop/vsoma-terminal && npm install --include=dev

# Recompilar node-pty para Electron
npx electron-rebuild

# Rodar em modo dev
npx electron .

# Buildar .dmg
npm run build
```
