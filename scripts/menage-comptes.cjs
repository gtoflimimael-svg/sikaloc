/**
 * Le ménage des bancs, garanti et honnête.
 *
 * ─── Ce que cela résout ─────────────────────────────────────────────────────
 *
 * Les bancs rangeaient leurs comptes à la FIN de leur corps `try`. Une
 * assertion qui lève, un `await` qui rejette, et le rangement était sauté : les
 * comptes — et leurs annonces, visibles de tous — restaient. En S8-D, ces
 * restes ont fait échouer `find-recherche`, qui compte les annonces publiées :
 * une fausse régression, née d'un banc précédent interrompu.
 *
 * ─── Le principe ────────────────────────────────────────────────────────────
 *
 *   corps du banc
 *        ↓  (succès OU exception)
 *   rangerComptes()  ← toujours exécuté, et attendu avant de sortir
 *
 * `rangerComptes` est branché à deux endroits : la fin normale du corps, et le
 * `.catch` de l'IIFE. Il est idempotent — supprimer un compte déjà parti ne
 * coûte rien — donc l'appeler deux fois est sans danger.
 *
 * ─── Un échec de ménage ne se tait pas ──────────────────────────────────────
 *
 * Si un compte refuse de partir, on le DIT, en le nommant. Masquer un reste
 * silencieusement, c'est préparer la prochaine fausse régression.
 */

/**
 * Supprime des comptes de test et le contenu qu'ils ont déposé.
 *
 * @param {object} admin  client Supabase à la clé de service.
 * @param {string[]} ids  identifiants de comptes créés par le banc.
 * @param {object} [options]
 * @param {string} [options.bucket='annonces']  bucket où les comptes déposent.
 * @returns {Promise<string[]>} les identifiants qui n'ont PAS pu être supprimés.
 */
async function rangerComptes(admin, ids, options = {}) {
  const bucket = options.bucket ?? 'annonces'
  const restes = []
  // Un ensemble : le corps du banc et le `.catch` peuvent tous deux appeler,
  // et un même identifiant peut figurer deux fois dans la liste.
  const uniques = [...new Set((ids ?? []).filter(Boolean))]

  for (const id of uniques) {
    try {
      // Le coffre d'abord : supprimer le compte n'efface pas ses fichiers.
      const { data: dossiers } = await admin.storage.from(bucket).list(id, { limit: 100 })
      for (const dossier of dossiers ?? []) {
        const { data: fichiers } = await admin.storage.from(bucket).list(`${id}/${dossier.name}`)
        if (fichiers?.length) {
          await admin.storage
            .from(bucket)
            .remove(fichiers.map((f) => `${id}/${dossier.name}/${f.name}`))
        }
      }
      const { error } = await admin.auth.admin.deleteUser(id)
      // « User not found » : déjà rangé (double appel). Ce n'est pas un reste.
      if (error && !/not found/i.test(error.message)) restes.push(id)
    } catch {
      restes.push(id)
    }
  }

  if (restes.length) {
    console.error(
      `\n  ⚠ ${restes.length} compte(s) de test n'ont pas pu être rangés — ` +
        `à supprimer à la main pour éviter une fausse régression :\n    ${restes.join('\n    ')}\n`,
    )
  }
  return restes
}

module.exports = { rangerComptes }
