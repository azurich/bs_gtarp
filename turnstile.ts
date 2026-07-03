/* ============================================================
   Cloudflare Turnstile — vérification serveur (pur, testable)
   Aucune dépendance au serveur/DB/env : la clé secrète est passée
   en argument. Import sans effet de bord.
============================================================ */

const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

/**
 * Valide un token Turnstile auprès de Cloudflare.
 * Fail-closed : toute absence de token, erreur réseau, timeout ou réponse
 * non conforme renvoie `false`.
 */
export async function verifyTurnstile(secret: string, token: string, ip?: string): Promise<boolean> {
  if (!token) return false
  try {
    const form = new URLSearchParams({ secret, response: token })
    if (ip) form.set('remoteip', ip)
    const res = await fetch(SITEVERIFY, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: form,
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return false
    const data = await res.json() as { success?: boolean }
    return data.success === true
  } catch {
    return false
  }
}
