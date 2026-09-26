/** Versao de prototipo de src/lib/dados/acessos.ts. */
export async function ultimosAcessos(ids: string[]): Promise<Record<string, string | null>> {
  const exemplo: Record<string, string | null> = {
    "a0000000-0000-0000-0000-000000000004": "2026-09-19T14:32:00.000Z",
    "a0000000-0000-0000-0000-000000000006": null,
  };
  return Object.fromEntries(ids.map((id) => [id, exemplo[id] ?? null]));
}

/**
 * As visitas da equipe ao portal daquele cliente, no protótipo.
 *
 * Duas linhas e não zero: o bloco some quando a lista é vazia, e um protótipo
 * que nunca desenha a tela nova é um protótipo que não a verifica.
 */
export async function visitasAoPortal(clienteId: string) {
  if (clienteId !== "c0000000-0000-0000-0000-00000000000a") return [];
  return [
    { id: "v1", quem: "Ana Souza", quando: "2026-09-24T14:22:00.000Z" },
    { id: "v2", quem: "Diego Martins", quando: "2026-09-18T09:05:00.000Z" },
  ];
}
