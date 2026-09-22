"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Power, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
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

import { chamarAcao } from "@/lib/acoes/cliente";

import { alternarAtivoDoCliente, excluirCliente } from "../acoes";

/**
 * Zona de perigo do cliente.
 *
 * Desativar é a ação normal — o histórico da conta precisa sobreviver.
 * Excluir de verdade é exceção: só sócio, em duas etapas, e bloqueada quando
 * existe QUALQUER vínculo — acesso ao portal, task, campanha, post ou
 * lançamento. Sobra para empresa recém-criada e vazia, cadastrada por engano.
 */
export function ZonaDePerigoDoCliente({
  clienteId,
  nomeDaEmpresa,
  ativo,
  ehSocio,
  vinculos,
}: {
  clienteId: string;
  nomeDaEmpresa: string;
  ativo: boolean;
  ehSocio: boolean;
  vinculos: {
    usuarios: number;
    tasks: number;
    campanhas: number;
    posts: number;
    lancamentos: number;
    total: number;
    impedeExclusao: boolean;
  };
}) {
  const [, iniciar] = useTransition();
  const [primeiraEtapa, setPrimeiraEtapa] = useState(false);
  const router = useRouter();

  function alternar() {
    iniciar(async () => {
      const resultado = await chamarAcao(() =>
        alternarAtivoDoCliente({ id: clienteId, ativo: !ativo }),
      );
      if (!resultado.ok) toast.error(resultado.error);
      else {
        toast.success(resultado.mensagem);
        router.refresh();
      }
    });
  }

  function excluir(nomeDigitado: string) {
    iniciar(async () => {
      const resultado = await chamarAcao(() =>
        excluirCliente({ id: clienteId, nome_digitado: nomeDigitado }),
      );
      if (!resultado.ok) toast.error(resultado.error);
      else {
        toast.success(resultado.mensagem);
        router.push("/painel/clientes");
      }
    });
  }

  return (
    <section className="border-destructive/30 space-y-4 rounded-xl border p-5">
      <div>
        <h2 className="text-destructive text-sm font-semibold">Zona de perigo</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Desativar é o caminho normal quando um cliente sai: nada é apagado e reativar é um clique.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ConfirmDialog
          trigger={
            <Button variant="outline" size="sm">
              <Power aria-hidden />
              {ativo ? "Desativar cliente" : "Reativar cliente"}
            </Button>
          }
          title={ativo ? `Desativar ${nomeDaEmpresa}?` : `Reativar ${nomeDaEmpresa}?`}
          description={
            ativo
              ? "A empresa sai das listas ativas e dos seletores. Nenhum dado é apagado, e os acessos ao portal continuam registrados."
              : "A empresa volta a aparecer nas listas ativas."
          }
          confirmLabel={ativo ? "Desativar" : "Reativar"}
          onConfirm={alternar}
        />

        {ehSocio ? (
          <Dialog open={primeiraEtapa} onOpenChange={setPrimeiraEtapa}>
            <DialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 aria-hidden />
                Excluir definitivamente
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Excluir {nomeDaEmpresa}?</DialogTitle>
                <DialogDescription>
                  Isso apaga a empresa do banco. Não dá para desfazer.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                <p className="text-sm font-medium">O que está vinculado a esta empresa:</p>
                <ul className="text-muted-foreground space-y-1 text-sm">
                  <li>{vinculos.usuarios} acesso(s) ao portal</li>
                  <li>{vinculos.tasks} task(s)</li>
                  <li>{vinculos.campanhas} campanha(s)</li>
                  <li>{vinculos.posts} post(s)</li>
                  <li>{vinculos.lancamentos} lançamento(s) financeiro(s)</li>
                </ul>

                {vinculos.impedeExclusao ? (
                  <Alert variant="destructive">
                    <AlertTriangle />
                    <AlertDescription>
                      Existe conteúdo vinculado a esta empresa. Excluir apagaria esse histórico —
                      desative a empresa em vez de excluir. Ela sai das listas e dos seletores, e
                      nada é perdido.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert variant="warning">
                    <AlertTriangle />
                    <AlertDescription>
                      Esta empresa está vazia, então a exclusão é permitida. Na próxima etapa você
                      vai precisar digitar o nome dela.
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setPrimeiraEtapa(false)}>
                  Cancelar
                </Button>
                {!vinculos.impedeExclusao ? (
                  <ConfirmDialog
                    trigger={<Button variant="destructive">Continuar</Button>}
                    title="Confirme o nome da empresa"
                    description="Esta é a última etapa. Depois disso o registro é apagado."
                    confirmLabel="Excluir definitivamente"
                    confirmationText={nomeDaEmpresa}
                    destructive
                    onConfirm={() => {
                      setPrimeiraEtapa(false);
                      excluir(nomeDaEmpresa);
                    }}
                  />
                ) : null}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>

      {!ehSocio ? (
        <p className="text-muted-foreground text-xs">
          Apenas sócios podem excluir um cliente definitivamente.
        </p>
      ) : null}
    </section>
  );
}
