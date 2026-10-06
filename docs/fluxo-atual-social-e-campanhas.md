# Como o fluxo funciona hoje: Social Media e Campanhas

Resumo do estado **real do código** em 06/10/2026, para servir de base ao sprint
de correção. Tudo aqui foi conferido no código e no Postgres, não de memória — e
o que eu não consegui provar está marcado como tal.

---

## 0. O bug do envio ao cliente — reproduzido

> **Achei a causa, e ela é de produto, não de infraestrutura.**

Um post enviado ao cliente num **portão do meio** (a conta que aprova a Pauta
antes da arte) **não aparece em lugar nenhum da área de Social do cliente**.

Por quê: desde a 0044 o mês abre **sem data** em nenhum post — quem produz
distribui os dias depois. A trava "post sem data não vai ao cliente" só vale no
portão de **entrega** (0076), porque a Pauta é a primeira etapa da corrente e
exigir data ali seria uma recusa que a corrente não tem como satisfazer. Então o
envio da Pauta passa, o `enviado_em` é carimbado, a RLS deixa o cliente ver o
post — **e a consulta da tela filtra por `data_publicacao` dentro do mês**
(`postsDoMes` em `lib/dados/posts.ts`), que é nula. O post desaparece do
calendário, da lista e da grade do feed.

Reprovado contra o Postgres, passo a passo:

| Passo | Resultado |
| --- | --- |
| Ana pede o aval interno da Pauta | passou |
| Ana aprova o aval interno | passou |
| Ana envia a Pauta ao cliente (post sem data) | passou — `enviado_em` carimbado |
| Caio (cliente) enxerga o post pela RLS | **passou** |
| Caio vê o post no mês (`postsDoMes`) | **FALHOU — 0 linhas** |

**O que o cliente vê de verdade:** a peça aparece só na **tela inicial** do
portal, porque `postsComoItens` não filtra por data. Ou seja: há um item em
"esperando você" na home e a área de Social está vazia — que é exatamente a tela
em que a pessoa vai procurar.

**Duas coisas a mais, que fazem parte do mesmo buraco:**

1. A faixa **"Sem data ainda"** existe só no painel interno
   (`social-media.tsx`). O portal não tem onde pôr um post sem data.
2. No portão de **entrega** tudo funciona — provei também. O bug é específico do
   portão do meio, que é justamente a funcionalidade da 0076.

**Antes de qualquer sprint, uma checagem de ambiente:** rode
`scripts/onde-esta-o-banco.sql` no SQL Editor. Se o banco estiver em 0080, o
módulo de Social inteiro está quebrado por outro motivo — o código espera
`posts.plataformas` (0082), `subtasks.social_papel` (0088),
`post_etapa_progresso` (0088) e `o_que_o_cliente_decide` (0087). As migrations
0081 → 0089 estão prontas em `pendentes/aplicar-no-supabase.sql`.

---

## 1. Social Media — como está hoje

### O modelo: três níveis

```
FLUXO (social_flows)  ──  define a sequência de ações, por conta ou por mês
  └─ ELO (social_flow_steps): nome · função · papel · campo · o cliente aprova?

MÊS aberto  =  UMA demanda (tasks.social_do_mes)
  ├─ FASE   =  UMA subtarefa por elo (subtasks.social_papel)   ← o trabalho
  │     └─ CAIXINHA = uma linha por peça naquela fase          ← a peça
  └─ POST   =  uma linha por combinação de redes (posts)       ← o que o cliente decide
```

**O que isso significa na prática:** a produção é **mensal** e a aprovação é
**por post**. Com 18 posts e 5 fases, a redatora tem **uma** etapa "Conteúdo"
com 18 caixinhas, não 18 etapas. Foi a mudança da 0088.

### O fluxo é configurável (0087 + 0089)

Cada elo tem:

| Campo | O que é |
| --- | --- |
| `nome` | livre — "Pauta", "Layout", "Entrega da arte" |
| `funcao` | a função da agência que faz (Design, Redator…) |
| `papel` | `producao` / `entrega` / `pos_entrega` — **exatamente uma entrega** |
| `campo` | qual campo do card essa etapa preenche (pauta, legenda, arte…) |
| `aprovacao_cliente` | se o cliente dá a palavra nessa etapa (só em `producao`) |

- A **entrega** é o portão final: aprovar ela fecha a peça (`posts.status = 'aprovado'`).
- Desde a 0089 **a entrega pode ser o próprio último trabalho** — o Layout pode
  ter `papel = 'entrega'`, e aí quem aprova o Layout é o cliente e pronto.
- **O fluxo não guarda datas** (0089). Ele é só a sequência; as datas são do mês
  e aparecem sugeridas no diálogo que abre o mês (30 dias fechando 2 antes do dia 1,
  divididos pelos elos).
- Qual fluxo vale: **mês → conta → padrão da casa**, nessa ordem.
- Onde se monta: `/painel/social-media?aba=fluxos`, **só gestão**.

### Abrir o mês

