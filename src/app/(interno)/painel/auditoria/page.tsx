import type { Metadata } from "next";
import { Suspense } from "react";
import { forbidden } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Badge } from "@/components/ui/badge";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { exigirAcessoARota } from "@/lib/auth/dal";
import { ehSocio } from "@/lib/auth/roles";
import { trilhaDeAuditoria, quemApareceNaAuditoria } from "@/lib/dados/auditoria";
import {
  ROTULOS_DE_OPERACAO,
  mudancasDe,
  rotuloDaTabela,
  type Operacao,
} from "@/lib/dominio/auditoria";

import { FiltrosDaAuditoria } from "./filtros";

export const metadata: Metadata = { title: "Auditoria" };

const ROTA = "/painel/auditoria";

/** Quantas linhas por página. */
const POR_PAGINA = 80;

/**
 * A trilha de auditoria.
 *
 * ---------------------------------------------------------------------------
 * SÓ O SÓCIO, e são as três camadas de sempre — com a terceira valendo.
 *
 * `exigirAcessoARota` devolve 403 aqui, `roles: SOCIO` esconde o item do menu,
 * e `audit_log_select` recusa no Postgres. **A que vale é a terceira:** quem
 * chamar a API do Supabase direto com a chave anon leva a recusa do banco.
 *
 * E o motivo de ser só o sócio não é hierarquia: a auditoria copia o trecho que
 * mudou de `finance_entries` e de `contracts`, que fecham em `is_socio()` desde
 * a 0013. Um log legível pela gestão seria a porta dos fundos daquela regra —
 * **um log é tão sensível quanto a coisa mais sensível que tem dentro dele.**
 * ---------------------------------------------------------------------------
 */
export default async function PaginaDeAuditoria({
  searchParams,
}: PageProps<"/painel/auditoria">) {
  const { profile } = await exigirAcessoARota(ROTA);
  if (!ehSocio(profile.role)) forbidden();

  const parametros = await searchParams;
  const texto = (chave: string): string | null => {
    const valor = parametros[chave];
    const bruto = Array.isArray(valor) ? valor[0] : valor;
    return bruto && bruto.trim() !== "" ? bruto : null;
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Auditoria" />

      <p className="text-muted-foreground -mt-4 text-sm">
        Quem mexeu em acesso, gente e dinheiro — e o que foi apagado. Só o sócio
        alcança esta tela, e a recusa é do banco: a trilha guarda o valor que
        mudou no Financeiro, então quem a lê lê o Financeiro.
      </p>

      <Suspense fallback={<LoadingSkeleton />}>
        <Conteudo
          tabela={texto("tabela")}
          quem={texto("quem")}
          de={texto("de")}
          ate={texto("ate")}
        />
      </Suspense>
    </div>
  );
}

