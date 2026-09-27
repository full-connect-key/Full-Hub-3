"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, MoreHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { chamarEMostrar } from "@/lib/acoes/cliente";
import type { ItemDoInventario } from "@/lib/dados/comodatos";
import {
  CAMPOS_DA_FICHA,
  ESTADOS,
  ROTULOS_DE_ESTADO,
  ROTULOS_DE_TIPO,
  TIPOS_DE_ASSET,
  temFichaTecnica,
} from "@/lib/dominio/comodatos";
import type { AssetEstado, AssetTipo } from "@/lib/supabase/database.types";

import { darBaixa, devolverEquipamento, emprestarEquipamento, mudarSituacao, salvarEquipamento } from "./acoes";
import { hojeNaAgencia } from "@/lib/dominio/datas";

const HOJE = () => hojeNaAgencia();

/**
 * Os diálogos da gestão.
 *
 * **Curtos de propósito.** Emprestar é uma coisa que se faz de pé, com a
 * pessoa esperando o notebook — um formulário de quinze campos vira um
 * formulário que ninguém preenche, e aí o empréstimo não fica registrado, que
 * é o problema que este módulo existe para resolver.
 */

export function DialogoDeEquipamento({
  aberto,
  aoFechar,
  item,
}: {
  aberto: boolean;
  aoFechar: () => void;
  item?: ItemDoInventario;
}) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [tipo, setTipo] = useState<AssetTipo>(item?.tipo ?? "notebook");
  const [estado, setEstado] = useState<AssetEstado>(item?.estado ?? "bom");

  // O TIPO É ESTADO, então a seção aparece e some enquanto a pessoa mexe no
  // seletor — sem salvar e reabrir para descobrir que os campos existiam.
  const mostrarFicha = temFichaTecnica(tipo, item ?? {});

  async function salvar(form: FormData) {
    setEnviando(true);
    const valor = String(form.get("valor_aquisicao") ?? "").replace(",", ".");
    const r = await chamarEMostrar(() =>
      salvarEquipamento({
        id: item?.id ?? null,
        tipo,
        estado,
        nome: String(form.get("nome") ?? ""),
        codigo: String(form.get("codigo") ?? ""),
        marca: String(form.get("marca") ?? ""),
        modelo: String(form.get("modelo") ?? ""),
        numero_serie: String(form.get("numero_serie") ?? ""),
        data_aquisicao: String(form.get("data_aquisicao") ?? ""),
        valor_aquisicao: valor === "" ? null : Number(valor),
        observacoes: String(form.get("observacoes") ?? ""),
        // A FICHA TÉCNICA VAI SEMPRE, e não só quando a seção está na tela:
        // `form.get` de um campo que não foi desenhado devolve null e vira
        // `""`, que `ouNulo` grava como null — apagando a ficha de quem mudou
        // o tipo. O `?? item?.…` é a rede; a outra metade é a seção aparecer
        // quando já há valor, e as duas moram em `temFichaTecnica()`.
        memoria_ram: String(form.get("memoria_ram") ?? item?.memoria_ram ?? ""),
        processador: String(form.get("processador") ?? item?.processador ?? ""),
        placa_de_video: String(form.get("placa_de_video") ?? item?.placa_de_video ?? ""),
        armazenamento: String(form.get("armazenamento") ?? item?.armazenamento ?? ""),
      }),
    );
    setEnviando(false);
    if (r.ok) {
      aoFechar();
      router.refresh();
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{item ? `Editar ${item.nome}` : "Cadastrar equipamento"}</DialogTitle>
          <DialogDescription>
            O código de patrimônio é gerado sozinho se você deixar em branco.
          </DialogDescription>
        </DialogHeader>

        <form action={salvar} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cmd-tipo">Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as AssetTipo)}>
                <SelectTrigger id="cmd-tipo" aria-label="Tipo do equipamento" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_DE_ASSET.map((t) => (
                    <SelectItem key={t} value={t}>
                      {ROTULOS_DE_TIPO[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cmd-estado">Estado</Label>
              <Select value={estado} onValueChange={(v) => setEstado(v as AssetEstado)}>
                <SelectTrigger id="cmd-estado" aria-label="Estado do equipamento" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ESTADOS.map((e) => (
                    <SelectItem key={e} value={e}>
                      {ROTULOS_DE_ESTADO[e]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Campo id="cmd-nome" nome="nome" rotulo="Nome" obrigatorio padrao={item?.nome} dica="MacBook Pro 14 M3" />

          <div className="grid gap-3 sm:grid-cols-2">
            <Campo id="cmd-marca" nome="marca" rotulo="Marca" padrao={item?.marca ?? ""} />
            <Campo id="cmd-modelo" nome="modelo" rotulo="Modelo" padrao={item?.modelo ?? ""} />
            <Campo id="cmd-serie" nome="numero_serie" rotulo="Número de série" padrao={item?.numero_serie ?? ""} />
            <Campo
              id="cmd-codigo"
              nome="codigo"
              rotulo="Código de patrimônio"
              padrao={item?.codigo ?? ""}
              dica="deixe em branco para gerar"
            />
            <Campo id="cmd-aquisicao" nome="data_aquisicao" rotulo="Data de aquisição" tipo="date" padrao={item?.data_aquisicao ?? ""} />
            <Campo
              id="cmd-valor"
              nome="valor_aquisicao"
              rotulo="Valor de aquisição"
              padrao={item?.valor_aquisicao?.toString() ?? ""}
              dica="só a gestão vê"
            />
          </div>

          {/* A FICHA TÉCNICA (0070), decisão do usuário.

              Ela aparece para computador e para todo equipamento que já tenha
              qualquer um dos quatro preenchido — as duas metades moram em
              `temFichaTecnica()`. Sem a segunda, trocar o tipo de um notebook
              para "Outro" esconderia os campos, e o próximo salvamento os
              gravaria vazios.

              **E ela é uma SEÇÃO com título**, e não mais quatro campos na
              grade de cima: ali ficariam ao lado de "Número de série" e "Valor
              de aquisição", que são de todo equipamento, e o cadastro de um
              tripé pareceria ter metade dos campos em branco por descuido. Com
              o título, a ausência num tripé se lê como "não se aplica". */}
          {mostrarFicha ? (
            <fieldset className="space-y-3 rounded-lg border p-3">
              <legend className="text-text-secondary px-1 text-xs font-medium">
                Configuração
              </legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {CAMPOS_DA_FICHA.map(({ chave, rotulo, dica }) => (
                  <Campo
                    key={chave}
                    id={`cmd-${chave}`}
                    nome={chave}
                    rotulo={rotulo}
                    padrao={item?.[chave] ?? ""}
                    dica={dica}
                  />
                ))}
              </div>
            </fieldset>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="cmd-obs">Observações</Label>
            <Textarea id="cmd-obs" name="observacoes" rows={2} defaultValue={item?.observacoes ?? ""} />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={aoFechar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={enviando}>
              {enviando ? <Loader2 className="animate-spin" /> : null}
              {item ? "Salvar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Campo({
  id,
  nome,
  rotulo,
  padrao,
  dica,
  tipo = "text",
  obrigatorio,
}: {
  id: string;
  nome: string;
  rotulo: string;
  padrao?: string;
  dica?: string;
  tipo?: string;
  obrigatorio?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{rotulo}</Label>
      <Input id={id} name={nome} type={tipo} defaultValue={padrao} required={obrigatorio} placeholder={dica} />
    </div>
  );
}

export function DialogoDeEmprestimo({
  aberto,
  aoFechar,
  disponiveis,
  equipe,
}: {
  aberto: boolean;
  aoFechar: () => void;
  disponiveis: ItemDoInventario[];
  equipe: { id: string; nome: string; funcao: string | null }[];
}) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [assetId, setAssetId] = useState("");
  const [userId, setUserId] = useState("");
  const [estado, setEstado] = useState<AssetEstado>("bom");

  async function emprestar(form: FormData) {
    setEnviando(true);
    const r = await chamarEMostrar(() =>
      emprestarEquipamento({
        asset_id: assetId,
        user_id: userId,
        data_entrega: String(form.get("data_entrega") ?? ""),
        data_prevista_devolucao: String(form.get("data_prevista_devolucao") ?? ""),
        estado_entrega: estado,
        acessorios: String(form.get("acessorios") ?? ""),
        observacoes_entrega: String(form.get("observacoes_entrega") ?? ""),
      }),
    );
    setEnviando(false);
    if (r.ok) {
      setAssetId("");
      setUserId("");
      aoFechar();
      router.refresh();
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Emprestar equipamento</DialogTitle>
          <DialogDescription>
            A pessoa recebe um aviso para confirmar o recebimento, e o termo fica disponível para
            os dois lados.
          </DialogDescription>
        </DialogHeader>

        <form action={emprestar} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="emp-asset">Equipamento</Label>
            {/* SÓ OS DISPONÍVEIS: oferecer um que está com outra pessoa daria
                um clique que o banco recusa pelo índice único — e a recusa
                chegaria depois de a pessoa ter preenchido o resto. */}
            <Select value={assetId} onValueChange={setAssetId}>
              <SelectTrigger id="emp-asset" aria-label="Equipamento a emprestar" className="w-full">
                <SelectValue placeholder="Escolha um disponível" />
              </SelectTrigger>
              <SelectContent>
                {disponiveis.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {[i.codigo, i.nome].filter(Boolean).join(" · ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {disponiveis.length === 0 ? (
              <p className="text-text-muted text-xs">
                Nenhum equipamento disponível — todos estão emprestados, em manutenção ou baixados.
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="emp-pessoa">Para quem</Label>
            {/* SÓ PESSOAS ATIVAS: entregar equipamento a quem saiu é o caso que
                o alerta do painel existe para gritar. */}
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger id="emp-pessoa" aria-label="Pessoa que vai receber" className="w-full">
                <SelectValue placeholder="Escolha alguém da equipe" />
              </SelectTrigger>
              <SelectContent>
                {equipe.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome}
                    {p.funcao ? ` · ${p.funcao}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Campo id="emp-entrega" nome="data_entrega" rotulo="Data de entrega" tipo="date" padrao={HOJE()} obrigatorio />
            <Campo
              id="emp-previsao"
              nome="data_prevista_devolucao"
              rotulo="Previsão de devolução"
              tipo="date"
              dica="em branco = indeterminado"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="emp-estado">Estado na entrega</Label>
            <Select value={estado} onValueChange={(v) => setEstado(v as AssetEstado)}>
              <SelectTrigger id="emp-estado" aria-label="Estado na entrega" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ESTADOS.map((e) => (
                  <SelectItem key={e} value={e}>
                    {ROTULOS_DE_ESTADO[e]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="emp-acessorios">Acessórios que vão junto</Label>
            <Input id="emp-acessorios" name="acessorios" placeholder="carregador, capa, mouse" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="emp-obs">Observações</Label>
            <Textarea id="emp-obs" name="observacoes_entrega" rows={2} />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={aoFechar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={enviando || !assetId || !userId}>
              {enviando ? <Loader2 className="animate-spin" /> : null}
              Entregar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Devolver, dar baixa, mandar para manutenção e editar — o que cada linha pede. */
export function AcoesDoItem({ item }: { item: ItemDoInventario }) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [devolvendo, setDevolvendo] = useState(false);
  const [baixando, setBaixando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [estado, setEstado] = useState<AssetEstado>("bom");
  const [motivo, setMotivo] = useState("");

  async function devolver(form: FormData) {
    if (!item.comodato) return;
    setEnviando(true);
    const r = await chamarEMostrar(() =>
      devolverEquipamento({
        loan_id: item.comodato!.id,
        data_devolucao: String(form.get("data_devolucao") ?? ""),
        estado_devolucao: estado,
        observacoes_devolucao: String(form.get("observacoes_devolucao") ?? ""),
      }),
    );
    setEnviando(false);
    if (r.ok) {
      setDevolvendo(false);
      router.refresh();
    }
  }

  async function baixar() {
    setEnviando(true);
    const r = await chamarEMostrar(() => darBaixa({ id: item.id, motivo }));
    setEnviando(false);
    if (r.ok) {
      setBaixando(false);
      setMotivo("");
      router.refresh();
    }
  }

  async function paraManutencao(destino: "manutencao" | "disponivel") {
    const r = await chamarEMostrar(() => mudarSituacao({ id: item.id, status: destino }));
    if (r.ok) router.refresh();
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Ações de ${item.nome}`}>
            <MoreHorizontal aria-hidden className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {/* A FOLHA VEM PRIMEIRO no menu porque ela é a única coisa aqui que
              não muda nada — e é a resposta de "por quantas mãos esta peça
              passou?", que é a pergunta que se faz antes de decidir as
              outras. */}
          <DropdownMenuItem asChild>
            <Link href={`/painel/comodatos/${item.id}`}>Ver a folha</Link>
          </DropdownMenuItem>
          {item.comodato ? (
            <DropdownMenuItem onSelect={() => setDevolvendo(true)}>
              Registrar devolução
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onSelect={() => setEditando(true)}>Editar</DropdownMenuItem>
          {item.status === "disponivel" ? (
            <DropdownMenuItem onSelect={() => paraManutencao("manutencao")}>
              Mandar para manutenção
            </DropdownMenuItem>
          ) : null}
          {item.status === "manutencao" ? (
            <DropdownMenuItem onSelect={() => paraManutencao("disponivel")}>
              Voltou da manutenção
            </DropdownMenuItem>
          ) : null}
          {item.status !== "baixado" ? (
            <DropdownMenuItem onSelect={() => setBaixando(true)}>Dar baixa</DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <DialogoDeEquipamento aberto={editando} aoFechar={() => setEditando(false)} item={item} />

      <Dialog open={devolvendo} onOpenChange={(v) => !v && setDevolvendo(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar a devolução de {item.nome}</DialogTitle>
            <DialogDescription>
              Se o estado for “Ruim”, o equipamento vai para manutenção em vez de voltar para a
              prateleira.
            </DialogDescription>
          </DialogHeader>

          <form action={devolver} className="space-y-3">
            <Campo id="dev-data" nome="data_devolucao" rotulo="Data da devolução" tipo="date" padrao={HOJE()} obrigatorio />

            <div className="space-y-1.5">
              <Label htmlFor="dev-estado">Estado na devolução</Label>
              <Select value={estado} onValueChange={(v) => setEstado(v as AssetEstado)}>
                <SelectTrigger id="dev-estado" aria-label="Estado na devolução" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ESTADOS.map((e) => (
                    <SelectItem key={e} value={e}>
                      {ROTULOS_DE_ESTADO[e]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dev-obs">Observações</Label>
              <Textarea id="dev-obs" name="observacoes_devolucao" rows={2} />
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setDevolvendo(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={enviando}>
                {enviando ? <Loader2 className="animate-spin" /> : null}
                Registrar devolução
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={baixando} onOpenChange={(v) => !v && setBaixando(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dar baixa em {item.nome}</DialogTitle>
            {/* BAIXA E NÃO EXCLUSÃO, e a frase diz por quê: o histórico é o que
                responde "onde foi parar", que é a pergunta que se faz sobre o
                que sumiu. O banco recusa o DELETE. */}
            <DialogDescription>
              Ele sai do inventário e o histórico dele fica. Diga por quê — perdido, vendido,
              sucateado.
            </DialogDescription>
          </DialogHeader>

          <Input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Vendido para…"
            aria-label="Motivo da baixa"
          />

          <DialogFooter>
            <Button variant="ghost" onClick={() => setBaixando(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={baixar} disabled={enviando || motivo.trim() === ""}>
              {enviando ? <Loader2 className="animate-spin" /> : null}
              Dar baixa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
