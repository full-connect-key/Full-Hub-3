import type { Metadata } from "next";
import { Suspense } from "react";

import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { exigirAcessoARota } from "@/lib/auth/dal";
import { listarClientes } from "@/lib/dados/clientes";
import {
  cargaDaEquipe,
  itensDoCalendario,
  obterEvento,
  pessoasDaLinhaDoTempo,
} from "@/lib/dados/calendario";
import { souDoAtendimento } from "@/lib/dados/minhas-tasks";
import { CAMADAS, ehVisao, type VisaoDoCalendario } from "@/lib/dominio/calendario";
import type { TipoNoCalendario } from "@/lib/supabase/database.types";

import { CalendarioFull } from "./calendario-full";
import { janelaDoPeriodo, lerMes } from "./periodo";

export const metadata: Metadata = { title: "Calendário Full" };

/**
 * O Calendário Full.
 *
 * ---------------------------------------------------------------------------
 * TUDO MORA NA URL — mês, visão, camadas e filtros.
 *
 * É a mesma regra de toda listagem do produto, e aqui ela vale duas vezes:
 * "olha a semana do dia 15" precisa ser um link que abre no mesmo lugar para
 * quem recebe. Com estado interno, o link abriria sempre no mês corrente, na
 * visão padrão, com as camadas de quem clicou.
 *
 * **A exceção é a lembrança das camadas**, que o sprint pede em
 * `localStorage`. Ela não entra: duas fontes para a mesma escolha dariam a
 * tela abrindo com a camada que o link diz e trocando sozinha no instante
 * seguinte para a que o navegador lembrava. Quem quer a configuração de volta
 * salva o link.
 * ---------------------------------------------------------------------------
 *
 * **A busca é só da janela visível**, com uma semana de folga em cada ponta.
 * A view lê sete tabelas: pedir o ano seriam sete varreduras grandes para
 * desenhar trinta e um dias.
 */
async function Conteudo({
  visao,
  mes,
  parametros,
  usuarioId,
  podeEscrever,
  padraoDeFoco,
}: {
  visao: VisaoDoCalendario;
  mes: string;
  parametros: Record<string, string | string[] | undefined>;
  usuarioId: string;
  podeEscrever: boolean;
  /** O colaborador abre em "só minha pauta"; a gestão, na agência inteira. */
  padraoDeFoco: boolean;
}) {
  const janela = janelaDoPeriodo(mes, visao);

  const lista = (chave: string): string[] => {
    const valor = parametros[chave];
    if (!valor) return [];
    return (Array.isArray(valor) ? valor : valor.split(",")).filter(Boolean);
  };

  const camadasPedidas = lista("camadas") as TipoNoCalendario[];
  const camadas = camadasPedidas.length
    ? CAMADAS.filter((c) => camadasPedidas.includes(c))
    : CAMADAS;

  // "SÓ MINHA PAUTA" JÁ VEM LIGADO PARA O COLABORADOR, e é decisão do sprint:
  // quem executa abre o calendário para saber o que ELE faz, e a agenda da
  // agência inteira enterra isso em duzentas linhas. A gestão abre no
  // contrário, porque a pergunta dela é "a equipe aguenta?".
  //
  // O PADRÃO NÃO TRANCA NADA: o chip continua lá, e desligá-lo grava `todos`
  // na URL — um link compartilhado abre igual para quem recebe, qualquer que
  // seja o perfil de quem clicou. Sem esse valor explícito, o mesmo link
  // mostraria coisas diferentes para o sócio e para o redator, que é a pior
  // forma de um link mentir.
  const focoPedido = parametros.foco;
  const focoValendo =
    focoPedido === "minhas" || focoPedido === "todos"
      ? focoPedido
      : padraoDeFoco
        ? "minhas"
        : "todos";
  const soMinhas = focoValendo === "minhas" ? usuarioId : null;
  const eventoAberto = typeof parametros.evento === "string" ? parametros.evento : null;

  const [itens, clientes, pessoas, carga, evento] = await Promise.all([
    itensDoCalendario({
      de: janela.de,
      ate: janela.ate,
      clientes: lista("cliente"),
      responsaveis: lista("responsavel"),
      camadas,
      soMinhas,
    }),
    listarClientes(),
    pessoasDaLinhaDoTempo(),
    // A CARGA SÓ NA LINHA DO TEMPO. É a única visão que a desenha, e pedi-la
    // nas outras três seriam trinta consultas por pessoa para montar uma
    // grade que não a mostra.
    visao === "linha" ? cargaDaEquipe(janela.de, janela.ate) : Promise.resolve([]),
    eventoAberto ? obterEvento(eventoAberto) : Promise.resolve(null),
  ]);

  return (
    <CalendarioFull
      visao={visao}
      mes={mes}
      janela={janela}
      itens={itens}
      clientes={clientes.map((c) => ({ id: c.id, nome: c.nome_empresa }))}
      pessoas={pessoas}
      carga={carga}
      camadas={camadas}
      foco={focoValendo}
      evento={evento}
      usuarioId={usuarioId}
      podeEscrever={podeEscrever}
    />
  );
}

export default async function PaginaDoCalendario({
  searchParams,
}: PageProps<"/painel/calendario">) {
  const sessao = await exigirAcessoARota("/painel/calendario");
  const parametros = await searchParams;

  const visao: VisaoDoCalendario = ehVisao(parametros.visao) ? parametros.visao : "mes";
  const mes = lerMes(parametros.mes);

  // Quem escreve evento é `is_atendimento()`, e a pergunta vai ao BANCO pela
  // mesma RPC que o botão "Nova task" usa. Repetir a consulta aqui faria o
  // botão e a policy divergirem no dia em que alguém mudasse uma das duas.
  const podeEscrever = await souDoAtendimento();

  return (
    <div className="space-y-6">
      <PageHeader title="Calendário Full" />

      <Suspense key={`${visao}-${mes}`} fallback={<LoadingSkeleton variant="table" rows={8} />}>
        <Conteudo
          visao={visao}
          mes={mes}
          parametros={parametros}
          usuarioId={sessao.usuarioId}
          podeEscrever={podeEscrever}
          padraoDeFoco={sessao.profile.role === "colaborador"}
        />
      </Suspense>
    </div>
  );
}
