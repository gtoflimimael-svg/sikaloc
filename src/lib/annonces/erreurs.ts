/**
 * Les refus de la base, dits au bailleur.
 *
 * ─── Pourquoi la base parle en premier ─────────────────────────────────────
 *
 * Les règles de publication vivent dans les déclencheurs et contraintes de S1 :
 * une photo au moins, pas de bail actif incompatible, des champs complets. Les
 * refaire ici en TypeScript les ferait diverger un jour. On laisse donc la base
 * refuser, et ce module traduit son refus.
 *
 * ─── Ce qui ne remonte jamais ──────────────────────────────────────────────
 *
 * Ni SQLSTATE, ni nom de contrainte, ni texte PostgreSQL. L'erreur d'origine
 * part dans les journaux du serveur ; le bailleur reçoit une phrase qui dit
 * quoi faire.
 */

export const MESSAGES_ANNONCE = {
  non_autorise: 'Votre session a expiré. Reconnectez-vous pour continuer.',
  acces_refuse: 'Vous n’avez pas accès à cette annonce.',
  introuvable: 'Cette annonce est introuvable.',
  logement_introuvable: 'Ce logement est introuvable.',
  deja_existante: 'Ce logement a déjà une annonce en cours : ouvrez-la plutôt que d’en créer une autre.',
  cloturee: 'Cette annonce est clôturée : elle ne se modifie plus et ne se rouvre pas. Créez-en une nouvelle pour ce logement.',
  sans_photo: 'Ajoutez au moins une photo avant de publier.',
  bail_actif:
    'Ce logement a un bail en cours. Pour le publier, ce bail doit avoir une date de fin, et la date de disponibilité doit tomber après elle.',
  incomplete:
    'Pour publier, renseignez le quartier, le nombre de chambres, le loyer et une description d’au moins 20 caractères.',
  derniere_photo:
    'Une annonce publiée garde au moins une photo : ajoutez-en une autre avant de retirer celle-ci.',
  suppression_publiee: 'Seul un brouillon se supprime. Une annonce publiée se clôture.',
  brouillon_non_cloturable: 'Un brouillon n’a jamais été publié : il ne se clôture pas, il se supprime.',
  hors_limites: 'Une des valeurs saisies sort des limites autorisées. Vérifiez les champs.',
  statut_change: 'Cette annonce a changé entre-temps. Rechargez la page.',
  echec: 'L’enregistrement a échoué. Réessayez dans un instant.',
} as const

export type CleMessageAnnonce = keyof typeof MESSAGES_ANNONCE

type ErreurBase = { code?: string; message?: string } | null | undefined

/**
 * Les messages levés par les déclencheurs de S1, et les noms de contraintes
 * que PostgreSQL cite. Tous tirés de la migration 20260919000100 : s'ils y
 * changent, le banc de gestion le signale.
 */
const REGLES: [(e: { code: string; message: string }) => boolean, CleMessageAnnonce][] = [
  [(e) => e.code === '23505' && e.message.includes('annonces_une_vivante_par_logement'), 'deja_existante'],
  [(e) => e.message.includes('sans au moins une photo'), 'sans_photo'],
  [(e) => e.message.includes('a un bail actif'), 'bail_actif'],
  [(e) => e.message.includes('ne se rouvre pas'), 'cloturee'],
  [(e) => e.message.includes('annonces_complete_hors_brouillon'), 'incomplete'],
  [(e) => e.message.includes('garde au moins une photo'), 'derniere_photo'],
  [(e) => e.message.includes('Seul un brouillon se supprime'), 'suppression_publiee'],
  [(e) => e.message.includes('n\'appartient pas à ce bailleur'), 'logement_introuvable'],
  [(e) => e.code === '42501', 'acces_refuse'],
  [(e) => e.code === '23514' || e.code === '22P02' || e.code === '22003', 'hors_limites'],
]

export function cleErreurAnnonce(erreur: ErreurBase): CleMessageAnnonce {
  const e = { code: erreur?.code ?? '', message: erreur?.message ?? '' }
  return REGLES.find(([test]) => test(e))?.[1] ?? 'echec'
}

/** La phrase montrable. L'erreur d'origine est journalisée, jamais renvoyée. */
export function traduireErreurAnnonce(erreur: ErreurBase): string {
  const cle = cleErreurAnnonce(erreur)
  if (cle === 'echec' || cle === 'hors_limites') {
    console.error('[annonces] refus de la base', erreur?.code, erreur?.message)
  }
  return MESSAGES_ANNONCE[cle]
}
