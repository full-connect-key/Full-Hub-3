"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDays, Loader2, Power } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ROTULOS_DE_ROLE } from "@/lib/auth/roles";
import { AREAS_SUGERIDAS, FUNCOES, ROTULOS_DE_FUNCAO } from "@/lib/dominio/equipe";
import { DIAS_DE_DESCANSO_PADRAO } from "@/lib/dominio/full-days";
import type { MembroDaEquipe } from "@/lib/dados/equipe";

import { chamarAcao } from "@/lib/acoes/cliente";

import { alternarAtivoDoColaborador } from "../../../_actions/usuarios";
import { salvarColaborador } from "../acoes";
import { Desligamento, type Vinculos } from "./desligamento";

const esquema = z.object({
  nome: z.string().min(2, "Informe o nome completo."),
  role: z.enum(["colaborador", "desenvolvedor", "socio"]),
  cargo: z.string().optional(),
  area: z.string().optional(),
  // Obrigatória: é ela que libera a criação de tasks para o Atendimento.
  funcao: z.string().min(1, "Escolha a função da pessoa na agência."),
  data_admissao: z.string().optional(),
  dias_ferias_ano: z.number().int().min(0).max(365),
});

type Dados = z.infer<typeof esquema>;

export function DetalheDoColaborador({
  pessoa,
  ehSocio,
  ehGestor,
  vinculos,
  equipeDisponivel,
  ehVoceMesmo,
}: {
  pessoa: MembroDaEquipe;
  ehSocio: boolean;
  ehGestor: boolean;
  vinculos: Vinculos;
  equipeDisponivel: { id: string; nome: string }[];
  ehVoceMesmo: boolean;
}) {
  const [salvando, iniciar] = useTransition();
  const router = useRouter();

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<Dados>({
    resolver: zodResolver(esquema),
    defaultValues: {
      nome: pessoa.nome,
      role: pessoa.role as Dados["role"],
      cargo: pessoa.membro?.cargo ?? "",
      area: pessoa.membro?.area ?? "",
      funcao: pessoa.membro?.funcao ?? "",
      data_admissao: pessoa.membro?.data_admissao ?? "",
      dias_ferias_ano: pessoa.membro?.dias_ferias_ano ?? DIAS_DE_DESCANSO_PADRAO,
    },
  });

  // useWatch em vez de watch(): watch() devolve uma função nova a cada
  // render, que o compilador do React não consegue memoizar com segurança.
  const role = useWatch({ control, name: "role" });
  const area = useWatch({ control, name: "area" });
  const funcao = useWatch({ control, name: "funcao" });

  const enviar = handleSubmit((dados) => {
    iniciar(async () => {
      const resultado = await chamarAcao(() => salvarColaborador({ id: pessoa.id, ...dados }));
      if (!resultado.ok) toast.error(resultado.error);
      else {
        toast.success(resultado.mensagem);
        router.refresh();
      }
    });
  });

  const desligada = !pessoa.ativo || pessoa.membro?.ativo === false;

  function alternarAcesso() {
    iniciar(async () => {
      const resultado = await chamarAcao(() =>
        alternarAtivoDoColaborador({ user_id: pessoa.id, ativo: desligada }),
      );
      if (!resultado.ok) toast.error(resultado.error);
      else {
        toast.success(resultado.mensagem);
        router.refresh();
      }
    });
  }

  return (
    <Tabs defaultValue="dados">
      <TabsList>
        <TabsTrigger value="dados">Dados</TabsTrigger>
        <TabsTrigger value="full-days">Full Days</TabsTrigger>
      </TabsList>

      <TabsContent value="dados" className="space-y-6">
        <form onSubmit={enviar} noValidate className="space-y-5 rounded-xl border p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome completo</Label>
              <Input id="nome" aria-invalid={!!errors.nome} {...register("nome")} />
              {errors.nome ? <p className="text-destructive text-xs">{errors.nome.message}</p> : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" value={pessoa.email} disabled readOnly />
              <p className="text-muted-foreground text-xs">
                O e-mail de acesso é alterado pelo painel do Supabase.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Perfil de acesso</Label>
              {ehSocio ? (
                <Select value={role} onValueChange={(valor) => setValue("role", valor as Dados["role"])}>
                  <SelectTrigger id="role" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="colaborador">Colaborador</SelectItem>
                    <SelectItem value="desenvolvedor">Desenvolvedor</SelectItem>
                    <SelectItem value="socio">Sócio</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <>
                  <Input value={ROTULOS_DE_ROLE[pessoa.role]} disabled readOnly />
                  <p className="text-muted-foreground text-xs">
                    Apenas sócios alteram o perfil de acesso.
                  </p>
                </>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="cargo">Cargo</Label>
              <Input id="cargo" {...register("cargo")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="area">Área</Label>
              <Select value={area || undefined} onValueChange={(valor) => setValue("area", valor)}>
                <SelectTrigger id="area" className="w-full">
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
              <Label htmlFor="funcao">Função *</Label>
              <Select
                value={funcao || undefined}
                onValueChange={(valor) => setValue("funcao", valor, { shouldValidate: true })}
              >
                <SelectTrigger id="funcao" aria-invalid={!!errors.funcao} className="w-full">
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
                  Atendimento cria tasks mesmo com perfil de colaborador.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="data_admissao">Data de admissão</Label>
              <Input id="data_admissao" type="date" {...register("data_admissao")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dias_ferias_ano">Dias de descanso por ano</Label>
              <Input
                id="dias_ferias_ano"
                type="number"
                min={0}
                max={365}
                {...register("dias_ferias_ano", { valueAsNumber: true })}
              />
            </div>
          </div>

          <Button type="submit" disabled={salvando}>
            {salvando ? <Loader2 className="animate-spin" /> : null}
            Salvar alterações
          </Button>
        </form>

        {ehGestor && !ehVoceMesmo ? (
          <section className="space-y-3 rounded-xl border p-5">
            <div>
              <h2 className="text-sm font-semibold">Acesso à plataforma</h2>
              <p className="text-muted-foreground mt-1 text-sm">
                {desligada
                  ? "Esta pessoa não consegue entrar e não aparece nos seletores."
                  : "Desativar tira o acesso na hora e remove a pessoa dos seletores. As tasks antigas dela ficam como estão."}
              </p>
            </div>
            <ConfirmDialog
              trigger={
                <Button variant="outline" size="sm" disabled={salvando}>
                  <Power aria-hidden />
                  {desligada ? "Reativar acesso" : "Desativar acesso"}
                </Button>
              }
              title={desligada ? `Reativar ${pessoa.nome}?` : `Desativar ${pessoa.nome}?`}
              description={
                desligada
                  ? "A pessoa volta a entrar na plataforma e a aparecer nos seletores."
                  : "O acesso é revogado no mesmo instante e a pessoa sai dos seletores. Nada é apagado, e dá para reativar depois."
              }
              confirmLabel={desligada ? "Reativar" : "Desativar"}
              destructive={!desligada}
              onConfirm={alternarAcesso}
            />
          </section>
        ) : null}

        {ehSocio && !desligada && !ehVoceMesmo ? (
          <section className="border-destructive/30 space-y-4 rounded-xl border p-5">
            <div>
              <h2 className="text-destructive text-sm font-semibold">Zona de perigo</h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Desligar tira o acesso e remove a pessoa das listas, sem apagar nada do que ela fez.
              </p>
            </div>
            <Desligamento
              userId={pessoa.id}
              nome={pessoa.nome}
              vinculos={vinculos}
              equipeDisponivel={equipeDisponivel}
            />
          </section>
        ) : null}

        {desligada ? (
          <p className="text-muted-foreground text-sm">
            Esta pessoa está sem acesso
            {pessoa.membro?.desligado_em ? ` em ${pessoa.membro.desligado_em}` : ""}. Os registros
            antigos continuam com o nome dela.
          </p>
        ) : null}
      </TabsContent>


      <TabsContent value="full-days">
        {/* O módulo existe desde o Sprint 6; o que ainda não existe é o recorte
            de uma pessoa só dentro da ficha dela. Até lá, a aba manda para
            onde a informação está, em vez de prometer um sprint já entregue. */}
        <EmptyState
          icon={CalendarDays}
          title="O saldo e os pedidos desta pessoa ficam no Full Days"
          description="A matriz da equipe mostra os dias dela ao lado dos colegas da mesma área, que é o arranjo em que a informação decide alguma coisa."
          action={
            <Button asChild variant="outline" size="sm">
              <Link href="/painel/full-days?aba=matriz">Abrir o Full Days</Link>
            </Button>
          }
        />
      </TabsContent>
    </Tabs>
  );
}
