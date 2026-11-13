"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Download,
  ExternalLink,
  FolderOpen,
  FolderPlus,
  Link2,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { EnviarArquivos } from "@/components/shared/enviar-arquivos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { chamarAcao } from "@/lib/acoes/cliente";
import type { Resultado } from "@/lib/acoes/tipos";
import {
  arquivosQueSaemCom,
  ehLinkDeFora,
  type ArquivoDaMarca,
  type PastaComFilhas,
  type PastaDaMarca,
} from "@/lib/dominio/biblioteca-de-marca";
import { formatoDoArquivo, pesoLegivel } from "@/lib/dominio/arquivos";

import {
  anexarArquivoDaMarca,
  apagarArquivoDaMarca,
  apagarPastaDaMarca,
  criarPastaDaMarca,
  renomearArquivoDaMarca,
  renomearPastaDaMarca,
} from "@/app/(cliente)/portal/_actions/biblioteca";

/**
 * OS ARQUIVOS DA MARCA — a segunda seção da Biblioteca (migration 0139).
 *
 * ---------------------------------------------------------------------------
 * **Decisão do usuário:** *"a biblioteca do cliente, deve permitir acessar
 * logo, banners, e tudo mais que ele precisar"*, e *"quero que
 * desenvolvedores e sócios, possam mexer e criar pastas novas no portal do
 * cliente / dentro da biblioteca"*.
 *
 * **É UM COMPONENTE DE CLIENTE e não dois**, e a razão é o entrelaçamento: a
 * leitura e a edição ocupam a MESMA linha — o nome da pasta, e ao lado dele o
 * renomear, o apagar e o subir. Separados em servidor e cliente, cada pasta
 * precisaria passar um filho de servidor para dentro de um invólucro de
 * cliente, uma vez por pasta. O custo está pago pelo tamanho do dado: a
 * árvore inteira de uma conta são algumas dezenas de linhas, já lidas no
 * servidor e passadas como prop — a forma de `Referencias`.
 *
 * ---------------------------------------------------------------------------
 * **O CLIENTE SÓ LÊ, e `podeEditar` é a única coisa que troca.** Não há uma
 * segunda tela para a gestão: duas telas da mesma árvore divergiriam, e a que
 * divergiria é a do portal, que a equipe quase não abre. Quem recusa de
 * verdade são as policies da 0139 — esconder o botão nunca foi a proteção.
 * ---------------------------------------------------------------------------
 */
