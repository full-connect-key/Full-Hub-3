import { Building2 } from "lucide-react";

/**
 * A capa e a foto de perfil da empresa, no topo do Início do Portal (0063).
 *
 * Decisão do usuário, escolhida entre três propostas de layout: **capa larga
 * com a foto sobreposta**, que é o desenho de perfil de rede social.
 *
 * ---------------------------------------------------------------------------
 * **POR QUE SÓ NO INÍCIO, E NÃO EM TODA TELA.**
 *
 * A proposta B punha a capa atrás do cabeçalho de todas as telas, e o custo
 * dela era o inverso: numa faixa de 88px a imagem se lê como textura e não
 * como imagem — uma foto de equipe ou de produto se perde. Aqui ela tem
 * altura para ser uma imagem de verdade, e as outras telas continuam com a
 * foto pequena ao lado do nome, no cabeçalho — identidade constante, sem
 * repetir a peça grande em cada visita.
 *
 * **Em 375px a capa encolhe para 120px**, e é a única concessão da proposta:
 * metade da primeira dobra de um celular gasta com marca é meia tela a menos
 * para o que a pessoa veio ver. `h-30` no celular e `h-52` a partir de `sm`.
 * ---------------------------------------------------------------------------
 *
 * **Sem capa NÃO é um retângulo cinza**, e é a mesma decisão de
 * `CapaDoCartao`: a faixa cai para a cor da marca, que é um fundo escolhido e
 * não um buraco. Sem foto, as iniciais da empresa — nunca um avatar genérico,
 * que diz menos que duas letras.
 *
 * **As cores saem dos tokens**, inclusive a faixa de fallback: `--brand-navy`
 * é o mesmo fundo da barra lateral e do painel do login, e é escuro nos dois
 * temas — então a foto sobreposta e o nome em cima dela não precisam de duas
 * versões.
 */
export function IdentidadeDoCliente({
  nome,
  capaAssinada,
  fotoAssinada,
  saudacao,
}: {
  nome: string;
  capaAssinada: string | null;
  fotoAssinada: string | null;
  /** "Olá, Ana" — vazio na visualização da equipe. */
  saudacao?: string;
}) {
  return (
    <section aria-label={`Identidade de ${nome}`}>
      {/* ALINHADA AO CONTEÚDO, e não sangrando para fora dele.
          
          A primeira versão usava `-mx-4 lg:-mx-8` para escapar do respiro da
          página, e a imagem mostrou por que isso não funciona: `main` é
          `mx-auto max-w-5xl`, então tirar o padding deixa a faixa 32px mais
          larga que os cartões e ainda longe da borda da janela — nem alinhada
          nem de ponta a ponta, que é a única das três que parece erro. Sangria
          de verdade exigiria truque de largura de viewport dentro de um
          contêiner centralizado, e o preço dele aparece na primeira barra de
          rolagem. */}
      <div className="bg-brand-navy relative h-30 w-full overflow-hidden rounded-t-xl sm:h-52">
        {capaAssinada ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={capaAssinada} alt="" className="size-full object-cover" />
        ) : null}
      </div>

      {/* A FOTO SOBREPÕE A BORDA DE BAIXO, e é o que faz o desenho ser um
          perfil e não duas faixas empilhadas. O `-mt-10` é metade da altura
          dela; o anel da cor da página é o que a separa da capa em qualquer
          imagem, clara ou escura. */}
      <div className="flex items-end gap-3 px-4">
        <div className="ring-surface-page bg-surface-card -mt-10 size-20 shrink-0 overflow-hidden rounded-full ring-4 sm:-mt-12 sm:size-24">
          {fotoAssinada ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={fotoAssinada}
              alt={`Logo de ${nome}`}
              className="size-full object-cover"
            />
          ) : (
            <div className="text-text-secondary flex size-full items-center justify-center">
              <Building2 aria-hidden className="size-8" />
              <span className="sr-only">{nome}</span>
            </div>
          )}
        </div>

        {/* O NOME FICA AO LADO DA FOTO E ABAIXO DA CAPA, nunca EM CIMA da
            imagem: texto sobre foto é contraste que ninguém mediu — a capa
            vem de fora e pode ser clara, escura ou as duas coisas na mesma
            imagem. É a mesma razão pela qual o produto usa par nomeado em vez
            de opacidade. */}
        <div className="min-w-0 pb-1">
          <p className="truncate text-lg font-semibold">{nome}</p>
          {/* A SAUDAÇÃO MORA AQUI, e não num bloco acima.
              
              Ela estava na página, antes deste componente — e a imagem mostrou
              o resultado: "Olá, Ana" em cima, a capa embaixo, e o nome da
              empresa aparecendo duas vezes na mesma dobra (aqui e no
              cabeçalho). Juntas, as duas linhas dizem de uma vez de quem é o
              portal e quem está lendo. Na visualização da equipe `saudacao`
              vem vazia, e sobra só a empresa — que é o certo: quem abriu não é
              cliente de ninguém. */}
          <p className="text-text-muted text-sm">
            {saudacao ?? "Portal do cliente"}
          </p>
        </div>
      </div>
    </section>
  );
}
