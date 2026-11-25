import { AlertTriangle } from "lucide-react";

/**
 * O dia escolhido é feriado — dito embaixo do campo de data.
 *
 * Decisão do usuário: *"quando vou montar uma task, quero que você deixe o dia
 * do feriado com um aviso caso eu selecione ele, de que aquele dia é feriado,
 * para evitar realocações de tasks"*.
 *
 * **NÃO HÁ MIGRATION, E NÃO HÁ CONSULTA NOVA.** `holidays` existe desde a
 * 0011, a 0038 a estendeu até 2030, e `feriadosComNome()` já a lê com o nome
 * de cada data — é a leitura que a grade do Day Off usa. Era a ponte
 * construída e não atravessada: o campo de data de uma etapa nascia sem saber
 * nada da tabela que o produto já mantém.
 *
 * **O AVISO AVISA E NUNCA RECUSA**, que é a regra da carga desde a 0081:
 * marcar o prazo num feriado é incomum e às vezes é de propósito — a peça que
 * sai no dia 25 é montada antes, e a agência decide. Travar o campo recusaria
 * o caso que não é erro e mandaria a pessoa procurar outro caminho. O que ele
 * muda é onde a pessoa descobre: hoje, em vez de no dia da realocação.
 *
 * **E ELE NÃO REPETE A DATA.** O campo logo acima a mostra, e dizer "25/12 é
 * feriado" embaixo de um campo escrito 25/12 é o mesmo fato duas vezes a dois
 * centímetros de distância. O que ele acrescenta é o NOME — que é o que
 * distingue um feriado de um erro de digitação — e a consequência.
 *
 * **`--warning` e nunca `--danger`:** não há erro de ninguém aqui, e vermelho
 * num campo que se preenche todo dia treina o hábito de ignorar vermelho — a
 * regra do alerta de 7 dias do portal e dos quatro sinais de carga.
 *
 * **ISTO NÃO CONTRADIZ `DO_CALENDARIO`** (`lib/dominio/disponibilidade.ts`),
 * que tira fim de semana e feriado do aviso de sobrecarga com a razão escrita:
 * *"fim de semana e feriado apagam a célula na grade, e avisar sobre eles seria
 * um aviso em metade dos cliques"*. Aquele argumento é sobre a GRADE da faixa
 * de disponibilidade, onde a célula do feriado já sai apagada — ela mostra o
 * fato pelo desenho. Um `<input type="date">` não mostra nada: digitar 25/12
 * ali não dá sinal nenhum, e é essa superfície que este aviso cobre.
 *
 * **O FERIADO DE CLIENTE TEM FRASE PRÓPRIA, e isso não é estilo.** "A equipe
 * não trabalha neste dia" é FALSO quando o feriado é de uma conta: a agência
 * está aqui, as outras contas andam, e o que muda é que aquela conta não
 * responde. Reaproveitar a frase diria à pessoa que a casa fecha num dia em
 * que ela vai trabalhar — e, pior, no único caso em que datar ali é
 * deliberado: a peça que sai na véspera do feriado do cliente é montada com
 * ele dentro. Por isso são dois mapas e não um, e `holidays` continua
 * respondendo só pela AGÊNCIA (`dias_uteis()` lê aquela tabela).
 *
 * **E QUANDO O DIA É OS DOIS, o nacional ganha.** Ele é o que tira o dia da
 * conta de dias úteis; o do cliente, nesse dia, não acrescenta nada que mude a
 * decisão. Duas linhas empilhadas embaixo do campo seriam dois avisos para um
 * clique.
 *
 * Os mapas vêm prontos de quem renderiza (data → nome), para a leitura ser uma
 * por visita e não uma por tecla — e o do cliente já vem recortado na conta
 * certa: quem sabe de qual conta é a demanda é a tela, não este componente.
 */
export function AvisoDeFeriado({
  data,
  feriados,
  feriadosDoCliente,
}: {
  /** A data escolhida, em `yyyy-MM-dd`, ou vazio. */
  data: string | null | undefined;
  /** O mapa data → nome do feriado da agência, montado por quem renderiza. */
  feriados: Record<string, string>;
  /**
   * O mapa data → nome dos feriados da CONTA desta demanda, quando ela é
   * conhecida. Ausente onde a tela não sabe de qual conta se trata — e aí o
   * aviso continua respondendo pela agência, que é o que ela sabe.
   */
  feriadosDoCliente?: Record<string, string>;
}) {
  const nome = data ? feriados[data] : undefined;
  const doCliente = data && !nome ? feriadosDoCliente?.[data] : undefined;
  if (!nome && !doCliente) return null;

  return (
    <p className="text-warning flex items-start gap-1.5 text-xs">
      <AlertTriangle aria-hidden className="mt-0.5 size-3.5 shrink-0" />
      {nome ? (
        <span>Feriado: {nome} — a equipe não trabalha neste dia.</span>
      ) : (
        <span>
          Feriado do cliente: {doCliente} — a agência trabalha, mas a conta não
          responde neste dia.
        </span>
      )}
    </p>
  );
}

/**
 * O mapa data → nome, a partir do que `feriadosComNome()` devolve.
 *
 * Ele mora aqui e não em `lib/dominio/` porque é a forma que ESTE componente
 * pede, e não uma regra do produto: duas telas montando o objeto por conta
 * própria seriam duas chaves diferentes para a mesma data no dia em que uma
 * delas decidisse normalizar o formato.
 */
export function mapaDeFeriados(
  lista: { data: string; nome: string }[],
): Record<string, string> {
  const mapa: Record<string, string> = {};
  for (const feriado of lista) mapa[feriado.data] = feriado.nome;
  return mapa;
}
