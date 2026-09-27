import type { Metadata } from "next";
import Link from "next/link";
import { forbidden, notFound } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { exigirAcessoARota } from "@/lib/auth/dal";
import { ehGestor } from "@/lib/auth/roles";
import { equipamento, folhaDoEquipamento } from "@/lib/dados/comodatos";
import {
  CAMPOS_DA_FICHA,
  ICONE_DO_TIPO,
  ROTULOS_DE_ESTADO,
  ROTULOS_DE_EVENTO,
  ROTULOS_DE_STATUS,
  ROTULOS_DE_TIPO,
  TOM_DO_STATUS,
} from "@/lib/dominio/comodatos";

export const metadata: Metadata = { title: "Folha do equipamento" };

/**
 * A FOLHA CORRIDA DE UM EQUIPAMENTO — cadastrado, entregue a fulano,
 * devolvido, em manutenção, entregue a beltrano.
 *
 * ---------------------------------------------------------------------------
 * **É ROTA E NÃO DIÁLOGO**, e a razão é a mesma que põe filtro na URL em toda
 * listagem do produto: "olha a folha do FCK-0002" precisa ser um link. Um
 * diálogo por cima da tabela obrigaria a descrever o caminho até ele — e a
 * pergunta que esta tela responde ("a lente sumiu, quem foi o último a ficar
 * com ela?") é justamente a que se faz numa conversa, com alguém do outro
 * lado.
 *
 * **Ela é da GESTÃO, e não de quem está com o equipamento.** O colaborador vê
 * o que está com ele e o que já devolveu, pelo recorte de `meus_comodatos()`;
 * a folha mostra por quantas mãos a peça passou, que é informação sobre as
 * outras pessoas. `assets_select` é `is_gestor()` e devolveria nada de
 * qualquer jeito — a guarda existe para a recusa ser um 403 e não uma tela
 * dizendo "equipamento não encontrado", que é uma afirmação falsa.
 * ---------------------------------------------------------------------------
 */
