import type { Metadata } from "next";
import { forbidden } from "next/navigation";

import { PageHeader } from "@/components/shared/page-header";
import { exigirAcessoARota } from "@/lib/auth/dal";
import { ehSocio } from "@/lib/auth/roles";
import { filaDeNotas, minhasNotas } from "@/lib/dados/notas-fiscais";
import { mesesParaEmitir } from "@/lib/dominio/notas-fiscais";

import { AbasDaNota } from "./abas";
import { lerAba, type Aba } from "./vocabulario";
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

  // HOJE SAI DO SERVIDOR e desce pronto, como em toda tela do produto: se a
  // lista de meses fosse montada no navegador, quem estivesse num fuso à frente
  // veria um mês que ainda não terminou no topo do seletor.
  const agora = new Date();
  const hoje = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`;

  return (
    <div className="space-y-6">
      <div>
        <PageHeader title="Notas Fiscais" />
        {/* A FRASE DA PRIVACIDADE FICA NA TELA, e não num texto de ajuda: ela
            é o que faz a pessoa anexar o PDF sem hesitar. Uma promessa que o
            banco cumpre e a tela não diz é uma promessa que ninguém conhece —
            a mesma razão pela qual a Academy escreve "só você lê isto" ao lado
            da anotação. */}
        <p className="text-muted-foreground mt-1 text-sm">
          Envie a sua nota do mês e acompanhe o pagamento. Só você e o sócio enxergam a sua.
        </p>
      </div>

      <div className="border-b">
        <AbasDaNota
          ativa={aba}
          visiveis={visiveis}
          aConferir={fila?.aConferir.length ?? 0}
        />
      </div>

      {aba === "conferir" && fila ? (
        <FilaDoSocio fila={fila} />
      ) : (
        <MinhasNotas
          notas={await minhasNotas()}
          usuarioId={sessao.usuarioId}
          mesesDisponiveis={mesesParaEmitir(hoje)}
        />
      )}
    </div>
  );
}
