import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { exigirSessao } from "@/lib/auth/dal";
import { comodatoParaOTermo } from "@/lib/dados/comodatos";
import { linhaDoAceite, montarTermo, ROTULOS_DE_ESTADO } from "@/lib/dominio/comodatos";

/**
 * O termo de comodato, em PDF.
 *
 * ---------------------------------------------------------------------------
 * **ELE NASCE NO DOWNLOAD, e não na entrega — e as duas metades disso são
 * decisões separadas.**
 *
 * O TEXTO é o congelado no dia da entrega (`asset_loans.termo_corpo`): o
 * modelo é editável pelo sócio, e um termo é o que a agência afirmou por
 * escrito NAQUELE dia. Ler o modelo corrente aqui faria reescrever o texto
 * hoje mudar o termo de um comodato de dois anos atrás — que é exatamente o
 * que `tasks.workflow_snapshot` evita desde a 0008.
 *
 * O ESTADO é o de agora, e é por isso que o arquivo não fica guardado: o
 * sprint pede que *"o aceite apareça no termo quando ele for baixado depois do
 * aceite"*. Um PDF gravado na entrega nunca carregaria o aceite, e regravá-lo
 * a cada mudança seria manter duas verdades sobre o mesmo documento.
 * ---------------------------------------------------------------------------
 *
 * **Quem pode baixar é quem pode LER o comodato**, e a trava é a RLS:
 * `asset_loans_select` fecha em "é meu ou sou gestão". Esta rota não repete a
 * pergunta — repetir seria o segundo lugar onde a regra pode divergir.
 */
export async function GET(_req: Request, ctx: RouteContext<"/painel/comodatos/[id]/termo">) {
  await exigirSessao();
  const { id } = await ctx.params;

  const dados = await comodatoParaOTermo(id);
  // 404 E NÃO 403: a RLS já devolveu nada, e dizer "sem permissão" contaria a
  // quem tentou que o comodato existe.
  if (!dados) return new Response("Não encontrado.", { status: 404 });

  const { comodato, equipamento, pessoa } = dados;

  const corpo = montarTermo(comodato.termo_corpo ?? "", {
    PESSOA: pessoa,
    EQUIPAMENTO: [equipamento.nome, equipamento.marca, equipamento.modelo]
      .filter(Boolean)
      .join(" "),
    PATRIMONIO: equipamento.codigo ?? undefined,
    SERIE: equipamento.numero_serie ?? undefined,
    ACESSORIOS: comodato.acessorios ?? undefined,
    ESTADO: ROTULOS_DE_ESTADO[comodato.estado_entrega],
    DATA_ENTREGA: new Date(`${comodato.data_entrega}T00:00:00`).toLocaleDateString("pt-BR"),
    ACEITE: linhaDoAceite(comodato.aceito_em, pessoa),
  });

  const pdf = await PDFDocument.create();
  // HELVETICA E NÃO UMA FONTE EMBUTIDA: a padrão do PDF cobre Latin-1, que é o
  // que o português precisa (ç, ã, é). Embutir um arquivo de fonte custaria
  // centenas de kB por termo para ganhar acento que já funciona.
  const fonte = await pdf.embedFont(StandardFonts.Helvetica);
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold);

  const LARGURA = 595.28; // A4 em pontos
  const ALTURA = 841.89;
  const MARGEM = 56;
  const CORPO = 10.5;
  const ENTRELINHA = 15;
  const util = LARGURA - MARGEM * 2;

  let pagina = pdf.addPage([LARGURA, ALTURA]);
  let y = ALTURA - MARGEM;

  const escrever = (texto: string, tamanho: number, fnt: typeof fonte) => {
    // A PÁGINA VIRA SOZINHA. Sem isto o termo de um equipamento com muitos
    // acessórios sairia com as últimas linhas escritas fora do papel — e o
    // que se perderia seria justamente o fim, onde ficam as condições.
    if (y < MARGEM + ENTRELINHA) {
      pagina = pdf.addPage([LARGURA, ALTURA]);
      y = ALTURA - MARGEM;
    }
    pagina.drawText(texto, { x: MARGEM, y, size: tamanho, font: fnt, color: rgb(0.1, 0.1, 0.12) });
    y -= ENTRELINHA;
  };

  for (const paragrafo of corpo.split("\n")) {
    if (paragrafo.trim() === "") {
      y -= ENTRELINHA * 0.6;
      continue;
    }

    // A PRIMEIRA LINHA É O TÍTULO, e as de caixa alta curta são as seções.
    const titulo = paragrafo === paragrafo.toUpperCase() && paragrafo.trim().length < 60;
    const fnt = titulo ? negrito : fonte;
    const tamanho = titulo ? 11.5 : CORPO;

    // A QUEBRA É POR LARGURA MEDIDA, e não por contagem de caracteres: "MMMM"
    // e "iiii" têm o mesmo número de letras e o dobro de diferença em pontos.
    let linha = "";
    for (const palavra of paragrafo.split(/\s+/)) {
      const tentativa = linha === "" ? palavra : `${linha} ${palavra}`;
      if (fnt.widthOfTextAtSize(tentativa, tamanho) > util) {
        escrever(linha, tamanho, fnt);
        linha = palavra;
      } else {
        linha = tentativa;
      }
    }
    if (linha !== "") escrever(linha, tamanho, fnt);
  }

  const bytes = await pdf.save();
  const arquivo = `termo-${equipamento.codigo ?? "comodato"}.pdf`;

  return new Response(bytes as BodyInit, {
    headers: {
      "content-type": "application/pdf",
      // `inline` e não `attachment`: quem clica em "Baixar termo" quase sempre
      // quer conferir antes de guardar, e o navegador já oferece o download na
      // própria visualização.
      "content-disposition": `inline; filename="${arquivo}"`,
      // O TERMO NÃO SE GUARDA EM CACHE: ele muda no instante em que a pessoa
      // confirma o recebimento, e uma cópia cacheada mostraria um documento
      // sem o aceite que já existe.
      "cache-control": "no-store",
    },
  });
}
