import {
  BadgeCheck,
  CalendarRange,
  FolderOpen,
  Home,
  Megaphone,
  MessageSquarePlus,
  Settings,
  Share2,
  type LucideIcon,
} from "lucide-react";

/**
 * Navegação do Portal do Cliente.
 *
 * Separada do menu do painel de propósito: o portal é curto, plano e sem
 * perfis — todo cliente vê os mesmos itens. Misturar as duas navegações num
 * arquivo só faria a regra de permissão do painel valer para quem não tem
 * perfil de acesso interno.
 */
export type ItemDoPortal = {
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
  /**
   * Fora da barra de seções, mas a rota existe e a trilha continua achando o
   * nome dela. É o espelho do `hiddenFromMenu` do painel: quem sai é a
   * entrada, não a tela — e `acharItemDoPortal()` precisa dela para escrever
   * "Configurações" no cabeçalho de quem chegou pelo menu do avatar.
   */
  foraDaBarra?: boolean;
};

export const NAVEGACAO_DO_PORTAL: ItemDoPortal[] = [
  {
    label: "Início",
    href: "/portal",
    icon: Home,
    description: "O panorama do que está acontecendo na sua conta.",
  },
  {
    // SOLICITAÇÕES SOBE PARA A SEGUNDA POSIÇÃO, e isto desfaz uma decisão que
    // estava escrita aqui. O argumento de então era que esta é a única seção
    // em que o cliente ESCREVE — as outras respondem "o que a Full fez para
    // mim", esta responde "o que eu preciso" — e que pôr a de escrever no meio
    // das de ler faria quem veio aprovar um post tropeçar num formulário.
    //
    // **O sprint do portal inverte isso de propósito**, e a promessa dele é a
    // razão: *"o cliente abre um pedido em segundos e ele cai direto na
    // operação do time"*. Abrir trabalho deixou de ser o movimento raro da
    // tela e passou a ser o que ela existe para facilitar.
    //
    // *O que se perde, e é consequência aceita:* quem entra para aprovar passa
    // o olho por um item de abrir pedido antes de chegar em Aprovações. O que
    // segura o tropeço é que nada aqui é formulário — o item leva a uma LISTA,
    // e o painel de abrir só aparece no clique do botão.
    //
    // **Ela aparece para todo cliente, mesmo na conta que não aceita pedido**,
    // e é escolha: o histórico do que já foi pedido continua sendo dele. O que
    // some na conta desligada é o botão de abrir um novo — e a tela diz a quem
    // falar, em vez de sumir e deixá-lo procurando.
    label: "Solicitações",
    href: "/portal/solicitacoes",
    icon: MessageSquarePlus,
    description: "O que você pediu para a agência, e em que pé está.",
  },
  {
    label: "Social Media",
    href: "/portal/social-media",
    icon: Share2,
    description: "Os conteúdos das suas redes, para acompanhar e aprovar.",
  },
  {
    label: "Campanhas",
    href: "/portal/campanhas",
    icon: Megaphone,
    description: "Suas campanhas, o que já foi aprovado e o que espera você.",
  },
  {
    // O CRONOGRAMA ENTRA DEPOIS DAS TRÊS FRENTES e antes de Aprovações, porque
    // é delas que ele é feito: ele não é uma quarta área de material, é a
    // mesma coisa vista pela data. Acima delas, prometeria ser o lugar onde o
    // trabalho mora; no fim, depois da fila que COBRA uma ação, seria a seção
    // que ninguém abre.
    label: "Cronograma",
    href: "/portal/cronograma",
    icon: CalendarRange,
    description: "O que acontece em cada dia do mês, nas três frentes.",
  },
  {
    // A BIBLIOTECA É A ÚLTIMA DAS SEÇÕES DE MATERIAL, e a posição é a da
    // pergunta: as de cima são sobre o que está acontecendo, esta é sobre o
    // que já aconteceu. Quem a abre não está trabalhando — está procurando um
    // arquivo de semanas atrás.
    label: "Biblioteca",
    href: "/portal/biblioteca",
    icon: FolderOpen,
    description: "Tudo o que você já aprovou, para baixar depois.",
  },
  {
    label: "Aprovações",
    href: "/portal/aprovacoes",
    icon: BadgeCheck,
    description: "O que a agência enviou para a sua aprovação.",
  },
  {
    // FORA DA NAVEGAÇÃO, e a rota de pé — decisão do usuário: "um caminho só
    // para o perfil, no canto superior direito". Ela estava aqui, como aba, E
    // no menu do avatar como "Meus dados": a mesma tela em dois lugares.
    //
    // Ficou a do canto porque é onde o cliente já procura — é o único item
    // desta barra que fala DELE e não do trabalho da agência, e no meio de
    // Início, Aprovações, Social Media e Campanhas ele lia como mais uma
    // seção de material.
    label: "Configurações",
    href: "/portal/configuracoes",
    icon: Settings,
    description: "Seus dados de contato e preferências de acesso.",
    foraDaBarra: true,
  },
];

export function acharItemDoPortal(pathname: string): ItemDoPortal | undefined {
  const candidatos = NAVEGACAO_DO_PORTAL.filter(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  if (candidatos.length === 0) return undefined;
  return candidatos.reduce((maior, item) => (item.href.length > maior.href.length ? item : maior));
}

/**
 * A mesma navegação, com outro prefixo.
 *
 * Serve a visualização administrativa, em /portal/{slug}: os itens são os
 * mesmos do portal do cliente — é esse o ponto, mostrar o que ele vê — e só o
 * caminho muda.
 */
export function navegacaoComBase(base: string): ItemDoPortal[] {
  if (base === "/portal") return NAVEGACAO_DO_PORTAL;
  return NAVEGACAO_DO_PORTAL.map((item) => ({
    ...item,
    href: item.href === "/portal" ? base : `${base}${item.href.slice("/portal".length)}`,
  }));
}
