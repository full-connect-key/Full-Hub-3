import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/shared/page-header";
import { exigirAcessoARota } from "@/lib/auth/dal";
import { meusPedidosDeNota, minhasNotas } from "@/lib/dados/notas-fiscais";
import { mesesParaEmitir } from "@/lib/dominio/notas-fiscais";

import { FaixaDoPedido } from "./faixa-do-pedido";
import { MinhasNotas } from "./minhas-notas";

export const metadata: Metadata = { title: "Notas Fiscais" };

/**
 * A nota fiscal DA PESSOA (0065).
 *
 * Não confundir com o Financeiro da agência (`/painel/financeiro`, só sócio):
 * aqui cada um envia a sua nota e acompanha o próprio pagamento. São módulos
 * diferentes porque são assuntos diferentes, e no menu antigo os dois viviam
 * juntos em "Financeiro e NFs", o que fazia o colaborador achar que não tinha
 * onde mandar a nota dele.
 *
 * ---------------------------------------------------------------------------
 * **ERAM DUAS ABAS E É UMA TELA (0095).** A fila do sócio — conferir, recusar,
 * pagar — virou a primeira aba do Financeiro, ao lado do gasto que ela gera.
 * Com uma seção só não há barra: *menos de duas seções não vira barra*, a
 * regra que os Comodatos e as Notas já aplicavam, e `vocabulario.ts` e
 * `abas.tsx` foram APAGADOS em vez de ficarem com um valor de enum cada — a
 * decisão da 0023.
 *
 * **E O ENDEREÇO ANTIGO NÃO PODE DAR 404**, porque ele está GRAVADO em linhas
 * que já existem no banco de produção: `notificar()` é chamada de dentro de
 * trigger desde a 0065, com `/painel/notas-fiscais?aba=conferir` escrito no
 * corpo da função. Sem o redirect, todo sino antigo do sócio cairia numa tela
 * que não tem mais aquela seção — e ele continua nascendo assim a cada nota
 * nova. Reescrever o corpo daquela função seria uma migration cujo único efeito
 * é trocar um texto que o redirect já resolve, e migration que não muda
 * comportamento é migration que alguém aplica por engano achando que muda: a
 * mesma decisão dos comentários datados da 0028 e da 0031, e do 308 das duas
 * rotas que entraram em Gestão de Tasks.
 *
 * **O redirect não pergunta o perfil**, de propósito: quem não é sócio leva o
 * 403 do `exigirAcessoARota` do Financeiro, que é exatamente a resposta que ele
 * recebia aqui — só vinda do lugar certo. Perguntar duas vezes seria a segunda
 * pergunta embaixo de uma primeira que já barra todo mundo.
 * ---------------------------------------------------------------------------
 */
export default async function Pagina({
  searchParams,
}: PageProps<"/painel/notas-fiscais">) {
  const sessao = await exigirAcessoARota("/painel/notas-fiscais");
  const parametros = await searchParams;

  if (parametros.aba === "conferir") {
    // O FILTRO VIAJA JUNTO: o sino não o carrega, mas um link colado numa
    // conversa carrega — "olha as notas de setembro da Carla" é um endereço
    // que alguém mandou, e perdê-lo no caminho faria o redirect abrir a fila
    // inteira para quem pediu um recorte.
    const destino = new URLSearchParams();
    for (const chave of ["mes", "pessoa"]) {
      const valor = parametros[chave];
      if (typeof valor === "string") destino.set(chave, valor);
    }
    destino.set("aba", "notas");
    redirect(`/painel/financeiro?${destino.toString()}`);
  }

  // HOJE SAI DO SERVIDOR e desce pronto, como em toda tela do produto: se a
  // lista de meses fosse montada no navegador, quem estivesse num fuso à frente
  // veria um mês que ainda não terminou no topo do seletor.
  const agora = new Date();
  const hoje = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`;
  const hojeISO = `${hoje}-${String(agora.getDate()).padStart(2, "0")}`;

  return (
    <div className="space-y-6">
      {/* O `PageHeader` VOLTOU a esta tela, e não é um `<h1>` escrito aqui.
          Com a barra de contexto, o título morava nela, `sr-only`; sem a
          barra, o nome do módulo precisa aparecer na escala do desenho — e a
          escala mora num lugar só, senão a segunda tela a precisar dela sai
          com outro tamanho.

          A FRASE DA PRIVACIDADE É O SUBTÍTULO, e não um texto de ajuda: ela
          é o que faz a pessoa anexar o PDF sem hesitar. Uma promessa que o
          banco cumpre e a tela não diz é uma promessa que ninguém conhece —
          a mesma razão pela qual a Academy escreve "só você lê isto" ao lado
          da anotação. */}
      <PageHeader title="Notas Fiscais" subtitulo="Só você e o sócio enxergam a sua." />

      {/* A FAIXA FICA ACIMA DA LISTA, e não dentro do diálogo de envio:
          quem abre esta tela precisa saber que foi cobrado ANTES de decidir
          se vai mandar algo hoje. Dentro do diálogo ela só apareceria para
          quem já tinha decidido. */}
      <FaixaDoPedido pedidos={await meusPedidosDeNota()} hojeISO={hojeISO} />

      <MinhasNotas
        notas={await minhasNotas()}
        usuarioId={sessao.usuarioId}
        mesesDisponiveis={mesesParaEmitir(hoje)}
      />
    </div>
  );
}
