"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { chamarEMostrar } from "@/lib/acoes/cliente";
import {
  METRICAS_DO_SOCIAL,
  ROTULO_DO_ESTADO_DO_RELATORIO,
  TOM_DO_ESTADO_DO_RELATORIO,
  chaveDoNumero,
  estadoDoRelatorio,
  mesPorExtenso,
  mesesParaRelatar,
  numeroNaTela,
  publicado,
  variacaoDaMetrica,
  type RelatorioDoSocial,
  type NumeroDoRelatorio,
} from "@/lib/dominio/relatorio-do-social";
import { PLATAFORMAS, ROTULO_DA_PLATAFORMA } from "@/lib/dominio/posts";
import type { PlataformaSocial } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

import {
  publicarRelatorioDoSocial,
  salvarRelatorioDoSocial,
} from "./acoes-do-relatorio";

/**
 * O RELATÓRIO DE DESEMPENHO DO MÊS, do lado de quem preenche (migration 0150).
 *
 * Decisão do usuário, item 17: *"gostaria que no Social Media, aparecesse um
 * relatório preenchido com os dados do social, como visualização, curtidas e
 * afins, para o cliente ter essas informações o tempo todo (…), isso pode ser
 * preenchido pela social media"*; item 18: *"podemos passar essa parte
 * de social, para uma aba a parte de relatórios, para permitir que os dados
 * sejam editados pela social"*.
 *
 * ---------------------------------------------------------------------------
 * **A TELA COMEÇA PELAS REDES QUE O MÊS TEM, e não pelas sete.** Sete redes
 * por dez métricas são **setenta campos em branco**, e setenta campos não são
 * um formulário — quem preenche abre o Insights de UMA rede, às vezes duas, e
 * digita os números dela. As redes do mês saem de `redesDoMes()`, que recorta
 * pela DEMANDA e não por data de publicação; as outras entram num chip, porque
 * a conta que reporta uma rede onde não postou naquele mês é caso real (um
 * perfil que cresceu sozinho) e recusá-la seria uma trava que a tela não sabe
 * explicar.
 *
 * ---------------------------------------------------------------------------
 * **UM SALVAR PARA O MÊS INTEIRO, e o campo vazio APAGA a linha.** É a decisão
 * da barra do modal da etapa: cada campo gravado sozinho seria uma escrita que
 * o cliente vê no instante em que quem digita ainda está conferindo o
 * Insights — e aqui ele é pior, porque metade dos números vem de uma tela só e
 * salvar campo a campo publicaria um mês pela metade. O vazio apagar é o que
 * permite desfazer um número digitado errado sem um segundo botão por linha.
 *
 * ---------------------------------------------------------------------------
 * **PUBLICAR É UM SEGUNDO BOTÃO, e isso é "aprovar não envia" aplicado a um
 * relatório.** Enquanto `publicado_em` é nulo o cliente não vê nada —
 * `social_reports_select` pergunta por ela —, então digitar e publicar são duas
 * decisões: a social media fecha os números no dia 1 e a conta é apresentada
 * na reunião do dia 5. Um salvamento que publicasse junto mandaria para o
 * portal o mês em que ela parou no meio para conferir uma dúvida.
 * ---------------------------------------------------------------------------
 */
