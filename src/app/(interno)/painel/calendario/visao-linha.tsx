"use client";

import { Fragment, useEffect, useRef } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

import { UserAvatar } from "@/components/shared/user-avatar";
import {
  COR_DA_CAMADA,
  COR_DO_NIVEL,
  corDaEtapa,
  ROTULOS_DE_CAMADA,
  ROTULOS_DE_NIVEL,
  diaNaGrade,
  nivelDaCarga,
  ocupaODia,
  type CargaDeUmDia,
  type ItemDoCalendario,
  type PessoaDaLinha,
} from "@/lib/dominio/calendario";
import { formatarMinutos } from "@/lib/dominio/tempo";

import { cn } from "@/lib/utils";

import { diasDoPeriodo, ehFimDeSemana, type Janela } from "./periodo";

/**
 * A Linha do Tempo: uma linha por pessoa, uma coluna por dia.
 *
 * ---------------------------------------------------------------------------
 * É A VISÃO QUE RESPONDE "A EQUIPE AGUENTA?"
 *
 * As outras três respondem "o que acontece quando". Esta cruza isso com quem
 * faz — e é por isso que ela é a única que desenha a carga: a barra sob o
 * nome compara os minutos comprometidos com a capacidade da pessoa, que é
 * coluna de `team_members` porque contrato muda por pessoa.
 *
 * **O que não tem dono fica numa faixa no topo**, acima de todas as pessoas.
 * Evento da agência, demanda e campanha não são de ninguém em particular:
 * espalhá-los por todas as linhas repetiria a mesma barra dez vezes, e
 * escondê-los faria a semana da convenção parecer uma semana comum.
 * ---------------------------------------------------------------------------
 */
