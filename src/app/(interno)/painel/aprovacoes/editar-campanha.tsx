"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { chamarEMostrar } from "@/lib/acoes/cliente";
import { ROTULO_DA_CAMPANHA } from "@/lib/dominio/campanhas";
import type { CampaignStatus } from "@/lib/supabase/database.types";

import { editarCampanha } from "./acoes-de-campanha";

const ESTADOS: CampaignStatus[] = [
  "planejamento",
  "ativa",
  "finalizada",
  "cancelada",
];

/**
 * Editar a campanha depois de aberta — decisão do usuário.
 *
 * ---------------------------------------------------------------------------
 * **A EMPRESA NÃO ESTÁ AQUI, e é a única ausência que é trava.**
 *
 * `abrir_campanha()` (0051) cria a demanda com o mesmo `client_id`, e a
 * visibilidade de cada peça no portal sai dali: trocar a empresa deixaria a
 * demanda apontando para a antiga e as peças já enviadas visíveis para quem
 * não as pediu. O campo que não existe não volta no dia em que alguém copiar
 * este formulário — e, de qualquer forma, o trigger da 0078 recusa.
 *
 * **É DIÁLOGO E NÃO EDIÇÃO NO LUGAR**, ao contrário da tela de task, que salva
 * campo a campo. Lá o rascunho é de quem o criou e não existe para mais
 * ninguém; aqui cada salvamento parcial muda o que o cliente lê no portal
 * dele, e um período invertido salvo por um instante é um período que alguém
 * pode ter aberto. É a decisão do editor de recorrência, pela mesma razão.
 *
 * **O período é conferido aqui E no banco.** Esta checagem escreve a frase; o
 * `check` de `campaigns` é a que vale.
 * ---------------------------------------------------------------------------
 */
export function EditarCampanha({
  campanhaId,
  nome,
  descricao,
  dataInicio,
  dataFim,
  status,
  /** Quantas folhas já estão aprovadas — para o aviso do estado automático. */
  tudoAprovado,
}: {
  campanhaId: string;
  nome: string;
  descricao: string | null;
  dataInicio: string;
  dataFim: string;
  status: CampaignStatus;
  tudoAprovado: boolean;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [salvando, salvar] = useTransition();

  const [form, setForm] = useState({
    nome,
    descricao: descricao ?? "",
    dataInicio,
    dataFim,
    status,
  });

  // O ESTADO DO FORMULÁRIO VOLTA AO ABRIR, e não fica de uma vez para a
  // outra: quem fecha sem salvar está desistindo, e reabrir com o que foi
  // digitado e descartado mostraria um valor que não está no banco.
  function abrir(valor: boolean) {
    if (valor) {
      setForm({ nome, descricao: descricao ?? "", dataInicio, dataFim, status });
    }
    setAberto(valor);
  }

  const periodoInvertido = form.dataFim < form.dataInicio;

  function enviar() {
    salvar(async () => {
      const r = await chamarEMostrar(() => editarCampanha(campanhaId, form));
      if (r.ok) {
        setAberto(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={aberto} onOpenChange={abrir}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Pencil aria-hidden className="size-4" />
          Editar campanha
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar campanha</DialogTitle>
          <DialogDescription>
            O nome aparece no board da agência e no portal do cliente. A empresa
            não se troca — campanha de outra conta é campanha nova.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="campanha-nome">Nome</Label>
            <Input
              id="campanha-nome"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="campanha-inicio">Início</Label>
              <Input
                id="campanha-inicio"
                type="date"
                value={form.dataInicio}
                onChange={(e) =>
                  setForm({ ...form, dataInicio: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="campanha-fim">Encerramento</Label>
              <Input
                id="campanha-fim"
                type="date"
                value={form.dataFim}
                onChange={(e) => setForm({ ...form, dataFim: e.target.value })}
              />
            </div>
          </div>

          {periodoInvertido ? (
            <p className="text-warning text-sm" role="status">
              O encerramento não pode ser antes do início.
            </p>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="campanha-status">Estado</Label>
            <Select
              value={form.status}
              onValueChange={(v) =>
                setForm({ ...form, status: v as CampaignStatus })
              }
            >
              <SelectTrigger
                aria-label="Estado da campanha"
                id="campanha-status"
                className="w-full"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ESTADOS.map((e) => (
                  <SelectItem key={e} value={e}>
                    {ROTULO_DA_CAMPANHA[e]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* O AVISO SÓ APARECE QUANDO ELE VALE. A campanha se finaliza e se
                reabre sozinha pelas peças (0051), então marcar "Ativa" numa
                com tudo aprovado é uma escolha que o trigger desfaz na próxima
                escrita. Dizer isso sempre seria um aviso permanente sobre algo
                que quase nunca acontece — e aviso permanente é aviso que a
                pessoa aprende a não ler. */}
            {tudoAprovado ? (
              <p className="text-text-muted text-xs">
                Com todas as peças aprovadas, o Full Hub marca a campanha como
                finalizada sozinho — e devolve para ativa quando alguma voltar
                para produção.
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="campanha-descricao">Descrição</Label>
            <Textarea
              id="campanha-descricao"
              rows={3}
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setAberto(false)}
            disabled={salvando}
          >
            Cancelar
          </Button>
          <Button
            onClick={enviar}
            disabled={salvando || form.nome.trim().length < 2 || periodoInvertido}
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
