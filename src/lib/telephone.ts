/**
 * Les numéros de téléphone béninois — une seule source pour tout Sikaloc.
 *
 * ─── Ce que le Bénin a changé en 2024 ───────────────────────────────────────
 *
 * Les numéros sont passés de 8 à 10 chiffres, en préfixant les anciens de
 * « 01 ». Les deux formes coexistent donc dans les données :
 *
 *     90459821      ancien, 8 chiffres
 *     0190459821    actuel, 10 chiffres — le même abonné
 *
 * La saisie n'accepte plus que la forme actuelle. La lecture, elle, doit
 * continuer de comprendre l'ancienne : un numéro enregistré il y a six mois ne
 * doit pas devenir illisible.
 *
 * ─── Deux représentations, jamais confondues ────────────────────────────────
 *
 *     canonique   +2290190459821     ce qui est stocké et transmis
 *     affichage   +229 01 90 45 98 21   ce qu'on montre
 *
 * Les espaces sont de la présentation. Les stocker obligerait chaque
 * comparaison, chaque recherche et chaque appel d'API à les retirer d'abord —
 * et quelqu'un finirait par l'oublier.
 */

export const INDICATIF = '229'
export const INDICATIF_AFFICHE = '+229'
/** Longueur nationale depuis la réforme de 2024. */
export const LONGUEUR_NATIONALE = 10
/** Longueur d'avant la réforme, encore présente dans les données. */
export const LONGUEUR_ANCIENNE = 8

/**
 * Extrait les chiffres nationaux, quelle que soit la forme d'entrée.
 *
 * Accepte `+2290190459821`, `00229 01 90…`, `0190459821`, `229-0190459821`,
 * et même un `+229` collé deux fois — cas réel quand on colle dans un champ qui
 * en affiche déjà un.
 *
 * Rend `null` si rien d'exploitable n'en sort. Jamais une chaîne vide : un
 * appelant qui teste `if (national)` doit pouvoir distinguer « absent » de
 * « zéro chiffre ».
 */
export function chiffresNationaux(saisie: string): string | null {
  if (!saisie) return null

  let chiffres = saisie.replace(/\D/g, '')
  if (!chiffres) return null

  // Préfixe international, sous ses formes possibles, éventuellement répété.
  // `+229+2290190459821` arrive vraiment quand on colle dans un champ préfixé.
  let precedent = ''
  while (chiffres !== precedent) {
    precedent = chiffres
    if (chiffres.startsWith(`00${INDICATIF}`)) chiffres = chiffres.slice(2 + INDICATIF.length)
    else if (chiffres.startsWith(INDICATIF) && chiffres.length > LONGUEUR_ANCIENNE) {
      chiffres = chiffres.slice(INDICATIF.length)
    }
  }

  return chiffres || null
}

/**
 * La forme stockée et transmise : `+2290190459821`.
 *
 * Un numéro à 8 chiffres est préfixé de « 01 », comme l'a fait l'opérateur en
 * 2024. C'est une transformation déterministe : le même abonné, écrit selon le
 * plan de numérotation en vigueur.
 *
 * Rend `null` si le résultat n'a pas une longueur plausible — mieux vaut ne
 * rien rendre qu'un numéro inventé.
 */
export function normaliserTelephone(saisie: string): string | null {
  const national = chiffresNationaux(saisie)
  if (!national) return null

  const complet =
    national.length === LONGUEUR_ANCIENNE ? `01${national}` : national

  if (complet.length !== LONGUEUR_NATIONALE) return null

  return `${INDICATIF_AFFICHE}${complet}`
}

/**
 * La forme montrée : `+229 01 90 45 98 21`.
 *
 * Tolérante : elle formate ce qu'elle peut, même un numéro incomplet en cours
 * de frappe. C'est ce qui permet de l'utiliser pendant la saisie.
 */
export function formaterTelephone(saisie: string): string {
  const national = chiffresNationaux(saisie)
  if (!national) return INDICATIF_AFFICHE

  const paires = national.slice(0, LONGUEUR_NATIONALE).match(/\d{1,2}/g) ?? []
  return `${INDICATIF_AFFICHE} ${paires.join(' ')}`.trimEnd()
}

/** Les chiffres nationaux seuls, bornés — ce que le champ de saisie manipule. */
export function chiffresSaisis(saisie: string): string {
  return (chiffresNationaux(saisie) ?? '').slice(0, LONGUEUR_NATIONALE)
}

export type MotifTelephone = 'vide' | 'trop_court' | 'trop_long' | 'invalide'

export const MESSAGES_TELEPHONE: Record<MotifTelephone, string> = {
  vide: 'Le numéro de téléphone est obligatoire.',
  trop_court: `Un numéro béninois compte ${LONGUEUR_NATIONALE} chiffres après l’indicatif.`,
  trop_long: `Un numéro béninois compte ${LONGUEUR_NATIONALE} chiffres après l’indicatif.`,
  invalide: 'Ce numéro ne semble pas valide. Vérifiez les chiffres saisis.',
}

/**
 * Le verdict, côté serveur comme côté navigateur.
 *
 * Le navigateur s'en sert pour guider la frappe ; le serveur pour décider. Une
 * requête forgée qui contournerait le formulaire passe par la même fonction.
 *
 * `tolererAncien` accepte les 8 chiffres d'avant 2024 : utile pour relire des
 * données existantes, jamais pour une saisie.
 */
export function validerTelephone(
  saisie: string | null | undefined,
  options: { obligatoire?: boolean; tolererAncien?: boolean } = {},
): { valide: boolean; motif?: MotifTelephone; canonique?: string } {
  const brut = (saisie ?? '').trim()

  if (!brut) {
    return options.obligatoire ? { valide: false, motif: 'vide' } : { valide: true }
  }

  // Une lettre au milieu n'est pas une coquille de présentation : on refuse
  // plutôt que de la retirer en silence et d'accepter un numéro tronqué.
  if (/[a-z]/i.test(brut)) return { valide: false, motif: 'invalide' }

  const national = chiffresNationaux(brut)
  if (!national) return { valide: false, motif: 'invalide' }

  const longueurs = options.tolererAncien
    ? [LONGUEUR_NATIONALE, LONGUEUR_ANCIENNE]
    : [LONGUEUR_NATIONALE]

  if (!longueurs.includes(national.length)) {
    return {
      valide: false,
      motif: national.length < LONGUEUR_NATIONALE ? 'trop_court' : 'trop_long',
    }
  }

  const canonique = normaliserTelephone(brut)
  if (!canonique) return { valide: false, motif: 'invalide' }

  return { valide: true, canonique }
}
