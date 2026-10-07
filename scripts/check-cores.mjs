/**
 * A prova da identidade visual.
 *
 * Duas perguntas, e as duas com resposta objetiva:
 *
 *   1. Existe cor literal fora do arquivo de tokens?
 *      O critério de aceite do sprint é textual: procurar por #7FCFF5, #545960
 *      ou qualquer hex fora de globals.css tem que voltar vazio.
 *
 *   2. Todo par texto/fundo é legível?
 *      Mínimo 4.5:1 para texto normal, 3:1 para texto grande e para elemento
 *      de interface (borda, ícone sozinho). A paleta tem um azul muito claro,
 *      e azul claro convida ao erro de pôr texto branco em cima — 1.7:1. Este
 *      script é o que impede isso de entrar sem ninguém ver.
 *
 * Roda com: npm run check:cores
 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const CSS = "src/app/globals.css";

/* As exceções, cada uma com motivo. Nenhuma delas é cor de interface. */
const EXCECOES = [
  {
    arquivo: "src/components/shared/editor-rico.tsx",
    motivo:
      "paleta de texto do editor rico: a cor escolhida é gravada DENTRO do documento " +
      "do TipTap. Uma var() ali viajaria junto com o conteúdo e apareceria crua em " +
      "qualquer lugar que renderize o documento fora deste app.",
  },
  {
    arquivo: "src/app/layout.tsx",
    motivo:
      "theme-color do navegador: vai numa meta tag, que só aceita cor literal — " +
      "var() não resolve lá.",
  },
  {
    arquivo: "src/app/icon.svg",
    motivo:
      "ícone da aba: o navegador serve o arquivo sozinho, sem a folha de estilo do " +
      "app, então não existe var(--marca-disco) para ele ler. São os mesmos três " +
      "valores do símbolo, e é por isso que o .svg entrou na varredura — fora dela, " +
      "a regra diria que só há dois lugares com cor literal e ninguém saberia do " +
      "terceiro.",
  },
];

// --- leitura dos tokens ----------------------------------------------------

function blocos(css) {
  const pegar = (seletor) => {
    const i = css.indexOf(`${seletor} {`);
    if (i < 0) throw new Error(`Bloco ${seletor} não encontrado em ${CSS}`);
    const abre = css.indexOf("{", i);
    const fecha = css.indexOf("\n}", abre);
    return css.slice(abre + 1, fecha);
  };
  return { claro: pegar(":root"), escuro: pegar(".dark") };
}

