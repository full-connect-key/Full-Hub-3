#!/usr/bin/env node
/**
 * TODA SERVER ACTION EXPORTADA TEM QUE TER CHAMADOR.
 *
 * ---------------------------------------------------------------------------
 * **A FALHA QUE ELA EXISTE PARA PEGAR É UMA TELA ESPERANDO UM BOTÃO.**
 *
 * O produto já tem um nome para a metade de cima disto: a PONTE construída e
 * nunca atravessada — uma coluna que nasce numa migration e que nenhuma linha
 * de `src/` lê. Foram doze, de `clients.drive_folder_id` a
 * `notifications.origem_id`, e cada uma levou sprints para ser notada.
 *
 * **Esta é a metade de baixo, e ela é pior.** A migration 0086 criou
 * `apagar_mes_de_social()`, `limpar_posts_do_mes()` e `o_que_vai_com_o_mes()`,
 * a bateria provou as três com vinte e sete cenários, as quatro Server Actions
 * foram escritas no mesmo dia — e o BOTÃO nunca existiu. O cabeçalho daquela
 * migration afirma que há *"duas portas para o mesmo estrago: o botão do
 * Social Media e o 'Excluir task' do board"*, e a frase do diálogo do board
 * aponta para cá — *"a contagem exata fica no diálogo do Social Media"*. Só a
 * segunda porta foi construída.
 *
 * Quem encontrou foi o usuário, meses depois: *"Ainda não consigo deletar um
 * mês inteiro de social"*. É a lição da 0029 e da 0060 outra vez, de um
 * terceiro ângulo: lá a regra morava nos dois lados e desfazer um não desfez
 * nada; aqui a regra inteira estava de pé e ninguém alcançava.
 *
 * **NENHUMA DAS OUTRAS VARREDURAS PEGA ISTO, e vale dizer por quê.**
 * `check:tipos` liga a migration ao tipo e o tipo à chamada — e aqui o tipo
 * estava certo e a chamada existia, na action. `check:fronteira` liga servidor
 * a cliente. `check:cores` mede cor e nome morto. O `tsc` não reclama de um
 * `export` sem consumidor, o `lint` reclama de variável não usada e não de
 * função exportada, e o `npm run build` compila tudo. Uma action órfã atravessa
 * a verificação inteira — ela só aparece para quem vai procurar o botão.
 * ---------------------------------------------------------------------------
 *
 * **O QUE ELA MEDE é o nome aparecendo em qualquer outro arquivo de `src/` ou
 * de `scripts/prototipo/`**, e não a forma da chamada. Uma action chegou a
 * uma tela por três caminhos diferentes neste produto — chamada direta,
 * passada como prop, embrulhada num `chamarAcao(() => ...)` —, e uma varredura
 * que exigisse a forma reprovaria o caminho novo em vez do furo.
 *
 * **E A ISENÇÃO É DECLARADA, com o motivo escrito**, que é a decisão do
 * `-- SEM LINHA:` do `onde-esta-o-banco.sql`: uma lista de nomes a ignorar sem
 * razão ao lado é onde o furo seguinte se esconde. Cada linha abaixo diz o que
 * falta e o que ela custaria — ou que a action é CÓDIGO MORTO, que pela regra
 * da 0023 se apaga e não se aposenta.
 */

import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

/**
 * As actions sem chamador que são ESCOLHA, cada uma com o motivo.
 *
 * Todas as sete abaixo foram encontradas pela primeira rodada desta varredura,
 * no mesmo commit em que o botão de apagar o mês de social foi construído.
 * Nenhuma foi resolvida ali: o pedido era uma tela, e cinco telas a mais num
 * commit de conserto é escopo que ninguém pediu. Elas ficam nomeadas aqui, com
 * o que falta, em vez de desaparecerem numa lista de exceções sem razão.
 */
const ISENTAS = {
  "gestao-tasks/acoes.ts:criarTask":
    "CÓDIGO MORTO, e pela regra da 0023 ela se apaga. A 0028 trocou o formulário de abertura pela tela de detalhe: a demanda nasce como rascunho no clique de '+ Nova task', por outra action, e tudo salva campo a campo. Esta cria a task com as subtarefas de uma vez, que é o caminho que deixou de existir — e é o pior tipo de código morto, porque ela parece a maneira certa de criar uma demanda para quem a encontrar.",
  "gestao-tasks/acoes-de-itens.ts:reordenarSubtarefas":
    "FALTA A TELA: não há como reordenar as etapas de uma demanda arrastando. O dnd-kit já está no projeto e o board de etapas de Minhas Tasks arrasta desde o Sprint 10, então o que falta é a lista do detalhe da Task virar um alvo de solta.",
  "comodatos/acoes.ts:registrarFoto":
    "FALTA A TELA, e ela é a que o módulo precisa mais: o CLAUDE.md diz que as fotos *'são o que resolve discussão na devolução — a tampa já estava assim'*, e não existe por onde subir uma. `asset_photos` e o bucket estão de pé desde a 0069, com o momento (entrega/devolução) em coluna.",
  "feedback/acoes.ts:marcarFeedbackExplicado":
    "FALTA O CHAMADOR, e ele é uma linha: `/painel/feedback/sobre` explica o módulo e nada registra que a pessoa leu. Sem isso a explicação ou aparece sempre, ou nunca — e o módulo inteiro depende de ela ser lida ANTES do primeiro relatório.",
  "aprovacoes/acoes-de-campanha.ts:moverEntregavel":
    "FALTA A TELA: a árvore de produção mostra o status de cada peça e não o troca. `aprovado` e `rejeitado` continuam fora dela de propósito — quem decide é o cliente —, então o que falta é mover entre os estados internos.",
  "academy/acoes.ts:excluirTrilha":
    "FALTA A TELA, e aqui a ausência pode ser a decisão certa: despublicar devolve a trilha ao rascunho e já resolve o caso comum. Apagar leva o progresso de quem a concluiu, e a regra da casa é que histórico não se apaga. Se a ausência for a escolha, a action é que sai.",
  "recomendacoes/acoes.ts:editarRecomendacao":
    "FALTA A TELA, e o CLAUDE.md promete esta: *'editar é só do autor; a gestão modera apagando, nunca reescrevendo o que outra pessoa disse'*. A policy de UPDATE fecha no autor desde a 0017, então a regra está no banco e o autor não tem por onde exercê-la.",
};