export function VisaoDeLinha({
  janela,
  itens,
  pessoas,
  carga,
  aoAbrir,
}: {
  janela: Janela;
  itens: ItemDoCalendario[];
  pessoas: PessoaDaLinha[];
  carga: CargaDeUmDia[];
  aoAbrir: (item: ItemDoCalendario) => void;
}) {
  const dias = diasDoPeriodo(janela.inicio, janela.fim);
  const hoje = new Date().toISOString().slice(0, 10);

  const semDono = itens.filter((i) => i.userId === null);
  const porPessoa = new Map<string, ItemDoCalendario[]>();
  for (const item of itens) {
    if (!item.userId) continue;
    porPessoa.set(item.userId, [...(porPessoa.get(item.userId) ?? []), item]);
  }

  const cargaPorPessoa = new Map<string, Map<string, CargaDeUmDia>>();
  for (const c of carga) {
    const dela = cargaPorPessoa.get(c.userId) ?? new Map();
    dela.set(c.dia, c);
    cargaPorPessoa.set(c.userId, dela);
  }

  // As áreas na ordem em que as pessoas já vêm — a consulta ordena por área e
  // depois por nome, e reagrupar aqui inventaria uma segunda ordem.
  const areas: { area: string; gente: PessoaDaLinha[] }[] = [];
  for (const pessoa of pessoas) {
    const nome = pessoa.area ?? "Sem área";
    const ultima = areas[areas.length - 1];
    if (ultima?.area === nome) ultima.gente.push(pessoa);
    else areas.push({ area: nome, gente: [pessoa] });
  }

  // 2rem POR DIA, e não 3: com três, um mês de trinta dias pede 90rem e
  // nem numa tela de 1700px ele cabe — a pessoa abre a visão e vê a primeira
  // quinzena, que no dia 25 é passado inteiro. Com dois, o mês fecha em
  // ~72rem e cabe de uma vez, que é o ponto desta visão: ver o mês inteiro de
  // uma equipe sem rolar.
  const largura = `minmax(2rem, 1fr)`;

  // E ONDE NÃO COUBER, ABRE EM HOJE. No celular a grade rola de qualquer
  // jeito, e começar no dia 1 faria a pessoa arrastar até o meio do mês toda
  // vez que abrisse. É rolagem, não sincronização de estado — o efeito só
  // posiciona uma vez, no primeiro desenho.
  const rolagem = useRef<HTMLDivElement>(null);
  const colunaDeHoje = dias.indexOf(hoje);

  useEffect(() => {
    if (!rolagem.current || colunaDeHoje < 0) return;
    const caixa = rolagem.current;
    const porDia = caixa.scrollWidth / Math.max(1, dias.length);
    caixa.scrollLeft = Math.max(
      0,
      colunaDeHoje * porDia - caixa.clientWidth / 2,
    );
  }, [colunaDeHoje, dias.length]);

  return (
    <div className="space-y-2">
      <div ref={rolagem} className="overflow-x-auto">
        <div className="min-w-[72rem]">
          {/* O CABEÇALHO DOS DIAS */}
          <div
            className="grid gap-px pb-1"
            style={{
              gridTemplateColumns: `12rem repeat(${dias.length}, ${largura})`,
            }}
          >
            <div className="bg-surface-page sticky left-0 z-20" />
            {dias.map((dia) => (
              <div
                key={dia}
                className={cn(
                  "text-center text-[0.65rem] capitalize",
                  dia === hoje
                    ? "text-accent-strong font-semibold"
                    : "text-text-muted",
                )}
              >
                {format(parseISO(dia), "EEEEE", { locale: ptBR })}
                <br />
                <span className="tabular-nums">{Number(dia.slice(8, 10))}</span>
              </div>
            ))}
          </div>

          {/* A FAIXA DO QUE É DE TODOS */}
          {semDono.length > 0 ? (
            <div className="mb-2 space-y-1">
              {semDono.map((item) => {
                const { de, ate } = diaNaGrade(item);
                const inicio = dias.findIndex((d) => d >= de);
                const fim = dias.findLastIndex((d) => d <= ate);
                if (inicio === -1 || fim === -1 || fim < inicio) return null;
                return (
                  <div
                    key={item.id}
                    className="grid gap-px"
                    style={{
                      gridTemplateColumns: `12rem repeat(${dias.length}, ${largura})`,
                    }}
                  >
                    <div className="bg-surface-page text-text-muted sticky left-0 z-20 truncate pr-2 text-right text-xs">
                      {ROTULOS_DE_CAMADA[item.tipo]}
                    </div>
                    <button
                      type="button"
                      onClick={() => aoAbrir(item)}
                      title={`${ROTULOS_DE_CAMADA[item.tipo]}: ${item.titulo}`}
                      style={{
                        gridColumnStart: inicio + 2,
                        gridColumnEnd: fim + 3,
                      }}
                      className={cn(
                        "truncate rounded px-2 py-0.5 text-left text-xs font-medium",
                        COR_DA_CAMADA[item.tipo],
                      )}
                    >
                      {item.titulo}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : null}

          {/* AS PESSOAS, agrupadas por área */}
          {/* SEM `overflow-hidden` AQUI, e não é descuido de estilo.
            `overflow: hidden` cria um novo scrollport, e `position: sticky`
            passa a se medir por ELE em vez de pela caixa que rola de verdade
            — a coluna de nomes ficava presa à grade e saía da tela junto com
            os dias. O arredondamento das pontas sai das bordas dos filhos. */}
          <div className="bg-border grid gap-px rounded-lg border">
            {areas.map(({ area, gente }) => (
              <Fragment key={area}>
                {/* A FAIXA DA ÁREA OCUPA A LARGURA INTEIRA, então quem gruda
                  é o TEXTO e não ela: `sticky` numa caixa de 72rem não
                  segura nada — ela já está toda dentro da tela, e o rótulo
                  no canto esquerdo dela sai junto com a rolagem. */}
                <div className="bg-muted text-text-muted py-1 text-xs font-medium tracking-wide uppercase">
                  <span className="sticky left-0 inline-block px-3">
                    {area}
                  </span>
                </div>

                {gente.map((pessoa) => {
                  const dela = porPessoa.get(pessoa.id) ?? [];
                  const cargaDela = cargaPorPessoa.get(pessoa.id);

                  return (
                    <div
                      key={pessoa.id}
                      className="bg-surface-card grid items-center gap-px"
                      style={{
                        gridTemplateColumns: `12rem repeat(${dias.length}, ${largura})`,
                      }}
                    >
                      {/* A COLUNA DE NOMES É FIXA, e é o que faz esta visão
                        funcionar rolando. Sem `sticky`, arrastar o mês para
                        a direita leva os nomes junto e a grade vira um campo
                        de barras sem dono — foi assim que ela saiu na
                        primeira imagem, com "Carla Nunes" lida como "nes". */}
                      <div className="bg-surface-card sticky left-0 z-10 flex min-w-0 items-center gap-2 px-2 py-1.5">
                        <UserAvatar
                          name={pessoa.nome}
                          src={pessoa.avatar_url}
                          size="sm"
                        />
                        <span className="min-w-0 truncate text-xs font-medium">
                          {pessoa.nome}
                        </span>
                      </div>

                      {dias.map((dia) => {
                        const noDia = dela.filter((i) => ocupaODia(i, dia));
                        const fora = noDia.some((i) => i.tipo === "ausencia");
                        const c = cargaDela?.get(dia);
                        const nivel = c
                          ? nivelDaCarga(c, pessoa.capacidadeMinutos)
                          : "vazio";
                        const trabalho = noDia.filter(
                          (i) => i.tipo !== "ausencia",
                        );

                        const rotulo = fora
                          ? `${pessoa.nome} está fora em ${format(parseISO(dia), "dd/MM")}`
                          : c
                            ? `${pessoa.nome}, ${format(parseISO(dia), "dd/MM")}: ${c.etapas} etapa(s), ${formatarMinutos(c.minutos)} de ${formatarMinutos(pessoa.capacidadeMinutos)} — ${ROTULOS_DE_NIVEL[nivel]}${c.semEstimativa > 0 ? `, ${c.semEstimativa} sem estimativa` : ""}`
                            : `${pessoa.nome}, ${format(parseISO(dia), "dd/MM")}`;

                        return (
                          <div
                            key={dia}
                            title={rotulo}
                            className={cn(
                              "flex h-9 flex-col justify-center gap-0.5 px-0.5",
                              ehFimDeSemana(dia)
                                ? "bg-muted"
                                : COR_DO_NIVEL[nivel],
                              // QUEM ESTÁ FORA É HACHURADO, e não só colorido:
                              // a cor sozinha já carrega a carga, e duas
                              // informações na mesma cor seriam uma delas
                              // sumindo.
                              fora &&
                                "bg-[repeating-linear-gradient(45deg,transparent,transparent_3px,currentColor_3px,currentColor_4px)] text-text-muted",
                            )}
                          >
                            {trabalho.slice(0, 2).map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => aoAbrir(item)}
                                aria-label={`${item.titulo} — ${format(parseISO(dia), "dd/MM")}`}
                                className={cn(
                                  "h-2 w-full rounded-full",
                                  item.tipo === "subtarefa"
                                    ? corDaEtapa(item.prioridade)
                                    : COR_DA_CAMADA[item.tipo],
                                )}
                              />
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* A LEGENDA FICA FORA DO QUE ROLA. Dentro, ela some para a esquerda no
          instante em que a pessoa arrasta o mês — e uma legenda que precisa
          ser procurada não é legenda.

          E A LEGENDA DA CARGA Ela existe porque a cor da célula quer dizer
            duas coisas diferentes do resto da tela: aqui ela é OCUPAÇÃO, e
            não camada. Sem dizer isso, o âmbar da célula leria como o âmbar
            da campanha. */}
      <div className="text-text-muted mt-2 flex flex-wrap items-center gap-3 text-xs">
        <span>Cor da célula = ocupação do dia:</span>
        {(["folgado", "cheio", "estourado"] as const).map((nivel) => (
          <span key={nivel} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className={cn("size-3 rounded", COR_DO_NIVEL[nivel])}
            />
            {ROTULOS_DE_NIVEL[nivel]}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="text-text-muted size-3 rounded bg-[repeating-linear-gradient(45deg,transparent,transparent_3px,currentColor_3px,currentColor_4px)]"
          />
          fora
        </span>
      </div>
    </div>
  );
}
