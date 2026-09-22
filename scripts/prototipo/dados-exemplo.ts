/**
 * Dados de exemplo usados APENAS na geracao de prototipos.
 *
 * A cada sprint, adicione aqui as linhas ficticias do modulo novo. E o unico
 * arquivo que precisa crescer para as telas novas aparecerem nas imagens.
 *
 * Nada daqui entra no app publicado: o gerador de prototipos trabalha sobre
 * uma copia temporaria do projeto (veja scripts/prototipo.mjs).
 */

export const PERFIL_EXEMPLO = {
  id: "00000000-0000-0000-0000-000000000000",
  nome_completo: "Ana Souza",
  email: "ana@suaagencia.com.br",
  cargo: "Diretora de contas",
  avatar_url: null,
  papel: "admin" as const,
  ativo: true,
  criado_em: "2026-01-15T10:00:00.000Z",
  atualizado_em: "2026-01-15T10:00:00.000Z",
};

export const USUARIO_EXEMPLO = {
  id: PERFIL_EXEMPLO.id,
  email: PERFIL_EXEMPLO.email,
  user_metadata: { nome_completo: PERFIL_EXEMPLO.nome_completo },
};
