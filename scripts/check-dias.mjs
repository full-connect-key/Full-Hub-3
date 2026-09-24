/**
 * Os casos obrigatórios da contagem de dias do Full Days.
 *
 * POR QUE UM SCRIPT, E NÃO UM CENÁRIO DA BATERIA: a conta existe nos DOIS
 * lados — `dias_do_pedido()` no Postgres e `contarDiasDoPedido()` aqui —, e a
 * bateria só alcança o primeiro. Um período que atravessa o mês é justamente
 * onde os dois podem discordar sem ninguém notar, porque a tela mostra um
 * número e o banco grava outro.
 *
 * SOBRE O HORÁRIO DE VERÃO, e é registro de uma suspeita que não se
 * confirmou. `lerData()` monta `new Date(ano, mes - 1, dia)` — meia-noite
 * local —, e a leitura óbvia é que num dia sem meia-noite isso escorrega de
 * data. Fui atrás: varri 2026 e 2027 inteiros em quatro fusos com transição
 * na virada do dia (Santiago, Beirute, Lord Howe, Havana) e **não há uma data
 * sequer** em que `new Date(a, m, d)` devolva outro dia do calendário. Os
 * únicos desvios são estouro normal (31 de abril vira 1º de maio), que não
 * tem nada a ver com fuso.
 *
 * Então o código ficou como estava. Fica a varredura em três fusos abaixo
 * para o caso de alguém trocar o passo de dia por aritmética de
 * milissegundos — ESSE quebra, e é o que o sprint mandava não fazer.
 */
import { execFileSync } from "node:child_process";

const FUSOS = [
  ["America/Sao_Paulo", "sem horário de verão desde 2019 — o controle"],
  ["America/Santiago", "muda o relógio na virada do dia"],
  ["Asia/Beirut", "muda o relógio na virada do dia"],
];

// tipo, início, fim, esperado, o que o caso prova
const CASOS = [
  ["ferias", "2026-10-05", "2026-10-09", 5, "cinco dias dentro do mês"],
  ["ausencia", "2026-10-05", "2026-10-09", 5, "os mesmos cinco, em dias úteis"],
  ["ferias", "2026-10-28", "2026-11-03", 7, "corridos ATRAVESSANDO o mês"],
  ["ausencia", "2026-10-28", "2026-11-03", 5, "úteis atravessando o mês"],
  ["ferias", "2026-12-28", "2027-01-05", 9, "corridos atravessando o ANO"],
  ["ferias", "2026-10-01", "2026-10-01", 1, "um dia só conta um"],
  ["ausencia", "2026-10-01", "2026-10-01", 1, "um dia útil só conta um"],
  ["ferias", "2026-10-15", "2026-03-01", 0, "fim antes do início não conta nada"],

  // OS PERÍODOS QUE CRUZAM UMA TRANSIÇÃO DE HORÁRIO DE VERÃO. Beirute recua
  // o relógio no dia 25 de outubro e Santiago no dia 5 de abril. Com o passo
  // de dia em `setDate(+1)` eles passam — é o ponto. Trocado por soma de
  // milissegundos, é aqui que aparece o dia a mais ou a menos.
  ["ferias", "2026-10-23", "2026-10-27", 5, "Beirute recua o relógio no dia 25"],
  ["ausencia", "2026-10-23", "2026-10-27", 3, "os mesmos dias, em úteis"],
  ["ferias", "2026-04-04", "2026-04-08", 5, "Santiago recua o relógio no dia 5"],
];

const DENTRO = `
import { contarDiasDoPedido } from "./src/lib/dominio/full-days.ts";
const casos = ${JSON.stringify(CASOS)};
// Sem feriado: os feriados reais moram no banco, e o que se prova aqui é a
// travessia de mês e de ano, não o calendário nacional.
const saida = casos.map(([tipo, de, ate]) =>
  contarDiasDoPedido(tipo, de, ate, new Set()),
);
console.log(JSON.stringify(saida));
`;

let falhas = 0;
console.log("\nContagem de dias do Full Days\n");

for (const [fuso, nota] of FUSOS) {
  const bruto = execFileSync(process.execPath, ["--experimental-strip-types", "--input-type=module", "--eval", DENTRO], {
    encoding: "utf8",
    env: { ...process.env, TZ: fuso },
    stdio: ["pipe", "pipe", "pipe"],
  });
  const obtidos = JSON.parse(bruto.trim().split("\n").at(-1));

  console.log(`  ${fuso} — ${nota}`);
  CASOS.forEach(([tipo, de, ate, esperado, porque], i) => {
    const obtido = obtidos[i];
    const ok = obtido === esperado;
    if (!ok) falhas++;
    const rotulo = `${de} → ${ate} (${tipo})`;
    console.log(
      `    ${ok ? "ok    " : "FALHOU"}  ${rotulo.padEnd(34)} ${String(obtido).padStart(2)} / ${esperado}  ${porque}`,
    );
  });
  console.log("");
}

if (falhas > 0) {
  console.log(`${falhas} conta(s) erradas. A tela mostraria um número e o banco gravaria outro.\n`);
  process.exit(1);
}
console.log("Tudo certo.\n");
