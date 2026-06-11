#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Preformatted,
                                Table, TableStyle, HRFlowable, PageBreak)
from reportlab.lib.enums import TA_LEFT

OUT = "/home/user/cloudcode/Guia_Migracao_Claude.pdf"

styles = getSampleStyleSheet()

H1 = ParagraphStyle('H1', parent=styles['Heading1'], fontSize=18, textColor=colors.HexColor('#1a1a2e'),
                    spaceAfter=6, spaceBefore=4)
H2 = ParagraphStyle('H2', parent=styles['Heading2'], fontSize=13.5, textColor=colors.HexColor('#0f3460'),
                    spaceBefore=14, spaceAfter=6)
H3 = ParagraphStyle('H3', parent=styles['Heading3'], fontSize=11.5, textColor=colors.HexColor('#16213e'),
                    spaceBefore=10, spaceAfter=4)
BODY = ParagraphStyle('BODY', parent=styles['BodyText'], fontSize=10, leading=14, alignment=TA_LEFT,
                      spaceAfter=6)
SMALL = ParagraphStyle('SMALL', parent=BODY, fontSize=8.5, textColor=colors.HexColor('#555555'))
WARN = ParagraphStyle('WARN', parent=BODY, fontSize=9.5, leading=13, textColor=colors.HexColor('#7a1f1f'))
CODE = ParagraphStyle('CODE', parent=styles['Code'], fontName='Courier', fontSize=7.6, leading=9.6,
                      textColor=colors.HexColor('#1b1b1b'))

def code_box(text):
    """Render a code block inside a light gray table cell."""
    p = Preformatted(text, CODE)
    t = Table([[p]], colWidths=[170*mm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f4f4f7')),
        ('BOX', (0,0), (-1,-1), 0.6, colors.HexColor('#cccccc')),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ]))
    return t

def warn_box(text):
    p = Paragraph(text, WARN)
    t = Table([[p]], colWidths=[170*mm])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#fff4f4')),
        ('BOX', (0,0), (-1,-1), 0.8, colors.HexColor('#e0a3a3')),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ]))
    return t

story = []

# ---- Title ----
story.append(Paragraph("Guia de Migração — Dados do Claude Code", H1))
story.append(Paragraph("Conferência do backup e transferência de históricos/sessões para outra conta", SMALL))
story.append(Paragraph("Gerado em 2026-06-11 &bull; Rodar no terminal do <b>Mac</b> (macOS)", SMALL))
story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#0f3460'), spaceBefore=6, spaceAfter=8))

# ---- Context ----
story.append(Paragraph("Contexto", H2))
story.append(Paragraph(
    "Backup completo feito antes de apagar, localizado em:", BODY))
story.append(code_box("/Users/caiquegama/Documents/CLAUDE_BACKUP_20260610-170157"))
story.append(Paragraph("Conteúdo preservado no backup (~34 GB):", BODY))
story.append(Paragraph(
    "&bull; <b>.claude</b> &nbsp; &bull; <b>.claude.json</b> &nbsp; &bull; <b>Claude_AppSupport</b>", BODY))

# ---- Important notes ----
story.append(Paragraph("Avisos importantes (ler antes)", H2))
story.append(warn_box(
    "<b>1. Sessões são vinculadas ao CAMINHO do projeto, não à conta.</b> "
    "Os históricos ficam em <font face='Courier'>.claude/projects/</font> com nome derivado do path "
    "(ex.: <font face='Courier'>-Users-caiquegama-cloudcode</font>). Se o projeto mudar de caminho no destino, "
    "o <font face='Courier'>--resume</font> não encontra automaticamente — é preciso renomear a pasta correspondente."))
story.append(Spacer(1, 4))
story.append(warn_box(
    "<b>2. O arquivo .claude.json carrega a identidade da conta antiga</b> (objeto "
    "<font face='Courier'>oauthAccount</font>, e-mail, org). O Passo 2 remove isso por padrão para você não herdar "
    "a conta antiga. As credenciais reais NÃO ficam no backup — estão no <b>Keychain do macOS</b> "
    "(item <font face='Courier'>Claude Code-credentials</font>). A conta nova vai exigir um "
    "<font face='Courier'>claude login</font> de qualquer forma."))

story.append(PageBreak())

# ---- Step 1 ----
story.append(Paragraph("Passo 1 — Conferência do backup (somente leitura)", H2))
story.append(Paragraph(
    "Não altera nada. Confirma tamanho, estrutura e onde estão as conversas/sessões. "
    "Cole a saída para validar antes de migrar.", BODY))

