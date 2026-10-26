"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Link2, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import type { JSONContent } from "@tiptap/react";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EditorRico } from "@/components/shared/editor-rico";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { chamarAcao } from "@/lib/acoes/cliente";
import {
  BUCKET_DO_ACERVO,
  ROTULOS_DE_AULA,
  TIPOS_DE_AULA,
  ehEnderecoDeFora,
  servicoDoLink,
} from "@/lib/dominio/academy";
import {
  EXTENSOES_DO_FORMATO,
  ROTULOS_DO_FORMATO,
  formatoPeloNome,
} from "@/lib/dominio/ebook-interativo";
import { FUNCOES, rotuloDaFuncao } from "@/lib/dominio/equipe";
import type { ItemAberto } from "@/lib/dados/academy";
import type { AcademyAulaTipo } from "@/lib/supabase/database.types";

import { criarClienteNavegador } from "@/lib/supabase/client";

import {
  anexarArquivo,
  excluirAula,
  excluirItem,
  publicarItem,
  publicarVersao,
  salvarAula,
  salvarItem,
  salvarModulo,
  tirarObrigatoriedade,
  tornarObrigatorio,
} from "../acoes";

/**
 * O QUE A GESTÃO FAZ COM UM ITEM, no fim da página dele.
 *
 * **NO FIM E NÃO NO TOPO**, que é a decisão do detalhe da Task palavra por
 * palavra: *excluir não é propriedade, é ação sobre a demanda — vai para o fim
 * da página, que é onde se procura o que encerra alguma coisa*. Quem abre um
 * playbook quase sempre abre para LER; montar é o caso raro, e ele não pode
 * dividir a primeira dobra com o conteúdo.
 *
 * **E ELE SÓ É DESENHADO PARA A GESTÃO.** Não porque esconder seja a proteção
 * — quem recusa é a policy de escrita de cada tabela —, mas porque oferecer a
 * quem vai ser recusado é ensinar a clicar e levar erro.
 */
export function MontarOItem({ aberto }: { aberto: ItemAberto }) {
  const { item, playbook, arquivo, curso } = aberto;

  return (
    <section className="space-y-4 border-t pt-6">
      <h3 className="text-text-primary text-sm font-semibold">
        Montar este item
      </h3>

      <Propriedades item={item} />
      {playbook ? (
        <NovaVersao
          itemId={item.id}
          proxima={(playbook.versaoCorrente?.numero_versao ?? 0) + 1}
        />
      ) : null}
      <ArquivoDoItem tipo={item.tipo} itemId={item.id} atual={arquivo} />
      {curso ? <MontarCurso itemId={item.id} curso={curso} /> : null}
      <Obrigatoriedade itemId={item.id} />
      <Publicacao item={item} />
    </section>
  );
}

