import { ExternalLink, Film } from "lucide-react";

/**
 * O VÍDEO DA PEÇA, do tamanho que dá para decidir.
 *
 * ===========================================================================
 * **ELE NÃO EXISTIA, E O CLIENTE NUNCA VIU VÍDEO NENHUM.** A 0042 escreveu,
 * no cabeçalho dela, que *"o visualizador do portal desenha `<img>`, com zoom
 * de roda e pinça; um `.mp4` ali apareceria quebrado"*, e que *"a tela avisa
 * que o link abre fora"*. A primeira frase estava certa; **a segunda nunca
 * foi verdade** — nada em `src/components/portal/` lia `video_url`, e um post
 * de vídeo chega com `arte_url` nulo. O que o cliente recebia era o
 * visualizador de arte VAZIO, com os dois botões de decisão embaixo: a tela
 * pedindo que ele aprove o que ela não mostrou.
 *
 * **SÃO DOIS ESTADOS E NÃO UM, porque o vídeo tem duas formas (0120):** o
 * arquivo dentro do Full Hub, que toca aqui, e o link de fora, que abre em
 * outra aba. E o segundo **diz que abre fora antes do clique** — é a frase que
 * a 0042 prometeu, quatro anos de sprint depois.
 *
 * **SEM `autoPlay`, e isso é regra e não gosto:** vídeo com som que começa
 * sozinho é o comportamento que todo navegador passou a bloquear, e o que
 * sobra dele é um player que parece travado. `preload="metadata"` traz o
 * primeiro quadro e a duração sem baixar os 400 MB — num portal que se abre
 * no celular, baixar o vídeo inteiro de uma peça que a pessoa talvez só vá
 * olhar depois é a conta de dados dela.
 * ===========================================================================
 */
export function QuadroDeVideo({
  src,
  poster,
  link,
  titulo,
}: {
  /** O vídeo no bucket, já assinado. */
  src: string | null;
  /** A capa, quando a peça tem uma. */
  poster?: string | null;
  /** O endereço de fora (Drive, YouTube), quando não há arquivo. */
  link?: string | null;
  titulo: string;
}) {
  if (src) {
    return (
      /* A ALTURA MÍNIMA É O QUE IMPEDE O PULO, e foi a imagem que mostrou:
         um `<video>` sem dimensão nasce 300 × 150 e só assume a proporção do
         arquivo quando os metadados chegam — então a página desenha uma caixa
         baixa e larga e a empurra para baixo um instante depois. Reservar o
         espaço é a decisão da miniatura da Biblioteca, que tem altura mesmo
         sem imagem.

         E O VÍDEO NÃO É ESTICADO: `w-auto max-w-full` deixa ele no tamanho
         dele, centralizado. Um Reels é vertical e um VT de campanha é
         deitado — `w-full` daria ao primeiro uma caixa larga com duas tarjas
         pretas do lado, e um quadro 16/9 fixo cortaria um dos dois. */
      <div className="bg-surface-sidebar flex min-h-72 items-center justify-center overflow-hidden rounded-card border">
        <video
          src={src}
          poster={poster ?? undefined}
          controls
          preload="metadata"
          playsInline
          className="mx-auto max-h-[70vh] w-auto max-w-full bg-black"
          aria-label={`Vídeo de ${titulo}`}
        />
      </div>
    );
  }

  if (link) {
    return (
      <div className="bg-surface-card space-y-3 rounded-card border p-6 text-center">
        <Film aria-hidden className="text-text-muted mx-auto size-8" />
        <p className="text-sm font-medium">Este material é um vídeo</p>
        {/* A FRASE VEM ANTES DO CLIQUE. Quem sai do portal para assistir
            decide longe do botão de aprovar — é o custo que a 0042 aceitou, e
            dizê-lo é o mínimo para a pessoa saber que vai voltar. */}
        <p className="text-text-muted mx-auto max-w-sm text-xs">
          Ele está guardado fora do Full Hub. O link abre em outra aba — depois
          de assistir, volte aqui para decidir.
        </p>
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="text-action-text inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
        >
          Assistir ao vídeo
          <ExternalLink aria-hidden className="size-3.5" />
        </a>
      </div>
    );
  }

  return (
    <div className="bg-surface-card rounded-card border border-dashed p-8 text-center">
      <Film aria-hidden className="text-text-muted mx-auto mb-2 size-8" />
      <p className="text-text-muted text-sm">
        Este material é um vídeo e o arquivo ainda não foi anexado.
      </p>
    </div>
  );
}
