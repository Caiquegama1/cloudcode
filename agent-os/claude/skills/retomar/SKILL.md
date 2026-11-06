---
name: retomar
description: Ritual de início de sessão. Lê o BRAIN e diz onde parou e qual a próxima ação. Use ao abrir uma sessão ou quando o Caíque disser "retomar", "onde paramos".
argument-hint: [projeto]
---
Projeto: $ARGUMENTS (se vazio, descubra pelo diretório atual ou pergunte).

1. Leia `~/Documents/BRAIN/contexto/PROTOCOLO.md`, `~/Documents/BRAIN/indice.md` e `~/Documents/BRAIN/projetos/<projeto>.md` (o que existir).
2. Leia `~/Documents/BRAIN/agentes/progresso.md` e `~/Documents/BRAIN/agentes/fila.md`.
3. Rode `git status` e `git log --oneline -5` se estiver num repositório.
4. Responda em até 6 linhas:
   - Onde parou (com data da última entrada)
   - Pendências abertas
   - Conta/ambiente deste projeto
   - UMA próxima ação de 2–5 minutos
