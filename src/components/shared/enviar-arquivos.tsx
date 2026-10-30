"use client";

import { useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import * as tus from "tus-js-client";

import { BarraDeProgresso } from "@/components/shared/barra-de-progresso";
import { Button } from "@/components/ui/button";
import {
  atributoAccept,
  conferirArquivo,
  pesoLegivel,
  type FamiliaDeArquivo,
} from "@/lib/dominio/arquivos";
import { SUPABASE_ANON_KEY, SUPABASE_STORAGE_URL } from "@/lib/env";
import { criarClienteNavegador } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/**
 * O ENVIADOR DE ARQUIVOS DA CASA — um, para as três telas que entregam.
 *
 * ===========================================================================
 * **ERAM TRÊS UPLOADERS COM O MESMO CORPO E TRÊS COMPORTAMENTOS DIFERENTES**,
 * e a conta é a das sete cópias de `abas.tsx`: a arte do post
 * (`editor-do-post.tsx`), os arquivos da peça de campanha
 * (`arvore-de-producao.tsx`) e a referência da demanda (`referencias.tsx`)
 * escreviam o mesmo laço de `supabase.storage.upload()` — e já divergiam em
 * tudo o que importa:
 *
 * | | arte do post | peça de campanha | referência |
 * | --- | --- | --- | --- |
 * | o que aceita | `image/*` | **qualquer coisa** | **qualquer coisa** |
 * | teto | nenhum | nenhum | 15 MB |
 * | progresso | giro | giro | giro |
 * | erro no meio | **larga os anteriores no bucket** | **idem** | n/a |
 *
 * **A TERCEIRA LINHA É A QUE O ITEM 30 PEDE E NENHUMA DAS TRÊS TINHA.** E ela
 * não é descuido: `supabase.storage.from().upload()` **não tem como** mostrar
 * progresso — ele é escrito sobre `fetch`, que não emite evento de subida. Uma
 * barra por cima daquela chamada seria uma barra inventada, e inventar
 * progresso é pior que um giro honesto: num arquivo de 300 MB ela chegaria a
 * 100% e ficaria lá, parada, pelos oito minutos seguintes.
 *
 * **POR ISSO É TUS, e é a mesma decisão que dá o upload resumível.** O
 * protocolo manda o arquivo em pedaços de 6 MB, e cada pedaço que chega é um
 * progresso de verdade — e um ponto de onde continuar quando a conexão cai.
 * **Um caminho só para arquivo grande e pequeno**, pela regra da casa: um JPG
 * de 2 MB é um pedaço só, com progresso, pelo mesmo código. Dois caminhos
 * seriam dois lugares para divergir, e o que divergiria é o do arquivo grande
 * — que é o que ninguém testa.
 *
 * **O ERRO NÃO DEIXA ÓRFÃO, e isto é conserto e não funcionalidade nova.** Nas
 * três telas antigas o laço fazia `return` no primeiro erro: subindo cinco
 * slides, se o quarto falha, **três arquivos ficam no bucket sem nada
 * apontando para eles** e nenhuma versão é gravada. Aqui o que já subiu é
 * APAGADO antes de a recusa aparecer. A entrega é o CONJUNTO: uma versão com
 * três de cinco slides é uma versão errada, e quem a vê não tem como saber.
 * ===========================================================================
 */

/** O que o enviador devolve por arquivo que subiu. */
export type ArquivoEnviado = {
  /** O caminho no bucket — é isto que a tabela guarda. */
  url: string;
  nome: string;
  tamanho: number;
};

/**
 * O PEDAÇO É DE 6 MB EXATOS, e a documentação do Supabase diz isso em letras
 * maiúsculas: *"NOTE: it must be set to 6MB (for now) do not change it"*. Não
 * é escolha de desempenho — é o que o servidor deles aceita.
 */
const PEDACO = 6 * 1024 * 1024;

export function EnviarArquivos({
  bucket,
  caminho,
  familias,
  varios = false,
  rotulo,
  desabilitado = false,
  onPronto,
  variante = "outline",
  className,
  rotuloDoCampo,
  dica,
}: {
  bucket: string;
  /**
   * O CAMINHO DE CADA ARQUIVO no bucket, decidido por quem chama.
   *
   * **E é obrigatório que seja de quem chama**: nos três buckets a PRIMEIRA
   * PASTA é o que a policy do Storage pergunta — o id da empresa em
   * `posts-artes` e em `campanhas-arquivos`, a palavra `entregas` mais o id da
   * etapa em `task-arquivos`. Um caminho montado aqui dentro teria que
   * conhecer as três convenções, e a quarta nasceria errada.
   */
  caminho: (arquivo: File, indice: number) => string;
  /** O que esta tela aceita. A frase de recusa sai daqui. */
  familias: readonly FamiliaDeArquivo[];
  varios?: boolean;
  /**
   * O RÓTULO DO BOTÃO, e ele é de quem chama — não há um `rotuloVarios` aqui.
   *
   * Houve, e saiu sem chamador: as três telas computam o rótulo do estado
   * delas ("Subir a arte" / "Trocar a arte", "Subir os arquivos" / "Subir
   * nova versão"), que depende de haver arte ou versão gravada — coisas que
   * este componente não sabe e não deve saber. Uma prop que nenhuma tela
   * passa é o que alguém reaproveita três sprints depois achando que ela quer
   * dizer alguma coisa, que é a lição de `pessoasDaLinhaDoTempo`.
   */
  rotulo: string;
  desabilitado?: boolean;
  /** Chamado com o que subiu. É aqui que a tela grava a versão. */
  onPronto: (enviados: ArquivoEnviado[]) => void | Promise<void>;
  variante?: "outline" | "secondary" | "default";
  className?: string;
  /** O `aria-label` do `<input>`. Sem ele o campo não tem nome. */
  rotuloDoCampo: string;
  /** Uma linha abaixo do botão dizendo o que cabe. */
  dica?: string;
}) {
  const campo = useRef<HTMLInputElement>(null);
  const [subindo, setSubindo] = useState(false);
  const [feitos, setFeitos] = useState(0);
  const [total, setTotal] = useState(0);
  const [emFoco, setEmFoco] = useState<string | null>(null);
  const [recusa, setRecusa] = useState<string | null>(null);

  async function enviar(escolhidos: FileList | null) {
    if (!escolhidos || escolhidos.length === 0) return;
    const arquivos = Array.from(escolhidos);

    // ------------------------------------------- CONFERIR TODOS, PRIMEIRO --
    // O LOTE COMEÇA INTEIRO OU NÃO COMEÇA. Conferindo dentro do laço, o
    // segundo arquivo recusado pararia depois de o primeiro já ter subido — e
    // aí ou se deixa um órfão, ou se apaga o que estava certo. Conferir antes
    // custa nada e desfaz os dois casos.
    for (const arquivo of arquivos) {
      const veredito = conferirArquivo(arquivo, familias);
      if (!veredito.ok) {
        setRecusa(veredito.motivo);
        return;
      }
    }

    setRecusa(null);
    setSubindo(true);
    setFeitos(0);
    setTotal(arquivos.reduce((soma, a) => soma + a.size, 0));

    const supabase = criarClienteNavegador();
    // `getSession` E NÃO `getUser`, e esta é a exceção declarada à regra da
    // casa. A documentação do Supabase escreve por quê, e o argumento é
    // exatamente o que a regra protege: aqui o código só precisa da STRING do
    // token para encaminhar como credencial, e quem a valida é o Storage, no
    // servidor. Nenhuma decisão de acesso é tomada a partir do que o cookie
    // diz — se o token for velho, o Storage recusa.
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    if (!token) {
      setSubindo(false);
      setRecusa("Sua sessão expirou. Recarregue a página e entre de novo.");
      return;
    }

    const subidos: ArquivoEnviado[] = [];
    let jaContado = 0;

    try {
      for (const [indice, arquivo] of arquivos.entries()) {
        const destino = caminho(arquivo, indice);
        setEmFoco(arquivo.name);

        try {
          await umArquivo({
            arquivo,
            bucket,
            destino,
            token,
            aoAndar: (bytes) => setFeitos(jaContado + bytes),
          });
        } catch (erro) {
          // O QUE JÁ SUBIU SAI DAQUI, antes de a pessoa ler a recusa. Sem
          // isto, o bucket acumula arquivo que nenhuma linha aponta — e o
          // único jeito de achá-los é abrir o painel do Supabase.
          if (subidos.length > 0) {
            await supabase.storage
              .from(bucket)
              .remove(subidos.map((s) => s.url));
          }
          setRecusa(
            `“${arquivo.name}” não subiu: ${mensagemDoErro(erro)}` +
              (subidos.length > 0
                ? ` Os ${subidos.length} anteriores foram descartados — a entrega vai inteira ou não vai.`
                : ""),
          );
          return;
        }

        jaContado += arquivo.size;
        setFeitos(jaContado);
        subidos.push({
          url: destino,
          nome: arquivo.name,
          tamanho: arquivo.size,
        });
      }

      await onPronto(subidos);
    } finally {
      setSubindo(false);
      setEmFoco(null);
      setFeitos(0);
      setTotal(0);
      if (campo.current) campo.current.value = "";
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      <input
        ref={campo}
        type="file"
        aria-label={rotuloDoCampo}
        accept={atributoAccept(familias)}
        multiple={varios}
        className="sr-only"
        onChange={(e) => void enviar(e.target.files)}
      />

      <Button
        type="button"
        variant={variante}
        size="sm"
        disabled={desabilitado || subindo}
        onClick={() => campo.current?.click()}
      >
        {subindo ? (
          <Loader2 aria-hidden className="size-4 animate-spin" />
        ) : (
          <Upload aria-hidden className="size-4" />
        )}
        {subindo ? "Enviando…" : rotulo}
      </Button>

      {/* A BARRA SÓ EXISTE ENQUANTO SOBE. Uma barra em 0% parada embaixo do
          botão lê como upload travado — é o estado em repouso dizendo que
          algo está acontecendo. */}
      {subindo && total > 0 ? (
        <BarraDeProgresso
          valor={feitos}
          total={total}
          nome="Envio dos arquivos"
          rotulo={
            emFoco
              ? `${pesoLegivel(feitos)} de ${pesoLegivel(total)} · ${emFoco}`
              : `${pesoLegivel(feitos)} de ${pesoLegivel(total)}`
          }
        />
      ) : null}

      {recusa ? (
        // `role="alert"` E NAO `status`: a recusa chega depois de um clique e
        // a pessoa esta esperando o resultado — `status` e anunciado quando o
        // leitor de tela fica ocioso, e o que ela precisa ouvir e que o
        // arquivo nao subiu.
        //
        // E `--warning` e nunca `--danger`: um arquivo grande ou de um tipo
        // que a tela nao aceita e uma correcao, nao um erro do sistema. E a
        // regra do alerta de 7 dias do portal.
        <p className="text-warning text-xs" role="alert">
          {recusa}
        </p>
      ) : dica ? (
        <p className="text-text-muted text-xs">{dica}</p>
      ) : null}
    </div>
  );
}

/**
 * UM arquivo, por TUS.
 *
 * `findPreviousUploads()` antes de começar é o que torna o upload resumível de
 * verdade: o `tus-js-client` guarda no `localStorage` a impressão digital do
 * arquivo e o endereço do upload, e a URL do Supabase vale 24 horas. Quem
 * perdeu a conexão no meio de um vídeo de 400 MB escolhe o mesmo arquivo de
 * novo e continua de onde parou.
 *
 * `removeFingerprintOnSuccess` fecha o par: sem ele, subir o MESMO arquivo
 * duas vezes de propósito — que é o caso de quem corrige e reexporta com o
 * mesmo nome — tentaria continuar um upload que já acabou.
 */
function umArquivo({
  arquivo,
  bucket,
  destino,
  token,
  aoAndar,
}: {
  arquivo: File;
  bucket: string;
  destino: string;
  token: string;
  aoAndar: (bytes: number) => void;
}): Promise<void> {
  return new Promise((resolver, recusar) => {
    const upload = new tus.Upload(arquivo, {
      endpoint: `${SUPABASE_STORAGE_URL}/storage/v1/upload/resumable`,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON_KEY,
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: bucket,
        objectName: destino,
        // O `type` DO NAVEGADOR VAI PARA O `contentType`, e é o único lugar
        // deste módulo onde ele importa: é com ele que o Storage serve o
        // arquivo depois. Vazio — que é o que um `.psd` devolve em metade dos
        // sistemas — vira `application/octet-stream`, que o navegador baixa
        // em vez de tentar desenhar. Quem decide se o arquivo SERVE é a
        // extensão, em `conferirArquivo()`.
        contentType: arquivo.type || "application/octet-stream",
        cacheControl: "3600",
      },
      // SEM `x-upsert`, de propósito: os três caminhos carregam carimbo de
      // tempo, então colisão aqui quer dizer que duas abas mandaram o mesmo
      // arquivo no mesmo milissegundo — e nesse caso recusar é melhor que
      // sobrescrever calado.
      chunkSize: PEDACO,
      onError: recusar,
      onProgress: (enviados) => aoAndar(enviados),
      onSuccess: () => resolver(),
    });

    void upload.findPreviousUploads().then((anteriores) => {
      if (anteriores.length > 0) upload.resumeFromPreviousUpload(anteriores[0]);
      upload.start();
    });
  });
}

/**
 * A FRASE DO ERRO, sem esconder a causa.
 *
 * `tus-js-client` embrulha a resposta HTTP, e o corpo dela é onde o Storage
 * diz o que recusou — `Payload too large` quando passa do
 * `file_size_limit` do bucket, `mime type not supported` quando o tipo não
 * está na lista da 0120. Trocar isso por "não foi possível enviar" esconderia
 * justamente o que separa um arquivo grande de um tipo recusado de uma queda
 * de rede, que são três consertos diferentes.
 */
function mensagemDoErro(erro: unknown): string {
  if (erro instanceof tus.DetailedError) {
    const corpo = erro.originalResponse?.getBody();
    if (corpo) {
      try {
        const json = JSON.parse(corpo) as { message?: string; error?: string };
        const frase = json.message ?? json.error;
        if (frase) return frase;
      } catch {
        // Corpo que não é JSON vai cru, que é melhor que a frase redonda.
        return corpo.slice(0, 200);
      }
    }
  }
  if (erro instanceof Error) return erro.message;
  return String(erro);
}