export default async function Pagina({ params }: PageProps<"/painel/comodatos/[id]">) {
  const sessao = await exigirAcessoARota("/painel/comodatos");
  if (!ehGestor(sessao.profile.role)) forbidden();

  const { id } = await params;

  const [item, folha] = await Promise.all([equipamento(id), folhaDoEquipamento(id)]);
  if (!item) notFound();

  const Icone = ICONE_DO_TIPO[item.tipo];

  // SÓ O QUE TEM VALOR, e não os quatro com um travessão nos vazios: aqui a
  // ficha é leitura, e "Placa de vídeo —" numa máquina de vídeo integrado
  // ocupa uma coluna para dizer que não há o que dizer. No formulário é o
  // contrário — lá o campo vazio é onde se escreve.
  const fichaPreenchida = CAMPOS_DA_FICHA.map(({ chave, rotulo }) => ({
    rotulo: rotulo as string,
    valor: item[chave],
  })).filter((c): c is { rotulo: string; valor: string } => Boolean(c.valor));

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ms-2">
          <Link href="/painel/comodatos?aba=geral">
            <ArrowLeft aria-hidden className="size-4" />
            Comodatos
          </Link>
        </Button>
      </div>

      <div className="space-y-1">
        <PageHeader title={item.nome} />
        <p className="text-text-secondary text-sm">
          {[item.codigo, ROTULOS_DE_TIPO[item.tipo], item.marca, item.modelo]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-start gap-x-8 gap-y-4 pt-6">
          <div className="bg-neutral-soft flex size-16 shrink-0 items-center justify-center rounded-lg">
            <Icone aria-hidden className="text-text-muted size-7" />
          </div>

          <Dado rotulo="Situação">
            <Badge className={TOM_DO_STATUS[item.status]}>{ROTULOS_DE_STATUS[item.status]}</Badge>
          </Dado>
          <Dado rotulo="Estado">{ROTULOS_DE_ESTADO[item.estado]}</Dado>
          <Dado rotulo="Número de série">{item.numero_serie ?? "—"}</Dado>
          <Dado rotulo="Com quem está">
            {item.comodato ? (
              <>
                {item.comodato.pessoa}
                {!item.comodato.pessoa_ativa ? (
                  // O AVISO REPETE AQUI o que o painel diz em vermelho lá em
                  // cima: quem abre a folha de um item específico costuma ter
                  // vindo pelo link, sem passar pela lista.
                  <span className="text-danger ms-1.5 text-xs">saiu da agência</span>
                ) : null}
              </>
            ) : (
              "—"
            )}
          </Dado>
          {item.data_aquisicao ? (
            <Dado rotulo="Comprado em">
              {format(parseISO(item.data_aquisicao), "dd/MM/yyyy", { locale: ptBR })}
            </Dado>
          ) : null}
        </CardContent>
      </Card>

      {/* A FICHA TÉCNICA (0070), e ela fica ACIMA da folha.
    
          A folha responde "por onde esta peça passou"; a ficha responde "o que
          é esta peça" — e quem abre a página de um notebook para decidir se
          ele serve para o trabalho de alguém está fazendo a segunda pergunta.
          Um bloco inteiro abaixo da linha do tempo seria lido depois de uma
          lista que pode ter vinte linhas.

          Ela some quando não há nada preenchido, como os blocos de exceção da
          Home: quatro rótulos sem valor numa página de tripé é moldura. */}
      {fichaPreenchida.length > 0 ? (
        <section className="space-y-3" aria-labelledby="ficha-titulo">
          <h2 id="ficha-titulo" className="text-text-primary text-sm font-semibold">
            Configuração
          </h2>
          <Card>
            <CardContent className="flex flex-wrap gap-x-8 gap-y-4 pt-6">
              {fichaPreenchida.map(({ rotulo, valor }) => (
                <Dado key={rotulo} rotulo={rotulo}>
                  {valor}
                </Dado>
              ))}
            </CardContent>
          </Card>
        </section>
      ) : null}

      <section className="space-y-3" aria-labelledby="folha-titulo">
        <h2 id="folha-titulo" className="text-text-primary text-sm font-semibold">
          A folha deste equipamento{" "}
          <span className="text-text-muted font-normal tabular-nums">{folha.length}</span>
        </h2>

        {folha.length === 0 ? (
          // NUNCA ACONTECE COM EQUIPAMENTO CADASTRADO PELO PRODUTO — o trigger
          // escreve `cadastrado` no insert —, e o estado existe mesmo assim:
          // uma linha posta a mão no SQL Editor chega aqui, e uma lista em
          // branco sem frase parece tela quebrada.
          <p className="text-text-muted text-sm">
            Nada registrado. Este equipamento entrou no banco por fora do Full Hub.
          </p>
        ) : (
          <ol className="divide-border divide-y rounded-xl border">
            {folha.map((linha) => (
              <li
                key={linha.id}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2.5"
              >
                <span className="text-text-primary min-w-[11rem] flex-1 text-sm font-medium">
                  {ROTULOS_DE_EVENTO[linha.tipo]}
                  {linha.pessoa ? (
                    <span className="text-text-secondary font-normal"> — {linha.pessoa}</span>
                  ) : null}
                </span>
                {linha.estado ? (
                  <span className="text-text-muted text-xs">
                    estado {ROTULOS_DE_ESTADO[linha.estado].toLowerCase()}
                  </span>
                ) : null}
                <span className="text-text-secondary text-xs tabular-nums">
                  {format(parseISO(linha.created_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                </span>
                <span className="text-text-muted text-xs">por {linha.quem}</span>
                {linha.texto ? (
                  <p className="text-text-secondary w-full text-xs">{linha.texto}</p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function Dado({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-text-muted text-xs">{rotulo}</p>
      <div className="text-text-primary text-sm">{children}</div>
    </div>
  );
}
