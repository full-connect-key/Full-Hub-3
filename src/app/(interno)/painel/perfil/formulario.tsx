"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { criarClienteNavegador } from "@/lib/supabase/client";
import type { Profile } from "@/lib/supabase/database.types";

import { salvarMeuPerfil, trocarMinhaSenha } from "./acoes";
import { chamarAcao } from "@/lib/acoes/cliente";

const TAMANHO_MAXIMO = 2 * 1024 * 1024;
const TIPOS_ACEITOS = ["image/jpeg", "image/png", "image/webp"];

export function FormularioDoPerfil({ profile }: { profile: Profile }) {
  const [nome, setNome] = useState(profile.nome);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url);
  const [enviandoAvatar, setEnviandoAvatar] = useState(false);
  const [salvando, iniciar] = useTransition();
  const entradaDeArquivo = useRef<HTMLInputElement>(null);
  const router = useRouter();

  /**
   * O arquivo vai direto do navegador para o Storage. A política do bucket só
   * aceita escrita dentro da pasta com o id da própria pessoa — por isso o
   * caminho começa com o id.
   */
  async function enviarAvatar(arquivo: File) {
    if (!TIPOS_ACEITOS.includes(arquivo.type)) {
      toast.error("Use uma imagem JPG, PNG ou WebP.");
      return;
    }
    if (arquivo.size > TAMANHO_MAXIMO) {
      toast.error("A imagem precisa ter no máximo 2 MB.");
      return;
    }

    setEnviandoAvatar(true);
    try {
      const supabase = criarClienteNavegador();
      const extensao = arquivo.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const caminho = `${profile.id}/avatar-${Date.now()}.${extensao}`;

      const { error } = await supabase.storage
        .from("avatars")
        .upload(caminho, arquivo, { upsert: true, contentType: arquivo.type });

      if (error) {
        toast.error(`Não foi possível enviar: ${error.message}`);
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(caminho);

      const resultado = await chamarAcao(() => salvarMeuPerfil({ nome, avatar_url: publicUrl }));
      if (!resultado.ok) {
        toast.error(resultado.error);
        return;
      }

      setAvatarUrl(publicUrl);
      toast.success("Foto atualizada.");
      router.refresh();
    } finally {
      setEnviandoAvatar(false);
    }
  }

  function salvarNome(evento: React.FormEvent) {
    evento.preventDefault();
    iniciar(async () => {
      const resultado = await chamarAcao(() => salvarMeuPerfil({ nome }));
      if (!resultado.ok) toast.error(resultado.error);
      else {
        toast.success(resultado.mensagem);
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={salvarNome} className="space-y-6 rounded-xl border p-5">
      <div className="flex flex-wrap items-center gap-4">
        <UserAvatar name={nome || profile.nome} src={avatarUrl} size="lg" />
        <div>
          <input
            ref={entradaDeArquivo}
            type="file"
            accept={TIPOS_ACEITOS.join(",")}
            className="sr-only"
            onChange={(evento) => {
              const arquivo = evento.target.files?.[0];
              if (arquivo) void enviarAvatar(arquivo);
              evento.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => entradaDeArquivo.current?.click()}
            disabled={enviandoAvatar}
          >
            {enviandoAvatar ? <Loader2 className="animate-spin" /> : <Upload aria-hidden />}
            Trocar foto
          </Button>
          <p className="text-muted-foreground mt-1.5 text-xs">JPG, PNG ou WebP, até 2 MB.</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="meu-nome">Nome</Label>
        <Input
          id="meu-nome"
          value={nome}
          onChange={(evento) => setNome(evento.target.value)}
          maxLength={120}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="meu-email">E-mail</Label>
        <Input id="meu-email" value={profile.email} disabled readOnly />
      </div>

      <Button type="submit" disabled={salvando}>
        {salvando ? <Loader2 className="animate-spin" /> : null}
        Salvar
      </Button>
    </form>
  );
}

export function TrocaDeSenha() {
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [salvando, iniciar] = useTransition();

  function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    iniciar(async () => {
      const resultado = await chamarAcao(() => trocarMinhaSenha(senha, confirmacao));
      if (!resultado.ok) toast.error(resultado.error);
      else {
        toast.success(resultado.mensagem);
        setSenha("");
        setConfirmacao("");
      }
    });
  }

  return (
    <form onSubmit={enviar} className="space-y-4 rounded-xl border p-5">
      <div>
        <h2 className="text-sm font-semibold">Trocar senha</h2>
        <p className="text-muted-foreground mt-0.5 text-sm">Use pelo menos 8 caracteres.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="nova-senha">Nova senha</Label>
          <Input
            id="nova-senha"
            type="password"
            autoComplete="new-password"
            value={senha}
            onChange={(evento) => setSenha(evento.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirma-senha">Confirme a nova senha</Label>
          <Input
            id="confirma-senha"
            type="password"
            autoComplete="new-password"
            value={confirmacao}
            onChange={(evento) => setConfirmacao(evento.target.value)}
          />
        </div>
      </div>

      <Button type="submit" disabled={salvando || senha.length < 8}>
        {salvando ? <Loader2 className="animate-spin" /> : null}
        Trocar senha
      </Button>
    </form>
  );
}