step1 = r'''#!/usr/bin/env bash
set -euo pipefail

BACKUP="/Users/caiquegama/Documents/CLAUDE_BACKUP_20260610-170157"

echo "=========================================="
echo " CONFERENCIA DO BACKUP CLAUDE"
echo " $BACKUP"
echo "=========================================="

echo; echo "### Tamanho total e por pasta de topo ###"
du -sh "$BACKUP" 2>/dev/null
du -sh "$BACKUP"/* "$BACKUP"/.claude "$BACKUP"/.claude.json 2>/dev/null | sort -h

echo; echo "### Estrutura (ate 2 niveis) ###"
find "$BACKUP" -maxdepth 2 -type d 2>/dev/null | sed "s|$BACKUP|.|" | sort | head -80

echo; echo "### Arquivos .json no topo do .claude ###"
ls -la "$BACKUP/.claude/"*.json 2>/dev/null || echo "  (nenhum)"

echo; echo "### SESSOES/CONVERSAS - .claude/projects ###"
if [ -d "$BACKUP/.claude/projects" ]; then
  echo "Projetos encontrados:"
  ls -1 "$BACKUP/.claude/projects" 2>/dev/null
  echo
  echo "Qtd de arquivos de sessao (.jsonl) por projeto:"
  for d in "$BACKUP/.claude/projects"/*/; do
    n=$(find "$d" -name '*.jsonl' 2>/dev/null | wc -l | tr -d ' ')
    sz=$(du -sh "$d" 2>/dev/null | cut -f1)
    printf "  %-6s %-8s %s\n" "$n" "$sz" "$(basename "$d")"
  done
  echo
  echo "Total de sessoes (.jsonl): $(find "$BACKUP/.claude/projects" -name '*.jsonl' 2>/dev/null | wc -l | tr -d ' ')"
else
  echo "  !! Pasta .claude/projects NAO encontrada no backup"
fi

echo; echo "### Conta atual no .claude.json (do backup) ###"
if [ -f "$BACKUP/.claude.json" ]; then
  /usr/bin/python3 - "$BACKUP/.claude.json" <<'PY' 2>/dev/null || echo "  (nao consegui parsear o JSON)"
import json,sys
d=json.load(open(sys.argv[1]))
acc=d.get("oauthAccount",{})
print("  email      :", acc.get("emailAddress"))
print("  org        :", acc.get("organizationName"))
print("  accountUuid:", acc.get("accountUuid"))
print("  projetos no .claude.json:", len(d.get("projects",{})))
PY
else
  echo "  !! .claude.json nao encontrado"
fi

echo; echo "### Outras pastas relevantes ###"
ls -la "$BACKUP/.claude/todos" 2>/dev/null | head -5 || true
du -sh "$BACKUP/Claude_AppSupport" 2>/dev/null || true

echo; echo "=== Conferencia concluida ==="'''
story.append(code_box(step1))

story.append(PageBreak())

# ---- Step 2 ----
story.append(Paragraph("Passo 2 — Migração para o destino", H2))
story.append(Paragraph(
    "Faz backup de segurança do que já existe no destino antes de sobrescrever. "
    "Edite apenas <font face='Courier'>DEST_HOME</font> (home do usuário/conta nova). "
    "Mantenha <font face='Courier'>KEEP_OLD_ACCOUNT_ID=false</font> para conta nova.", BODY))

step2 = r'''#!/usr/bin/env bash
set -euo pipefail

BACKUP="/Users/caiquegama/Documents/CLAUDE_BACKUP_20260610-170157"
DEST_HOME="$HOME"                 # <-- destino (home do usuario/conta nova)
STAMP="$(date +%Y%m%d-%H%M%S)"
KEEP_OLD_ACCOUNT_ID=false         # false = NAO herdar conta antiga (recomendado)

echo ">> Migrando de:   $BACKUP"
echo ">> Migrando para: $DEST_HOME"

# 0) Garante que o Claude nao esta rodando
pkill -x claude 2>/dev/null || true

# 1) Backup de seguranca do que ja existe no destino
for item in ".claude" ".claude.json"; do
  if [ -e "$DEST_HOME/$item" ]; then
    echo ">> Salvando destino atual: $item -> $item.bak-$STAMP"
    cp -a "$DEST_HOME/$item" "$DEST_HOME/$item.bak-$STAMP"
  fi
done

# 2) Restaura as CONVERSAS/SESSOES e dados locais (.claude)
echo ">> Copiando .claude (projects/todos/settings/...)"
mkdir -p "$DEST_HOME/.claude"
rsync -a "$BACKUP/.claude/" "$DEST_HOME/.claude/"

# 3) Trata o .claude.json (config + historico por projeto)
if [ -f "$BACKUP/.claude.json" ]; then
  if [ "$KEEP_OLD_ACCOUNT_ID" = true ]; then
    echo ">> Copiando .claude.json INTEGRAL (mantem conta antiga)"
    cp -a "$BACKUP/.claude.json" "$DEST_HOME/.claude.json"
  else
    echo ">> Copiando .claude.json SEM a identidade da conta antiga"
    /usr/bin/python3 - "$BACKUP/.claude.json" "$DEST_HOME/.claude.json" <<'PY'
import json,sys
src,dst=sys.argv[1],sys.argv[2]
d=json.load(open(src))
for k in ("oauthAccount","userID"):
    d.pop(k,None)
json.dump(d,open(dst,"w"),indent=2)
print("   -> oauthAccount/userID removidos; projects e historico preservados")
PY
  fi
fi

# 4) (Opcional) App desktop - so se for o mesmo tipo de instalacao
APPSUP="$HOME/Library/Application Support/Claude"
if [ -d "$BACKUP/Claude_AppSupport" ]; then
  echo ">> NOTA: backup do app desktop em $BACKUP/Claude_AppSupport"
  echo "   Para restaurar (FECHE o app antes):"
  echo "     rsync -a \"$BACKUP/Claude_AppSupport/\" \"$APPSUP/\""
fi

echo
echo "=== Migracao concluida ==="
echo ">> Proximo passo: rode 'claude' e faca 'claude login' com a NOVA conta."
echo ">> Historicos: use 'claude --resume' dentro de cada projeto."
echo ">> Backups de seguranca do destino: *.bak-$STAMP"'''
story.append(code_box(step2))

