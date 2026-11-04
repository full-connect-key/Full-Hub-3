"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { CircleAlert, Loader2, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { chamarAcao } from "@/lib/acoes/cliente";
import type { Conteudo, EnvioEscolhido } from "@/lib/aprovacoes/conteudo";
import {
  quemPodeAprovar,
  type QuemPodeAprovar,
} from "@/app/(interno)/painel/_actions/aprovadores";

/**
 * O MODAL DE ENVIO AO CLIENTE: cliente, responsável e mensagem.
 *
 * ---------------------------------------------------------------------------
 * Decisão do usuário, item 14: *"modal com Cliente (auto), Responsável
 * (obrigatório), Mensagem (opcional); só usuários ativos; impedir envio sem
 * responsável"*.
 *
 * **É UM COMPONENTE E NÃO UMA CONVENÇÃO ESCRITA**, que é a decisão de
 * `LinhaDeTrabalho` e de `BotaoDeDecisao` palavra por palavra: são QUATRO
 * telas que mandam material para fora da agência — a etapa de demanda, o post
 * avulso, a peça de campanha e a fila de aprovações internas —, e quatro
 * cópias deste diálogo seriam quatro lugares para divergir. A que divergiria é
 * a da fila, que é a menos relida; e o lugar em que a divergência apareceria é
 * o mais caro do produto: o botão que manda arte para o cliente.
 *
 * **O CLIENTE É LIDO, NUNCA ESCOLHIDO.** Ele vem de `cliente_da_rodada()`
 * (0064), a mesma função que o gatilho usa para achar a conta — e aparece como
 * texto, não como campo. Um seletor de empresa aqui seria o jeito mais fácil
 * de mandar a arte de uma conta para o portal de outra, que é a razão pela
 * qual a 0078 recusa trocar a empresa de uma campanha para todo mundo,
 * inclusive o sócio.
 *
 * **A LISTA É SÓ DE QUEM ESTÁ ATIVO**, e ela sai de `aprovadores_da_conta()`
 * — a MESMA função que `validar_nova_rodada` consulta. É isso que impede o
 * seletor de oferecer quem o banco recusa.
 *
 * **E A CONTA SEM NINGUÉM NO PORTAL DIZ ISSO, com o caminho.** Em 27 das 28
 * contas deste banco é esse o caso, e material enviado para uma conta sem
 * acesso não chega a pessoa nenhuma: ninguém consegue abrir o portal dela.
 * Então o diálogo não abre um seletor vazio — ele nomeia a empresa e manda
 * para onde se dá o acesso, que é a diferença entre uma recusa e uma
 * instrução (0023). O botão fica desligado COM a razão à vista, e não some: um
 * botão que some ensina que a ação não existe.
 *
 * **A MENSAGEM É OPCIONAL de propósito**, e é a decisão do recado do lote
 * (0090): na maioria dos envios não há nada a dizer, e um campo obrigatório
 * faria alguém escrever "segue" dezoito vezes por ano.
 *
 * **A LISTA É BUSCADA NA ABERTURA, e não quando a tela monta.** Quatro telas
 * desenham este diálogo, e três delas o têm fechado quase sempre — uma consulta
 * por montagem seria uma ida ao banco por abertura de tela de task para
 * alimentar um seletor que quase ninguém vê. É a decisão da contagem do
 * diálogo de apagar o mês de social.
 */