export function ArquivosDaMarca({
  clienteId,
  pastas,
  podeEditar,
}: {
  clienteId: string | null;
  pastas: PastaComFilhas[];
  podeEditar: boolean;
}) {
  if (pastas.length === 0) {
    return (
      <div className="space-y-4">
        {podeEditar && clienteId ? <NovaPasta clienteId={clienteId} /> : null}
        <EmptyState
          icon={FolderOpen}
          title="Nenhum arquivo da marca ainda"
          description={
            podeEditar
              ? "Crie uma pasta — Marca, Banners, Manual — e suba os arquivos que esta conta usa."
              : "Quando a Full guardar o logo, os banners e os outros arquivos da sua marca, eles aparecem aqui."
          }
          className="bg-card rounded-card shadow-cartao border-solid"
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {podeEditar && clienteId ? <NovaPasta clienteId={clienteId} /> : null}

      <ul className="space-y-4">
        {pastas.map((pasta) => (
          <Pasta
            key={pasta.id}
            pasta={pasta}
            clienteId={clienteId}
            podeEditar={podeEditar}
          />
        ))}
      </ul>
    </div>
  );
}

/* ========================================================================= */
/*  A PASTA DE TOPO                                                          */
/* ========================================================================= */

function Pasta({
  pasta,
  clienteId,
  podeEditar,
}: {
  pasta: PastaComFilhas;
  clienteId: string | null;
  podeEditar: boolean;
}) {
  const vaiSair = arquivosQueSaemCom(pasta);

  return (
    <li className="bg-surface-card rounded-card shadow-cartao border">
      <div className="flex flex-wrap items-center gap-2 border-b p-3.5">
        <FolderOpen aria-hidden className="text-text-muted size-4 shrink-0" />
        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold">
          {pasta.nome}
        </h3>
        {/* A CONTAGEM FICA NO CABEÇALHO, que é a regra do `GrupoDobravel`:
            quem recolhe continua dizendo quantos tem dentro. Aqui nada
            recolhe, e ela continua valendo — a pasta vazia precisa dizer que
            está vazia, senão ela se lê como uma pasta que não carregou. */}
        <span className="text-text-muted shrink-0 text-xs tabular-nums">
          {rotuloDaContagem(vaiSair)}
        </span>

        {podeEditar ? (
          <AcoesDaPasta pasta={pasta} clienteId={clienteId} vaiSair={vaiSair} />
        ) : null}
      </div>

      <div className="space-y-4 p-3.5">
        <Arquivos arquivos={pasta.arquivos} podeEditar={podeEditar} />

        {pasta.filhas.map((filha) => (
          <section key={filha.id} className="border-s-2 ps-3.5">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h4 className="min-w-0 flex-1 truncate text-xs font-semibold tracking-wide uppercase">
                {filha.nome}
              </h4>
              <span className="text-text-muted shrink-0 text-xs tabular-nums">
                {rotuloDaContagem(filha.arquivos.length)}
              </span>
              {podeEditar ? (
                <AcoesDaPasta
                  pasta={filha}
                  clienteId={clienteId}
                  vaiSair={filha.arquivos.length}
                  /* A SUBPASTA NÃO OFERECE "nova subpasta", e a ausência é a
                     trava da 0139 escrita na tela: `client_folders_dois_niveis`
                     recusa o neto, e um botão que leva à recusa é um botão que
                     ensina errado. */
                  semSubpasta
                />
              ) : null}
            </div>
            <Arquivos arquivos={filha.arquivos} podeEditar={podeEditar} />
          </section>
        ))}
      </div>
    </li>
  );
}

/**
 * "3 arquivos" / "1 arquivo" / "vazia".
 *
 * **A CONTAGEM DA PASTA DE TOPO INCLUI AS FILHAS, e foi a imagem que mandou:**
 * "Marca — 2 arquivos" em cima de uma pasta que mostrava quatro (dois soltos e
 * um em cada subpasta) é um número que quem lê não tem como reconciliar com o
 * que está logo abaixo. Com o total, os números FECHAM à vista — 2 soltos mais
 * 1 mais 1 são os 4 do cabeçalho.
 *
 * E ela é a mesma conta do diálogo de apagar, de propósito: o que sai com a
 * pasta é o que ela tem dentro.
 */
function rotuloDaContagem(n: number): string {
  if (n === 0) return "vazia";
  return n === 1 ? "1 arquivo" : `${n} arquivos`;
}

/* ========================================================================= */
/*  OS ARQUIVOS                                                              */
/* ========================================================================= */

function Arquivos({
  arquivos,
  podeEditar,
}: {
  arquivos: ArquivoDaMarca[];
  podeEditar: boolean;
}) {
  if (arquivos.length === 0) {
    return (
      <p className="text-text-muted text-xs italic">
        {podeEditar
          ? "Nada aqui. Suba um arquivo ou anexe um link."
          : "Nada aqui ainda."}
      </p>
    );
  }

  return (
    <ul className="divide-y">
      {arquivos.map((arquivo) => (
        <Arquivo key={arquivo.id} arquivo={arquivo} podeEditar={podeEditar} />
      ))}
    </ul>
  );
}

function Arquivo({
  arquivo,
  podeEditar,
}: {
  arquivo: ArquivoDaMarca;
  podeEditar: boolean;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(arquivo.nome);
  const [descricao, setDescricao] = useState(arquivo.descricao ?? "");
  const deFora = ehLinkDeFora(arquivo.url);
  const formato =
    formatoDoArquivo(arquivo.nome) ?? formatoDoArquivo(arquivo.url);

  async function chamar(acao: () => Promise<Resultado>, depois?: () => void) {
    const resultado = await chamarAcao(acao);
    if (!resultado.ok) {
      toast.error(resultado.error);
      return;
    }
    toast.success(resultado.mensagem);
    depois?.();
    router.refresh();
  }

  /**
   * RENOMEAR O ARQUIVO E DESCREVÊ-LO SÃO O MESMO FORMULÁRIO, e não dois.
   *
   * **O nome que sobe é o nome do arquivo no computador de quem subiu** —
   * `logo_final_v3_OK.svg` —, e é ele que o cliente lê na biblioteca dele. A
   * descrição é a outra metade: *"versão principal, fundo claro"* responde o que
   * o nome não responde, e é o único jeito de duas versões do mesmo logo se
   * distinguirem.
   *
   * **`url` não está aqui**, de propósito: trocar o endereço por baixo de um
   * arquivo que o cliente já baixou é trocar o material sem deixar rastro — a
   * decisão de `post_referencias`, que não tem policy de UPDATE. Trocou o
   * arquivo, anexa outro e apaga este.
   */
  if (podeEditar && editando) {
    return (
      <li className="py-2">
        <form
          onSubmit={(evento) => {
            evento.preventDefault();
            void chamar(
              () =>
                renomearArquivoDaMarca({
                  id: arquivo.id,
                  nome,
                  descricao,
                }),
              () => setEditando(false),
            );
          }}
          className="flex flex-wrap items-center gap-2"
        >
          <Input
            value={nome}
            onChange={(evento) => setNome(evento.target.value)}
            aria-label={`Novo nome de ${arquivo.nome}`}
            autoFocus
            className="min-w-40 flex-1"
          />
          <Input
            value={descricao}
            onChange={(evento) => setDescricao(evento.target.value)}
            placeholder="O que é este arquivo (opcional)"
            aria-label={`Descrição de ${arquivo.nome}`}
            className="min-w-40 flex-[2]"
          />
          <Button type="submit" size="sm" disabled={!nome.trim()}>
            Salvar
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              /* CANCELAR DEVOLVE O QUE ESTÁ GRAVADO, nunca o digitado. */
              setNome(arquivo.nome);
              setDescricao(arquivo.descricao ?? "");
              setEditando(false);
            }}
          >
            Cancelar
          </Button>
        </form>
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center gap-x-2 gap-y-1.5 py-2">
      {/* O NOME OCUPA A LINHA INTEIRA NO CELULAR, e foi a imagem de 375px que
          mandou: com tudo na mesma linha, o peso e o botão são `shrink-0` e o
          NOME é o único que cede largura — `mundo-verde-logo....`. É a lição
          que esta casa já pagou três vezes, e está escrita no CLAUDE.md: **o
          título é a única coisa que a linha existe para dizer, e é a última
          que pode encolher.**

          `basis-full` abaixo de `sm` empurra o peso e o botão para a linha de
          baixo; de `sm` para cima a linha volta a ser uma só. O `truncate`
          fica, porque um nome de arquivo não tem teto. */}
      <div className="min-w-0 flex-1 basis-full sm:basis-0">
        <p className="truncate text-sm font-medium">{arquivo.nome}</p>
        {arquivo.descricao ? (
          <p className="text-text-muted text-xs">{arquivo.descricao}</p>
        ) : null}
      </div>

      {/* O PESO, O BOTÃO E AS AÇÕES ANDAM JUNTOS, num bloco só: na segunda
          linha do celular eles encostam na direita de uma vez, em vez de
          cada um procurar a borda por conta própria. */}
      <div className="ms-auto flex shrink-0 items-center gap-2">
        {/* O PESO SÓ APARECE QUANDO HÁ UM: o link de fora não tem tamanho que o
          produto possa afirmar, e um "—" ali afirmaria que existe um número
          que ninguém mediu. */}
        {arquivo.tamanho ? (
          <span className="text-text-muted shrink-0 text-xs tabular-nums">
            {pesoLegivel(arquivo.tamanho)}
          </span>
        ) : null}

        {/* BAIXAR OU ABRIR, e quem decide é a própria string — `ehLinkDeFora()`.
          Um `download` num endereço de outro domínio é ignorado pelo
          navegador: o clique navega e o rótulo mentiria sobre o que acabou de
          acontecer, que é a lição da 0115. */}
        {arquivo.href ? (
          deFora ? (
            <a
              href={arquivo.href}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:bg-accent inline-flex min-h-9 shrink-0 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors"
            >
              <ExternalLink aria-hidden className="size-4" />
              Abrir
              <span className="text-text-muted text-[11px]">abre fora</span>
            </a>
          ) : (
            <a
              href={arquivo.href}
              download={arquivo.nome}
              className="hover:bg-accent inline-flex min-h-9 shrink-0 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors"
            >
              <Download aria-hidden className="size-4" />
              Baixar
              {formato ? (
                <span className="text-text-muted text-[11px] font-semibold">
                  {formato}
                </span>
              ) : null}
            </a>
          )
        ) : (
          /* SEM ENDEREÇO É A ASSINATURA QUE FALHOU, e a frase diz isso em vez de
           um botão que não leva a lugar nenhum — a decisão de
           `ImagemAssinada`, que distingue "não carregou" de "não existe". */
          <p className="text-text-muted shrink-0 text-xs italic">
            Não foi possível abrir agora.
          </p>
        )}

        {podeEditar ? (
          <>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Renomear ${arquivo.nome}`}
              onClick={() => setEditando(true)}
            >
              <Pencil aria-hidden />
            </Button>

            <ConfirmDialog
              trigger={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Apagar ${arquivo.nome}`}
                >
                  <Trash2 aria-hidden />
                </Button>
              }
              title={`Apagar "${arquivo.nome}"?`}
              description="O cliente deixa de ver este arquivo na biblioteca dele."
              confirmLabel="Apagar"
              destructive
              onConfirm={() =>
                chamar(() => apagarArquivoDaMarca({ id: arquivo.id }))
              }
            />
          </>
        ) : null}
      </div>
    </li>
  );
}

