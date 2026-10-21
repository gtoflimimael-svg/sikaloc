/**
 * Longueur du code de confirmation email émis par Supabase Auth.
 * Les projets peuvent différer ; par défaut, le contrat historique reste 6.
 */
export const LONGUEUR_CODE_EMAIL_DEFAUT = 6
export const LONGUEUR_CODE_EMAIL_MIN = 6
export const LONGUEUR_CODE_EMAIL_MAX = 10

export function lireLongueurCodeEmail(valeur: string | undefined): number {
  if (valeur === undefined || valeur === '') return LONGUEUR_CODE_EMAIL_DEFAUT
  if (!/^\d+$/.test(valeur)) {
    throw new Error('NEXT_PUBLIC_EMAIL_OTP_LENGTH doit être un entier de 6 à 10.')
  }

  const longueur = Number(valeur)
  if (
    !Number.isSafeInteger(longueur) ||
    String(longueur) !== valeur ||
    longueur < LONGUEUR_CODE_EMAIL_MIN ||
    longueur > LONGUEUR_CODE_EMAIL_MAX
  ) {
    throw new Error('NEXT_PUBLIC_EMAIL_OTP_LENGTH doit être un entier de 6 à 10.')
  }
  return longueur
}

export const LONGUEUR_CODE_EMAIL = lireLongueurCodeEmail(
  process.env.NEXT_PUBLIC_EMAIL_OTP_LENGTH,
)

export type ErreurFormatCodeEmail =
  | 'code_absent'
  | 'code_incomplet'
  | 'code_trop_long'
  | 'code_format_invalide'

export type VerdictCodeEmail =
  | { ok: true; code: string }
  | { ok: false; motif: ErreurFormatCodeEmail }

/** Valide sans normaliser : les zéros initiaux et chaque caractère sont conservés. */
export function validerCodeEmail(
  valeur: unknown,
  longueur = LONGUEUR_CODE_EMAIL,
): VerdictCodeEmail {
  if (typeof valeur !== 'string' || valeur.length === 0) {
    return { ok: false, motif: 'code_absent' }
  }
  if (!/^\d+$/.test(valeur)) {
    return { ok: false, motif: 'code_format_invalide' }
  }
  if (valeur.length < longueur) {
    return { ok: false, motif: 'code_incomplet' }
  }
  if (valeur.length > longueur) {
    return { ok: false, motif: 'code_trop_long' }
  }
  return { ok: true, code: valeur }
}

export const MESSAGES_FORMAT_CODE_EMAIL: Record<ErreurFormatCodeEmail, string> = {
  code_absent: 'Saisissez le code reçu par email.',
  code_incomplet: `Le code est incomplet : saisissez les ${LONGUEUR_CODE_EMAIL} chiffres reçus.`,
  code_trop_long: `Le code contient trop de chiffres : il en faut ${LONGUEUR_CODE_EMAIL}.`,
  code_format_invalide: 'Le code doit contenir uniquement des chiffres.',
}