function declaracoes(texto) {
  const mapa = new Map();
  for (const linha of texto.split("\n")) {
    const limpa = linha.replace(/\/\*[\s\S]*?\*\//g, "").trim();
    const m = limpa.match(/^(--[a-z0-9-]+)\s*:\s*([^;]+);/i);
    if (m) mapa.set(m[1], m[2].trim());
  }
  return mapa;
}

/** Resolve var(--x) até chegar num hex. Herda do claro no tema escuro. */
function resolver(nome, tema, base, vistos = new Set()) {
  if (vistos.has(nome)) throw new Error(`Ciclo em ${nome}`);
  vistos.add(nome);

  const valor = tema.get(nome) ?? base.get(nome);
  if (!valor) throw new Error(`Token ${nome} não existe`);

  const v = valor.trim();
  if (v.startsWith("#")) return v;

  const m = v.match(/^var\((--[a-z0-9-]+)\)$/i);
  if (m) return resolver(m[1], tema, base, vistos);

  throw new Error(`Token ${nome} não é hex nem var(): ${v}`);
}

// --- contraste -------------------------------------------------------------

function canais(hex) {
  const h = hex.replace("#", "");
  const largo = h.length <= 4;
  const ler = (i) =>
    largo ? parseInt(h[i] + h[i], 16) : parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return [ler(0), ler(1), ler(2)];
}

function luminancia(hex) {
  const [r, g, b] = canais(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contraste(a, b) {
  const la = luminancia(a);
  const lb = luminancia(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// --- os pares que a interface realmente usa --------------------------------

const NORMAL = 4.5;
const GRANDE = 3;

const PARES = [
  // Texto sobre as superfícies.
  ["--text-primary", "--surface-page", NORMAL, "texto principal na página"],
  ["--text-primary", "--surface-card", NORMAL, "texto principal no cartão"],
  ["--text-secondary", "--surface-page", NORMAL, "texto de apoio na página"],
  ["--text-secondary", "--surface-card", NORMAL, "texto de apoio no cartão"],
  // NORMAL E NAO GRANDE, e a troca é a correção de um furo desta lista.
  //
  // `--text-muted` tem 330 usos na interface, e quase todos são `text-xs` ou
  // `text-[11px]` — texto NORMAL para a WCAG, que só chama de grande a partir
  // de 24px (ou 18,7px em negrito). Medi-lo a 3:1 era abençoar o par no limite
  // errado, e ele passava com 3,39:1.
  ["--text-muted", "--surface-card", NORMAL, "texto discreto (rótulo, legenda)"],
  ["--text-muted", "--surface-page", NORMAL, "texto discreto na página"],

  // E SOBRE OS CINCO FUNDOS TINGIDOS, que é onde ele estava reprovando.
  //
  // A lista dizia, doze linhas abaixo, que `--text-muted` sobre um `*-soft`
  // dá 4,03 a 4,49:1 — e resolvia isso mandando usar `--text-secondary` ali.
  // A recomendação valia para UM componente e a interface tem 330 usos do
  // token: a varredura da página viva achou 53 nós em selo de post, cabeçalho
  // de tabela, lista de cartão de atenção e dia da semana da matriz.
  //
  // Então o token foi escurecido, e estas cinco linhas são o que tira a regra
  // do lugar de chamada: elas medem o token contra TODO fundo em que ele pode
  // cair, e não contra os dois em que ele já passava.
  ["--text-muted", "--muted", NORMAL, "texto discreto sobre o selo neutro"],
  ["--text-muted", "--blue-soft", NORMAL, "texto discreto no bloco azul"],
  ["--text-muted", "--warning-soft", NORMAL, "texto discreto no bloco de atenção"],
  ["--text-muted", "--danger-soft", NORMAL, "texto discreto no bloco de alerta"],
  ["--text-muted", "--success-soft", NORMAL, "texto discreto no bloco bom"],

  // O RÓTULO DO CARTÃO DE NÚMERO SOBRE OS TRÊS FUNDOS TINGIDOS.
  //
  // Um fundo `*-soft` não é o cartão nem a página, e a lista só tinha essas
  // duas — então o rótulo em `--text-muted` sobre eles (4,03 a 4,49:1 a 12px)
  // passava sem nada conferir. O componente usa `--text-secondary` nos três
  // desde o Sprint 16, e estas linhas são o que impede a volta.
  ["--text-secondary", "--warning-soft", NORMAL, "rótulo do cartão de atenção"],
  ["--text-secondary", "--danger-soft", NORMAL, "rótulo do cartão de alerta"],
  ["--text-secondary", "--success-soft", NORMAL, "rótulo do cartão bom"],

  // O CHIP DO CALENDÁRIO DE TASKS, que é o primeiro lugar do produto a pôr o
  // título de um item sobre fundo tingido.
  //
  // Ele era um cartão branco com um fio de cor na esquerda, e virou o fundo
  // inteiro quando o usuário pediu a tela "visualmente mais colorida" — então
  // `--text-primary` (o nome da etapa) e `--text-muted` (a linhagem) caem
  // sobre quatro fundos que nenhuma linha desta lista media com eles.
  //
  // `--text-muted` sobre os três `*-soft` já está medido acima; o que faltava
  // era `--accent`, e ele é o caso que não dá para deduzir: no tema claro
  // `--accent` aponta para `--blue-soft`, no escuro para
  // `--surface-sidebar-2`. São dois fundos diferentes com o mesmo nome de
  // token, e só medir os dois temas responde.
  ["--text-primary", "--danger-soft", NORMAL, "nome da etapa no chip vencido"],
  ["--text-primary", "--warning-soft", NORMAL, "nome da etapa no chip de hoje"],
  ["--text-primary", "--success-soft", NORMAL, "nome da etapa no chip concluído"],
  ["--text-primary", "--accent", NORMAL, "nome da etapa no chip em produção"],
  ["--text-muted", "--accent", NORMAL, "linhagem no chip em produção"],
  // A TERCEIRA LINHA do chip é o nome do cliente, em `--text-secondary`: o
  // chip passou a ter cliente, demanda e etapa em três pesos (proposta C).
  // `--text-secondary` sobre os três `*-soft` já está medido acima, no bloco
  // do rótulo do cartão de número; faltava `--accent`, pelo mesmo motivo das
  // duas linhas acima — ele é outro fundo em cada tema.
  ["--text-secondary", "--accent", NORMAL, "nome do cliente no chip em produção"],

  // O PAR NEUTRO, e ele é a terceira vez que esta lista fica para trás da
  // interface.
  //
  // `--muted` aponta para `--neutral-soft`, e é o fundo dos selos neutros — a
  // camada "quem está fora" do calendário, o cabeçalho de mês da linha do
  // tempo, o dia de outro mês na grade. Sobre ele, `--text-muted` dá
  // **4,43:1**: passa raspando POR BAIXO do mínimo, e nenhuma linha desta
  // lista media a combinação. Quem pegou foi o axe-core, na imagem do
  // protótipo, em três lugares de uma vez.
  //
  // `--neutral` é o primeiro-plano nomeado de `--neutral-soft` e dá 6,3:1. As
  // duas linhas ficam: a de baixo é o que impede alguém de voltar ao
  // `--text-muted` achando que só a cor mudou.
  ["--muted-foreground", "--muted", NORMAL, "o apelido do shadcn sobre o selo neutro"],
  ["--neutral", "--muted", NORMAL, "texto sobre o selo neutro"],
  ["--text-secondary", "--muted", NORMAL, "texto de apoio sobre o selo neutro"],

  // A regra da casa: azul claro pede texto escuro.
  ["--primary-foreground", "--primary", NORMAL, "BOTÃO PRIMÁRIO — a regra da casa"],
  ["--brand-foreground", "--brand", NORMAL, "texto sobre a cor da marca"],

  // O azul legível.
  ["--accent-strong", "--surface-card", NORMAL, "link no cartão"],
  ["--accent-strong", "--surface-page", NORMAL, "link na página"],
  ["--accent-foreground", "--accent", NORMAL, "ícone no quadrado azul claro"],
  ["--info-foreground", "--info", NORMAL, "texto sobre o azul de informação"],

  // A barra lateral escura.
  // A BARRA LATERAL PASSOU A SEGUIR O TEMA (interface "Leve"), então estas seis
  // linhas mediam o par errado: elas conferiam `--text-on-dark` sobre
  // `--surface-sidebar`, e no tema claro isso virou texto branco sobre branco.
  // Deixá-las como estavam faria a varredura reprovar um par que a tela não usa
  // e calar sobre os pares que ela passou a usar — que é o pior dos dois.
  ["--text-secondary", "--surface-sidebar", NORMAL, "nome do item no menu"],
  ["--text-primary", "--surface-sidebar-2", NORMAL, "item do menu em destaque"],
  ["--sidebar-ativo-texto", "--sidebar-ativo-fundo", NORMAL, "ITEM ATIVO do menu"],
  ["--sidebar-ativo-texto", "--surface-sidebar", NORMAL, "item ativo sobre a barra"],
  // O PAR `--text-muted` SOBRE A BARRA LATERAL SAIU DAQUI, e a ausência é a
  // correção: nenhuma tela usa mais essa combinação. A barra é escura nos dois
  // temas, então o token dela é `--text-on-dark-muted`, medido logo abaixo.
  //
  // Ele estava aqui como TEXTO GRANDE, por causa do cargo no rodapé do menu —
  // e o cargo é `text-xs`. A linha dizia "ok" em 4,49:1 enquanto o mínimo do
  // uso real era 4,5:1. Medir um par que ninguém usa é pior que não medir: a
  // lista fica com uma linha verde que não protege tela nenhuma.
  // O item de menu de módulo OPCIONAL. Ele é mais apagado de propósito, e
  // por isso precisa ser MEDIDO: o primeiro valor tentado foi
  // `text-on-dark/45`, que dava 4,05:1 — abaixo do mínimo para texto. Este
  // par é o motivo de o token existir em vez da opacidade.
  ["--text-muted", "--surface-sidebar", NORMAL, "item discreto do menu"],
  ["--text-muted", "--surface-sidebar-2", NORMAL, "item discreto sobre hover"],
  // ESTES DOIS ENTRARAM DEPOIS, e quem os achou foi o axe na página viva, não
  // esta lista — porque eles não estavam nela. O selo "Admin" e o perfil da
  // pessoa usavam `--brand-blue`, que é o azul claro: ele se lê sobre a barra
  // ESCURA, e a barra ficou branca. É a regra da casa virada do avesso — azul
  // claro pede texto escuro — e ela reapareceu no dia em que o fundo mudou.
  // O selo ainda usava `bg-brand-blue/15`, opacidade que o produto proíbe em
  // cor de estado desde sempre; ela passava despercebida sobre o escuro.
  // E o primeiro conserto estava errado nos DOIS temas: `--blue-strong` sobre
  // `--blue-soft` dá 5,24:1 no claro e **2,35:1 no escuro**, porque lá os dois
  // tokens são escuros. O par que serve nos dois é o que o produto já usa no
  // quadrado de ícone — `--accent` com `--accent-foreground` —, e ele existe
  // exatamente para isso: é "o azul legível no tema de agora".
  ["--accent-foreground", "--accent", NORMAL, "selo Admin na barra"],

  // A MALHA DO TOPO, medida contra o composto e não contra a página. Estes
  // quatro pares foram o que decidiu o alfa dela: com o 0,75 da proposta os
  // três tokens de texto passavam e o LINK dava 4,01:1. O alfa caiu para 0,36
  // por causa desta linha, e não por gosto.
  ["--text-primary", "--malha-no-pior-caso", NORMAL, "título sobre a malha"],
  ["--text-secondary", "--malha-no-pior-caso", NORMAL, "texto de apoio sobre a malha"],
  ["--text-muted", "--malha-no-pior-caso", NORMAL, "rótulo sobre a malha"],
  ["--accent-strong", "--malha-no-pior-caso", NORMAL, "link sobre a malha"],

  // O AMARELO SOBRE OS FUNDOS EM QUE ELE CAI, e não só sobre o par nomeado.
  // Ele estava medido contra o cartão e contra --warning-soft, e o axe o
  // achou em 16 telas sobre a PÁGINA, a 4,32:1. É a terceira causa do
  // contraste de novo: um token de 300 usos não se conserta no lugar de
  // chamada, porque o 17º fica para trás.
  ["--warning", "--surface-page", NORMAL, "selo de atenção sobre a página"],
  ["--warning", "--neutral-soft", NORMAL, "selo de atenção sobre o cinza suave"],

  // O DEGRADÊ DA PÍLULA DE AÇÃO, medido nas três paradas e não só no meio.
  // O da proposta passava no meio (4,50) e dava 2,02:1 na ponta ciano — medir
  // uma parada só é a mesma armadilha de medir o texto contra o branco em vez
  // de contra a malha.
  ["--action-foreground", "--action-grad-1", NORMAL, "rótulo no início do degradê"],
  ["--action-foreground", "--action-grad-2", NORMAL, "rótulo no meio do degradê"],
  ["--action-foreground", "--action-grad-3", NORMAL, "rótulo no fim do degradê"],
  ["--accent-strong", "--surface-sidebar", NORMAL, "perfil da pessoa na barra"],

  // `--brand-navy` como superfície. Ele era o painel da marca na tela de login,
  // que SAIU quando a porta virou preta com a molécula — e continua sendo o
  // fundo da faixa de identidade do portal do cliente quando a empresa não
  // subiu capa. Fundo próprio, escuro nos DOIS temas como a barra lateral,
  // então o texto em cima dele é medido aqui e não herda a conta de nenhuma
  // superfície que troca com o tema.
  ["--text-on-dark", "--brand-navy", NORMAL, "nome sobre o azul escuro da marca"],
  ["--text-on-dark-muted", "--brand-navy", NORMAL, "apoio sobre o azul escuro da marca"],

  // --- A PORTA: as quatro telas de (auth) -----------------------------------
  //
  // O vidro do cartão é medido contra o PIOR CASO, e é essa a única conta
  // honesta aqui: o fundo é preto com a molécula azul passando, então o fundo
  // efetivo de um texto do cartão vai de quase preto até o composto do vidro
  // sobre o ponto MAIS CLARO dela. **Ninguém mede uma cor que anda** — quem
  // garante o contraste é o cartão, e é contra o pior caso dele que os três
  // tokens de texto precisam fechar.
  //
  // Medir contra `--auth-fundo` (preto) passaria por larga margem afirmando
  // algo que a tela não garante: a proposta usava vidro a 58%, e nesse valor
  // `--auth-apoio` dava 2,50:1 contra o pior caso e 15:1 contra o preto. As
  // duas contas existiam; só uma descrevia a tela.
  ["--auth-texto", "--vidro-no-pior-caso", NORMAL, "título e valor digitado na porta"],
  ["--auth-rotulo", "--vidro-no-pior-caso", NORMAL, "rótulo de campo na porta"],
  ["--auth-apoio", "--vidro-no-pior-caso", NORMAL, "subtítulo, link e placeholder na porta"],
  // O azul da marca aparece na porta como texto em três lugares: a palavra
  // "chave" do lema, o ícone do escudo em trocar-senha e o fundo do botão.
  ["--brand-blue", "--vidro-no-pior-caso", NORMAL, "a palavra \"chave\" no lema"],
  // E o mesmo trio contra o preto, que é o outro extremo do que passa atrás.
  // Os dois lados entram porque um token pode reprovar no claro E no escuro por
  // razões opostas — foi o que aconteceu com `--text-muted` no Sprint 16.
  ["--auth-apoio", "--auth-fundo", NORMAL, "apoio da porta sobre o preto"],
  ["--brand-blue", "--auth-fundo", GRANDE, "o símbolo da marca sobre o preto"],

  // Estados: cor cheia com texto por cima, e fundo suave com a cor como texto.
  ["--success-foreground", "--success", NORMAL, "texto sobre verde"],
  ["--warning-foreground", "--warning", NORMAL, "texto sobre âmbar"],
  ["--destructive-foreground", "--destructive", NORMAL, "texto sobre vermelho"],
  ["--success", "--success-soft", NORMAL, "selo de sucesso"],
  ["--warning", "--warning-soft", NORMAL, "selo de atenção"],
  ["--danger", "--danger-soft", NORMAL, "selo de erro"],
  ["--neutral", "--neutral-soft", NORMAL, "selo neutro (prioridade Normal)"],
  ["--ferias", "--ferias-soft", NORMAL, "selo de férias"],
  // Na matriz o quadrado de férias é só cor, sem texto: vale a régua de
  // elemento de interface.
  ["--ferias", "--surface-card", GRANDE, "quadrado de férias na matriz"],

  // Elemento de interface: 3:1.
  //
  // --border NÃO entra aqui. Ela separa blocos e desenha o contorno do
  // cartão: some sem prejuízo, e o padrão cobra os 3:1 do que identifica um
  // controle, não de divisória. Exigir 3:1 dela daria um traço pesado em
  // volta de cada cartão — o oposto da tela que o sprint descreve.
  //
  // --input entra: é a borda do CAMPO, o que diz onde se clica para digitar.
  ["--input", "--surface-card", GRANDE, "borda do campo de formulário"],
  ["--input", "--surface-page", GRANDE, "borda do campo sobre a página"],
  ["--ring", "--surface-card", GRANDE, "anel de foco"],

  // As cores de gráfico. Régua de ELEMENTO DE INTERFACE (3:1): uma linha ou
  // uma barra não é texto, e o que o padrão cobra dela é ser distinguível do
  // fundo.
  //
  // O contraste contra o fundo é só metade do problema, e a outra metade
  // nenhuma conta de luminância pega: o par precisa ser distinguível para
  // quem tem daltonismo. Isso foi medido à parte, com o validador de paleta
  // do skill de visualização — receita/despesa em verde e vermelho dava
  // ΔE 4,2 em deuteranopia, ou seja, duas linhas idênticas. O par azul/roxo
  // dá 9,4, e o eixo azul/laranja do saldo dá 20,5.
  ["--serie-1", "--surface-card", GRANDE, "linha e barra da série 1"],
  ["--serie-2", "--surface-card", GRANDE, "linha e barra da série 2"],
  ["--serie-neg", "--surface-card", GRANDE, "coluna de saldo negativo"],
];

// --- nomes que saíram do produto -------------------------------------------
//
// Um critério de aceite do Sprint 8 diz que "Mês a Mês" não existe mais em
// lugar nenhum. Um critério assim não se verifica uma vez: ele se verifica
// toda vez, senão o nome volta num texto de ajuda três sprints depois e
// ninguém percebe.
//
// Eles moram aqui, e não num script próprio, porque este já é o verificador
// que varre o projeto inteiro atrás de coisa que não devia estar lá.

const NOMES_MORTOS = [
  // ---------------------------------------------------------------------
  // A DATA NÃO DECIDE SE UMA PEÇA DE SOCIAL EXISTE PARA O CLIENTE.
  //
  // É a regra do Sprint 3K, e a varredura existe porque o bug que ela
  // conserta não quebra nada: desde a 0044 o mês de social abre sem data em
  // nenhum post, e desde a 0076 a peça pode ir ao cliente num portão do MEIO
  // — a pauta, a legenda —, onde a data ainda não existe. Um filtro
  // `data_publicacao` dentro do mês passa no build, passa no tipo, passa na
  // bateria (que é de SQL), e esconde do cliente material que ele precisa
  // decidir. A RLS libera, a consulta esconde, e o sintoma é uma área de
  // Social vazia com um item em "esperando você" na tela inicial.
  //
  // O recorte certo é a DEMANDA do mês (`posts.social_task_id`), resolvida
  // por `mes_de_social_do_portal()` — o cliente não enxerga `tasks`.
  //
  // SÃO DOIS ARQUIVOS SALVOS, e os dois por razões diferentes.
  //
  // `lib/dados/posts.ts` é salvo pela razão de `datas.ts` na varredura
  // abaixo: é lá que mora a explicação, e ela precisa citar o que proíbe. Lá
  // dentro a data entra só no ramo do post AVULSO, que nunca teve mês — e no
  // `or()` ela acompanha `social_task_id.is.null`.
  //
  // `lib/dados/social-media.ts` é salvo porque ela é a leitura do lado da
  // AGÊNCIA, e lá o recorte por data está certo: aquela consulta desenha uma
  // GRADE DE DIAS, e peça sem dia não tem célula. Quem responde pelos sem
  // data ali é `postsSemData()`, uma consulta própria que alimenta a faixa
  // "Sem data ainda" (0044) — a decisão que o lado do cliente não tinha, e
  // que é justamente o que esta varredura passou a cobrar dele.
  //
  // `onde` continua sendo `src/` inteiro, e não os dois arquivos: o que a
  // regra protege é a leitura NOVA, a que alguém escrever amanhã noutro
  // lugar.
  {
    nome: 'gte("data_publicacao"',
    onde: "src/",
    salvo: ["src/lib/dados/posts.ts", "src/lib/dados/social-media.ts"],
    porque:
      "a data não decide se a peça existe para o cliente — recorte pela demanda do mês",
  },

  // ---------------------------------------------------------------------
  // O HOJE DA AGÊNCIA É UM SÓ, e estas são as duas formas que o produto
  // tinha espalhado por quinze arquivos.
  //
  // `toISOString()` devolve UTC e `format(new Date(), …)` devolve o fuso do
  // PROCESSO — os dois estavam em uso, às vezes na mesma pergunta: o board
  // da Gestão de Tasks decidia atraso por um e o contador de Minhas Tasks
  // pelo outro. E nenhum dos dois é o fuso da agência, que é o que decide se
  // uma etapa venceu: das 21h à meia-noite, num servidor em UTC, tudo o que
  // vence hoje passa a ler atrasada e o contador cobra uma etapa que a
  // pessoa olha e não reconhece.
  //
  // Quem responde é `hojeNaAgencia()`, em `lib/dominio/datas.ts` — e é ele o
  // único arquivo salvo da varredura, porque a explicação da regra precisa
  // citar o que ela proíbe. É a exceção de `icon.svg` na lista de cores, e a
  // armadilha que a lista de nomes mortos já pagou sete vezes.
  {
    nome: "new Date().toISOString().slice(0, 10)",
    onde: "src/",
    salvo: "src/lib/dominio/datas.ts",
    porque: "é a data em UTC, não a da agência — use hojeNaAgencia()",
  },
  {
    nome: 'format(new Date(), "yyyy-MM-dd")',
    onde: "src/",
    salvo: "src/lib/dominio/datas.ts",
    porque: "é a data no fuso do processo, não a da agência — use hojeNaAgencia()",
  },

  // O nome antigo do Financeiro Pessoal, varrido do projeto INTEIRO: ele não
  // pode sobreviver nem numa migration nem num comentário.
  { nome: "Mês a Mês", onde: "src/ scripts/ supabase/ *.md", porque: "o Financeiro Pessoal se chamou assim até o Sprint 8" },
  { nome: "Mes a Mes", onde: "src/ scripts/ supabase/ *.md", porque: "a mesma coisa, sem acento" },
  { nome: "mes-a-mes", onde: "src/ scripts/ supabase/ *.md", porque: "a rota antiga" },

  // A regra-mestra do produto: o Full Hub é o sistema único da agência, e
  // nunca cita ferramenta externa NA INTERFACE.
  //
  // Só `src/` de propósito. O CLAUDE.md precisa nomear as ferramentas para
  // poder proibi-las — varrer a documentação junto faria a verificação
  // acusar a própria regra, que foi exatamente o que ela fez na primeira
  // versão.
  // "Tipo de tarefa" e "workflow" eram dois nomes para a MESMA coisa, e o
  // produto falava os dois: o menu e a rota diziam Workflows, o formulário de
  // abertura e a tela de gestão diziam tipo de tarefa. Quem usava tinha que
  // descobrir sozinho que era a mesma coisa. Ficou Workflow.
  //
  // Só `src/`, pela razão de sempre: o CLAUDE.md precisa nomear o nome antigo
  // para registrar por que ele saiu.
  // VOCABULÁRIO TRABALHISTA. A equipe é toda PJ, e palavra de direito
  // trabalhista num sistema da própria empresa não é impropriedade de
  // linguagem: é prova documental num pedido de reconhecimento de vínculo.
  //
  // SÓ AS FORMAS ACENTUADAS, e a escolha é o que faz esta varredura valer
  // alguma coisa. `ferias`, `licenca` e `folga` sem acento continuam no
  // projeto de propósito: são valor de enum (`hr_tipo`, `presenca_status`) e
  // nome de token de cor, que ninguém que usa o sistema vê e que o usuário
  // decidiu manter. Varrer os dois juntos acusaria essas linhas toda vez, e um
  // alarme que sempre toca é um alarme que ninguém escuta.
  //
  // O que a pessoa LÊ passa por `ROTULOS_DE_TIPO` e `ROTULOS_DE_PRESENCA`, e
  // lá está escrito recesso, indisponibilidade e "sem alocação".
  //
  // E SEM EXCEÇÃO DE ARQUIVO. A primeira versão isentava o módulo de
  // vocabulário, que precisava nomear as palavras para proibi-las — a mesma
  // situação do Trello logo abaixo. Só que o `--exclude` do grep não filtrou
  // nada aqui, e a varredura acusava a si mesma. A saída foi melhor que a
  // exceção: a regra saiu de `src/` e foi para o CLAUDE.md e para o cabeçalho
  // da migration 0016, que é onde ela já devia estar. `src/` ficou limpo de
  // verdade, e a varredura não precisa acreditar em ninguém.
  //
  // "feriado" NÃO entra: é data do calendário nacional, um fato sobre o dia, e
  // não direito concedido a ninguém.
  { nome: "férias", onde: "src/", porque: "vocabulário da CLT — a equipe é PJ; use descanso" },
  { nome: "licença", onde: "src/", porque: "vocabulário da CLT; use afastamento" },
  // Segunda rodada. "Recesso programado" e "indisponibilidade" foram o
  // vocabulário entre a 0016 e a 0018, e saíram por decisão do usuário. A
  // lista CRESCE em vez de ser substituída: nenhuma geração de palavra pode
  // voltar, não só a última — senão alguém copiando uma tela antiga
  // ressuscita a penúltima sem ninguém notar.
  { nome: "recesso", onde: "src/", porque: "vocabulário anterior à 0018; use descanso" },
  { nome: "indisponibilidade", onde: "src/", porque: "vocabulário anterior à 0018; use afastamento" },

  // A TRAVA DE AUTOAPROVAÇÃO, que saiu na 0029 por decisão do usuário.
  //
  // Ela estava em DOIS lugares, e eu só desfiz um: o trigger no Postgres e um
  // `if` em `acoes-de-aprovacao.ts`, que recusava antes de o banco ser
  // chamado. A bateria roda contra o Postgres e passou verde com a action
  // ainda recusando — foi o usuário quem encontrou, clicando em Aprovar.
  //
  // Por isso a varredura, e não um cenário: o que faltava não era um teste de
  // SQL a mais, era alguém perguntando se a frase ainda existe em `src/`. A
  // explicação mora no cabeçalho da 0029 e no CLAUDE.md, fora de `src/`, pela
  // mesma razão do vocabulário do Full Days acima.
  //
  // E A SEGUNDA METADE DO PAR ENTROU AGORA. Até a 0060 esta lista dizia, aqui
  // mesmo, que "envia ao cliente a própria entrega" NÃO entrava — porque
  // aprovar e enviar são duas decisões e o usuário tinha mudado só uma. Ele
  // mudou a outra: a gestão envia inclusive o que produziu.
  //
  // A trava de envio nunca teve a quem recusar, e é o que a 0060 explica: a
  // linha de cima (`is_gestor()`) já barra todo colaborador, então a de baixo
  // só alcançava desenvolvedor e sócio — as duas pessoas que agora podem.
  { nome: "aprova a própria entrega", onde: "src/", porque: "a trava saiu na 0029 — a gestão aprova o próprio trabalho" },
  { nome: "decide a própria entrega", onde: "src/", porque: "a trava saiu na 0029 — a gestão decide a própria rodada" },
  { nome: "envia ao cliente a própria entrega", onde: "src/", porque: "a trava saiu na 0060 — a gestão envia inclusive o que produziu" },

  // E A TERCEIRA FORMA ENTROU NA 3K, porque a varredura não pegou a
  // paráfrase. `state-machine.ts` carregava a trava do envio por mais cinco
  // migrations depois da 0060: o `!souOResponsavel` estava lá, com um
  // comentário dizendo a mesma coisa com outras palavras — e as três linhas
  // acima procuram a frase do usuário, não o sentido dela. O desenvolvedor
  // dono de uma etapa que pede aval do cliente não via o botão, num caminho
  // que o banco aceita desde a 0060.
  //
  // **É a 0029 virada do avesso**, e é o que torna esta linha diferente das
  // três de cima: lá a bateria ficava verde com a action recusando; aqui o
  // banco liberou e a TELA continuou escondendo. Nenhuma das duas formas
  // aparece como erro — a primeira é uma recusa que ninguém esperava, a
  // segunda é um botão que não existe.
  { nome: "manda material ao cliente", onde: "src/", porque: "a mesma trava da 0060, parafraseada — foi assim que ela sobreviveu em state-machine.ts" },

  // ---------------------------------------------------------------------------
  // UM NOME PARA CADA AÇÃO DO FLUXO DE APROVAÇÃO (Sprint 3K, migration 0092).
  //
  // O produto chamava a MESMA ação de três nomes conforme a tela: "Enviar
  // para aprovação" na etapa de demanda, "Marcar como pronto" no post e
  // "Enviar para análise" na peça de campanha. As três abrem uma rodada de
  // escopo `interna`, decidida pela mesma função, na mesma fila — e quem
  // atravessava os três módulos tinha que descobrir isso sozinho.
  //
  // **E a recusa do banco nomeava o botão.** As duas dicas de
  // `validar_transicao_de_subtarefa` diziam *Enviar para aprovação*, e
  // `atualizarTask` as concatena na mensagem: trocar o rótulo só aqui faria o
  // Postgres mandar a pessoa usar um botão que não existe mais. Por isso a
  // 0092 é migration, e não só um `sed` em `src/`.
  //
  // "Enviada para aprovação" NÃO é alcançada por estas linhas, e é de
  // propósito: ela é o rótulo do STATUS `enviada_aprovacao`, não o nome de
  // uma ação. Padronizar é fazer o nome ser um só, não trocar o nome de tudo.
  { nome: "Enviar para aprovação", onde: "src/ scripts/", porque: "a ação se chama Pedir aval interno desde a 0092" },
  { nome: "Enviar para análise", onde: "src/ scripts/", porque: "era o nome dela na campanha; virou Pedir aval interno na 0092" },
  { nome: "Mandar para análise", onde: "src/ scripts/", porque: "a mesma ação, pedida de novo — virou Pedir aval interno de novo" },
  { nome: "Marcar como pronto", onde: "src/ scripts/", porque: "era o nome dela no post; virou Pedir aval interno na 0092" },
  { nome: "Enviar para o cliente", onde: "src/ scripts/", porque: "a ação se chama Enviar ao cliente — um nome só, nos três módulos" },

  // DOIS MÓDULOS QUE SAÍRAM DO PRODUTO, por decisão do usuário.
  //
  // O Resumo Semanal e o Financeiro Pessoal foram apagados: tela, rota, dados
  // e tabelas. Um módulo apagado volta sozinho de um jeito específico — alguém
  // copia uma tela antiga, um atalho fica no menu, um texto de ajuda cita a
  // "letra de cada semana" — e aí o link existe e a rota devolve 404.
  //
  // Só `src/`, pela razão de sempre: o CLAUDE.md e o cabeçalho da 0034
  // precisam nomear os dois para registrar por que saíram, e varrer a
  // documentação junto faria a verificação acusar a própria regra.
  //
  // "Notas Fiscais" NÃO entra: é o módulo pessoal que ficou.
  { nome: "Resumo Semanal", onde: "src/", porque: "o módulo saiu do produto na 0034" },
  { nome: "resumo-semanal", onde: "src/", porque: "a rota saiu do produto na 0034" },
  { nome: "Financeiro Pessoal", onde: "src/", porque: "o módulo saiu do produto na 0034" },
  { nome: "financeiro-pessoal", onde: "src/", porque: "a rota saiu do produto na 0034" },
  { nome: "weekly_entries", onde: "src/", porque: "a tabela foi apagada na 0034" },
  { nome: "weekly_notes", onde: "src/", porque: "a tabela foi apagada na 0034" },
  { nome: "personal_finance_entries", onde: "src/", porque: "a tabela foi apagada na 0034" },

  // E O TERCEIRO, na 0043: o Meu Desenvolvimento.
  //
  // A LISTA CRESCE, como a do vocabulário do Full Days: nenhuma geração de
  // nome pode voltar, não só a última. Alguém copiando uma tela antiga
  // ressuscita a penúltima sem ninguém notar.
  //
  // `skills` e `skill_id` NÃO entram, e a distinção é o ponto: o catálogo
  // FICOU, agora como vocabulário de etiquetas do Full Academy — decisão do
  // usuário. O que saiu foi a autoavaliação e a observação da gestão.
  { nome: "Meu Desenvolvimento", onde: "src/", porque: "o módulo saiu do produto na 0043" },
  { nome: "meu-desenvolvimento", onde: "src/", porque: "a rota saiu do produto na 0043" },
  { nome: "minhas-skills", onde: "src/", porque: "a rota antiga dele, e o 308 saiu junto na 0043" },
  { nome: "user_skills", onde: "src/", porque: "a tabela foi apagada na 0043" },
  { nome: "skill_avaliacoes", onde: "src/", porque: "a tabela foi apagada na 0043" },
  { nome: "quer_desenvolver", onde: "src/", porque: "a coluna foi apagada com user_skills na 0043" },
  { nome: "Recomendadas para você", onde: "src/", porque: "a vitrine saiu com a origem do sinal, na 0043" },

  { nome: "tipo de tarefa", onde: "src/", porque: "virou Workflow — um nome só para a mesma coisa" },
  { nome: "tipos de tarefa", onde: "src/", porque: "virou Workflows" },

  // O VOCABULARIO INTERNO NAO ATRAVESSA A PAREDE DO PORTAL.
  //
  // "task", "subtarefa", "etapa", "workflow" e "sprint" sao palavras da
  // agencia. O cliente recebe MATERIAL, e ele pertence a uma DEMANDA. A
  // traducao mora em `lib/dominio/portal.ts`, e e por existir esse lugar unico
  // que esta varredura consegue exigir que o resto esteja limpo.
  //
  // O ALCANCE E SO A AREA DO CLIENTE, e as palavras sao as PORTUGUESAS: o
  // valor de enum `subtask` e a camada em ingles, como nome de tabela, e
  // continua valendo. Varrer "task" pegaria "subtask" junto e o alarme tocaria
  // sempre -- alarme que sempre toca e alarme que ninguem escuta.
  {
    nome: "subtarefa",
    onde: "'src/app/(cliente)' src/components/portal",
    porque: "jargão interno na tela do cliente; ele vê material, não subtarefa",
  },
  {
    nome: "etapa",
    onde: "'src/app/(cliente)' src/components/portal",
    porque: "jargão interno na tela do cliente; use material",
  },
  {
    nome: "workflow",
    onde: "'src/app/(cliente)' src/components/portal",
    porque: "jargão interno na tela do cliente",
  },
  {
    nome: "sprint",
    onde: "'src/app/(cliente)' src/components/portal",
    porque: "vocabulário do projeto, não do produto — nem em comentário da área do cliente",
  },

  { nome: "Trello", onde: "src/", porque: "ferramenta externa citada na interface" },
  { nome: "ClickUp", onde: "src/", porque: "ferramenta externa citada na interface" },
  { nome: "Asana", onde: "src/", porque: "ferramenta externa citada na interface" },
];

// --- execução --------------------------------------------------------------

const css = readFileSync(CSS, "utf8");
const { claro, escuro } = blocos(css);
const base = declaracoes(claro);
const dark = declaracoes(escuro);

let falhas = 0;
let avisos = 0;

console.log("\nNomes que saíram do produto\n");

/**
 * A BUSCA DE NOME MORTO NAO PASSA MAIS PELO `grep -i`, e a razao e um furo
 * que esta varredura teve desde que a lista ganhou palavra com acento.
 *
 * `grep -i` faz case-fold pelo LOCALE. Numa maquina com `LC_CTYPE=POSIX` --
 * o padrao de muito container, inclusive o desta sessao -- ele dobra so
 * ASCII: "VOCE" casa com "voce", e "VOCÊ" NAO casa com "você". Metade da
 * lista de nomes mortos e acentuada, e todos eles vinham passando em branco.
 *
 * O sintoma foi o pior possivel: a varredura respondia "ok, nao aparece em
 * lugar nenhum" na minha maquina e FALHA no CI, para o mesmo commit. Uma
 * checagem cujo trabalho inteiro e afirmar que um nome nao existe nao pode
 * depender de variavel de ambiente para saber ler.
 *
 * `toLowerCase()` do JavaScript dobra acento pelo Unicode, igual em qualquer
 * sistema. O `grep` continua fazendo o que ele faz bem -- achar os arquivos.
 */
function ondeAparece(nome, onde) {
  let arquivos = "";
  try {
    arquivos = execSync(
      `grep -rl "" ${onde} --include=*.ts --include=*.tsx --include=*.mjs --include=*.sql --include=*.md 2>/dev/null || true`,
      { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
    ).trim();
  } catch {
    return [];
  }

  const alvo = nome.toLowerCase();
  const linhas = [];

  for (const arquivo of arquivos.split("\n").filter(Boolean)) {
    let texto;
    try {
      texto = readFileSync(arquivo, "utf8");
    } catch {
      continue;
    }
    if (!texto.toLowerCase().includes(alvo)) continue;

    texto.split("\n").forEach((linha, i) => {
      if (linha.toLowerCase().includes(alvo)) {
        linhas.push(`${arquivo}:${i + 1}: ${linha.trim()}`);
      }
    });
  }

  return linhas;
}

for (const { nome, onde, porque, salvo } of NOMES_MORTOS) {
  const achados = ondeAparece(nome, onde).join("\n");
  // O próprio check-cores.mjs cita os nomes na lista acima: ignorar este
  // arquivo é o que impede a verificação de acusar a si mesma. `salvo` é a
  // mesma ideia declarada caso a caso, para a regra que só pode ser
  // explicada citando o que ela proíbe — um arquivo ou uma lista deles,
  // porque uma regra pode ter mais de uma exceção com motivos diferentes.
  const salvos = salvo ? (Array.isArray(salvo) ? salvo : [salvo]) : [];
  const linhas = achados
    .split("\n")
    .filter(
      (l) =>
        l &&
        !l.startsWith("scripts/check-cores.mjs") &&
        !salvos.some((s) => l.startsWith(s)),
    );

  if (linhas.length === 0) {
    console.log(`  ok      “${nome}” não aparece em lugar nenhum`);
  } else {
    falhas++;
    console.log(`  FALHA   “${nome}” ainda aparece — ${porque}`);
    for (const linha of linhas.slice(0, 5)) console.log(`          ${linha}`);
  }
}

console.log("\nContraste — tema CLARO e tema ESCURO\n");

for (const [frente, fundo, minimo, descricao] of PARES) {
  const linha = [];
  let ruim = false;

  for (const [nome, tema] of [
    ["claro", new Map()],
    ["escuro", dark],
  ]) {
    const f = resolver(frente, tema, base);
    const b = resolver(fundo, tema, base);
    const razao = contraste(f, b);
    if (razao < minimo) ruim = true;
    linha.push(`${nome} ${razao.toFixed(2)}:1`);
  }

  if (ruim) {
    falhas++;
    console.log(`  FALHOU  ${descricao}`);
    console.log(`          ${frente} sobre ${fundo} — ${linha.join("   ")} (mínimo ${minimo})`);
  } else {
    console.log(`  ok      ${descricao.padEnd(38)} ${linha.join("   ")}`);
  }
}

// --- opacidade em cor de ESTADO ---------------------------------------------
//
// A regra do produto: selo de estado usa o PAR NOMEADO (`bg-warning-soft
// text-warning`), nunca `bg-warning/10`. Opacidade sobre um fundo qualquer dá
// uma cor que ninguém mediu -- e no tema escuro dá outra, porque o fundo é
// outro.
//
// A regra estava escrita no CLAUDE.md e em dois comentários de código, e
// nunca tinha sido VERIFICADA. No Sprint 9 eu mesmo escrevi `bg-info/10` num
// selo de categoria e passei por esta varredura sem um aviso: ela só conferia
// se a classe existia, e `bg-info/10` existe.
//
// Só os tokens de estado que TÊM par suave entram. `bg-muted/40` e
// `bg-primary/90` são do shadcn e não são selo de estado -- varrê-los daria
// um alarme que toca sempre, e alarme que toca sempre ninguém escuta.

console.log("\nOpacidade onde o par nomeado é a regra\n");

const COM_PAR_SUAVE = ["warning", "success", "danger", "neutral", "ferias", "info", "brand"];

{
  let achados = "";
  try {
    const alvo = COM_PAR_SUAVE.map((t) => `(bg|text|border)-${t}/[0-9]`).join("|");
    achados = execSync(
      `grep -rnE ${JSON.stringify(alvo)} src/ --include=*.ts --include=*.tsx | grep -v "^[^:]*:[0-9]*: *\\*" | grep -v "nunca" || true`,
      { encoding: "utf8" },
    ).trim();
  } catch {
    achados = "";
  }

  if (achados) {
    falhas++;
    console.log("  FALHA   opacidade num token de estado — use o par nomeado");
    for (const linha of achados.split("\n").slice(0, 10)) {
      console.log(`          ${linha.trim()}`);
    }
  } else {
    console.log("  ok      nenhum token de estado usado com opacidade");
  }
}

// --- hex fora do arquivo de tokens -----------------------------------------

console.log("\nCor literal fora de globals.css\n");

const permitidos = new Set(EXCECOES.map((e) => e.arquivo));
let saida = "";
try {
  saida = execSync(
    `grep -rnoiE '#[0-9a-f]{3,8}\\b' src/ --include=*.tsx --include=*.ts --include=*.css --include=*.svg || true`,
    { encoding: "utf8" },
  );
} catch {
  saida = "";
}

const achados = saida
  .split("\n")
  .filter(Boolean)
  .map((l) => {
    const [arquivo, linha, ...resto] = l.split(":");
    return { arquivo, linha, cor: resto.join(":") };
  })
  .filter((a) => a.arquivo !== CSS);

const proibidos = achados.filter((a) => !permitidos.has(a.arquivo));

for (const a of proibidos) {
  falhas++;
  console.log(`  FALHOU  ${a.arquivo}:${a.linha} — ${a.cor}`);
  console.log(`          Cor de interface mora em ${CSS}, e só lá.`);
}

if (proibidos.length === 0) {
  console.log("  ok      nenhuma — toda cor de interface vem dos tokens");
}

for (const e of EXCECOES) {
  const quantos = achados.filter((a) => a.arquivo === e.arquivo).length;
  if (quantos === 0) {
    avisos++;
    console.log(`  aviso   ${e.arquivo} não tem mais cor literal — a exceção pode sair daqui.`);
  } else {
    console.log(`  exceção ${e.arquivo} (${quantos})`);
    console.log(`          ${e.motivo}`);
  }
}

// --- classe de cor que nao existe ------------------------------------------
//
// No Tailwind v4, utilitario desconhecido nao da erro: ele simplesmente nao
// gera CSS. `text-acent-strong` com um "c" a menos some da folha de estilo e a
// tela fica com a cor herdada, sem ninguem notar. Aqui cada classe de cor
// usada no projeto e conferida contra os nomes declarados no @theme inline.

console.log("\nClasse de cor que o Tailwind não conhece\n");

const temaInline = (() => {
  const i = css.indexOf("@theme inline {");
  const fecha = css.indexOf("\n}", i);
  return new Set(
    [...css.slice(i, fecha).matchAll(/--color-([a-z0-9-]+)\s*:/g)].map((m) => m[1]),
  );
})();

/**
 * Os prefixos que quase sempre levam cor. `divide-`, `outline-` e afins ficam
 * de fora: o ganho é pequeno e a lista de exceções cresce demais.
 */
const PREFIXOS = ["bg", "text", "border", "ring", "fill", "stroke"];

/** Nomes que o Tailwind já traz de fábrica e não precisam estar no @theme. */
const DE_FABRICA =
  /^(inherit|current|transparent|black|white|auto|none|(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3})$/;

/**
 * O que esses mesmos prefixos levam quando NÃO é cor.
 *
 * Esta lista existe para que a conferência possa ser pela negativa: tudo que
 * não é cor conhecida nem valor conhecido é suspeito. Ao contrário, tentar
 * adivinhar "parece uma cor nossa?" deixa passar justamente o erro que
 * interessa — `text-acent-strong`, com um "c" a menos, não parece nada.
 */
const NAO_E_COR = new Set([
  // tamanho e alinhamento de texto
  "xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl", "5xl", "6xl", "7xl", "8xl", "9xl",
  "left", "center", "right", "justify", "start", "end",
  "balance", "pretty", "nowrap", "ellipsis", "clip", "wrap", "style",
  // borda
  "t", "r", "b", "l", "x", "y", "s", "e",
  "solid", "dashed", "dotted", "double", "hidden", "collapse", "separate",
  "spacing",   // border-spacing-*, de tabela
  "reveal",    // text-reveal-*
  // fundo
  "fixed", "local", "scroll", "clip-text", "clip-border", "clip-padding", "clip-content",
  "cover", "contain", "repeat", "no-repeat", "repeat-x", "repeat-y", "repeat-round",
  "repeat-space", "origin-border", "origin-padding", "origin-content", "bottom", "top",
  "blend-normal", "blend-multiply", "blend-screen", "blend-overlay",
  // ring e offset
  "inset", "offset",
]);

/** `border-b-2`, `bg-gradient-to-br`, `ring-offset-2` — sufixo com número ou direção. */
function valorConhecido(nome) {
  if (NAO_E_COR.has(nome)) return true;
  const primeiro = nome.split("-")[0];
  if (NAO_E_COR.has(primeiro)) return true;
  if (/^\d/.test(nome)) return true;           // border-2, ring-4
  if (nome.startsWith("gradient-")) return true;
  if (nome.startsWith("linear-") || nome.startsWith("radial-") || nome.startsWith("conic-")) return true;
  return false;
}

// O ponto antes do \\b captura UM caractere de contexto. Sem ele,
// `[text-orientation:mixed]` -- propriedade CSS arbitrária do Tailwind --
// entrega `text-orientation` ao detector, que reclama de um utilitário que
// nunca existiu. Com o contexto dá para descartar o que vem logo depois de
// `[`, `-` ou `:`.
let classes = "";
try {
  classes = execSync(
    `grep -rhoE '.?\\b(${PREFIXOS.join("|")})-[a-z][a-z0-9-]*' src/ --include=*.tsx --include=*.ts || true`,
    { encoding: "utf8" },
  );
} catch {
  classes = "";
}

const desconhecidas = new Map();
for (const comContexto of new Set(classes.split("\n").filter(Boolean))) {
  // Descarta o que estava dentro de um valor arbitrário ou colado noutra
  // palavra: `[text-orientation:…]`, `--text-sm`, `algo:text-xs` já tratado
  // pelo prefixo de variante.
  const anterior = comContexto.length > 0 && !/^[a-z]/.test(comContexto[0])
    ? comContexto[0]
    : "";
  if (anterior === "[" || anterior === "-") continue;

  const bruta = anterior ? comContexto.slice(1) : comContexto;
  const corte = bruta.indexOf("-");
  const prefixo = bruta.slice(0, corte);
  const nome = bruta.slice(corte + 1);

  if (DE_FABRICA.test(nome)) continue;
  if (temaInline.has(nome)) continue;
  if (valorConhecido(nome)) continue;

  desconhecidas.set(bruta, `${prefixo}-${nome}`);
}

if (desconhecidas.size === 0) {
  console.log("  ok      toda classe de cor usada existe no @theme inline");
} else {
  for (const classe of desconhecidas.keys()) {
    falhas++;
    console.log(`  FALHOU  ${classe} — não há --color-* com esse nome em ${CSS}`);
    console.log(`          O Tailwind não emite nada para ela, e a tela fica sem a cor.`);
  }
}

console.log("");
if (falhas > 0) {
  console.log(`${falhas} problema(s). A interface não está pronta.\n`);
  process.exit(1);
}
console.log(`Tudo certo${avisos ? ` (${avisos} aviso)` : ""}.\n`);
