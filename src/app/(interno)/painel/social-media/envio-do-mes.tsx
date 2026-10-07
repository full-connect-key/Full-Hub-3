"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CircleAlert, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { chamarAcao } from "@/lib/acoes/cliente";
import type { PortaoDoMes } from "@/lib/dados/social-media";
import { enviarMesAoCliente } from "./acoes";

/**
 * ENVIAR O MÊS AO CLIENTE, numa decisão só.
 *
 * ---------------------------------------------------------------------------
 * **O BOTÃO DIZ QUANTAS PEÇAS VÃO**, e o número não é enfeite: a gestão está
 * mandando dezoito artes para fora da agência de uma vez, e um botão escrito
 * só "Enviar ao cliente" não dá a ela nenhuma forma de perceber que faltam
 * três. É a decisão do diálogo de "Pedir as notas do mês", que diz QUEM vai
 * receber antes do clique, e a do diálogo de apagar campanha, que CONTA o que
 * vai junto em vez de perguntar "tem certeza?".
 *
 * **E ELE NÃO É UM DIÁLOGO.** O recado é opcional e o resto da decisão já está
 * na tela — a fase, a contagem, o que falta. Um diálogo de confirmação em cima
 * disso só repetiria o que a pessoa acabou de ler, e o produto já pagou essa
 * conta na faixa de disponibilidade: construir a trava para depois oferecer o
 * "mesmo assim" é inventar o portão.
 *
 * **O QUE FALTA VEM NOMEADO, COM LINK**, e esta é a metade que o sprint pede
 * por nome. "Três peças estão sem data" manda a pessoa abrir dezoito uma por
 * uma; dizer quais, com o link de cada, é a diferença entre uma recusa e uma
 * instrução — a decisão da 0023, que nomeia cada etapa sem aprovação.
 *
 * **E A LISTA DESLIGA O BOTÃO, e eu tinha escrito aqui o contrário.** A versão
 * anterior deste comentário dizia que "as peças que faltam ficam de fora do
 * lote e as outras saem", e desligava nada — **foi o teste de fumaça contra o
 * Postgres que mostrou**: `enviar_mes_ao_cliente` confere
 * `o_que_falta_no_portao()` ANTES de gravar qualquer coisa e recusa o envio
 * inteiro, nomeando as peças. A tela dizia "(7)" num mês de 13 e o clique
 * levava a recusa.
 *
 * **E o banco está certo:** o mês anda junto por padrão (0090), e o portão é
 * do MÊS — mandar 7 de 13 partiria o mês no portão, que é o que
 * `avanca_em_paralelo` existe para permitir e o que o padrão recusa. Quem
 * quiser o envio parcial liga o paralelismo no fluxo da conta.
 *
 * Então o número é o que VAI SAIR quando nada mais faltar, e enquanto a lista
 * tem linha o botão fica desligado com ela à vista. É a decisão do "Enviar ao
 * cliente" desligado com a razão escrita, e não um número que o clique
 * desmente.
 * ---------------------------------------------------------------------------
 */
export function EnvioDoMes({
  taskId,
  portao,
}: {
  taskId: string;
  portao: PortaoDoMes;
}) {
  const [recado, setRecado] = useState("");
  const [enviando, comecarTransicao] = useTransition();

  if (!portao.etapa) return null;

  const impedido = portao.falta.length > 0 || portao.pecas === 0;

  const rotulo =
    portao.etapa.papel === "entrega"
      ? "Enviar o mês ao cliente"
      : `Enviar a ${portao.etapa.titulo} ao cliente`;

  function enviar() {
    comecarTransicao(async () => {
      const r = await chamarAcao(() =>
        enviarMesAoCliente(taskId, portao.etapa!.id, recado),
      );
      if (r.ok) {
        setRecado("");
        toast.success(r.mensagem);
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <section className="space-y-2" aria-labelledby="envio-do-mes">
      <h3
        id="envio-do-mes"
        className="text-text-secondary text-[11px] font-bold tracking-wider uppercase"
      >
        Envio ao cliente
      </h3>

      {/* O RECADO VIAJA COM O LOTE, e é um por envio e não um por peça: ele
          responde "o que a agência quis dizer ao mandar este mês", e dezoito
          cópias da mesma frase seriam dezoito lugares para ela divergir.
          Opcional de propósito — na maioria dos meses não há nada a dizer, e
          um campo obrigatório ali faria alguém escrever "segue" dezoito vezes
          por ano. */}
      <div className="space-y-1">
        <Label htmlFor="recado-do-lote" className="text-xs">
          Um recado junto (opcional)
        </Label>
        <Textarea
          id="recado-do-lote"
          value={recado}
          onChange={(e) => setRecado(e.target.value)}
          disabled={enviando || impedido}
          rows={2}
          placeholder="Ex.: as duas de campanha vêm na semana que vem."
          className="text-sm"
        />
      </div>

      <Button
        onClick={enviar}
        disabled={enviando || impedido}
        className="w-full"
      >
        <Send aria-hidden />
        {rotulo}
        {portao.pecas > 0 ? ` (${portao.pecas})` : ""}
      </Button>

      {/* ZERO PEÇA DESLIGA O BOTÃO COM A RAZÃO ESCRITA, em vez de esconder:
          um botão que some ensina que não existe; um desligado que diz *"todas
          as peças já estão com o cliente"* ensina em que pé o mês está. É a
          decisão do "Enviar ao cliente" desligado do próprio módulo. */}
      {portao.pecas === 0 ? (
        <p className="text-text-muted text-xs">
          Todas as peças desta fase já estão com o cliente.
        </p>
      ) : null}

      {portao.falta.length > 0 ? (
        <div className="bg-warning-soft rounded-lg px-3 py-2">
          <p className="text-warning flex items-start gap-2 text-xs font-semibold">
            <CircleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
            {/* A FRASE NÃO DIZ "o mês vai junto", e a precisão importa: com
                `avanca_em_paralelo` ligado o mês NÃO vai junto, e a peça que
                já passou deste portão não está nesta lista — ela nem é
                elegível aqui. O que vale nos dois modos é que o envio espera
                as peças que estão NESTE portão, e é isso que a frase diz. */}
            {portao.falta.length === 1
              ? "Uma peça ainda não pode ir, e o envio espera por ela:"
              : `${portao.falta.length} peças ainda não podem ir, e o envio espera por elas:`}
          </p>
          {/* O LINK FICA EM LINHA PRÓPRIA, e o motivo embaixo dele. **Foi o
              axe que pegou**, com a regra `link-in-text-block`: dentro do
              parágrafo, a cor era a única coisa que separava o nome da peça do
              texto em volta — e todo link deste produto é `hover:underline`,
              que não vale para quem não passa o mouse. É o mesmo achado que o
              pedido concluído do portal já pagou, e o conserto é o mesmo. */}
          <ul className="mt-1.5 space-y-1">
            {portao.falta.map((f) => (
              <li key={f.postId} className="text-xs">
                <Link
                  href={`/painel/social-media?post=${f.postId}`}
                  className="text-accent-strong block font-medium hover:underline"
                >
                  {f.tema}
                </Link>
                <span className="text-text-secondary">{f.motivo}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
