import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowRight, PartyPopper } from "lucide-react";

import { CartaoDeItem } from "@/components/portal/cartao-de-item";
import { obterMinhasEmpresas } from "@/lib/dados/clientes";
import {
  atividadeRecente,
  itensDoPortal,
  prazosDoPortal,
  registrarAcesso,
} from "@/lib/dados/portal";
import { ordenarPorUrgencia } from "@/lib/dominio/portal";

/**
 * A tela inicial do Portal, num bloco só.
 *
 * **Um bloco, duas entradas.** O portal da pessoa cliente (/portal) e a
 * visualização da equipe (/portal/{slug}) renderizam ESTE componente. Duas
 * cópias divergiriam na primeira mudança, e a visualização existe justamente
 * para mostrar o que o cliente vê — uma aproximação não serve.
 *
 * O que muda entre as duas é o parâmetro, não o desenho:
 *
 *   `clienteId`  — null para o cliente (a RLS já fecha nas empresas dele),
 *                  obrigatório para a equipe, que enxerga todas.
 *   `comoEquipe` — desliga o registro de acesso e troca a frase do vazio.
 *   `base`       — o prefixo dos links, para "Ver tudo" não sair do portal
 *                  que está sendo visto.
 */
export async function InicioDoPortal({
  base,
  clienteId,
  comoEquipe,
  nome,
}: {
  base: string;
  clienteId: string | null;
  comoEquipe: boolean;
  /** Primeiro nome de quem está lendo. Vazio na visualização da equipe. */
  nome: string;
}) {
  const { hoje } = prazosDoPortal();
  const [itens, atividade] = await Promise.all([
    itensDoPortal(clienteId ?? undefined),
    atividadeRecente(clienteId ?? undefined, comoEquipe),
  ]);

  // O acesso fica registrado por empresa: quem responde por duas contas entrou
  // nas duas. A equipe NÃO registra aqui — a visita dela vira linha em
  // `client_portal_views`, no layout de /portal/{slug}, e a policy de
  // `client_access_log` recusaria a escrita de quem não é do cliente.
  if (!comoEquipe) {
    const empresas = await obterMinhasEmpresas();
    await Promise.all(
      empresas.map((empresa) => registrarAcesso(empresa.id, "login")),
    );
  }

  const pendentes = itens
    .filter((i) => i.status === "em_aprovacao")
    .sort(ordenarPorUrgencia);
  const emProducao = itens.filter((i) => i.status === "em_producao").length;

  const inicioDoMes = `${hoje.slice(0, 7)}-01`;
  const aprovadosNoMes = itens.filter(
    (i) => i.status === "aprovado" && (i.enviadoEm ?? "") >= inicioDoMes,
  ).length;

  return (
    <div className="space-y-10">
      <section className="grid gap-4 sm:grid-cols-[2fr_1fr_1fr]">
        {/* O CARTÃO GRANDE, e o número em tamanho de manchete. */}
        <div className="bg-blue-soft border-blue-muted rounded-xl border p-6">
          <p className="text-text-primary text-sm font-medium">
            {comoEquipe ? "Esperando o cliente" : "Esperando você"}
          </p>
          <p className="text-text-primary mt-2 text-5xl font-semibold tabular-nums">
            {pendentes.length}
          </p>
          <p className="text-text-primary/80 mt-1 text-sm">
            {pendentes.length === 1
              ? "material para aprovar"
              : "materiais para aprovar"}
          </p>
        </div>

        <div className="bg-surface-card rounded-xl border p-5">
          <p className="text-text-muted text-sm">Em produção</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">
            {emProducao}
          </p>
        </div>

        <div className="bg-surface-card rounded-xl border p-5">
          <p className="text-text-muted text-sm">Aprovados no mês</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">
            {aprovadosNoMes}
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">
            {comoEquipe
              ? "Para a aprovação do cliente"
              : "Para a sua aprovação"}
          </h2>
          {itens.length > 0 ? (
            <Link
              href={`${base}/itens`}
              className="text-accent-strong inline-flex items-center gap-1 text-sm hover:underline"
            >
              Ver tudo
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          ) : null}
        </div>

        {pendentes.length === 0 ? (
          // ZERO PENDÊNCIA É BOA NOTÍCIA, e a tela diz isso. Um vazio genérico
          // ("nenhum resultado") deixa a pessoa em dúvida se ela procurou
          // errado ou se está tudo bem.
          <div className="bg-success-soft flex items-start gap-3 rounded-xl border border-transparent p-6">
            <PartyPopper
              aria-hidden
              className="text-success mt-0.5 size-5 shrink-0"
            />
            <div>
              <p className="font-medium">
                {comoEquipe ? "Tudo em dia por aqui." : `Tudo em dia, ${nome}.`}
              </p>
              <p className="text-text-muted mt-1 text-sm">
                {comoEquipe
                  ? "Nenhum material aguardando a decisão deste cliente."
                  : "Nada aguardando a sua aprovação. Quando a Full enviar algo novo, ele aparece aqui."}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {pendentes.slice(0, 5).map((item) => (
              <CartaoDeItem key={item.conteudoId} item={item} hoje={hoje} />
            ))}
            {pendentes.length > 5 ? (
              <Link
                href={`${base}/itens?status=em_aprovacao`}
                className="text-accent-strong block py-2 text-center text-sm hover:underline"
              >
                Ver os outros {pendentes.length - 5}
              </Link>
            ) : null}
          </div>
        )}
      </section>

      {atividade.length > 0 ? (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Atividade recente</h2>
          <ul className="bg-surface-card divide-y rounded-xl border">
            {atividade.map((linha) => (
              <li
                key={linha.id}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 p-4"
              >
                <span className="text-sm font-medium">{linha.acao}</span>
                <span className="text-text-muted min-w-0 flex-1 truncate text-sm">
                  {linha.sobre}
                </span>
                <span className="text-text-muted text-xs tabular-nums">
                  {format(parseISO(linha.quando), "dd/MM", { locale: ptBR })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Campanhas ativas com barra de progresso chegam junto com a tela que
          as define. Um bloco vazio prometendo isso agora seria espaço ocupado
          por nada. */}

      <p className="sr-only" aria-live="polite">
        {pendentes.length} materiais aguardando aprovação.
      </p>
    </div>
  );
}
