"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CircleHelp, Paperclip, Printer, Share2, Video, X } from "lucide-react";

import { abrirSolicitacao } from "@/app/(cliente)/portal/_actions/solicitacoes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { chamarEMostrar } from "@/lib/acoes/cliente";
import {
  camposDoRoteiro,
  respostasQueFaltam,
} from "@/lib/dominio/solicitacoes";
import type { RequestType } from "@/lib/supabase/database.types";

import { subirAnexoDoPedido } from "../subir-anexo";

/** O teto é do banco; a tela conta para não oferecer um caminho sem saída. */
const TETO_DE_ARQUIVOS = 10;

/** Os ícones que os tipos iniciais da 0068 pedem, pelo nome gravado. */
const ICONES = { Share2, Printer, Video, CircleHelp } as const;

/**
 * O formulário de um pedido novo.
 *
 * ---------------------------------------------------------------------------
 * **O TIPO VEM PRIMEIRO, E ELE MUDA O RESTO DA TELA.**
 *
 * Escolher "Peça para redes" acrescenta as perguntas daquele trabalho — onde
 * vai ao ar, que formato, o que precisa dizer. É o roteiro de briefing, e ele
 * existe porque um campo de texto livre chamado "descreva o que você precisa"
 * devolve "uma arte pro insta", e a primeira mensagem da conversa é sempre a
 * mesma pergunta.
 *
 * As perguntas vêm do banco (`request_types.campos_json`) e não daqui: a
 * gestão edita o roteiro sem deploy, que é a mesma razão pela qual a
 * capacidade da equipe é coluna e não constante.
 * ---------------------------------------------------------------------------
 *
 * **"Para quando você gostaria" diz o que significa, embaixo do campo.** Um
 * campo de data sem essa frase é lido como prazo combinado — e ele não é: o
 * prazo é o que a agência assume depois de olhar o pedido. Quem digita a data
 * precisa saber disso ANTES de digitar, não quando a peça não chegar no dia.
 */
