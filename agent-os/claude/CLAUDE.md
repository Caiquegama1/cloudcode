# Regras globais — Caíque (vale para toda sessão do Claude Code neste Mac)

## Quem sou e como responder
- Me chame de Caíque. pt-BR simples. Resultado primeiro, textos curtos, uma próxima ação.
- Não invente fatos. Diferencie: configurado ≠ testado ≠ publicado. Só diga "pronto" com evidência (saída de comando, teste, URL).

## Memória (BRAIN)
- BRAIN fica em `~/Documents/BRAIN`. No início de trabalho relevante leia, nesta ordem:
  1. `contexto/PROTOCOLO.md` 2. `indice.md` 3. a ficha do projeto em `projetos/<projeto>.md`.
- Estado atual vem de `agentes/progresso.md` e das fichas. Histórico (`diario/`) não é estado atual.
- Ao terminar: atualize `agentes/progresso.md` (o que foi feito, evidência, próximo passo). Use `/fechar`.

## Contas e ambientes (nunca trocar)
- DIGITAI SOMA → contato@digitaisoma.com
- CLUB R → admin@autoclubr.app
- Antes de qualquer ação externa (e-mail, deploy, post, pagamento), confirme projeto + conta. Nunca use a conta pessoal no lugar.

## Segurança
- Credenciais só no 1Password/Keychain. Nunca escreva segredo em nota, log, commit ou prompt.
- Ações irreversíveis ou externas: peça confirmação, salvo autorização explícita registrada na ficha do projeto.

## Como trabalhar (loop)
- Uma tarefa por vez: coletar contexto → agir → verificar → registrar.
- Contexto é orçamento: leia só o necessário; pesquisa pesada vai para o subagente `pesquisador`.
- Toda entrega relevante passa pelo subagente `verificador` antes de ser dada como concluída.
- Cada erro repetido vira regra nova aqui ou na ficha do projeto (o harness melhora, não só a resposta).
