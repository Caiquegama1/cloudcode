# ORCASS — Diagnóstico Inicial

**Campanha:** Festa de Preços Campeões (Festa Junina + Copa Brasil)
**Data do diagnóstico:** 2026-05-28
**Modo:** Background only (sem UI, sem cliques, sem janelas) ✔️
**Status geral:** 🔴 **BLOQUEADO** — os arquivos-fonte não estão acessíveis neste ambiente.

---

## ⚠️ Resumo executivo (leia primeiro)

Esta sessão **não está rodando no seu Mac**. Ela roda em um **container Linux remoto e isolado na nuvem** (Claude Code on the web), onde o repositório `cloudcode` foi clonado do zero quando o ambiente subiu.

Por isso, **nenhum** dos caminhos `/Users/caiquegama/...` que você indicou existe aqui, e não há como ler a planilha, as imagens reais ou o ZIP de direções a partir desta sessão. Eles estão no disco do seu Mac, que este ambiente não enxerga.

Não foi gerada nenhuma arte (conforme instruído). Abaixo está o diagnóstico completo e as opções para destravar.

---

## 1. Planilha oficial

| Item | Resultado |
|------|-----------|
| `ORCASS_tabelaJUNHO.xlsx` | ❌ não encontrada |
| `ORCASS_tabelaJUNHO(1).xlsx` | ❌ não encontrada |
| `ORCASS_tabelaJUNHO(2).xlsx` | ❌ não encontrada |
| Qualquer `*.xlsx` / `*.xls` / `*.csv` no ambiente | ❌ nenhum (fora de `node_modules`) |

**Linhas/produtos lidos:** 0 (planilha inacessível).
**Categorias encontradas:** nenhuma (planilha inacessível).

> Busca executada na raiz do sistema (`find / -iname 'ORCASS_tabela*'` e `find / -iname '*.xlsx'`). Zero resultados.

---

## 2. Imagens reais dos produtos

Busca por todas as pastas prioritárias — **nenhuma existe neste ambiente**:

| Prioridade | Pasta | Resultado |
|-----------|-------|-----------|
| 1 | `imagens_padronizadas/` | ❌ não existe |
| 2 | `ENTREGA_FINAL_padronizadas/` | ❌ não existe |
| 3 | `ENTREGA_FINAL_imagens_originais/` | ❌ não existe |
| 4 | `iPhone_apple_store/` / `Apple_v_store/` (Apple CDN/assets) | ❌ não existe |

- **Imagens padronizadas:** caminho inexistente.
- **PNGs transparentes encontrados:** **0**.
- **Modelos de iPhone com imagem disponível:** **nenhum**.

> Busca por `*iphone*.png/.jpg/.webp` na raiz do sistema retornou zero resultados (fora de `node_modules`).

---

## 3. ZIP de direções das artes

| Item | Resultado |
|------|-----------|
| `orcass_direcoes_artes_iphone.zip` | ❌ não encontrado |
| `/Users/caiquegama/Downloads/orcass_direcoes_artes_iphone.zip` | ❌ caminho inexistente |
| Qualquer `*direcoes_artes*` no ambiente | ❌ nenhum |

- **ZIP lido corretamente?** Não — o arquivo não está acessível, então **nenhum MD interno foi lido**.

---

## 4. O que existe de fato neste ambiente

O ambiente é uma VM Linux isolada (`Linux vm 6.18.5 x86_64`), com um único disco gravável (`/`). Não há volumes externos montados nem diretório `/Users`.

O repositório clonado é o app **CloudCode** (terminal AI desktop / agente para Mac), que **não tem relação** com os assets da campanha ORCASS:

```
cloudcode/
├── server.js, main.js, mac-agent.js, CLOUDCODE.js   (app CloudCode)
├── public/      (index.html, ícones, logos do app)
├── assets/      (apenas ícones do app: icon.png, nuvem.png, logo_texto.png…)
├── ios/         (projeto iOS do app)
└── package.json (express, ws, node-pty, electron)
```

Nenhuma planilha, dado de produto, imagem de iPhone ou direção de arte está versionada no repositório.

**Conclusão técnica:** o material da campanha está no seu Mac (`/Users/caiquegama/...`). Esta sessão na nuvem não tem acesso a ele. Provavelmente houve a expectativa de que o agente rodasse localmente no Mac (via `mac-agent.js` / launchd `com.cloudcode.server.plist`), mas aqui ele está rodando remotamente.

---

## 5. Ferramentas disponíveis aqui (para quando os assets chegarem)

Verifiquei a capacidade de renderização do ambiente — **está pronto** assim que houver dados/imagens:

- ✅ Node.js v22 disponível.
- ✅ `sharp` instalável (rasteriza SVG → PNG; permite compor PNGs reais sobre o layout). *(removido após o teste para não sujar o repo)*
- ✅ Fontes disponíveis (DejaVu Sans/Serif, Liberation, FreeSans etc.) para o texto das artes.
- ✅ É viável montar um pipeline 100% por arquivos/scripts (background), sem UI: ler planilha → validar → compor grid com PNGs reais → exportar PNG 1080×1920 → gerar relatório MD.
- ➕ Há também MCPs de design (Canva / Adobe Express) e geração de imagem disponíveis — porém a **regra de ouro** proíbe iPhone por IA, então a geração de imagem **não** seria usada para os produtos.

---

## 6. Próximos passos recomendados

Para destravar, escolha **uma** das opções (em ordem de preferência):

1. **Subir os assets para o repositório (recomendado para automação na nuvem).**
   Adicione ao repo (ex.: numa pasta `orcass/`):
   - a planilha `ORCASS_tabelaJUNHO.xlsx` (ou exportada como `.csv`);
   - as imagens reais em `imagens_padronizadas/` (PNGs transparentes);
   - o conteúdo do `orcass_direcoes_artes_iphone.zip` (os MDs de direção).

   Com isso versionado, eu construo aqui o pipeline completo (leitura da planilha → validação de preço/cor/armazenamento → exclusão de "SOB CONSULTA" e sem preço → montagem do grid, máx. 9 cards/arte com página 02 automática → export PNG por modelo → relatório de validação).

2. **Rodar no Mac, não na nuvem.**
   Se a intenção era o agente local enxergar `/Users/caiquegama/...`, execute o Claude Code / CloudCode **no próprio Mac** (acesso direto às pastas). Esta sessão remota nunca verá esses caminhos.

3. **Anexar os arquivos diretamente nesta conversa.**
   Envie a planilha + as imagens + o ZIP aqui; eu salvo no ambiente, leio as direções e sigo o pipeline.

> Assim que qualquer uma das opções acima estiver pronta, eu refaço este diagnóstico já com dados reais (linhas da planilha, contagem de PNGs, modelos cobertos) e só então parto para as artes — uma por modelo, respeitando todas as regras (sem 12x/PIX/contato/QR nos cards, sem IA nos iPhones, tamanho visual consistente, estética premium Festa Junina + Copa).

---

### Checklist do diagnóstico

- [x] Localizar planilha oficial → **não encontrada**
- [x] Localizar imagens reais dos iPhones → **não encontradas**
- [x] Localizar `imagens_padronizadas/` → **não existe**
- [x] Localizar o ZIP de direções → **não encontrado**
- [ ] Ler o ZIP → **impossível (ausente)**
- [x] Gerar `ORCASS_DIAGNOSTICO_INICIAL.md` → **este arquivo**
- [x] **Não** gerar artes → **nenhuma arte gerada** ✔️