export function RelatorioDoSocialNaTela({
  contas,
  clienteId,
  nomeDaConta,
  mes,
  relatorio,
  numeros,
  anteriores,
  redes,
}: {
  contas: { id: string; nome_empresa: string }[];
  clienteId: string | null;
  nomeDaConta: string | null;
  mes: string;
  relatorio: RelatorioDoSocial | null;
  numeros: NumeroDoRelatorio[];
  anteriores: NumeroDoRelatorio[];
  /** As redes em que a conta publicou naquele mês. */
  redes: PlataformaSocial[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const parametros = useSearchParams();

  function ir(chave: string, valor: string | null) {
    const proximos = new URLSearchParams(parametros.toString());
    if (valor) proximos.set(chave, valor);
    else proximos.delete(chave);
    router.replace(`${pathname}?${proximos.toString()}`, { scroll: false });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-50 flex-1">
          <Label htmlFor="relatorio-conta" className="text-xs">
            Conta
          </Label>
          {/* OS DOIS SELETORES NAVEGAM PELA URL, como todo recorte de listagem
              deste produto: *"olha o relatório de outubro da Mundo Verde"*
              precisa ser um link, e é por isso que vir de Social com `?mes=` já
              abre o mês certo. */}
          <select
            id="relatorio-conta"
            className="border-input bg-card focus-visible:ring-ring mt-1 h-9 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
            value={clienteId ?? ""}
            onChange={(e) => ir("cliente", e.target.value || null)}
          >
            <option value="">Escolha uma conta…</option>
            {contas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome_empresa}
              </option>
            ))}
          </select>
        </div>

        <div className="w-44">
          <Label htmlFor="relatorio-mes" className="text-xs">
            Mês
          </Label>
          <select
            id="relatorio-mes"
            className="border-input bg-card focus-visible:ring-ring mt-1 h-9 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
            value={mes}
            onChange={(e) => ir("mes", e.target.value)}
          >
            {mesesParaRelatar().map((m) => (
              <option key={m} value={m}>
                {mesPorExtenso(m)}
              </option>
            ))}
          </select>
        </div>

        {clienteId ? <SeloDoEstado relatorio={relatorio} /> : null}
      </div>

      {clienteId ? (
        <Formulario
          key={`${clienteId}|${mes}`}
          clienteId={clienteId}
          nomeDaConta={nomeDaConta}
          mes={mes}
          relatorio={relatorio}
          numeros={numeros}
          anteriores={anteriores}
          redes={redes}
        />
      ) : (
        /* A FRASE DIZ O QUE ESCOLHER E O QUE ACONTECE DEPOIS. Um estado vazio
           que só diz "escolha uma conta" manda a pessoa clicar para descobrir o
           que a tela faz. */
        <p className="text-text-secondary border-input bg-card rounded-card border border-dashed p-6 text-sm">
          Escolha a conta e o mês para preencher o relatório de desempenho —
          alcance, curtidas, seguidores. Depois de publicado, o cliente lê estes
          números no portal dele, dentro do mês de social.
        </p>
      )}
    </div>
  );
}

function SeloDoEstado({ relatorio }: { relatorio: RelatorioDoSocial | null }) {
  const estado = estadoDoRelatorio(relatorio);
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 text-xs font-medium",
        TOM_DO_ESTADO_DO_RELATORIO[estado],
      )}
    >
      {ROTULO_DO_ESTADO_DO_RELATORIO[estado]}
    </span>
  );
}

