---
name: fechar
description: Ritual de fim de sessão. Registra no BRAIN o que foi feito, a evidência e o próximo passo. Use quando o Caíque disser "fechar", "encerrar" ou ao final de uma tarefa.
---
Acrescente ao FINAL de `~/Documents/BRAIN/agentes/progresso.md` (não reescreva o resto):

```
## AAAA-MM-DD HH:MM — <projeto>
- Feito: ...
- Evidência: (comando/saída, teste, URL) — ou "sem evidência"
- Status: configurado | testado | publicado
- Pendente: ...
- Próxima ação: ...
```

Se uma tarefa de `agentes/fila.md` foi concluída com evidência, marque-a `[x]`.
Se algum erro se repetiu, proponha (não aplique sozinho) uma regra nova para o CLAUDE.md.
Nunca grave segredos.
