import type { Metadata } from "next";
import { Suspense } from "react";

import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { exigirAcessoARota } from "@/lib/auth/dal";
import { listarClientes } from "@/lib/dados/clientes";
import {
  itensDoCalendario,
  obterEvento,
  pessoasDaEquipeNoCalendario,
} from "@/lib/dados/calendario";
import { souDoAtendimento } from "@/lib/dados/minhas-tasks";
import { ehVisao, type VisaoDoCalendario } from "@/lib/dominio/calendario";

import { CalendarioFull } from "./calendario-full";
import { janelaDoPeriodo, lerMes } from "./periodo";

export const metadata: Metadata = { title: "Calendário Full" };

/**
 * O Calendário Full.
 *
 * ---------------------------------------------------------------------------
 * TUDO MORA NA URL — mês, visão e o filtro de cliente.
 *
 * É a mesma regra de toda listagem do produto, e aqui ela vale duas vezes:
 * "olha a semana do dia 15" precisa ser um link que abre no mesmo lugar para
 * quem recebe. Com estado interno, o link abriria sempre no mês corrente, na
 * visão padrão.
 * ---------------------------------------------------------------------------
 *
 * ---------------------------------------------------------------------------
 * TRÊS PARÂMETROS SAÍRAM COM AS CINCO ORIGENS (0105): `camadas`, `responsavel`
 * e `foco`. A razão de cada um está em `lib/dados/calendario.ts`, e a de todos
 * é a mesma — eles perguntavam por `user_id` e por uma escolha entre origens
 * que não existe mais. **E eles saem do código, não só da tela:** um
 * parâmetro que a página continua lendo e não usa é o interruptor que a 0088
 * deixou para trás, em outra forma.
 *
 * Link antigo com `?camadas=post,evento` abre no mês inteiro, que é o que um
 * endereço salvo tem de fazer: abrir, e não quebrar.
 * ---------------------------------------------------------------------------
 *
 * **A busca é só da janela visível**, com uma semana de folga em cada ponta.
 */
async function Conteudo({
  visao,
  mes,
  parametros,
  usuarioId,
  podeEscrever,
}: {
  visao: VisaoDoCalendario;
  mes: string;
  parametros: Record<string, string | string[] | undefined>;
  usuarioId: string;
  podeEscrever: boolean;
}) {
  const janela = janelaDoPeriodo(mes, visao);

  const lista = (chave: string): string[] => {
    const valor = parametros[chave];
    if (!valor) return [];
    return (Array.isArray(valor) ? valor : valor.split(",")).filter(Boolean);
  };

  const eventoAberto = typeof parametros.evento === "string" ? parametros.evento : null;

  // A LISTA DE PESSOAS FICA, e ela não é filtro: quem a lê é o formulário de
  // evento (os participantes) e o detalhe. Foi o FILTRO "Filtrar por
  // responsável" que saiu na 0105, não a consulta.
  const [itens, clientes, pessoas, evento] = await Promise.all([
    itensDoCalendario({
      de: janela.de,
      ate: janela.ate,
      clientes: lista("cliente"),
    }),
    listarClientes(),
    pessoasDaEquipeNoCalendario(),
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
        />
      </Suspense>
    </div>
  );
}
