# Protótipo clicável

`npm run prototipo` gera **imagens** das telas. Isto aqui gera a **página única
e clicável** que vai para validação — a que abre no login, deixa entrar com
cada perfil, navegar pelos módulos, abrir os formulários e ver o resultado da
ação na lista.

Ela é montada a partir do HTML e do CSS que o app realmente serve. Não é uma
maquete desenhada à parte: se uma tela mudar no código, ela muda aqui na
próxima geração.

## O que ela não faz

Não grava nada. Não há Supabase atrás dela. Cadastrar um colaborador insere a
linha na tabela **da página aberta** e mostra o toast de sucesso; recarregou,
sumiu. Serve para validar caminho, texto e regra de tela — não funcionamento.

## Como gerar

**1. Prepare a cópia e suba o servidor, um perfil de cada vez.**

```bash
PROTOTIPO_MANTER_COPIA=1 npm run prototipo     # cria .prototipo/ e as imagens
cd .prototipo && PROTOTIPO_ROLE=socio npx next start -p 3600
```

**2. Capture, com o servidor no ar** (noutro terminal, na raiz do projeto):

```bash
node scripts/prototipo-clicavel/capturar.mjs .captura socio
```

Depois derrube o servidor, suba com `PROTOTIPO_ROLE=desenvolvedor` e rode a
captura de novo com `desenvolvedor`; idem para `colaborador`. Só o casco do
painel muda entre perfis — o script sai cedo nessas duas passadas.

**3. Monte e gere:**

```bash
node scripts/prototipo-clicavel/montar.mjs .captura .captura/pacote.json
node scripts/prototipo-clicavel/gerar.mjs \
  .captura/pacote.json prototipo-full-hub.html \
  .captura/abas.json .captura/dialogos.json .captura/opcoes.json
```

**4. Derrube o servidor e apague `.prototipo/` e `.captura/`.**

## Por que a captura é feita com navegador

Baixar o HTML de cada rota não basta:

- telas com `<Suspense>` chegam como esqueleto de carregamento;
- as abas do Radix desmontam o conteúdo que não está ativo;
- um diálogo só existe no DOM depois de aberto;
- as opções de um `<Select>` só existem depois do clique.

Essas quatro coisas são capturadas clicando de verdade, com o app rodando.

## A cada sprint

1. Acrescente a tela nova em `capturar.mjs` (`PAGINAS`, `COM_SUSPENSE`, `ABAS`
   ou `DIALOGOS`, conforme o caso).
2. Se ela for um diálogo, acrescente o gatilho em `GATILHOS` e o que a
   confirmação faz em `ACOES`, dentro de `gerar.mjs`.
3. Gere e confira clicando antes de publicar.

## Verificar antes de publicar

Com o servidor no ar (passo 1), rode:

```bash
node scripts/prototipo-clicavel/verificar-fluxo.mjs
```

São os critérios de aceite que só aparecem clicando — e é a rede que pega erro
de runtime invisível ao build. Já apanhou um `export const` num arquivo
`"use server"`, que derrubava todas as Server Actions da Gestão de Tasks sem
o `npm run build` reclamar.

Cada sprint com regra de tela tem o seu:

| Script | Perfis |
| --- | --- |
| `verificar-fluxo.mjs` | `socio` |
| `verificar-formulario-de-task.mjs` | `socio` |
| `verificar-3c-e-6.mjs` | `socio` |
| `verificar-7.mjs` | `socio` |
| `verificar-8.mjs` e `verificar-8-desenvolvedor.mjs` | `socio`, depois `desenvolvedor` |
| `verificar-9.mjs` | `socio`, **depois `colaborador`** |

O `verificar-9.mjs` roda duas vezes de propósito, e é a segunda que interessa:
metade dos critérios do Sprint 9 é sobre o que a equipe **não** alcança — a
trilha em rascunho, a aba de gestão, remover post alheio. Rodando só como
sócio, todos esses cenários passariam sem nunca ter sido testados.

Passe o mesmo perfil no ambiente do script, senão ele confere contra o papel
errado e reprova por engano:

```bash
cd .prototipo && PROTOTIPO_ROLE=colaborador npx next start -p 3600 &
PROTOTIPO_ROLE=colaborador node scripts/prototipo-clicavel/verificar-9.mjs
```

## Armadilha conhecida

O `<script>` da página final é escrito dentro de um template literal do
JavaScript. **Uma barra invertida se perde no caminho**: `/\s+/` chega ao
navegador como `/s+/`. Não use expressão regular no script da página — prefira
`indexOf`, `split(" ")` e comparação direta. Já derrubou a inicial do avatar e
a validação de e-mail uma vez.