/* ========================================================================= */
/*  A GESTÃO                                                                 */
/* ========================================================================= */

function NovaPasta({ clienteId }: { clienteId: string }) {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [salvando, iniciar] = useTransition();

  function criar() {
    if (!nome.trim()) return;
    iniciar(async () => {
      const resultado = await chamarAcao(() =>
        criarPastaDaMarca({ client_id: clienteId, nome }),
      );
      if (!resultado.ok) {
        toast.error(resultado.error);
        return;
      }
      toast.success(resultado.mensagem);
      setNome("");
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={(evento) => {
        evento.preventDefault();
        criar();
      }}
      className="bg-surface-card rounded-card shadow-cartao flex flex-wrap items-center gap-2 border p-3"
    >
      <FolderPlus aria-hidden className="text-text-muted size-4 shrink-0" />
      <Input
        value={nome}
        onChange={(evento) => setNome(evento.target.value)}
        placeholder="Nome da pasta — Marca, Banners, Manual…"
        aria-label="Nome da pasta nova"
        className="min-w-48 flex-1"
      />
      <Button type="submit" disabled={salvando || !nome.trim()}>
        Criar pasta
      </Button>
    </form>
  );
}

function AcoesDaPasta({
  pasta,
  clienteId,
  vaiSair,
  semSubpasta = false,
}: {
  pasta: PastaDaMarca;
  clienteId: string | null;
  vaiSair: number;
  semSubpasta?: boolean;
}) {
  const router = useRouter();
  const [renomeando, setRenomeando] = useState(false);
  const [nome, setNome] = useState(pasta.nome);
  const [criandoFilha, setCriandoFilha] = useState(false);
  const [nomeDaFilha, setNomeDaFilha] = useState("");

  /**
   * CHAMAR, MOSTRAR, REFAZER — e `async` em vez de `useTransition`.
   *
   * O `ConfirmDialog` fecha quando o `onConfirm` dele RESOLVE, então uma ação
   * disparada dentro de uma transição resolveria na hora e o diálogo fecharia
   * antes da resposta — com a recusa aparecendo sobre uma tela que já voltou.
   */
  async function chamar(
    acao: () => Promise<Resultado>,
    depois?: () => void,
  ): Promise<void> {
    const resultado = await chamarAcao(acao);
    if (!resultado.ok) {
      toast.error(resultado.error);
      return;
    }
    toast.success(resultado.mensagem);
    depois?.();
    router.refresh();
  }

  return (
    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
      {renomeando ? (
        <form
          onSubmit={(evento) => {
            evento.preventDefault();
            void chamar(
              () => renomearPastaDaMarca({ id: pasta.id, nome }),
              () => setRenomeando(false),
            );
          }}
          className="flex flex-1 items-center gap-2"
        >
          <Input
            value={nome}
            onChange={(evento) => setNome(evento.target.value)}
            aria-label={`Novo nome da pasta ${pasta.nome}`}
            autoFocus
            className="min-w-40 flex-1"
          />
          <Button type="submit" size="sm">
            Salvar
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              /* CANCELAR DEVOLVE O NOME GRAVADO e nunca o digitado: sem isto,
                 reabrir o campo traria de volta o rascunho que a pessoa
                 acabou de descartar — a decisão da observação da entrega. */
              setNome(pasta.nome);
              setRenomeando(false);
            }}
          >
            Cancelar
          </Button>
        </form>
      ) : (
        <>
          {/* OS ARQUIVOS SOBEM PARA ESTA PASTA, e o caminho tem a CONTA na
              primeira posição: é por ela que a policy do bucket pergunta de
              quem é o arquivo. Sem o `clienteId` o uploader não aparece — e
              ele falta só na visualização de um slug que não existe. */}
          {clienteId ? (
            <EnviarArquivos
              bucket="biblioteca-arquivos"
              familias={["imagem", "documento", "criacao", "video", "outro"]}
              varios
              rotulo="Subir"
              variante="outline"
              rotuloDoCampo={`Escolher arquivos para a pasta ${pasta.nome}`}
              caminho={(arquivo, i) =>
                `${clienteId}/${pasta.id}/${Date.now()}-${i}-${arquivo.name}`
              }
              onPronto={async (subidos) => {
                for (const arquivo of subidos) {
                  const resultado = await chamarAcao(() =>
                    anexarArquivoDaMarca({
                      folder_id: pasta.id,
                      nome: arquivo.nome,
                      url: arquivo.url,
                      tamanho: arquivo.tamanho,
                    }),
                  );
                  if (!resultado.ok) {
                    toast.error(resultado.error);
                    return;
                  }
                }
                toast.success(
                  subidos.length === 1
                    ? "Arquivo anexado."
                    : `${subidos.length} arquivos anexados.`,
                );
                router.refresh();
              }}
            />
          ) : null}

          <AnexarLink pastaId={pasta.id} />

          <Button
            variant="ghost"
            size="icon"
            aria-label={`Renomear a pasta ${pasta.nome}`}
            onClick={() => setRenomeando(true)}
          >
            <Pencil aria-hidden />
          </Button>

          {!semSubpasta && clienteId ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Criar subpasta em ${pasta.nome}`}
              onClick={() => setCriandoFilha((antes) => !antes)}
            >
              <FolderPlus aria-hidden />
            </Button>
          ) : null}

          <ConfirmDialog
            trigger={
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Apagar a pasta ${pasta.nome}`}
              >
                <Trash2 aria-hidden />
              </Button>
            }
            title={`Apagar a pasta "${pasta.nome}"?`}
            /* O DIÁLOGO CONTA EM VEZ DE PERGUNTAR "tem certeza?", que é a
               decisão do diálogo de apagar campanha: a contagem é a única
               coisa que faz alguém parar. */
            description={
              vaiSair === 0
                ? "A pasta está vazia."
                : `${vaiSair} ${vaiSair === 1 ? "arquivo sai" : "arquivos saem"} com ela, e as subpastas também. Isto não se desfaz.`
            }
            confirmLabel="Apagar a pasta"
            destructive
            onConfirm={() => chamar(() => apagarPastaDaMarca({ id: pasta.id }))}
          />
        </>
      )}

      {criandoFilha && clienteId ? (
        <form
          onSubmit={(evento) => {
            evento.preventDefault();
            void chamar(
              () =>
                criarPastaDaMarca({
                  client_id: clienteId,
                  nome: nomeDaFilha,
                  pasta_pai_id: pasta.id,
                }),
              () => {
                setNomeDaFilha("");
                setCriandoFilha(false);
              },
            );
          }}
          className="flex w-full items-center gap-2"
        >
          <Input
            value={nomeDaFilha}
            onChange={(evento) => setNomeDaFilha(evento.target.value)}
            placeholder={`Subpasta de ${pasta.nome}`}
            aria-label={`Nome da subpasta de ${pasta.nome}`}
            autoFocus
            className="min-w-40 flex-1"
          />
          <Button type="submit" size="sm" disabled={!nomeDaFilha.trim()}>
            Criar
          </Button>
        </form>
      ) : null}
    </div>
  );
}

