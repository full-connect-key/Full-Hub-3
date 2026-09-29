import type { Metadata } from "next";
import Link from "next/link";
import { forbidden } from "next/navigation";

import { Button } from "@/components/ui/button";
import { exigirAcessoARota } from "@/lib/auth/dal";
import { ehGestor, ehSocio } from "@/lib/auth/roles";
import {
  indicadoresDoInventario,
  inventario,
  meusComodatos,
  porPessoa,
} from "@/lib/dados/comodatos";
import { listarEquipeAtiva } from "@/lib/dados/equipe";

import { AbasDosComodatos } from "./abas";
import { MeusEquipamentos } from "./meus-equipamentos";
import { PainelDeComodatos } from "./painel-de-comodatos";
import { lerAba, type Aba } from "./vocabulario";
import { hojeNaAgencia } from "@/lib/dominio/datas";

export const metadata: Metadata = { title: "Comodatos" };

/**
 * Qual equipamento da agência está com qual pessoa (0069).
 *
 * ---------------------------------------------------------------------------
 * **DUAS VISÕES DA MESMA INFORMAÇÃO, e por isso é uma rota só.**
 *
 * O colaborador vê o que está com ele; a gestão vê o inventário inteiro. Dois
 * módulos dariam dois lugares para a mesma pergunta — e o segundo seria o que
 * divergisse no dia em que o vocabulário mudasse.
 *
 * **A aba geral é da gestão, e esconder não é a proteção.** `?aba=geral`
 * digitado leva 403, `assets_select` devolve lista vazia para quem não é
 * gestão, e a action confere de novo. São as três camadas de sempre, e a
 * terceira é a que vale.
 *
 * E a guarda existe além do RLS pela razão de sempre: sem ela, o colaborador
 * abriria a visão geral e leria "Nenhum equipamento cadastrado" — uma
 * afirmação falsa com toda a confiança sobre uma tela que não é dele.
 * ---------------------------------------------------------------------------
 */
const QUEM_VE: Record<Aba, (role: Parameters<typeof ehGestor>[0]) => boolean> = {
  meus: () => true,
  geral: ehGestor,
};

export default async function Pagina({ searchParams }: PageProps<"/painel/comodatos">) {
  const sessao = await exigirAcessoARota("/painel/comodatos");
  const parametros = await searchParams;
  const aba = lerAba(typeof parametros.aba === "string" ? parametros.aba : undefined);

  if (!QUEM_VE[aba](sessao.profile.role)) forbidden();

  const visiveis = (Object.keys(QUEM_VE) as Aba[]).filter((chave) =>
    QUEM_VE[chave](sessao.profile.role),
  );

  const souGestor = ehGestor(sessao.profile.role);

  // HOJE SAI DO SERVIDOR e desce pronto: se cada cartão lesse o relógio, o
  // navegador num fuso à frente pintaria de vermelho uma devolução que ainda
  // está no prazo — e o contador do painel discordaria dele.
  const hoje = hojeNaAgencia();

  const [meus, itens, equipe] = await Promise.all([
    meusComodatos(),
    // A CONSULTA DO INVENTÁRIO SÓ ACONTECE PARA A GESTÃO: chamá-la sempre
    // gastaria uma ida ao banco para desenhar nada, e ela voltaria vazia pelo
    // RLS de qualquer jeito.
    souGestor ? inventario() : Promise.resolve([]),
    souGestor ? listarEquipeAtiva() : Promise.resolve([]),
  ]);

  const indicadores = indicadoresDoInventario(itens);
  const pessoas = souGestor ? await porPessoa(itens) : [];

  return (
    <div className="space-y-6">
      {/* Sem `PageHeader`: a topbar já diz "Comodatos". O link do modelo
          subiu para a barra de contexto e o `<h1>` mora nela, invisível. */}
      <AbasDosComodatos
        ativa={aba}
        visiveis={visiveis}
        aceitesPendentes={indicadores.semAceite}
        acoes={
          ehSocio(sessao.profile.role) ? (
            <Button asChild variant="outline" size="sm">
              <Link href="/painel/comodatos/modelo-termo">Modelo do termo</Link>
            </Button>
          ) : undefined
        }
      />

      {aba === "meus" ? (
        <MeusEquipamentos comodatos={meus} hoje={hoje} />
      ) : (
        <PainelDeComodatos
          itens={itens}
          indicadores={indicadores}
          pessoas={pessoas}
          equipe={equipe.map((p) => ({ id: p.id, nome: p.nome, funcao: p.funcao ?? null }))}
        />
      )}
    </div>
  );
}