export function EnvioAoCliente({
  conteudo,
  aberto,
  aoFechar,
  aoEnviar,
  titulo = "Enviar ao cliente",
  oQueE = "O material",
}: {
  conteudo: Conteudo;
  aberto: boolean;
  aoFechar: () => void;
  /** Quem grava. Devolve `true` quando o envio foi aceito, para o diálogo fechar. */
  aoEnviar: (escolhido: EnvioEscolhido) => Promise<boolean>;
  titulo?: string;
  oQueE?: string;
}) {
  const [quem, setQuem] = useState<QuemPodeAprovar | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aprovadorId, setAprovadorId] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [enviando, iniciar] = useTransition();
  const [tentativa, setTentativa] = useState(0);
  // `useTransition` SÓ PELO EMBRULHO das escritas do efeito: o
  // `react-hooks/set-state-in-effect` do projeto reprova `setState` no corpo
  // de um efeito, e `startTransition` é o que o satisfaz — é a mesma linha da
  // faixa de disponibilidade, e pelo mesmo motivo.
  const [, limpar] = useTransition();

  // A CHAVE É O CONTEÚDO MAIS A TENTATIVA, e o estado de "carregando" é
  // DERIVADO dela — é a lição da faixa de disponibilidade, onde o primeiro
  // elemento de um `useTransition` fechava antes do primeiro byte porque o
  // retorno de chamada só DISPARA a promessa. Aqui `quem === null && !erro`
  // com o diálogo aberto é exatamente "a resposta ainda não voltou".
  useEffect(() => {
    if (!aberto) return;
    let valeAinda = true;
    limpar(() => {
      setQuem(null);
      setErro(null);
    });
    void (async () => {
      const r = await chamarAcao(() => quemPodeAprovar(conteudo));
      if (!valeAinda) return;
      if (r.ok && r.dados) {
        setQuem(r.dados);
        // UM APROVADOR SÓ JÁ VEM ESCOLHIDO. Com uma pessoa na conta, pedir o
        // clique num seletor de uma opção é pedir uma decisão que não existe —
        // e é o estado da única conta deste banco que tem portal. Com duas ou
        // mais, nada vem marcado: a opção pré-marcada é a que ninguém lê.
        setAprovadorId(
          r.dados.aprovadores.length === 1 ? r.dados.aprovadores[0].id : "",
        );
      } else {
        setErro(r.ok ? "Não foi possível ler quem aprova." : r.error);
      }
    })();
    return () => {
      valeAinda = false;
    };
    // A LISTA É O PAR, e não o objeto: os chamadores montam `conteudo` com
    // `daSubtarefa(id)` / `doPost(id)` dentro do JSX, então ele é um literal
    // NOVO a cada render — na lista, a busca se refaria a cada digitada do
    // chamador. O que identifica o material é `(tipo, id)`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, conteudo.tipo, conteudo.id, tentativa]);

  const carregando = aberto && quem === null && erro === null;
  const semNinguem = quem !== null && quem.aprovadores.length === 0;
  const impedido = carregando || semNinguem || aprovadorId === "" || enviando;

  const motivo = carregando
    ? "Lendo quem aprova por esta conta…"
    : semNinguem
      ? "Esta conta ainda não tem ninguém com acesso ao portal."
      : aprovadorId === ""
        ? "Escolha quem vai aprovar."
        : null;

  function enviar() {
    iniciar(async () => {
      const ok = await aoEnviar({
        aprovadorId,
        mensagem: mensagem.trim() === "" ? null : mensagem.trim(),
      });
      if (ok) {
        setMensagem("");
        aoFechar();
      }
    });
  }

  return (
    <Dialog open={aberto} onOpenChange={(a) => !a && aoFechar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>
            {oQueE} passa a aparecer no Portal do Cliente, e quem você nomear
            recebe o aviso. O envio registra quem enviou, quem recebeu e quando.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* CLIENTE — LIDO, e não um campo. */}
          <div className="space-y-1">
            <span className="text-text-secondary text-[11px] font-bold tracking-wider uppercase">
              Cliente
            </span>
            <p className="text-text-primary text-sm font-medium">
              {carregando ? "…" : (quem?.empresa ?? "—")}
            </p>
          </div>

          {erro ? (
            <div className="bg-warning-soft space-y-2 rounded-lg p-3">
              <p className="text-text-primary flex items-start gap-2 text-sm">
                <CircleAlert className="text-warning mt-0.5 size-4 shrink-0" />
                <span>{erro}</span>
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTentativa((n) => n + 1)}
              >
                Tentar de novo
              </Button>
            </div>
          ) : null}

          {/* A CONTA SEM PORTAL DIZ O QUE FAZER, e o link é linha própria —
              `link-in-text-block` do axe: dentro do parágrafo a cor seria a
              única coisa que o separa do texto em volta, que é a regra que o
              pedido concluído do portal já pagou. */}
          {semNinguem ? (
            <div className="bg-warning-soft space-y-2 rounded-lg p-3">
              <p className="text-text-primary flex items-start gap-2 text-sm">
                <CircleAlert className="text-warning mt-0.5 size-4 shrink-0" />
                <span>
                  A {quem?.empresa} ainda não tem ninguém com acesso ao portal.
                  Material enviado para uma conta sem acesso não chega a pessoa
                  nenhuma.
                </span>
              </p>
              <Link
                href="/painel/pessoas?aba=clientes"
                className="text-action-text block text-sm font-medium hover:underline"
              >
                Dar acesso em Gestão de Pessoas › Clientes
              </Link>
            </div>
          ) : null}

          {/* RESPONSÁVEL — obrigatório. */}
          {!semNinguem && !erro ? (
            <div className="space-y-1">
              <Label htmlFor="aprovador-do-envio" className="text-xs">
                Quem vai aprovar
              </Label>
              <Select
                value={aprovadorId}
                onValueChange={setAprovadorId}
                disabled={carregando || enviando}
              >
                <SelectTrigger
                  aria-label="Quem vai aprovar"
                  id="aprovador-do-envio"
                  className="w-full"
                >
                  <SelectValue placeholder="Escolha a pessoa…" />
                </SelectTrigger>
                <SelectContent>
                  {(quem?.aprovadores ?? []).map((pessoa) => (
                    <SelectItem key={pessoa.id} value={pessoa.id}>
                      {pessoa.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* QUALQUER PESSOA DA EMPRESA CONTINUA PODENDO RESPONDER, e
                  dizê-lo aqui é o que impede a pessoa de concluir que nomear
                  tranca a decisão — não há hierarquia do lado do cliente. */}
              <p className="text-text-muted text-xs">
                É quem recebe o aviso. Qualquer pessoa da empresa continua
                podendo responder.
              </p>
            </div>
          ) : null}

          {/* MENSAGEM — opcional. */}
          {!semNinguem && !erro ? (
            <div className="space-y-1">
              <Label htmlFor="mensagem-do-envio" className="text-xs">
                Uma mensagem junto (opcional)
              </Label>
              <Textarea
                id="mensagem-do-envio"
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                disabled={carregando || enviando}
                rows={2}
                placeholder="Ex.: os ajustes do layout já entraram."
                className="text-sm"
              />
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={aoFechar} disabled={enviando}>
            Cancelar
          </Button>
          {/* O BOTÃO FICA DESLIGADO COM A RAZÃO À VISTA, e não some: é a
              decisão do "Enviar ao cliente" do Social Media. */}
          <Button onClick={enviar} disabled={impedido} title={motivo ?? undefined}>
            {enviando ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Send aria-hidden="true" />
            )}
            Enviar ao cliente
          </Button>
        </DialogFooter>

        {motivo && !semNinguem && !erro ? (
          <p className="text-text-muted text-right text-xs">{motivo}</p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