/**
 * O LINK DE FORA, no mesmo lugar do upload.
 *
 * **É um campo da tela e nunca um `window.prompt`**, que é a regra escrita do
 * produto: o prompt não dá para colar no teclado do celular, não valida nada,
 * some ao clicar fora, e em alguns navegadores não abre — o botão vira um
 * botão que não faz nada.
 */
function AnexarLink({ pastaId }: { pastaId: string }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [url, setUrl] = useState("");
  const [, iniciar] = useTransition();

  if (!aberto) {
    return (
      <Button variant="outline" size="sm" onClick={() => setAberto(true)}>
        <Link2 aria-hidden />
        Link
      </Button>
    );
  }

  return (
    <form
      onSubmit={(evento) => {
        evento.preventDefault();
        iniciar(async () => {
          const resultado = await chamarAcao(() =>
            anexarArquivoDaMarca({ folder_id: pastaId, nome, url }),
          );
          if (!resultado.ok) {
            toast.error(resultado.error);
            return;
          }
          toast.success(resultado.mensagem);
          setNome("");
          setUrl("");
          setAberto(false);
          router.refresh();
        });
      }}
      className="flex w-full flex-wrap items-center gap-2"
    >
      <Input
        value={nome}
        onChange={(evento) => setNome(evento.target.value)}
        placeholder="Como se chama"
        aria-label="Nome do link"
        className="min-w-32 flex-1"
      />
      <Input
        value={url}
        onChange={(evento) => setUrl(evento.target.value)}
        placeholder="https://…"
        aria-label="Endereço do link"
        className="min-w-40 flex-[2]"
      />
      <Button type="submit" size="sm" disabled={!nome.trim() || !url.trim()}>
        Anexar
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setAberto(false)}
      >
        Cancelar
      </Button>
    </form>
  );
}
