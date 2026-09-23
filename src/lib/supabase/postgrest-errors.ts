/**
 * PostgREST şema önbelleğinde ilişki yok (migration uygulanmamış, yanlış isim vb.).
 * @see https://postgrest.org/en/stable/errors.html
 */
export function isPgrstRelationNotFound(
  error: unknown,
  relationSubstr: string
): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: string; message?: string };
  if (e.code !== "PGRST205") return false;
  return String(e.message ?? "").includes(relationSubstr);
}

/** PostgREST şema önbelleğinde RPC fonksiyonu yok (migration uygulanmamış). */
export function isPgrstFunctionNotFound(
  error: unknown,
  functionSubstr: string
): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: string; message?: string };
  if (e.code !== "PGRST202") return false;
  return String(e.message ?? "").includes(functionSubstr);
}
