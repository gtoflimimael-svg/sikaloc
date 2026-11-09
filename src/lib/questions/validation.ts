import { z } from 'zod'

import { validerTelephone } from '@/lib/telephone'

export const VALEURS_SUJETS_QUESTIONS = [
  'pro',
  'me',
  'tarifs_abonnements',
  'compte_connexion',
  'autre',
] as const

export const SUJETS_QUESTIONS = [
  { valeur: 'pro', libelle: 'Sikaloc Pro' },
  { valeur: 'me', libelle: 'Sikaloc Me' },
  { valeur: 'tarifs_abonnements', libelle: 'Tarifs et abonnements' },
  { valeur: 'compte_connexion', libelle: 'Compte et connexion' },
  { valeur: 'autre', libelle: 'Autre question' },
] as const

export const STATUTS_QUESTIONS = ['nouvelle', 'en_cours', 'repondue'] as const

/** Canonise les numéros béninois avec l'utilitaire du produit et accepte aussi
 * les autres numéros déjà présentés au format international E.164. */
export function normaliserNumeroWhatsApp(saisie: string): string | null {
  const compacte = saisie.trim().replace(/[\s().-]/g, '')
  if (!compacte) return null

  const international = compacte.startsWith('00')
    ? `+${compacte.slice(2)}`
    : compacte

  if (!international.startsWith('+') || international.startsWith('+229')) {
    const verdict = validerTelephone(international, { obligatoire: true })
    return verdict.valide ? verdict.canonique ?? null : null
  }

  return /^\+[1-9]\d{7,14}$/.test(international) ? international : null
}

const telephoneWhatsApp = z.string().trim().transform((valeur, contexte) => {
  const canonique = normaliserNumeroWhatsApp(valeur)
  if (!canonique) {
    contexte.addIssue({
      code: 'custom',
      message: 'Saisissez un numéro béninois ou international valide, avec son indicatif.',
    })
    return z.NEVER
  }
  return canonique
})

const commun = z.object({
  nom: z
    .string()
    .trim()
    .min(2, 'Indiquez au moins 2 caractères.')
    .max(120, 'Le nom ne peut pas dépasser 120 caractères.'),
  sujet: z.enum(VALEURS_SUJETS_QUESTIONS, {
    error: 'Choisissez le sujet de votre demande.',
  }),
  question: z
    .string()
    .trim()
    .min(5, 'Votre question doit contenir au moins 5 caractères.')
    .max(3000, 'Votre question ne peut pas dépasser 3 000 caractères.'),
  consentement: z.literal(true, {
    error: 'Votre accord est nécessaire pour traiter cette demande.',
  }),
})

export const schemaQuestionVisiteur = z.discriminatedUnion('canal', [
  commun.extend({
    canal: z.literal('email'),
    coordonnees: z
      .email('Saisissez une adresse e-mail valide.')
      .trim()
      .toLowerCase()
      .max(254, 'Cette adresse e-mail est trop longue.'),
  }),
  commun.extend({
    canal: z.literal('whatsapp'),
    coordonnees: telephoneWhatsApp,
  }),
])

export type QuestionVisiteurSoumise = z.infer<typeof schemaQuestionVisiteur>
export type SujetQuestionVisiteur = (typeof SUJETS_QUESTIONS)[number]['valeur']
export type StatutQuestionVisiteur = (typeof STATUTS_QUESTIONS)[number]

export const libelleSujetQuestion = (sujet: string): string =>
  SUJETS_QUESTIONS.find((item) => item.valeur === sujet)?.libelle ?? 'Autre question'