story.append(PageBreak())

# ---- Step 3 / checklist ----
story.append(Paragraph("Passo 3 — Após a migração", H2))
checklist = [
    "Abrir o terminal e rodar <font face='Courier'>claude</font>.",
    "Fazer login na conta NOVA: o Claude pede autenticação no navegador (grava no Keychain).",
    "Entrar na pasta de um projeto e rodar <font face='Courier'>claude --resume</font> para ver os históricos.",
    "Se um projeto mudou de caminho, renomear a pasta em <font face='Courier'>~/.claude/projects/</font> para o novo path (formato: barras viram hífens).",
    "Conferir <font face='Courier'>~/.claude/settings.json</font> e MCP servers.",
    "Validado tudo? Os <font face='Courier'>*.bak-STAMP</font> de segurança podem ser removidos.",
]
for i, c in enumerate(checklist, 1):
    story.append(Paragraph(f"<b>{i}.</b> {c}", BODY))

story.append(Paragraph("Decisões antes de rodar o Passo 2", H3))
story.append(Paragraph(
    "&bull; <b>Mesmo Mac trocando de conta</b> ou <b>Mac/usuário novo?</b> Se for outro usuário/máquina, "
    "ajuste <font face='Courier'>DEST_HOME</font> para o home correto.", BODY))
story.append(Paragraph(
    "&bull; <b>KEEP_OLD_ACCOUNT_ID</b> = <font face='Courier'>false</font> (recomendado p/ conta nova). "
    "Use <font face='Courier'>true</font> apenas se quiser clonar inclusive a referência da conta antiga.", BODY))

story.append(Paragraph("Mapa dos dados no backup", H3))
ref = [
    [".claude/projects/", "Sessões/conversas (.jsonl), uma por sessão, por projeto"],
    [".claude/todos/", "Listas de tarefas das sessões"],
    [".claude.json", "Config principal + histórico por projeto + identidade da conta"],
    [".claude/settings.json", "Suas configurações"],
    ["Claude_AppSupport", "Dados do app desktop (provável grosso dos 34 GB)"],
]
t = Table([[Paragraph(f"<font face='Courier'>{a}</font>", SMALL), Paragraph(b, SMALL)] for a,b in ref],
          colWidths=[55*mm, 115*mm])
t.setStyle(TableStyle([
    ('BACKGROUND',(0,0),(-1,-1), colors.HexColor('#f7f9fc')),
    ('BOX',(0,0),(-1,-1),0.6, colors.HexColor('#cdd6e0')),
    ('INNERGRID',(0,0),(-1,-1),0.4, colors.HexColor('#dde3ea')),
    ('VALIGN',(0,0),(-1,-1),'TOP'),
    ('LEFTPADDING',(0,0),(-1,-1),6),('RIGHTPADDING',(0,0),(-1,-1),6),
    ('TOPPADDING',(0,0),(-1,-1),4),('BOTTOMPADDING',(0,0),(-1,-1),4),
]))
story.append(t)

story.append(Spacer(1, 10))
story.append(HRFlowable(width="100%", thickness=0.6, color=colors.HexColor('#cccccc')))
story.append(Paragraph(
    "Dica: rode o Passo 1, valide a saída, depois o Passo 2. Os backups *.bak garantem que dá para reverter.", SMALL))

doc = SimpleDocTemplate(OUT, pagesize=A4,
                        leftMargin=20*mm, rightMargin=20*mm,
                        topMargin=16*mm, bottomMargin=16*mm,
                        title="Guia de Migracao - Claude Code")
doc.build(story)
print("OK:", OUT)