function Formulario({
  clienteId,
  nomeDaConta,
  mes,
  relatorio,
  numeros,
  anteriores,
  redes,
}: {
  clienteId: string;
  nomeDaConta: string | null;
  mes: string;
  relatorio: RelatorioDoSocial | null;
  numeros: NumeroDoRelatorio[];
  anteriores: NumeroDoRelatorio[];
  redes: PlataformaSocial[];
}) {
  const [salvando, iniciar] = useTransition();

  /**
   * O VALOR DE CADA CAMPO MORA COMO TEXTO, e a razão está escrita na
   * quantidade de peças do workflow (0140): um `<input type="number">`
   * controlado por NÚMERO não deixa o campo ficar vazio enquanto a pessoa
   * apaga o `1200` para digitar outro — ela apaga e o React devolve o valor na
   * mesma tecla. E aqui o vazio decide algo: ele apaga a linha.
   */
  const [valores, setValores] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      numeros.map((n) => [
        chaveDoNumero(n.plataforma, n.metrica),
        String(n.valor),
      ]),
    ),
  );
  const [comentario, setComentario] = useState(relatorio?.comentario ?? "");

  /**
   * AS REDES EM CENA SÃO AS DO MÊS **mais** as que já têm número gravado.
   *
   * A segunda metade é obrigatória: sem ela, um relatório preenchido num mês em
   * que a conta postou só no Instagram esconderia o bloco do LinkedIn que
   * alguém digitou na semana passada — os números continuariam no banco, no
   * portal do cliente, e invisíveis para quem os escreveu.
   */
  const [emCena, setEmCena] = useState<PlataformaSocial[]>(() => {
    const comNumero = new Set(numeros.map((n) => n.plataforma));
    return PLATAFORMAS.filter((p) => redes.includes(p) || comNumero.has(p));
  });

  const antes = new Map(
    anteriores.map((n) => [chaveDoNumero(n.plataforma, n.metrica), n.valor]),
  );

  const faltam = PLATAFORMAS.filter((p) => !emCena.includes(p));

  function salvar() {
    iniciar(async () => {
      await chamarEMostrar(() =>
        salvarRelatorioDoSocial({
          client_id: clienteId,
          competencia: `${mes}-01`,
          comentario,
          // SÓ O QUE TEM NÚMERO VIAJA, e é isso que faz o campo vazio apagar a
          // linha: a action lê de volta os pares gravados e apaga os que não
          // vieram. Mandar o vazio como zero seria gravar "zero curtidas",
          // que é uma afirmação e não uma ausência.
          numeros: emCena.flatMap((plataforma) =>
            METRICAS_DO_SOCIAL.flatMap((m) => {
              const cru = valores[chaveDoNumero(plataforma, m.chave)]?.trim();
              if (!cru) return [];
              const valor = Number(cru);
              if (!Number.isFinite(valor)) return [];
              return [{ plataforma, metrica: m.chave, valor }];
            }),
          ),
        }),
      );
    });
  }

  function trocarPublicacao(publicar: boolean) {
    iniciar(async () => {
      await chamarEMostrar(() =>
        publicarRelatorioDoSocial({
          client_id: clienteId,
          competencia: `${mes}-01`,
          publicar,
        }),
      );
    });
  }

  const noAr = publicado(relatorio);

  return (
    <div className="space-y-5">
      <div className="bg-card rounded-card shadow-cartao border-input space-y-5 border p-5">
        <div>
          <h2 className="text-sm font-semibold">
            {nomeDaConta} · {mesPorExtenso(mes)}
          </h2>
          {/* A FRASE DIZ O QUE ISTO FAZ FORA DESTA TELA, porque é fora dela que
              decide algo — e ela nomeia as DUAS metades: o que o cliente lê, e
              que só o ganho é comparado. */}
          <p className="text-text-muted mt-1 text-xs">
            Os números do Insights de cada rede. Depois de publicado, o cliente
            lê esta lista no mês de social do portal dele — com o ganho sobre o
            mês anterior ao lado, quando houver.
          </p>
        </div>

        {emCena.length === 0 ? (
          <p className="text-text-secondary text-sm">
            Este mês não tem peça em rede nenhuma. Escolha a rede abaixo para
            preencher os números de qualquer forma.
          </p>
        ) : (
          <div className="space-y-6">
            {emCena.map((plataforma) => (
              <BlocoDaRede
                key={plataforma}
                plataforma={plataforma}
                valores={valores}
                setValores={setValores}
                antes={antes}
                inerte={salvando}
              />
            ))}
          </div>
        )}

        {/* AS REDES QUE FALTAM SÃO CHIPS, e não sete blocos abertos: a rede que
            a conta não usa é um bloco de dez campos em branco em toda visita.
            É a decisão do seletor de redes do social — e o chip NÃO tira nada
            do que já foi digitado, porque tirar seria perder o trabalho num
            clique sem confirmação. */}
        {faltam.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 border-t pt-4">
            <span className="text-text-muted text-xs">Acrescentar rede:</span>
            {faltam.map((p) => (
              <button
                key={p}
                type="button"
                disabled={salvando}
                onClick={() =>
                  setEmCena((atual) =>
                    PLATAFORMAS.filter((x) => atual.includes(x) || x === p),
                  )
                }
                className="border-input bg-card hover:bg-muted rounded-full border px-2.5 py-1 text-xs disabled:opacity-50"
              >
                + {ROTULO_DA_PLATAFORMA[p]}
              </button>
            ))}
          </div>
        ) : null}

        <div className="border-t pt-4">
          <Label htmlFor="relatorio-comentario" className="text-xs">
            A leitura do mês
          </Label>
          <p className="text-text-muted mt-1 mb-2 text-xs">
            O que os números não dizem — a peça que puxou o alcance, a semana em
            que a conta pausou. O cliente lê esta frase junto do relatório.
          </p>
          <Textarea
            id="relatorio-comentario"
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            disabled={salvando}
            rows={3}
            placeholder="Opcional."
          />
        </div>
      </div>

      {/* A BARRA EXISTE NOS DOIS ESTADOS, e é a decisão do modal da etapa: uma
          barra que só nasce depois da primeira edição é uma barra que a pessoa
          descobre DEPOIS de ter editado. */}
      <div className="bg-card rounded-card shadow-cartao border-input flex flex-wrap items-center justify-between gap-3 border p-4">
        <p className="text-text-muted text-xs">
          {noAr
            ? "O cliente está vendo estes números. Salvar atualiza o que ele lê."
            : "O cliente ainda não vê nada deste mês. Publique quando os números estiverem fechados."}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={salvar} disabled={salvando}>
            {salvando ? "Salvando…" : "Salvar os números"}
          </Button>
          {/* PUBLICAR SÓ EXISTE DEPOIS DE HAVER RELATÓRIO, e não aparece
              desligado: antes do primeiro salvamento a razão não é um passo que
              falta, é que não há mês nenhum para publicar — e a action recusa
              com a frase, se alguém chegar lá por outro caminho. */}
          {relatorio ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => trocarPublicacao(!noAr)}
              disabled={salvando}
            >
              {noAr ? "Tirar do portal" : "Publicar para o cliente"}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function BlocoDaRede({
  plataforma,
  valores,
  setValores,
  antes,
  inerte,
}: {
  plataforma: PlataformaSocial;
  valores: Record<string, string>;
  setValores: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  antes: Map<string, number>;
  inerte: boolean;
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-semibold">
        {ROTULO_DA_PLATAFORMA[plataforma]}
      </legend>
      {/* A ORDEM É A DO FUNIL e vem de `METRICAS_DO_SOCIAL`, nunca escrita aqui:
          sem isso a mesma métrica apareceria em posições diferentes de um bloco
          para o outro, e comparar duas redes passaria a exigir procurar a
          linha. */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {METRICAS_DO_SOCIAL.map((m) => {
          const chave = chaveDoNumero(plataforma, m.chave);
          const cru = valores[chave] ?? "";
          const anterior = antes.get(chave) ?? null;
          const valor = cru.trim() ? Number(cru) : null;
          const variacao =
            valor !== null && Number.isFinite(valor)
              ? variacaoDaMetrica(m.chave, valor, anterior)
              : null;

          return (
            <div key={chave} className="min-w-0">
              <Label htmlFor={chave} className="text-xs">
                {m.rotulo}
              </Label>
              <Input
                id={chave}
                inputMode="numeric"
                value={cru}
                disabled={inerte}
                onChange={(e) =>
                  setValores((atual) => ({
                    ...atual,
                    [chave]: e.target.value.replace(/[^\d]/g, ""),
                  }))
                }
                className="mt-1 tabular-nums"
                placeholder="—"
              />
              <p className="text-text-muted mt-1 text-xs">
                {anterior === null
                  ? m.ajuda
                  : `mês anterior: ${numeroNaTela(anterior)}`}
                {/* SÓ O GANHO É PINTADO, que é o item 18 — e ele aparece já
                    aqui, enquanto se digita: é o que diz à social media que
                    aquele número vai sair com o selo na tela do cliente. */}
                {variacao ? (
                  <span className="text-success ml-1 font-medium">
                    {variacao.frase}
                  </span>
                ) : null}
              </p>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
