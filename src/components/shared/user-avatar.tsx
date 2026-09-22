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
  sm: "size-6 text-[10px]",
  md: "size-8 text-xs",
  lg: "size-10 text-sm",
} as const;

/**
 * Foto da pessoa, ou as iniciais quando não há foto. O nome vem no tooltip,
 * porque em lista e tabela só cabe o círculo.
 */
export function UserAvatar({
  name,
  src,
  size = "md",
  className,
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof TAMANHOS;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Avatar className={cn(TAMANHOS[size], className)}>
          {src ? <AvatarImage src={src} alt={name} /> : null}
          <AvatarFallback className="font-medium">{iniciaisDe(name)}</AvatarFallback>
        </Avatar>
      </TooltipTrigger>
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
    <div className="flex items-center -space-x-1.5">
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
