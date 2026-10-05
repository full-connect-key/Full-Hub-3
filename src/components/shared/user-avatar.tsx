import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** Primeira e última inicial. "Ana Souza" -> AS, "Ana" -> AN. */
export function iniciaisDe(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

const TAMANHOS = {
  // `xs` existe para a célula do calendário do mês, que tem cerca de 160px de
  // largura: a 24px o círculo comia o nome da etapa e "Conferir os anexos"
  // saía "Conferir os ane…". Foi a imagem do protótipo que mostrou.
  xs: "size-5 text-[9px]",
  sm: "size-6 text-[10px]",
  md: "size-8 text-xs",
  lg: "size-10 text-sm",
} as const;

/**
 * Foto da pessoa, ou as iniciais quando não há foto. O nome vem no tooltip,
 * porque em lista e tabela só cabe o círculo.
 *
 * **`tooltip={false}` existe para o avatar que mora DENTRO de um botão**, e
 * não é preferência de desenho: o `TooltipTrigger` do Radix é interativo, e um
 * elemento interativo dentro de outro é `nested-interactive` — crítico no axe,
 * e na prática duas paradas de Tab para a mesma coisa. É o caso do chip do
 * calendário de tasks, que é um `<button>` inteiro: lá o nome da pessoa viaja
 * no `title` e no rótulo acessível do próprio chip, junto com o resto.
 *
 * A bandeira fica aqui em vez de a tela montar o `Avatar` à mão porque é este
 * componente que carrega o `object-cover` do `AvatarImage` — o conserto da
 * foto achatada vale para o produto inteiro por passar todo avatar por um
 * lugar só, e uma segunda forma de desenhar o círculo é onde essa propriedade
 * se perde.
 */
export function UserAvatar({
  name,
  src,
  size = "md",
  className,
  tooltip = true,
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof TAMANHOS;
  className?: string;
  tooltip?: boolean;
}) {
  const circulo = (
    <Avatar className={cn(TAMANHOS[size], className)}>
      {src ? <AvatarImage src={src} alt={name} /> : null}
      <AvatarFallback className="font-medium">{iniciaisDe(name)}</AvatarFallback>
    </Avatar>
  );

  if (!tooltip) return circulo;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{circulo}</TooltipTrigger>
      <TooltipContent>{name}</TooltipContent>
    </Tooltip>
  );
}

/** Vários avatares sobrepostos, com o excedente contado no fim. */
export function UserAvatarGroup({
  users,
  max = 4,
  size = "sm",
}: {
  users: { name: string; src?: string | null }[];
  max?: number;
  size?: keyof typeof TAMANHOS;
}) {
  const visiveis = users.slice(0, max);
  const excedente = users.length - visiveis.length;

  return (
    // -space-x-1 E NÃO -1.5: quando não há foto o círculo carrega DUAS letras,
    // e seis pixels de sobreposição num círculo de vinte e quatro comiam a
    // segunda — "MC" saía "M(". Com quatro, a pilha continua se lendo como
    // pilha e as iniciais cabem. Apareceu quando a pilha desceu para a linha
    // de Minhas Tasks, onde quase ninguém tem foto; no board ela passava
    // porque lá os avatares são de quem já subiu a sua.
    <div className="flex items-center -space-x-1">
      {visiveis.map((usuario) => (
        <UserAvatar
          key={usuario.name}
          name={usuario.name}
          src={usuario.src}
          size={size}
          className="ring-background ring-2"
        />
      ))}
      {excedente > 0 ? (
        <span
          className={cn(
            "bg-muted text-muted-foreground ring-background flex items-center justify-center rounded-full font-medium ring-2",
            TAMANHOS[size],
          )}
        >
          +{excedente}
        </span>
      ) : null}
    </div>
  );
}
