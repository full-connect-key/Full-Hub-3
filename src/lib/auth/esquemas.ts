import { z } from "zod";

/**
 * Validacao dos formularios de autenticacao.
 *
 * Os mesmos esquemas rodam no navegador (react-hook-form, para o erro aparecer
 * enquanto a pessoa digita) e no servidor (nas actions). Validar so no
 * navegador nao vale nada: qualquer um consegue mandar um pedido direto.
 */

const email = z
  .string()
  .min(1, "Informe seu e-mail.")
  .email("Esse e-mail não parece válido.");

const senha = z.string().min(1, "Informe sua senha.");

export const esquemaDeLogin = z.object({
  email,
  senha,
});

export const esquemaDeRecuperacao = z.object({
  email,
});

export const esquemaDeNovaSenha = z
  .object({
    senha: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres."),
    confirmacao: z.string().min(1, "Repita a senha."),
  })
  .refine((dados) => dados.senha === dados.confirmacao, {
    message: "As duas senhas não são iguais.",
    path: ["confirmacao"],
  });

export type DadosDeLogin = z.infer<typeof esquemaDeLogin>;
export type DadosDeRecuperacao = z.infer<typeof esquemaDeRecuperacao>;
export type DadosDeNovaSenha = z.infer<typeof esquemaDeNovaSenha>;