`abrir_mes_de_social(cliente, mês, quantidades, responsáveis, prazos, pasta, fluxo)`,
numa transação só. Cria: a demanda, uma subtarefa por elo (encadeadas por
dependência), um post por linha de combinação de redes, e a caixinha de cada
post em cada etapa. Teto de 60 posts, que **recusa** em vez de cortar.

- Quem abre: `is_atendimento()`.
- Quem distribui a corrente: a gestão.
- Os posts nascem **sem data** e com tema de fábrica ("Instagram 1 de 12 · Dezembro/2026").
- Abrir o mesmo mês de novo **acrescenta** posts à demanda que já existe.

### A corrente de mão em mão

| Mão | Quem | O que faz |
| --- | --- | --- |
| Briefing | gestão | abre o mês: cliente, redes, fluxo, responsáveis, datas |
| Produção | o colaborador de cada fase | pauta, legenda, arte, slides — marca a caixinha de cada peça |
| Revisão | gestão | o aval interno, na fila de Aprovações Internas |
| Cliente | ele | aprova, pede ajustes ou rejeita — **por post** |

A **mão** é derivada (`maoDoPost()`), nunca gravada.

### O envio ao cliente

1. Quem produziu clica **"Pedir aval interno"** → rodada `interna`, número = `versao_atual`.
2. A gestão decide na fila (`/painel/gestao-tasks?aba=aprovacoes`).
3. A gestão clica **"Enviar ao cliente"** → rodada `cliente`. O `enviado_em` é
   consequência disso, por trigger — não um segundo comando.
4. Qual portão está saindo é **posicional**: `porta_do_cliente_no_post()`
   devolve o (k+1)-ésimo portão do mês, onde k = rodadas de cliente **aprovadas**
   daquela peça.
5. Portão do meio aprovado → o post **volta para `em_producao`** e a corrente
   anda. Entrega aprovada → `aprovado`.

**O que o banco recusa no envio:** não ser gestão; não ter o aval interno da
mesma versão; e — **só no portão de entrega** — post sem data e vídeo sem link.

### A caixinha

`post_etapa_progresso (post_id, subtask_id, concluido, observacao)`. Duas travas,
nessa ordem:

- **B** — não dá para marcar enquanto um portão anterior não tiver a aprovação
  **daquela peça**;
- **A** — não dá para marcar enquanto uma fase anterior dela estiver aberta.

A caixinha da **entrega não se marca à mão**: ela é consequência da aprovação.
E `observacao` é onde o pedido de ajuste do cliente cai, em âmbar, na linha da fase.

### O que o cliente vê

- **Só post com `enviado_em`**, da própria empresa (`posts_select_cliente`).
- Três visões: calendário do mês, lista e **feed** (grade 3 colunas, por rede).
- Filtros em **quatro fases** derivadas, não nos sete status.
- No detalhe: arte grande (com zoom), legenda **ao lado**, e só então os botões.
- A **corrente é invisível** para ele — quem responde o que ele decide é
  `o_que_o_cliente_decide()`, que entrega só o agregado.

### O que está fora, no Social

- **A corrente não entra no Calendário Full** (saiu na 0088) — ela vive em
  Minhas Tasks e na carga.
- **Navegação Conta → Ano → Mês não existe.** A lista interna agrupa por conta,
  mas não há como navegar por ano/mês: é um filtro de mês só.
- **O portal não tem onde pôr post sem data** (o bug da seção 0).
- A conversão de `social_aprovacoes` → fluxo não dá para medir na bateria.

---

## 2. Campanhas — como está hoje

### O modelo: dois níveis

```
TEMPLATE (campaign_templates)  ──  árvore em jsonb, escolhida ao abrir
CAMPANHA (campaigns)  =  UMA demanda (campaigns.task_id)
  └─ PEÇA (deliverables): no máximo DOIS níveis — grupo e sub-item
        └─ espelhada 1:1 numa SUBTAREFA da demanda (subtasks)
             └─ VERSÕES (deliverable_versions.arquivos, jsonb)
```

- **A etapa da demanda é a FONTE** desde a 0080: o espelho
  `subtasks → deliverables` cria, atualiza e apaga a peça. `abrir_campanha()`
  parou de inserir entregável.
- Acrescentar uma peça = acrescentar uma **etapa na demanda**.
- O status do **grupo é derivado** dos filhos, nunca coluna. Toda conta olha só
  as folhas.
- A peça é uma subtarefa → cronômetro, prazo, carga, dependência, Minhas Tasks.

### O fluxo da peça

1. O colaborador **sobe a versão** (vários arquivos: PDF, AI, JPG — a capa é a
   primeira **imagem**).
2. Clica **"Enviar para análise"** → rodada `interna`, número = `versao_atual`.
3. A gestão decide na **mesma fila** do post e da etapa.
   - Recusa → a peça volta para `em_producao`, a **etapa volta para
     `em_andamento`**, o pedido vira **comentário na demanda**, e quem produziu
     recebe o aviso (0079).