async function Conteudo({
  tabela,
  quem,
  de,
  ate,
}: {
  tabela: string | null;
  quem: string | null;
  de: string | null;
  ate: string | null;
}) {
  const [pagina, pessoas] = await Promise.all([
    trilhaDeAuditoria({ tabela, quem, de, ate, limite: POR_PAGINA }),
    quemApareceNaAuditoria(),
  ]);

  return (
    <div className="space-y-4">
      <FiltrosDaAuditoria pessoas={pessoas} />

      {pagina.linhas.length === 0 ? (
        <p className="text-muted-foreground bg-surface-card rounded-lg border p-6 text-sm">
          Nada registrado neste recorte. A trilha guarda mudanças de perfil de
          acesso, de cliente, de ficha da equipe, do Financeiro e do Full Days —
          e o apagamento de demanda, etapa, campanha, post e material.
        </p>
      ) : (
        <>
          <div className="bg-surface-card overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[46rem] text-sm">
              <thead className="text-muted-foreground border-b text-left text-xs">
                <tr>
                  <th className="px-3 py-2 font-medium">Quando</th>
                  <th className="px-3 py-2 font-medium">Quem</th>
                  <th className="px-3 py-2 font-medium">O quê</th>
                  <th className="px-3 py-2 font-medium">O que mudou</th>
                </tr>
              </thead>
              <tbody>
                {pagina.linhas.map((linha) => (
                  <tr key={linha.id} className="border-b last:border-0 align-top">
                    <td className="text-muted-foreground px-3 py-2.5 whitespace-nowrap tabular-nums">
                      {/*
                        DATE-FNS E NÃO `DateBadge`: esta data só registra QUANDO
                        algo aconteceu, e o selo é para prazo a vencer — o
                        passado apareceria em vermelho como se fosse atraso.
                      */}
                      {format(parseISO(linha.quando), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </td>
                    <td className="px-3 py-2.5">
                      {/*
                        "Sistema" QUANDO NÃO HÁ PESSOA, e não espaço em branco.
                        O seed, uma rotina e a chave de serviço escrevem sem
                        sessão — inventar um nome seria pior, e deixar vazio
                        parece defeito da tela.
                      */}
                      {linha.quem?.nome ?? (
                        <span className="text-muted-foreground italic">sistema</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <SeloDaOperacao operacao={linha.operacao} />
                        <span>{rotuloDaTabela(linha.tabela)}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <Mudancas linha={linha} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/*
            "MOSTRAR MAIS" COM O NÚMERO DITO, e nunca um total exato: contar uma
            tabela que só cresce é varrer tudo para escrever um número que
            ninguém lê. Cortar calado é pior — faz a pessoa concluir que aquilo
            é tudo, que é o erro que o resumo da semana também evita.
          */}
          {pagina.temMais ? (
            <p className="text-muted-foreground text-sm">
              Mostrando as {POR_PAGINA} mais recentes deste recorte. Estreite o
              período ou escolha o que procurar para ver o resto.
            </p>
          ) : (
            <p className="text-muted-foreground text-sm">
              {pagina.linhas.length === 1
                ? "1 registro neste recorte."
                : `${pagina.linhas.length} registros neste recorte.`}
            </p>
          )}
        </>
      )}
    </div>
  );
}

/**
 * O selo da operação.
 *
 * **"Apagou" é o único em tom de erro**, e é escolha: é o único que não dá para
 * desfazer nem reconstruir — uma demanda que sai leva comentário, tempo e
 * aprovação com ela. Pintar os três de vermelho treinaria o hábito de ignorar
 * vermelho, que é a mesma razão pela qual o alerta de 7 dias do portal é
 * `--warning` e não `--danger`.
 *
 * **O par nomeado, nunca opacidade:** `bg-danger-soft text-danger`, e não
 * `bg-danger/10` — opacidade sobre um fundo qualquer dá uma cor que ninguém
 * mediu, e no tema escuro dá outra.
 */
function SeloDaOperacao({ operacao }: { operacao: Operacao }) {
  // "MUDOU" É O NEUTRO, e é a mesma decisão de Prioridade Normal ser cinza:
  // ele é de longe o mais comum, e dar cor a ele faria a operação corriqueira
  // competir com a que importa.
  //
  // A primeira versão usou um par claro derivado de `--info`, que NÃO existe
  // em tom suave nos tokens. O Tailwind não emite nada para uma classe que ele
  // não conhece, então o selo teria saído sem fundo nenhum, sem erro em lugar
  // nenhum. Quem pegou foi o `check:cores` — e pegou DUAS vezes: a segunda
  // porque este comentário escrevia a classe errada por extenso, e a varredura
  // lê o arquivo inteiro. **A explicação não pode carregar o que ela proíbe**,
  // que é a mesma armadilha da lista de nomes mortos.
  const tom =
    operacao === "DELETE"
      ? "bg-danger-soft text-danger"
      : operacao === "INSERT"
        ? "bg-success-soft text-success"
        : "bg-neutral-soft text-text-secondary";

  return (
    <Badge className={`${tom} border-0`} variant="secondary">
      {ROTULOS_DE_OPERACAO[operacao]}
    </Badge>
  );
}

/**
 * O que mudou, campo por campo.
 *
 * **"de → para" numa linha por campo**, e não dois blocos de JSON: o que a
 * pessoa quer saber é "o perfil da Joana virou sócio", e dois objetos lado a
 * lado obrigam a comparar chave por chave com o olho.
 *
 * No apagamento não há "para": mostra o que havia, que é a única coisa que
 * sobrou daquela linha.
 */
function Mudancas({
  linha,
}: {
  linha: { operacao: Operacao; antes: Record<string, unknown> | null; depois: Record<string, unknown> | null };
}) {
  const mudancas = mudancasDe(linha.antes, linha.depois);
  if (mudancas.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }

  // CINCO CAMPOS E O RESTO CONTADO. Um INSERT traz a linha inteira, e vinte
  // campos numa célula empurram a tabela para fora da tela — o mesmo bug de
  // 375px que a barra de abas teve, por outro caminho.
  const visiveis = mudancas.slice(0, 5);
  const sobraram = mudancas.length - visiveis.length;

  return (
    <div className="space-y-0.5">
      {visiveis.map((m) => (
        <div key={m.coluna} className="flex flex-wrap items-baseline gap-1">
          <span className="text-muted-foreground">{m.rotulo}:</span>
          {linha.operacao === "UPDATE" ? (
            <>
              <span className="text-muted-foreground line-through">{m.de}</span>
              <span aria-hidden className="text-muted-foreground">→</span>
              <span className="font-medium">{m.para}</span>
            </>
          ) : (
            <span className="font-medium">
              {linha.operacao === "DELETE" ? m.de : m.para}
            </span>
          )}
        </div>
      ))}
      {sobraram > 0 ? (
        <p className="text-muted-foreground text-xs">
          e mais {sobraram} {sobraram === 1 ? "campo" : "campos"}
        </p>
      ) : null}
    </div>
  );
}