export function FormularioDePedido({
  empresas,
  tipos,
}: {
  empresas: { id: string; nome_empresa: string }[];
  tipos: RequestType[];
}) {
  const router = useRouter();
  const [executando, comecar] = useTransition();

  const [clienteId, setClienteId] = useState(empresas[0]?.id ?? "");
  const [tipoId, setTipoId] = useState<string>(tipos[0]?.id ?? "");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [quando, setQuando] = useState("");
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [arquivos, setArquivos] = useState<File[]>([]);
  const campo = useRef<HTMLInputElement>(null);
  /**
   * A FRASE DO QUE FALTA SÓ APARECE DEPOIS DE ALGUÉM TENTAR ENVIAR.
   *
   * Sem isto ela nasce na tela: o formulário abre com os obrigatórios vazios,
   * e a primeira coisa que a pessoa lê é uma cobrança por não ter feito nada
   * ainda. É a mesma razão pela qual o alerta que está sempre aceso deixa de
   * ser alerta.
   *
   * **E o botão fica LIGADO**, com o título preenchido: um botão desligado não
   * tem como dizer por que está desligado, e clicar nele é justamente o
   * momento em que a pessoa pede para saber o que falta.
   */
  const [tentou, setTentou] = useState(false);

  const tipo = tipos.find((t) => t.id === tipoId) ?? null;
  const campos = camposDoRoteiro(tipo?.campos_json);
  const faltando = respostasQueFaltam(campos, respostas);

  function responder(chave: string, valor: string) {
    setRespostas((atual) => ({ ...atual, [chave]: valor }));
  }

  function enviar() {
    if (faltando.length > 0) {
      setTentou(true);
      return;
    }
    comecar(async () => {
      const r = await chamarEMostrar(() =>
        abrirSolicitacao({
          client_id: clienteId,
          request_type_id: tipoId || null,
          titulo,
          descricao,
          respostas,
          data_desejada: quando,
        }),
      );
      if (!r.ok || !r.dados) return;

      // -----------------------------------------------------------------
      // O PEDIDO NASCE PRIMEIRO, E OS ARQUIVOS SOBEM DEPOIS.
      //
      // Não é escolha de estilo: o caminho no bucket leva o id do pedido, e
      // a policy do Storage confere a pasta da empresa — não há onde pôr o
      // arquivo antes de a linha existir. Guardá-los em memória até aqui é o
      // que permite o anexo na abertura, que é o pedido do usuário.
      //
      // **E uma falha de upload NÃO derruba o pedido.** Ele já está no
      // banco, e o Atendimento já foi avisado: descartar o texto que a
      // pessoa escreveu por causa de um arquivo que não subiu seria trocar
      // uma falha parcial por uma total. O que o aviso faz é NOMEAR o
      // arquivo que ficou de fora, e a tela do pedido — que abre no
      // instante seguinte — é onde ele entra.
      // -----------------------------------------------------------------
      for (const arquivo of arquivos) {
        const anexo = await subirAnexoDoPedido({
          clientId: clienteId,
          pedidoId: r.dados,
          arquivo,
        });
        if (!anexo.ok) {
          toast.error(
            `O pedido foi enviado, mas "${arquivo.name}" não subiu: ${
              anexo.erro ?? "tente anexar de novo na tela do pedido."
            }`,
          );
        }
      }

      // Leva para o pedido recém-criado: é lá que ele anexa mais arquivo e
      // conversa. Voltar para a lista faria a pessoa procurar o que acabou
      // de mandar.
      router.push(`/portal/solicitacoes/${r.dados}`);
    });
  }

  return (
    <div className="space-y-6">
      {/* O SELETOR DE EMPRESA SÓ APARECE COM MAIS DE UMA. Com uma, ele é um
          campo com uma opção — a pessoa lê, pensa, e escolhe a única. */}
      {empresas.length > 1 ? (
        <div className="space-y-1.5">
          <Label htmlFor="pedido-empresa">Para qual empresa</Label>
          <Select value={clienteId} onValueChange={setClienteId}>
            <SelectTrigger
              aria-label="Empresa"
              id="pedido-empresa"
              className="w-full sm:w-80"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {empresas.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.nome_empresa}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">
          Que tipo de trabalho é
        </legend>
        {/* `role="radiogroup"` no invólucro porque os cartões são
            `role="radio"`: um radio sem o grupo por perto é um papel sem pai,
            e o leitor de tela anuncia "opção 1 de 1" em cada um deles. */}
        <div
          role="radiogroup"
          aria-label="Tipo de pedido"
          className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"
        >
          {tipos.map((t) => {
            const Icone = ICONES[t.icone as keyof typeof ICONES] ?? CircleHelp;
            const escolhido = t.id === tipoId;
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={escolhido}
                onClick={() => setTipoId(t.id)}
                className={
                  escolhido
                    ? "border-accent-strong bg-accent rounded-lg border p-3 text-left"
                    : "hover:bg-accent rounded-lg border p-3 text-left transition-colors"
                }
              >
                <Icone aria-hidden className="text-accent-strong mb-1 size-5" />
                <p className="text-sm font-medium">{t.nome}</p>
                {t.descricao ? (
                  <p className="text-muted-foreground text-xs">{t.descricao}</p>
                ) : null}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="space-y-1.5">
        <Label htmlFor="pedido-titulo">Em uma linha, o que é *</Label>
        <Input
          id="pedido-titulo"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Arte para o Dia das Mães"
        />
      </div>

      {campos.length > 0 ? (
        <section className="space-y-4 rounded-lg border p-4">
          <h2 className="text-sm font-semibold">
            Para a gente não precisar perguntar depois
          </h2>

          {campos.map((c) => {
            const id = `roteiro-${c.chave}`;
            const valor = respostas[c.chave] ?? "";

            return (
              <div key={c.chave} className="space-y-1.5">
                <Label htmlFor={id}>
                  {c.rotulo}
                  {c.obrigatorio ? " *" : ""}
                </Label>

                {c.tipo === "escolha" && c.opcoes?.length ? (
                  <Select
                    value={valor}
                    onValueChange={(v) => responder(c.chave, v)}
                  >
                    <SelectTrigger
                      aria-label={c.rotulo}
                      id={id}
                      className="w-full sm:w-80"
                    >
                      <SelectValue placeholder="Escolha" />
                    </SelectTrigger>
                    <SelectContent>
                      {c.opcoes.map((o) => (
                        <SelectItem key={o} value={o}>
                          {o}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : c.tipo === "texto_longo" ? (
                  <Textarea
                    id={id}
                    rows={3}
                    value={valor}
                    onChange={(e) => responder(c.chave, e.target.value)}
                  />
                ) : (
                  <Input
                    id={id}
                    type={c.tipo === "data" ? "date" : "text"}
                    value={valor}
                    onChange={(e) => responder(c.chave, e.target.value)}
                  />
                )}

                {c.ajuda ? (
                  <p className="text-muted-foreground text-xs">{c.ajuda}</p>
                ) : null}
              </div>
            );
          })}
        </section>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="pedido-descricao">Mais alguma coisa</Label>
        <Textarea
          id="pedido-descricao"
          rows={3}
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Qualquer detalhe que ajude."
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="pedido-quando">Para quando você gostaria</Label>
        <Input
          id="pedido-quando"
          type="date"
          value={quando}
          onChange={(e) => setQuando(e.target.value)}
          className="w-full sm:w-52"
        />
        <p className="text-muted-foreground text-xs">
          É a data que ajudaria você — não é o prazo combinado. A gente olha o
          pedido e responde por aqui com a data que dá para assumir.
        </p>
      </div>

      {/* ---------------------------------------------------------------
          O ANEXO NA ABERTURA — decisão do usuário.

          **Ele existia só na tela do pedido JÁ CRIADO**, e a linha do pé
          deste formulário dizia isso em voz alta: "depois de enviar você pode
          anexar arquivos". Quem abre um pedido está com a referência na mão —
          o print, a foto do material, a arte do ano passado —, e mandá-la num
          segundo passo é mandá-la num passo que metade das pessoas não dá.

          **Os arquivos ficam em memória até o envio**, porque o caminho no
          bucket leva o id do pedido e ele ainda não existe. Por isso esta
          lista é uma lista de escolhas, e não de anexos: ninguém subiu nada
          ainda, e a tela não pode afirmar que subiu.
          --------------------------------------------------------------- */}
      <div className="space-y-2">
        <Label htmlFor="pedido-arquivos">Imagens e arquivos</Label>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={arquivos.length >= TETO_DE_ARQUIVOS}
            onClick={() => campo.current?.click()}
          >
            <Paperclip aria-hidden />
            Escolher arquivos
          </Button>

          <input
            ref={campo}
            id="pedido-arquivos"
            type="file"
            multiple
            // `sr-only` esconde da vista e NÃO da árvore de acessibilidade —
            // por isso o `aria-label`: sem ele o campo é anunciado como
            // "editar" e mais nada.
            aria-label="Escolher imagens e arquivos para anexar"
            className="sr-only"
            onChange={(e) => {
              const escolhidos = Array.from(e.target.files ?? []);
              // O CORTE AVISA, em vez de descartar calado: cada arquivo foi
              // escolhido por uma pessoa, e sumir com o décimo primeiro faria
              // ela achar que mandou o que não chegou. É a decisão do teto de
              // anexos do banco, que recusa em vez de cortar.
              const cabem = TETO_DE_ARQUIVOS - arquivos.length;
              if (escolhidos.length > cabem) {
                toast.error(
                  `São até ${TETO_DE_ARQUIVOS} arquivos por pedido. Entraram os ${cabem} primeiros.`,
                );
              }
              setArquivos((atual) => [...atual, ...escolhidos.slice(0, cabem)]);
              e.target.value = "";
            }}
          />

          <span className="text-muted-foreground text-xs">
            {arquivos.length} de {TETO_DE_ARQUIVOS}
          </span>
        </div>

        {arquivos.length > 0 ? (
          <ul className="space-y-1">
            {arquivos.map((a, i) => (
              <li
                key={`${a.name}-${i}`}
                className="bg-neutral-soft flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
              >
                <Paperclip
                  aria-hidden
                  className="text-muted-foreground size-4 shrink-0"
                />
                <span className="min-w-0 flex-1 truncate">{a.name}</span>
                <button
                  type="button"
                  aria-label={`Tirar ${a.name} da lista`}
                  className="text-muted-foreground hover:text-danger transition-colors"
                  onClick={() =>
                    setArquivos((atual) => atual.filter((_, j) => j !== i))
                  }
                >
                  <X aria-hidden className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-xs">
            Print, foto, a arte de referência — o que ajudar a gente a entender
            o que você quer.
          </p>
        )}
      </div>

      {/* A FRASE NOMEIA O QUE FALTA, e não diz "preencha os obrigatórios".
          É a decisão da recusa da 0023, que conta quantas faltam e diz QUAIS:
          dizer o nome é a diferença entre um aviso e uma instrução. */}
      {tentou && faltando.length > 0 ? (
        <p className="text-warning text-sm" role="status">
          Falta preencher: {faltando.join(", ")}.
        </p>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => router.back()}
          disabled={executando}
        >
          Cancelar
        </Button>
        <Button
          onClick={enviar}
          disabled={executando || titulo.trim().length < 3 || !clienteId}
        >
          Enviar pedido
        </Button>
      </div>

      <p className="text-muted-foreground text-xs">
        Depois de enviar você pode anexar mais arquivos e conversar com a gente
        na tela do pedido.
      </p>
    </div>
  );
}