4. A gestão clica **"Enviar ao cliente"** → rodada `cliente`.
   - Para quem produziu o botão **some**; para a gestão ele fica **desligado com
     a razão escrita**.
5. O cliente aprova / pede ajustes / rejeita.
   - Aprovar **conclui a etapa** (0052). Pedir ajustes devolve para `em_andamento`.
6. A campanha **se finaliza e se reabre sozinha**, conforme todas as folhas
   estarem aprovadas ou não (0051).

**O número da rodada é a versão da peça** — subir a v2 depois do aval da v1
deixa a v2 sem aval, que é o que tem de acontecer.

### O que o cliente vê

- A **campanha desde o planejamento** (nome, período, progresso).
- A **peça só depois de enviada** (`deliverables_select_cliente`).
- Árvore de dois níveis: o grupo é um rótulo com um fio à esquerda, a **peça é o
  cartão** — porque ninguém decide sobre um grupo.
- Alerta de 7 dias, em âmbar, sobre o que não foi aprovado.

### O que está fora, em Campanhas

- **O fluxo não é configurável.** O template é uma árvore de nomes, escolhida na
  abertura e editável só ali. Não há `papel`, não há "o cliente aprova esta
  etapa", não há padrão por conta.
- **Um portão de cliente só**, no fim de cada peça. Não existe aprovação
  etapa por etapa como no Social.
- Não existe reverter versão, dos dois lados.
- Campanhas abertas antes da 0051 ficaram sem demanda —
  `scripts/campanhas-sem-demanda.sql` liga.

---

## 3. As assimetrias — é aqui que mora a confusão

As duas áreas fazem a mesma coisa (produzir material, validar internamente,
mandar ao cliente, receber a decisão) com **modelos diferentes**. Esta tabela é o
que eu sugiro usar como base do sprint:

| | Social Media | Campanhas |
| --- | --- | --- |
| A demanda é | o **MÊS** | a **CAMPANHA** |
| A subtarefa é | a **FASE** (uma por elo do fluxo) | a **PEÇA** (uma por item) |
| O que o cliente decide | o **POST** | a **PEÇA** |
| Progresso por peça | a **caixinha** | o status da própria etapa |
| O fluxo | **configurável** por conta e por mês | árvore fixa do template |
| Papel de cada etapa | `producao` / `entrega` / `pos_entrega` | não existe |
| Portões do cliente | **vários**, posicionais | **um**, no fim |
| Pedido de ajuste cai | em `observacao` da caixinha | em comentário na demanda |
| Quem envia ao cliente | `is_gestor()` | `is_gestor()` |
| Aval interno | 1 rodada por post, nº = versão | 1 rodada por peça, nº = versão |
| Fila de aval | `postsNaFila()` | `entregaveisNaFila()` |
| Arquivos | `post_versions.arquivos` | `deliverable_versions.arquivos` |
| No calendário | o post, pela data de publicação | a campanha, pelo **encerramento** |
| Níveis de árvore | mês → fase → caixinha | campanha → grupo → peça |

**As três perguntas que o sprint precisa responder:**

1. **Campanhas ganha fluxo configurável?** Hoje o Social tem `papel`,
   `aprovacao_cliente` e portão do meio; Campanhas não tem nada disso. Se a
   agência valida conceito antes de arte numa campanha, não há onde dizer isso.
2. **O portão do meio do Social continua existindo?** Ele é a razão do bug da
   seção 0. Duas saídas: (a) o portal passa a mostrar post sem data — faixa "Sem
   data ainda", como o painel; ou (b) a data passa a ser exigida antes de
   qualquer envio, e aí o portão do meio exige a data desde a Pauta.
3. **A caixinha é o modelo certo, ou a peça deveria ser a unidade nos dois?**
   Hoje o Social tem três níveis e Campanhas tem dois, e quem usa as duas telas
   aprende duas gramáticas.

---

## 4. Onde cada coisa mora, no código

| O que | Arquivo |
| --- | --- |
| Fluxos de social (regras) | `src/lib/dominio/social-flows.ts` |
| Social: domínio | `src/lib/dominio/posts.ts` |
| Social: leitura | `src/lib/dados/social-media.ts`, `src/lib/dados/posts.ts` |
| Social: ações | `src/app/(interno)/painel/social-media/acoes.ts` |
| Social: telas | `src/app/(interno)/painel/social-media/` |
| Campanhas: domínio | `src/lib/dominio/campanhas.ts` |
| Campanhas: leitura | `src/lib/dados/campanhas.ts` |
| Campanhas: ações | `src/app/(interno)/painel/aprovacoes/acoes-de-campanha.ts` |
| Portal (as duas) | `src/components/portal/telas/detalhe-do-conteudo.tsx` |
| Motor de aprovação | `src/lib/aprovacoes/conteudo.ts` |
| Migrations do Social | 0032, 0042, 0044-0048, 0059, 0061, 0076, 0082-0089 |
| Migrations de Campanhas | 0033, 0050-0054, 0078-0080 |
