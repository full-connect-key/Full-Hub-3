import type { Metadata } from "next";
import { forbidden } from "next/navigation";

import { exigirAcessoARota } from "@/lib/auth/dal";
import { ehSocio } from "@/lib/auth/roles";
import { filaDeNotas, meusPedidosDeNota, minhasNotas } from "@/lib/dados/notas-fiscais";
import { mesesParaEmitir, porColunaDaFila } from "@/lib/dominio/notas-fiscais";

import { AbasDaNota } from "./abas";
import { lerAba, type Aba } from "./vocabulario";
import { FaixaDoPedido } from "./faixa-do-pedido";
import { FilaDoSocio } from "./fila-do-socio";
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
 * **A ABA DA FILA É DO SÓCIO, e esconder não é a proteção.**
 *
 * `?aba=conferir` digitado na barra leva 403, a policy `team_invoices_select`
 * devolve lista vazia para quem não é sócio, e a action confere de novo. São
 * as três camadas de sempre, e a terceira é a que vale.
 *
 * E a guarda existe além do RLS por uma razão específica: sem ela, quem não é
 * sócio abriria a fila e leria "Nenhuma nota esperando" — uma afirmação falsa
 * com toda a confiança, sobre uma tela que ele não devia ver. É a mesma razão
 * pela qual o bloco de visitas ao portal não é desenhado para quem não é
 * gestão.
 * ---------------------------------------------------------------------------
 */
const QUEM_VE: Record<Aba, (role: Parameters<typeof ehSocio>[0]) => boolean> = {
  minhas: () => true,
  conferir: ehSocio,
};

export default async function Pagina({
  searchParams,
}: PageProps<"/painel/notas-fiscais">) {
  const sessao = await exigirAcessoARota("/painel/notas-fiscais");
  const parametros = await searchParams;
  const aba = lerAba(typeof parametros.aba === "string" ? parametros.aba : undefined);

  if (!QUEM_VE[aba](sessao.profile.role)) forbidden();

  const visiveis = (Object.keys(QUEM_VE) as Aba[]).filter((chave) =>
    QUEM_VE[chave](sessao.profile.role),
  );

  // A CONSULTA DA FILA SÓ ACONTECE PARA O SÓCIO. Chamá-la sempre e esconder o
  // resultado gastaria uma ida ao banco para desenhar nada — e ela voltaria
  // vazia pelo RLS de qualquer forma.
  const souSocio = ehSocio(sessao.profile.role);
  const fila = souSocio ? await filaDeNotas() : null;

  // O SELO DA ABA CONTA A FILA INTEIRA, nunca o que sobrou do filtro de mês ou
  // de pessoa: ele diz quantas notas esperam conferência, e um número que
  // encolhe porque o sócio escolheu setembro cobraria menos do que existe. O
  // corte por estado é o mesmo da fila — `porColunaDaFila()` —, e não um
  // `filter` escrito aqui: dois lugares nomeando os estados é onde um deles
  // esquece do estado novo.
  const aConferir = fila ? porColunaDaFila(fila).enviada.length : 0;

  // HOJE SAI DO SERVIDOR e desce pronto, como em toda tela do produto: se a
  // lista de meses fosse montada no navegador, quem estivesse num fuso à frente
  // veria um mês que ainda não terminou no topo do seletor.
  const agora = new Date();
  const hoje = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`;
  const hojeISO = `${hoje}-${String(agora.getDate()).padStart(2, "0")}`;

  return (
    <div className="space-y-6">
      <div>
        {/* Sem `PageHeader`: a topbar já diz "Notas Fiscais". O `<h1>` mora
            na barra de contexto, invisível. */}
        {/* A FRASE DA PRIVACIDADE FICA NA TELA, e não num texto de ajuda: ela
            é o que faz a pessoa anexar o PDF sem hesitar. Uma promessa que o
            banco cumpre e a tela não diz é uma promessa que ninguém conhece —
            a mesma razão pela qual a Academy escreve "só você lê isto" ao lado
            da anotação. */}
        <p className="text-muted-foreground mt-1 text-sm">
          Só você e o sócio enxergam a sua.
        </p>
      </div>

      <AbasDaNota ativa={aba} visiveis={visiveis} aConferir={aConferir} />

      {aba === "conferir" && fila ? (
        <FilaDoSocio notas={fila} />
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}
