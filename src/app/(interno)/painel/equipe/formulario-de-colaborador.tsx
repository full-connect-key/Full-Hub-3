"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { LinkDeSenha } from "@/components/shared/link-de-senha";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ROTULOS_DE_ROLE } from "@/lib/auth/roles";
import { AREAS_SUGERIDAS, FUNCOES, ROTULOS_DE_FUNCAO, podeConcederRole } from "@/lib/dominio/equipe";
import { chamarAcao } from "@/lib/acoes/cliente";
import type { UserRole } from "@/lib/supabase/database.types";

import { criarColaborador } from "../_actions/usuarios";

const esquema = z.object({
  nome: z.string().min(2, "Informe o nome completo."),
  email: z.string().email("Esse e-mail não parece válido."),
  role: z.enum(["colaborador", "desenvolvedor", "socio"]),
  cargo: z.string().optional(),
  area: z.string().optional(),
  // Obrigatória: é ela que libera a criação de tasks para quem é do
  // Atendimento, e sem ela a pessoa entra na equipe sem papel definido.
  funcao: z.string().min(1, "Escolha a função da pessoa na agência."),
  data_admissao: z.string().optional(),
  // number direto (e não coerce): o input converte com valueAsNumber, e o
  // coerce deixaria o tipo de entrada como unknown para o react-hook-form.
  dias_ferias_ano: z.number().int().min(0).max(365),
});

type Dados = z.infer<typeof esquema>;

/**
 * Adiciona alguém à equipe.
 *
 * A criação da conta é uma Server Action: ela usa a chave de serviço, que
 * nunca pode chegar ao navegador. O navegador só manda os campos e recebe a
 * mensagem de volta.
 *
 * O select de perfil só mostra o que quem está logado pode conceder — e o
 * servidor confere de novo, porque esconder a opção não impede um pedido
 * montado à mão.
 */
export function FormularioDeColaborador({
  roleDeQuemCria,
  trigger,
}: {
  roleDeQuemCria: UserRole;
  trigger: React.ReactNode;
}) {
  const [aberto, setAberto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [linkDeSenha, setLinkDeSenha] = useState<{ link: string; motivo: string | null } | null>(
    null,
  );
  const router = useRouter();

  const rolesDisponiveis = (["colaborador", "desenvolvedor", "socio"] as UserRole[]).filter((role) =>
    podeConcederRole(roleDeQuemCria, role),
  );

  const {
    register,
    handleSubmit,
    setValue,
    control,
    reset,
    formState: { errors },
  } = useForm<Dados>({
    resolver: zodResolver(esquema),
    defaultValues: {
      nome: "",
      email: "",
      role: "colaborador",
      cargo: "",
      area: "",
      funcao: "",
      data_admissao: "",
      dias_ferias_ano: 30,
    },
  });

  // useWatch em vez de watch(): watch() devolve uma função nova a cada
  // render, que o compilador do React não consegue memoizar com segurança.
  const role = useWatch({ control, name: "role" });
  const area = useWatch({ control, name: "area" });
  const funcao = useWatch({ control, name: "funcao" });

  const enviar = handleSubmit(async (dados) => {
    setEnviando(true);
    setLinkDeSenha(null);

    const resultado = await chamarAcao(() =>
      criarColaborador({
        ...dados,
        cargo: dados.cargo || null,
        area: dados.area || null,
        data_admissao: dados.data_admissao || null,
      }),
    );
    setEnviando(false);

    if (!resultado.ok) {
      toast.error(resultado.error);
      return;
    }

    toast.success(resultado.mensagem);
    router.refresh();

    // Sem e-mail entregue, o diálogo fica aberto com o link: a conta existe e
    // alguém precisa conseguir passar a senha para a pessoa.
    if (resultado.dados && !resultado.dados.emailEnviado && resultado.dados.linkDeSenha) {
      setLinkDeSenha({
        link: resultado.dados.linkDeSenha,
        motivo: resultado.dados.motivoDoEmail,
      });
      reset();
      return;
    }

    setAberto(false);
    reset();
  });

  return (
    <Dialog
      open={aberto}
      onOpenChange={(estaAberto) => {
        setAberto(estaAberto);
        if (!estaAberto) setLinkDeSenha(null);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Adicionar colaborador</DialogTitle>
          <DialogDescription>
            A pessoa recebe um e-mail para definir a senha. A conta, o perfil de acesso e a ficha
            são criados de uma vez.
          </DialogDescription>
        </DialogHeader>

        {linkDeSenha ? (
          <LinkDeSenha link={linkDeSenha.link} motivo={linkDeSenha.motivo} />
        ) : null}

        <form onSubmit={enviar} noValidate className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="colab-nome">Nome completo *</Label>
              <Input id="colab-nome" aria-invalid={!!errors.nome} autoFocus {...register("nome")} />
              {errors.nome ? <p className="text-destructive text-xs">{errors.nome.message}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="colab-email">E-mail *</Label>
              <Input
                id="colab-email"
                type="email"
                aria-invalid={!!errors.email}
                {...register("email")}
              />
              {errors.email ? <p className="text-destructive text-xs">{errors.email.message}</p> : null}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="colab-role">Perfil de acesso *</Label>
            <Select value={role} onValueChange={(valor) => setValue("role", valor as Dados["role"])}>
              <SelectTrigger id="colab-role" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {rolesDisponiveis.map((opcao) => (
                  <SelectItem key={opcao} value={opcao}>
                    {ROTULOS_DE_ROLE[opcao]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {roleDeQuemCria !== "socio" ? (
              <p className="text-muted-foreground text-xs">
                Apenas sócios podem conceder o perfil de sócio.
              </p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="colab-cargo">Cargo</Label>
              <Input id="colab-cargo" placeholder="Analista de contas" {...register("cargo")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="colab-area">Área</Label>
              <Select value={area || undefined} onValueChange={(valor) => setValue("area", valor)}>
                <SelectTrigger id="colab-area" className="w-full">
                  <SelectValue placeholder="Escolha a área" />
                </SelectTrigger>
                <SelectContent>
                  {AREAS_SUGERIDAS.map((opcao) => (
                    <SelectItem key={opcao} value={opcao}>
                      {opcao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="colab-funcao">Função *</Label>
              <Select value={funcao || undefined} onValueChange={(valor) => setValue("funcao", valor, { shouldValidate: true })}>
                <SelectTrigger id="colab-funcao" aria-invalid={!!errors.funcao} className="w-full">
                  <SelectValue placeholder="Escolha a função" />
                </SelectTrigger>
                <SelectContent>
                  {FUNCOES.map((opcao) => (
                    <SelectItem key={opcao} value={opcao}>
                      {ROTULOS_DE_FUNCAO[opcao]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.funcao ? (
                <p className="text-destructive text-xs">{errors.funcao.message}</p>
              ) : (
                <p className="text-muted-foreground text-xs">
                  Quem está no Atendimento pode criar tasks mesmo sendo colaborador.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="colab-admissao">Data de admissão</Label>
              <Input id="colab-admissao" type="date" {...register("data_admissao")} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="colab-ferias">Dias de descanso por ano</Label>
            <Input
              id="colab-ferias"
              type="number"
              min={0}
              max={365}
              className="w-32"
              {...register("dias_ferias_ano", { valueAsNumber: true })}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAberto(false)} disabled={enviando}>
              Cancelar
            </Button>
            <Button type="submit" disabled={enviando}>
              {enviando ? <Loader2 className="animate-spin" /> : null}
              Criar e enviar convite
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
