# Agent OS — Mac do Caíque

Transforma o Claude Code num sistema de agentes com memória (BRAIN), harness (regras + hooks + verificador) e loops (fila + agendamento).

## Instalar (3 passos)

```bash
git clone -b claude/gallant-rubin-dsfx3j https://github.com/caiquegama1/cloudcode.git ~/cloudcode-agent-os
```

```bash
cd ~/cloudcode-agent-os/agent-os && chmod +x *.sh loops/*.sh claude/hooks/*.sh && ./instalar-agent-os.sh
```

```bash
cd ~/Documents/BRAIN && claude
```
Dentro do Claude, digite `/retomar`.

## Transcrever o vídeo (roda no seu Mac)

```bash
~/.agent-os/loops/0-transcrever-video.sh "https://www.youtube.com/watch?v=EzcXGtjNm5E"
```
Salva em `~/Documents/BRAIN/fontes/videos/`. Depois rode `~/.agent-os/loops/loop-fila.sh 1`: a primeira tarefa da fila é resumir esse vídeo.

## O que cada peça faz

| Peça | Arquivo | Conceito |
|---|---|---|
| Regras globais | `~/.claude/CLAUDE.md` | engenharia de contexto: o que todo agente sabe |
| Memória | `~/Documents/BRAIN/agentes/{fila,progresso}.md` | estado fora do contexto, lido no início e atualizado no fim |
| Contexto inicial | hook `contexto-inicial.sh` (SessionStart) | injeta só o estado atual, não o histórico |
| Guarda | hook `guarda.sh` (PreToolUse) | harness: bloqueia `rm -rf ~`, push forçado, Keychain, `.env`, segredos |
| Subagentes | `pesquisador`, `executor` (worktree), `verificador` | dividir o contexto e ter revisão independente |
| Skills | `/retomar`, `/fechar` | rituais de início e de fim de sessão |
| Loop | `loop-fila.sh` | coletar → agir → verificar → registrar, uma tarefa por volta, com limite e `PARAR` |
| Agendamento | `briefing-diario.sh` + launchd | plano do dia todo dia útil, só leitura |

## Uso diário
- Adicione uma tarefa em `agentes/fila.md` com o critério de **pronto quando**.
- Rode `~/.agent-os/loops/loop-fila.sh 3`. Para parar: `touch ~/Documents/BRAIN/agentes/PARAR`.
- Para tarefas em paralelo: `claude -w nome-da-tarefa` (cria um worktree isolado).
- Conectores (Gmail, Drive, Notion...): `claude mcp add --transport http <nome> <url>`.

## Limites conhecidos
- O loop usa `acceptEdits` e uma lista fechada de ferramentas. Ele não envia e-mail, não publica nem faz deploy: essas ações viram pendência.
- Há relatos de `claude -p` travando sob launchd (Keychain/login). Se o briefing não gerar o arquivo, veja `/tmp/caique-briefing.err`.
- Se você já tem `~/.claude/settings.json`, o instalador não sobrescreve: junte os blocos manualmente.

## Fontes
- Loop de agente: https://anthropic.com/engineering/building-agents-with-the-claude-agent-sdk
- Engenharia de contexto: https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- Harness para agentes longos: https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents
- Harness engineering: https://openai.com/index/harness-engineering/
- Lições do Manus: https://manus.im/en/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus
- 12-Factor Agents: https://github.com/humanlayer/12-factor-agents
- Loop "Ralph": https://ghuntley.com/ralph/
- Obsidian + Claude Code (PT-BR): https://horadecodar.com.br/segundo-cerebro-com-ia-obsidian-claude-code/
- Docs oficiais: https://code.claude.com/docs/en/hooks · /sub-agents · /skills · /headless · /worktrees · /mcp