const RAIZ = process.cwd();

function listar(comando) {
  return execSync(comando, { cwd: RAIZ, encoding: "utf8" })
    .trim()
    .split("\n")
    .filter(Boolean);
}

// Os arquivos de action: `acoes*.ts` e qualquer coisa dentro de `_actions/`.
const ARQUIVOS_DE_ACAO = listar(
  `find src -type f \\( -name 'acoes*.ts' -o -path '*_actions*' \\) -name '*.ts'`,
).sort();

// Onde um chamador pode morar: `src/` inteiro, mais os stubs do protótipo —
// uma action chamada só pelo stub ainda tem tela, e é a tela que importa.
const FONTES = listar(
  `find src scripts/prototipo -type f \\( -name '*.ts' -o -name '*.tsx' \\)`,
);

const CORPO = new Map(FONTES.map((f) => [f, readFileSync(f, "utf8")]));

const orfas = [];
const isentas = [];
let total = 0;

for (const arquivo of ARQUIVOS_DE_ACAO) {
  const texto = CORPO.get(arquivo) ?? readFileSync(arquivo, "utf8");
  const nomes = [...texto.matchAll(/^export async function (\w+)/gm)].map((m) => m[1]);

  for (const nome of nomes) {
    total += 1;

    // A CHAVE É O CAMINHO CURTO, a partir de `painel/`: o prefixo de rota tem
    // parêntese e muda quando um grupo de rota é renomeado, e uma isenção que
    // some numa remontagem de pastas é uma isenção que passa a esconder o
    // furo em silêncio.
    const chave = `${arquivo.replace(/^.*?painel\//, "")}:${nome}`;

    const procura = new RegExp(`\\b${nome}\\b`);
    let chamador = null;
    for (const [outro, conteudo] of CORPO) {
      if (outro === arquivo) continue;
      if (procura.test(conteudo)) {
        chamador = outro;
        break;
      }
    }

    if (chamador) {
      // UMA ISENÇÃO QUE DEIXOU DE SER VERDADE TAMBÉM REPROVA, e é a metade
      // que a lista de nomes mortos não tem: sem isto, conectar a tela de uma
      // action isenta deixaria aqui uma frase dizendo que ela não tem tela —
      // prosa mantida à mão, lida por quem está em dúvida, errada no dia em
      // que alguém a resolveu. É a armadilha da tabela de migrations
      // pendentes do CLAUDE.md, e ela já custou uma vez.
      if (ISENTAS[chave]) {
        orfas.push({
          chave,
          arquivo,
          nome,
          resolvida: chamador,
        });
      }
      continue;
    }

    if (ISENTAS[chave]) isentas.push({ chave, razao: ISENTAS[chave] });
    else orfas.push({ chave, arquivo, nome, resolvida: null });
  }
}

console.log("\nServer Action exportada e sem chamador\n");

const quebradas = orfas.filter((o) => !o.resolvida);
const resolvidas = orfas.filter((o) => o.resolvida);

if (quebradas.length === 0 && resolvidas.length === 0) {
  console.log(`  ok      ${total} action(ões) conferida(s), todas com tela`);
} else {
  for (const o of quebradas) {
    console.log(`  FALHA   ${o.chave}`);
    console.log(
      `          exportada e ninguém a chama — a regra existe e ninguém a alcança.`,
    );
    console.log(
      `          Ou a tela que a usa falta, ou ela é código morto: pela 0023, código`,
    );
    console.log(
      `          morto se apaga. Isentar exige escrever o motivo em ISENTAS.`,
    );
  }
  for (const o of resolvidas) {
    console.log(`  FALHA   ${o.chave}`);
    console.log(`          ela JÁ TEM chamador (${o.resolvida}), e continua isenta.`);
    console.log(`          Tire a linha dela de ISENTAS: a razão ali virou mentira.`);
  }
}

for (const i of isentas) {
  console.log(`  isenta  ${i.chave}`);
  console.log(`          ${i.razao}`);
}

if (quebradas.length > 0 || resolvidas.length > 0) {
  console.log("\nReprovado.\n");
  process.exit(1);
}

console.log("\nTudo certo.\n");