function Propriedades({ item }: { item: ItemAberto["item"] }) {
  const router = useRouter();
  const [enviando, começar] = useTransition();
  const [titulo, setTitulo] = useState(item.titulo);
  const [resumo, setResumo] = useState(item.resumo ?? "");
  const [categoria, setCategoria] = useState(item.categoria ?? "");
  const [tags, setTags] = useState(item.tags.join(", "));

  function salvar() {
    começar(async () => {
      const r = await chamarAcao(() =>
        salvarItem(item.id, {
          tipo: item.tipo,
          titulo,
          resumo: resumo || null,
          categoria: categoria || null,
          tags: tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        }),
      );
      if (!r.ok) toast.error(r.error);
      else {
        toast.success(r.mensagem);
        router.refresh();
      }
    });
  }

  return (
    <div className="bg-card rounded-card shadow-cartao space-y-3 border p-4">
      <h4 className="text-text-primary text-sm font-medium">
        Título e organização
      </h4>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="m-titulo">Título</Label>
          <Input
            id="m-titulo"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="m-resumo">Resumo</Label>
          <Textarea
            id="m-resumo"
            rows={2}
            value={resumo}
            onChange={(e) => setResumo(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="m-categoria">Categoria</Label>
          <Input
            id="m-categoria"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="m-tags">Etiquetas</Label>
          <Input
            id="m-tags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
          />
        </div>
      </div>

      <Button size="sm" onClick={salvar} disabled={enviando}>
        Salvar
      </Button>

      {/* O ENDEREÇO NÃO MUDA COM O TÍTULO, e a tela diz: um link colado numa
          conversa continua abrindo depois de alguém renomear o playbook. */}
      <p className="text-text-muted text-xs">
        O endereço continua <code>/painel/academy/{item.slug}</code> mesmo
        trocando o título — é ele que sobrevive num link que alguém já colou.
      </p>
    </div>
  );
}

/**
 * A publicação de uma versão nova do playbook.
 *
 * **A CAIXA DE RELEITURA É A DECISÃO QUE MAIS PESA DESTA TELA**, e por isso o
 * padrão é desmarcada: marcar devolve a pendência a todo mundo que já leu, e
 * um padrão ligado faria toda vírgula trocada virar um aviso — na terceira vez
 * ninguém mais leria nenhum.
 *
 * **AS NOTAS DO QUE MUDOU VÊM ANTES DO BOTÃO**, e não depois: escritas depois,
 * elas descreveriam uma versão já gravada. É a decisão da justificativa da
 * versão de campanha.
 */
function NovaVersao({ itemId, proxima }: { itemId: string; proxima: number }) {
  const router = useRouter();
  const [enviando, começar] = useTransition();
  const [conteudo, setConteudo] = useState<{
    json: JSONContent;
    texto: string;
  } | null>(null);
  const [notas, setNotas] = useState("");
  const [releitura, setReleitura] = useState(false);

  function publicar() {
    if (!conteudo) {
      toast.error("Escreva o conteúdo antes de publicar.");
      return;
    }
    começar(async () => {
      const r = await chamarAcao(() =>
        publicarVersao({
          item_id: itemId,
          conteudo_rico: conteudo.json,
          conteudo_texto: conteudo.texto,
          notas_mudanca: notas || null,
          exige_releitura: releitura,
        }),
      );
      if (!r.ok) toast.error(r.error);
      else {
        toast.success(r.mensagem);
        setConteudo(null);
        setNotas("");
        setReleitura(false);
        router.refresh();
      }
    });
  }

  return (
    <div className="bg-card rounded-card shadow-cartao space-y-3 border p-4">
      <h4 className="text-text-primary text-sm font-medium">
        Publicar a versão {proxima}
      </h4>

      <div className="rounded-lg border">
        <EditorRico
          conteudo={null}
          onChange={setConteudo}
          placeholder="O jeito Full de fazer isto…"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="v-notas">O que mudou</Label>
        <Textarea
          id="v-notas"
          rows={2}
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Quem já leu a versão anterior lê isto antes de reler."
        />
      </div>

      <label className="flex items-start gap-2.5">
        <Switch
          checked={releitura}
          onCheckedChange={setReleitura}
          aria-label="Exigir que quem já leu leia de novo"
        />
        <span className="text-sm">
          <span className="text-text-primary font-medium">
            Exigir releitura
          </span>
          <span className="text-text-muted block text-xs">
            Devolve a pendência a todo mundo que já tinha confirmado. Deixe
            desmarcado para correção de texto — senão o aviso vira ruído e
            ninguém mais o lê.
          </span>
        </span>
      </label>

      <Button size="sm" onClick={publicar} disabled={enviando}>
        Publicar versão {proxima}
      </Button>
    </div>
  );
}

/**
 * O ARQUIVO DO ITEM, nos TRÊS formatos.
 *
 * ---------------------------------------------------------------------------
 * **ELE ERA SÓ DO E-BOOK, e isso é a segunda metade do mesmo furo.** Decisão
 * do usuário: *"na parte do Acervo, não está dando para incluir anexos na
 * biblioteca nos itens de Playbook e Cursos, faça igual está no item de
 * Ebook"*. O condicional era `item.tipo === "ebook"`, e `academy_arquivos`
 * nunca soube o formato do item — ela é `(item_id, versao)` desde a 0096.
 *
 * **O QUE MUDA ENTRE OS TRÊS NÃO É O UPLOADER, É O QUE O ARQUIVO É.** No
 * e-book ele É o conteúdo: sem arquivo não há o que entregar, e quem abre vê
 * o título e nada mais. No playbook e no curso ele é ANEXO — material de
 * apoio ao lado do que se lê ou se assiste —, e é por isso que ele não
 * carrega nem a conclusão nem a releitura:
 *
 * - **a conclusão** de um playbook é a VERSÃO confirmada, e a de um curso são
 *   as aulas vistas. Uma segunda porta de "marcar como lido" no anexo faria o
 *   item fechar sem ninguém ter lido a versão — e `estadoDoPlaybook()` e
 *   `estadoDoCurso()` continuariam dizendo o contrário, na mesma tela;
 * - **a releitura** de um playbook já mora em `academy_playbook_versoes.
 *   exige_releitura`. Repeti-la aqui seriam duas verdades sobre o mesmo
 *   fato, e a que divergiria é a do anexo, porque ninguém a relê ao publicar
 *   uma versão de texto. No curso não há quem cobrar: ninguém confirma
 *   leitura de um curso, confirma aula.
 *
 * **E `html_interativo` É DO E-BOOK E DE MAIS NENHUM.** Aquele visualizador
 * registra progresso por capítulo e guarda checklist por `(item, versão)`;
 * ligado num curso, ele seria uma segunda contagem de progresso dentro do
 * mesmo item — a conta dobrada que este produto recusa em toda soma. Por isso
 * o anexo de playbook e de curso nasce sempre `pdf`, que neste enum quer
 * dizer *"arquivo para baixar"* e não a extensão: renomear o valor seria
 * migration em coluna em uso sem nada em troca, que é a decisão de `prazo` e
 * de `dias_uteis`.
 * ---------------------------------------------------------------------------
 *
 * O QUE SEGUE É A HISTÓRIA DO RAMO DO E-BOOK, e ela fica porque o furo foi o
 * mesmo duas vezes:
 *
 * ---------------------------------------------------------------------------
 * Relato do usuário: *"quando eu seleciono que vou montar um e-book, ele não
 * me dá nem sequer o espaço para enviar um PDF"*. Ele estava certo, e o furo
 * era meu: esta seção tinha ramo para o playbook e ramo para o curso, e
 * NENHUM para o e-book — escolher o formato levava a uma tela de montar sem
 * nada do formato escolhido.
 *
 * **TODO O RESTO JÁ EXISTIA desde a 0096**: a tabela `academy_arquivos`, as
 * duas policies dela, o bucket privado, a leitura em `abrirItem()` e o cartão
 * de download no detalhe. É a ponte construída e nunca atravessada pela
 * enésima vez — e ela passou porque `82e-academy-montar` fotografa a
 * montagem de um PLAYBOOK, que é o único dos três formatos cujo editor
 * existia. A tela do e-book não saía em imagem nenhuma.
 * ---------------------------------------------------------------------------
 *
 * **O CONDICIONAL É `item.tipo`, e não `arquivo`.** É a diferença entre
 * consertar e não consertar: `arquivo` é nulo justamente no e-book que ainda
 * não tem PDF, que é o único estado em que esta seção precisa aparecer. Pelo
 * dado, ela só apareceria para quem já tinha subido um — e quem já subiu é
 * quem não precisa dela.
 *
 * **O NAVEGADOR FALA COM O STORAGE DIRETO, e não a action.** Um PDF de quatro
 * megabytes atravessando uma Server Action é o arquivo inteiro no corpo de uma
 * requisição; o caminho é a forma da nota fiscal e da foto do comodato — sobe
 * o arquivo, e a action grava a LINHA que aponta para ele.
 *
 * **E SUBIR OUTRO SUBSTITUI, sem apagar nada.** `abrirItem()` lê o mais
 * recente desde a 0096, então a linha nova é o que o e-book mostra e a antiga
 * fica no histórico — a regra das versões de post e de campanha. Por isso não
 * há botão de remover: o caminho é subir de novo.
 */
function ArquivoDoItem({
  tipo,
  itemId,
  atual,
}: {
  tipo: ItemAberto["item"]["tipo"];
  itemId: string;
  atual: ItemAberto["arquivo"];
}) {
  const ehEbook = tipo === "ebook";
  const router = useRouter();
  const [enviando, começar] = useTransition();
  const [subindo, setSubindo] = useState(false);
  const [modo, setModo] = useState<"arquivo" | "link">("arquivo");
  const [escolhido, setEscolhido] = useState<{
    caminho: string;
    nome: string;
    bytes: number;
  } | null>(null);
  const [link, setLink] = useState("");
  const [nomeDoLink, setNomeDoLink] = useState("");
  const [paginas, setPaginas] = useState("");
  const [notas, setNotas] = useState("");
  const [releitura, setReleitura] = useState(false);
  const campo = useRef<HTMLInputElement>(null);

  // O FORMATO SAI DO NOME DO ARQUIVO ESCOLHIDO, e não de um seletor que a
  // pessoa preenche antes: ela já disse qual é o arquivo, e perguntar de novo
  // é pedir que ela repita o que o `.html` do nome já diz. Enquanto nada foi
  // escolhido, o campo aceita os dois — senão o seletor de arquivos esconderia
  // metade do que ele deve oferecer.
  // NO ANEXO O FORMATO NÃO SE ESCOLHE, e é a linha que impede um `.html`
  // anexado a um curso de virar o visualizador interativo dentro dele.
  // NO MODO LINK ELE É O MODO, e não o nome: um `.../edit#gid=0` não tem
  // extensão para adivinhar, e quem escolheu "Usar um link" já respondeu.
  const formato =
    modo === "link"
      ? "link"
      : !ehEbook
        ? "pdf"
        : escolhido
          ? formatoPeloNome(escolhido.nome)
          : null;
  const proxima = (atual?.versao ?? 0) + 1;

  // O LINK SÓ VALE INTEIRO: endereço de fora E nome. O nome não vem de lugar
  // nenhum — num arquivo ele é o nome do arquivo, aqui é a única coisa que a
  // pessoa que abrir vai ler antes de clicar.
  const servico = ehEnderecoDeFora(link) ? servicoDoLink(link) : null;
  const linkPronto = ehEnderecoDeFora(link) && nomeDoLink.trim().length > 0;
  const prontoParaSalvar = modo === "link" ? linkPronto : Boolean(escolhido);

  async function subir(arquivo: File | undefined) {
    if (!arquivo) return;
    setSubindo(true);
    try {
      const supabase = criarClienteNavegador();
      const extensao = arquivo.name.split(".").pop()?.toLowerCase() ?? "pdf";
      // A PASTA É A DO ITEM, e o nome carrega o instante: dois PDFs do mesmo
      // e-book são duas linhas no histórico, e com o nome fixo o segundo
      // sobrescreveria o arquivo que a primeira linha aponta.
      // A PASTA CARREGA A VERSÃO, e o nome o instante: `ebooks/{item}/v3/…`
      // é o que o sprint pede e é o que torna o bucket legível por quem abre
      // o painel do Supabase para conferir qual arquivo está no ar.
      // A PASTA DIZ DE QUE FORMATO É O ITEM, e não `ebooks/` para os três:
      // o bucket é lido por quem abre o painel do Supabase para conferir qual
      // arquivo está no ar, e um anexo de curso dentro de `ebooks/` manda essa
      // pessoa procurar um e-book que não existe. Os que já estão lá ficam
      // onde estão — o caminho é o que a linha aponta.
      const pasta =
        tipo === "ebook"
          ? "ebooks"
          : tipo === "playbook"
            ? "playbooks"
            : "cursos";
      const caminho = `${pasta}/${itemId}/v${proxima}/${Date.now()}.${extensao}`;

      const { error } = await supabase.storage
        .from(BUCKET_DO_ACERVO)
        .upload(caminho, arquivo, { contentType: arquivo.type });

      if (error) {
        toast.error(`Não foi possível anexar: ${error.message}`);
        return;
      }
      setEscolhido({ caminho, nome: arquivo.name, bytes: arquivo.size });
    } finally {
      setSubindo(false);
    }
  }

  function salvar() {
    if (modo === "link" && !linkPronto) {
      toast.error(
        ehEnderecoDeFora(link)
          ? "Dê um nome ao material antes de salvar."
          : "Cole o endereço começando com https:// antes de salvar.",
      );
      return;
    }
    if (modo === "arquivo" && !escolhido) {
      toast.error("Escolha o arquivo antes de salvar.");
      return;
    }
    const conteudo =
      modo === "link"
        ? {
            url: link.trim(),
            nome: nomeDoLink.trim(),
            tamanho_bytes: null,
            paginas: null,
            formato: "link" as const,
          }
        : {
            url: escolhido!.caminho,
            nome: escolhido!.nome,
            tamanho_bytes: escolhido!.bytes,
            paginas: paginas ? Number(paginas) : null,
            formato: ehEbook
              ? formatoPeloNome(escolhido!.nome)
              : ("pdf" as const),
          };

    começar(async () => {
      const r = await chamarAcao(() =>
        anexarArquivo({
          item_id: itemId,
          ...conteudo,
          versao: proxima,
          notas_mudanca: ehEbook ? notas || null : null,
          exige_releitura: ehEbook ? releitura : false,
        }),
      );
      if (!r.ok) toast.error(r.error);
      else {
        toast.success(r.mensagem);
        setEscolhido(null);
        setLink("");
        setNomeDoLink("");
        setPaginas("");
        setNotas("");
        setReleitura(false);
        router.refresh();
      }
    });
  }

  return (
    <div className="bg-card rounded-card shadow-cartao space-y-3 border p-4">
      <h4 className="text-text-primary text-sm font-medium">
        {ehEbook
          ? atual
            ? `Publicar a versão ${proxima}`
            : "Anexar o conteúdo"
          : atual
            ? `Trocar o anexo (versão ${proxima})`
            : "Anexar um material"}
      </h4>

      {/* O QUE JÁ ESTÁ NO AR VEM PRIMEIRO, e não como aviso: quem abre esta
          seção num e-book que já tem PDF está trocando um arquivo, e precisa
          saber qual. Sem a linha, "Trocar o arquivo" não diz trocar o quê.
          E O FORMATO APARECE SEMPRE QUE É LINK, mesmo num playbook: ali ele
          deixa de ser "PDF ou e-Pub" ao lado de um anexo — que é o rótulo
          repetido — e passa a dizer que o material mora fora. */}
      {atual ? (
        <p className="text-text-secondary text-xs">
          Hoje {ehEbook ? "este item entrega" : "o anexo é"}{" "}
          <span className="font-medium">{atual.nome}</span> (versão{" "}
          {atual.versao}
          {ehEbook || atual.formato === "link"
            ? `, ${ROTULOS_DO_FORMATO[atual.formato]}`
            : ""}
          ). {modo === "link" ? "Salvar o link" : "Subir outro"} passa a
          entregar o novo — o anterior continua no histórico.
        </p>
      ) : ehEbook ? (
        <p className="text-text-secondary text-xs">
          Um e-book sem conteúdo não tem o que entregar: a tela de quem abrir
          mostra o título e nada mais. Pode ser um arquivo (PDF, e-Pub ou página
          interativa) ou um link — um Google Doc, Slides ou planilha do Drive.
        </p>
      ) : (
        <p className="text-text-secondary text-xs">
          Material de apoio para quem abrir este{" "}
          {tipo === "playbook" ? "playbook" : "curso"} — a apostila, o modelo, a
          planilha, ou o link dela no Drive. Ele não conta como leitura:{" "}
          {tipo === "playbook"
            ? "quem confirma é a versão do texto."
            : "quem conta são as aulas."}
        </p>
      )}

      {/* ERA UM CAMPO DE ARQUIVO E SÃO DUAS PORTAS, e o seletor vem antes de
          qualquer campo porque é ele que decide quais campos existem.
          É `radiogroup` e não dois botões soltos: duas escolhas mutuamente
          exclusivas sem o papel são dois botões que o leitor de tela anuncia
          sem dizer que um desliga o outro — e o axe cobra `aria-checked` num
          `role="radio"`, que é o que mantém o par honesto. */}
      <div
        role="radiogroup"
        aria-label="Como anexar o material"
        className="bg-card inline-flex gap-1 rounded-lg border p-1"
      >
        {(["arquivo", "link"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={modo === m}
            disabled={subindo || enviando}
            onClick={() => setModo(m)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              modo === m
                ? "bg-action-soft text-action-text"
                : "text-text-secondary hover:bg-neutral-soft"
            }`}
          >
            {m === "arquivo" ? (
              <Upload aria-hidden className="size-3.5" />
            ) : (
              <Link2 aria-hidden className="size-3.5" />
            )}
            {m === "arquivo" ? "Subir um arquivo" : "Usar um link"}
          </button>
        ))}
      </div>

      {modo === "arquivo" ? (
        <>
          {/* O `<input type="file">` É `sr-only` E O BOTÃO O ACIONA, que é a
              forma do produto inteiro — e ele continua na árvore de
              acessibilidade com `aria-label` próprio, porque escondido não é
              ausente: sem o rótulo ele é anunciado como "editar" e mais nada.
              Foi o achado do axe. */}
          {/* SEM `accept` NO ANEXO, de propósito: um apoio de playbook é um PDF,
              um modelo de planilha ou um .zip de exemplos, e uma lista fechada
              aqui recusaria o caso comum sem dizer por quê. No e-book ela fica,
              porque lá o formato DECIDE qual tela o item vira. */}
          <input
            ref={campo}
            type="file"
            accept={
              ehEbook
                ? `${EXTENSOES_DO_FORMATO.pdf},${EXTENSOES_DO_FORMATO.html_interativo}`
                : undefined
            }
            aria-label={
              ehEbook ? "Arquivo do e-book" : "Arquivo anexado ao item"
            }
            className="sr-only"
            onChange={(e) => void subir(e.target.files?.[0])}
          />

          <div className="flex flex-wrap items-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={subindo || enviando}
              onClick={() => campo.current?.click()}
            >
              <Upload aria-hidden className="size-4" />
              {subindo
                ? "Enviando…"
                : escolhido
                  ? "Escolher outro"
                  : "Escolher o arquivo"}
            </Button>

            {/* PÁGINAS É DIGITADO, e não lido do arquivo: contar as páginas de
                um PDF exigiria um leitor de PDF no navegador para um número que
                a tela usa numa linha só. Em branco ela diz "PDF", que é verdade
                — e um número inventado é pior que campo vazio, a decisão do
                tempo real da etapa.
                ELE NÃO EXISTE NO MODO LINK: página de uma planilha do Drive não
                quer dizer nada, e um campo opcional que nunca se preenche é o
                campo que ensina a ignorar os outros. */}
            <div className="w-32 space-y-1.5">
              <Label htmlFor="e-paginas">Páginas</Label>
              <Input
                id="e-paginas"
                type="number"
                min={1}
                value={paginas}
                onChange={(e) => setPaginas(e.target.value)}
                placeholder="opcional"
              />
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="e-link">Endereço</Label>
              <Input
                id="e-link"
                type="url"
                inputMode="url"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://docs.google.com/…"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-link-nome">Nome do material</Label>
              <Input
                id="e-link-nome"
                value={nomeDoLink}
                onChange={(e) => setNomeDoLink(e.target.value)}
                placeholder="Como aparece para quem abrir"
              />
            </div>
          </div>

          {/* O SERVIÇO APARECE ANTES DE SALVAR, e é a conferência: colar o
              endereço errado é o erro provável aqui, e ler "Google Sheets"
              embaixo de um link que devia ser o Slides é o que pega. Ele sai
              da MESMA `servicoDoLink()` que desenha a linha do cartão — duas
              contas dariam duas respostas para o mesmo endereço. */}
          {servico ? (
            <p className="text-text-muted text-xs">
              Vai aparecer como <span className="font-medium">{servico}</span>,
              com um botão de abrir em nova aba.
            </p>
          ) : link.trim() ? (
            <p className="text-warning text-xs">
              O endereço precisa começar com{" "}
              <span className="font-medium">https://</span>.
            </p>
          ) : null}

          {/* O ACESSO É DO DRIVE, E NÃO DO FULL HUB — e isto fica escrito na
              tela de quem cola o link, não só aqui. Ele guarda o endereço e
              quem leu; quem abre a porta é a permissão do arquivo. Sem a
              frase, alguém anexa um link restrito, a equipe bate numa tela de
              "pedir acesso" e ninguém liga uma coisa à outra. */}
          <p className="text-text-secondary text-xs">
            O Full Hub guarda o endereço e quem marcou como lido — ele não copia
            o arquivo nem libera acesso. Confira se o material está
            compartilhado com a equipe no Drive antes de salvar.
          </p>
        </>
      )}

      {escolhido && ehEbook ? (
        <p className="text-text-muted text-xs">
          O Full Hub vai tratar este arquivo como{" "}
          <span className="font-medium">
            {ROTULOS_DO_FORMATO[formato ?? "pdf"]}
          </span>
          {formato === "html_interativo"
            ? " — ele abre dentro do painel, com o progresso de leitura registrado por capítulo."
            : " — ele abre no visualizador, com um botão de baixar."}
        </p>
      ) : null}

      {/* AS NOTAS E A RELEITURA SÓ APARECEM A PARTIR DA SEGUNDA VERSÃO, e a
          ausência é a decisão: na primeira não há o que dizer que mudou, e não
          há quem reler — pedir as duas ali seria um campo que ninguém sabe
          preencher no único momento em que ele é obrigatório pelo costume.
          NO LINK A RELEITURA VALE MAIS, e é dito por extenso: um Google Doc
          vivo muda sem versão nova, então ela é o único jeito de cobrar de
          novo quem já tinha lido. */}
      {atual && ehEbook ? (
        <div className="space-y-3 border-t pt-3">
          <div className="space-y-1.5">
            <Label htmlFor="e-notas">O que mudou</Label>
            <Textarea
              id="e-notas"
              rows={2}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Quem já leu a versão anterior lê isto antes de reler."
            />
          </div>

          <label className="flex items-start gap-2.5">
            <Switch
              checked={releitura}
              onCheckedChange={setReleitura}
              aria-label="Exigir que quem já leu leia de novo"
            />
            <span className="text-sm">
              <span className="text-text-primary font-medium">
                Exigir releitura
              </span>
              <span className="text-text-muted block text-xs">
                Devolve a pendência a todo mundo que já tinha confirmado. Deixe
                desmarcado para correção de texto — senão o aviso vira ruído e
                ninguém mais o lê.
              </span>
            </span>
          </label>
        </div>
      ) : null}

      {escolhido ? (
        <p className="text-text-muted text-xs">
          {escolhido.nome} ·{" "}
          {Math.max(1, Math.round(escolhido.bytes / 1024 / 1024))} MB — clique
          em <span className="font-medium">Salvar</span> para ele passar a
          valer.
        </p>
      ) : null}

      {/* O BOTÃO É UM SÓ E FICA NO FIM, e isto é um conserto de quem veio
          antes: ele morava na linha do seletor de arquivo, e a partir da
          segunda versão de um e-book as duas coisas que ele grava — "o que
          mudou" e "exigir releitura" — ficavam ABAIXO dele. Quem escrevia a
          nota tinha de voltar para cima para salvá-la, e quem não voltasse
          gravaria a versão sem ela, calada. Foi a imagem que mostrou.

          Um por modo seriam dois botões com a mesma `onClick` e dois rótulos
          para divergir; o que troca é o rótulo, porque "Salvar o arquivo" num
          link nomeia o que não está acontecendo. */}
      <Button
        size="sm"
        onClick={salvar}
        disabled={enviando || subindo || !prontoParaSalvar}
      >
        {modo === "link" ? "Salvar o link" : "Salvar o arquivo"}
      </Button>
    </div>
  );
}

function MontarCurso({
  itemId,
  curso,
}: {
  itemId: string;
  curso: NonNullable<ItemAberto["curso"]>;
}) {
  const router = useRouter();
  const [enviando, começar] = useTransition();
  const [nomeDoModulo, setNomeDoModulo] = useState("");

  function criarModulo() {
    começar(async () => {
      const r = await chamarAcao(() =>
        salvarModulo(null, {
          item_id: itemId,
          titulo: nomeDoModulo,
          ordem: curso.modulos.length * 10,
        }),
      );
      if (!r.ok) toast.error(r.error);
      else {
        toast.success(r.mensagem);
        setNomeDoModulo("");
        router.refresh();
      }
    });
  }

  return (
    <div className="bg-card rounded-card shadow-cartao space-y-4 border p-4">
      <h4 className="text-text-primary text-sm font-medium">Módulos e aulas</h4>

      {curso.modulos.map((modulo) => (
        <NovaAula
          key={modulo.id}
          moduloId={modulo.id}
          titulo={modulo.titulo}
          aulas={modulo.aulas}
        />
      ))}

      <div className="flex flex-wrap items-end gap-2 border-t pt-3">
        <div className="min-w-50 flex-1 space-y-1.5">
          <Label htmlFor="novo-modulo">Novo módulo</Label>
          <Input
            id="novo-modulo"
            value={nomeDoModulo}
            onChange={(e) => setNomeDoModulo(e.target.value)}
            placeholder="O começo"
          />
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={criarModulo}
          disabled={enviando || nomeDoModulo.trim().length < 2}
        >
          <Plus aria-hidden className="size-4" />
          Acrescentar
        </Button>
      </div>
    </div>
  );
}

function NovaAula({
  moduloId,
  titulo,
  aulas,
}: {
  moduloId: string;
  titulo: string;
  aulas: NonNullable<ItemAberto["curso"]>["modulos"][number]["aulas"];
}) {
  const router = useRouter();
  const [enviando, começar] = useTransition();
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<AcademyAulaTipo>("video");
  const [url, setUrl] = useState("");

  function criar() {
    começar(async () => {
      const r = await chamarAcao(() =>
        salvarAula(null, {
          modulo_id: moduloId,
          titulo: nome,
          tipo,
          url: url || null,
          ordem: aulas.length * 10,
        }),
      );
      if (!r.ok) toast.error(r.error);
      else {
        toast.success(r.mensagem);
        setNome("");
        setUrl("");
        router.refresh();
      }
    });
  }

  function apagar(id: string) {
    começar(async () => {
      const r = await chamarAcao(() => excluirAula(id));
      if (!r.ok) toast.error(r.error);
      else {
        toast.success(r.mensagem);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <p className="text-text-primary text-sm font-medium">{titulo}</p>

      <ul className="divide-border divide-y text-sm">
        {aulas.map((aula) => (
          <li key={aula.id} className="flex items-center gap-2 py-1.5">
            <span className="text-text-secondary min-w-0 flex-1">
              {aula.titulo}
            </span>
            <span className="text-text-muted text-[11px]">
              {ROTULOS_DE_AULA[aula.tipo]}
            </span>
            <button
              type="button"
              onClick={() => apagar(aula.id)}
              disabled={enviando}
              aria-label={`Excluir a aula ${aula.titulo}`}
              className="text-text-muted hover:text-danger"
            >
              <Trash2 aria-hidden className="size-4" />
            </button>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-40 flex-1 space-y-1.5">
          <Label htmlFor={`aula-${moduloId}`}>Nova aula</Label>
          <Input
            id={`aula-${moduloId}`}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Por que medir antes de anunciar"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`tipo-${moduloId}`}>Formato</Label>
          <select
            id={`tipo-${moduloId}`}
            value={tipo}
            onChange={(e) => setTipo(e.target.value as AcademyAulaTipo)}
            className="border-input bg-background h-9 rounded-md border px-2 text-sm"
          >
            {TIPOS_DE_AULA.map((t) => (
              <option key={t} value={t}>
                {ROTULOS_DE_AULA[t]}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-40 flex-1 space-y-1.5">
          <Label htmlFor={`url-${moduloId}`}>Endereço</Label>
          <Input
            id={`url-${moduloId}`}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
          />
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={criar}
          disabled={enviando || nome.trim().length < 2}
        >
          <Plus aria-hidden className="size-4" />
          Acrescentar
        </Button>
      </div>
    </div>
  );
}

/**
 * A obrigatoriedade.
 *
 * **FUNÇÃO VAZIA QUER DIZER "PARA A AGÊNCIA INTEIRA"**, e é o caso de
 * "Primeiros 30 dias na Full". **Prazo vazio é "sem prazo"**: o item é
 * obrigatório e não vence — sem o vazio, todo obrigatório pediria um número
 * inventado, e prazo inventado é prazo que vence sem ninguém entender por quê.
 */
function Obrigatoriedade({ itemId }: { itemId: string }) {
  const router = useRouter();
  const [enviando, começar] = useTransition();
  const [funcao, setFuncao] = useState("");
  const [dias, setDias] = useState("");

  function tornar() {
    começar(async () => {
      const r = await chamarAcao(() =>
        tornarObrigatorio({
          item_id: itemId,
          funcao: funcao || null,
          prazo_dias_apos_admissao: dias ? Number(dias) : null,
        }),
      );
      if (!r.ok) toast.error(r.error);
      else {
        toast.success(r.mensagem);
        router.refresh();
      }
    });
  }

  return (
    <div className="bg-card rounded-card shadow-cartao space-y-3 border p-4">
      <h4 className="text-text-primary text-sm font-medium">
        Tornar obrigatório
      </h4>

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-40 flex-1 space-y-1.5">
          <Label htmlFor="o-funcao">Para quem</Label>
          <select
            id="o-funcao"
            value={funcao}
            onChange={(e) => setFuncao(e.target.value)}
            className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
          >
            <option value="">A agência inteira</option>
            {FUNCOES.map((f) => (
              <option key={f} value={f}>
                {rotuloDaFuncao(f)}
              </option>
            ))}
          </select>
        </div>

        <div className="w-40 space-y-1.5">
          <Label htmlFor="o-dias">Prazo (dias de casa)</Label>
          <Input
            id="o-dias"
            type="number"
            min={1}
            value={dias}
            onChange={(e) => setDias(e.target.value)}
            placeholder="sem prazo"
          />
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={tornar}
          disabled={enviando}
        >
          Marcar
        </Button>
      </div>

      <p className="text-text-muted text-xs">
        O prazo conta a partir da data de admissão da pessoa — quem entrou ontem
        tem o prazo inteiro, e quem está há dois anos já está fora dele se nunca
        leu. Em branco, o item é obrigatório e não vence.
      </p>

      <RegraAtual itemId={itemId} />
    </div>
  );
}

/**
 * Tirar a obrigatoriedade.
 *
 * Esta tela não LISTA as regras existentes, e é dito em vez de escondido: a
 * leitura que alimenta esta página traz o item e o conteúdo dele, não as
 * regras de obrigatoriedade — e trazer uma consulta a mais em toda abertura de
 * playbook, para uma seção que quase ninguém abre, é a conta que o diálogo do
 * board já recusou uma vez. Quem quer ver todas as regras vê o efeito delas na
 * aba Acompanhamento, que é onde a pergunta é feita.
 */
function RegraAtual({ itemId }: { itemId: string }) {
  const router = useRouter();
  const [enviando, começar] = useTransition();
  const [id, setId] = useState("");

  return (
    <details className="text-xs">
      <summary className="text-text-secondary cursor-pointer">
        Tirar uma regra de obrigatoriedade
      </summary>
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <div className="min-w-50 flex-1 space-y-1.5">
          <Label htmlFor="o-id">Identificador da regra</Label>
          <Input
            id="o-id"
            value={id}
            onChange={(e) => setId(e.target.value)}
            placeholder="o uuid que aparece no acompanhamento"
          />
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={enviando || id.length < 10}
          onClick={() =>
            começar(async () => {
              const r = await chamarAcao(() => tirarObrigatoriedade(id));
              if (!r.ok) toast.error(r.error);
              else {
                toast.success(r.mensagem);
                setId("");
                router.refresh();
              }
            })
          }
        >
          Tirar
        </Button>
      </div>
      <p className="text-text-muted mt-1">
        Este item é do acervo {itemId.slice(0, 8)}…
      </p>
    </details>
  );
}

function Publicacao({ item }: { item: ItemAberto["item"] }) {
  const router = useRouter();
  const [enviando, começar] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        size="sm"
        variant={item.publicado ? "outline" : "default"}
        disabled={enviando}
        onClick={() =>
          começar(async () => {
            const r = await chamarAcao(() =>
              publicarItem(item.id, !item.publicado),
            );
            if (!r.ok) toast.error(r.error);
            else {
              toast.success(r.mensagem);
              router.refresh();
            }
          })
        }
      >
        {item.publicado ? "Voltar a rascunho" : "Publicar no acervo"}
      </Button>

      <ConfirmDialog
        title={`Excluir "${item.titulo}"?`}
        description="O conteúdo, as versões e o progresso de todo mundo saem junto. Não tem volta."
        confirmLabel="Excluir item"
        destructive
        onConfirm={async () => {
          const r = await chamarAcao(() => excluirItem(item.id));
          if (!r.ok) toast.error(r.error);
          else {
            toast.success(r.mensagem);
            router.push("/painel/academy");
          }
        }}
        trigger={
          <Button size="sm" variant="ghost" className="text-danger">
            Excluir
          </Button>
        }
      />
    </div>
  );
}
