/** Versao de prototipo de src/lib/dados/acessos.ts. */
export async function ultimosAcessos(ids: string[]): Promise<Record<string, string | null>> {
  const exemplo: Record<string, string | null> = {
    "a0000000-0000-0000-0000-000000000004": "2026-09-19T14:32:00.000Z",
    "a0000000-0000-0000-0000-000000000006": null,
  };
  return Object.fromEntries(ids.map((id) => [id, exemplo[id] ?? null]));
}
