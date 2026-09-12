import { z } from 'zod'

import { LONGUEUR_MAXIMALE, messageRefus } from '@/lib/mot-de-passe'
import { MESSAGES_TELEPHONE, validerTelephone } from '@/lib/telephone'
import { evaluerMotDePasse } from '@/lib/mot-de-passe-evaluation'

/**
 * Schémas de validation partagés.
 *
 * Chaque Server Action valide ici avant d'écrire : les contraintes CHECK de la
 * base sont le dernier rempart, pas le premier, et leurs messages d'erreur ne
 * sont pas montrables à un bailleur.
 */

const texteObligatoire = (champ: string, min = 2, max = 200) =>
  z
    .string()
    .trim()
    .min(min, `${champ} doit contenir au moins ${min} caractères.`)
    .max(max, `${champ} ne peut pas dépasser ${max} caractères.`)

/**
 * Le numéro est validé ET normalisé ici : ce qui sort du schéma est la forme
 * canonique `+2290190459821`, jamais ce que le formulaire a envoyé.
 *
 * `tolererAncien` est laissé à faux : dix chiffres sont exigés à la saisie.
 *
 * La tolérance aurait été dangereuse ici. Elle aurait accepté huit chiffres en
 * les préfixant de « 01 » — la conversion de la réforme béninoise de 2024 —
 * donc en *décidant* du numéro à la place de celui qui le saisit. Cette
 * conversion a sa place dans la reprise de données existantes, jamais sur une
 * frappe : quelqu'un qui tape huit chiffres aujourd'hui s'est trompé, et mérite
 * qu'on le lui dise plutôt qu'on complète son numéro pour lui.
 *
 * La migration 20260912000600 a converti les numéros déjà enregistrés : plus
 * aucun formulaire ne se rouvre sur huit chiffres.
 */
const telephone = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const verdict = validerTelephone(v, { obligatoire: true })
    if (!verdict.valide) {
      ctx.addIssue({ code: 'custom', message: MESSAGES_TELEPHONE[verdict.motif!] })
      return z.NEVER
    }
    return verdict.canonique!
  })

/**
 * La mesure vient de `@/lib/mot-de-passe-evaluation` : la jauge affichée pendant
 * la frappe et ce schéma appellent la même fonction, il ne peut donc pas y avoir
 * de mot de passe annoncé « Fort » puis refusé à l'envoi.
 *
 * Ce contrôle-ci est le seul qui compte. Celui du navigateur sert le confort de
 * saisie et rien d'autre : il tourne sur la machine de l'utilisateur, donc sous
 * son contrôle. Une requête forgée qui contournerait la page passe ici.
 *
 * 72 caractères est la limite de bcrypt, utilisé par GoTrue : au-delà, la fin du
 * mot de passe serait silencieusement ignorée.
 */
const motDePasse = z
  .string()
  .max(LONGUEUR_MAXIMALE, `Le mot de passe ne peut pas dépasser ${LONGUEUR_MAXIMALE} caractères.`)
  .superRefine((valeur, contexte) => {
    const force = evaluerMotDePasse(valeur)
    if (force.acceptable) return

    contexte.addIssue({ code: 'custom', message: messageRefus(force) })
  })

/**
 * Reprise du contrôle en tenant compte de ce que le compte révèle.
 *
 * « MoussaAdjovi1! » est un bon mot de passe pour n'importe qui — sauf pour
 * Moussa Adjovi. Les indices sont des valeurs déjà connues du compte : nom,
 * email, téléphone. Rien n'en sort : la mesure est locale.
 *
 * Rend le message de refus, ou `null` si le mot de passe convient.
 */
export function refusMotDePasseContextuel(
  valeur: string,
  indices: (string | null | undefined)[],
): string | null {
  const force = evaluerMotDePasse(valeur, indices.filter(Boolean) as string[])
  return force.acceptable ? null : messageRefus(force)
}

/**
 * Le même contrôle, branché sur Zod.
 *
 * `superRefine` d'un champ ne voit pas ses voisins : il faut repasser au niveau
 * de l'objet pour lire le nom et l'email saisis dans le même formulaire. Zod
 * n'exécute ce contrôle que si le champ a déjà passé le précédent — pas de
 * double message.
 */
function refuserMotDePasseContextuel<T extends { motDePasse: string }>(
  valeurs: T,
  contexte: z.RefinementCtx,
  indices: (string | undefined)[],
) {
  const message = refusMotDePasseContextuel(valeurs.motDePasse, indices)
  if (message) contexte.addIssue({ code: 'custom', message, path: ['motDePasse'] })
}

const dateISO = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide.')

const montant = z.coerce
  .number({ error: 'Montant invalide.' })
  .positive('Le montant doit être supérieur à 0.')
  .max(999_999_999, 'Le montant est trop élevé.')

// ─── Authentification ───────────────────────────────────────────────────────

/**
 * Un avatar est une suite d'index « tenue-coiffure-visage-pilosite-accessoire ».
 * Cette valeur finit dans un segment d'URL : le motif est donc strict, et
 * n'accepte que des chiffres et des tirets. Il double la contrainte CHECK posée
 * en base — la validation la plus proche de la donnée reste celle de Postgres.
 */
export const avatarOptionnel = z
  .string()
  .trim()
  .regex(/^\d{1,3}(-\d{1,3}){4}$/, 'Avatar invalide.')
  .optional()
  .or(z.literal(''))

export const schemaInscription = z
  .object({
    nom: texteObligatoire('Le nom', 2, 120),
    email: z.email('Adresse email invalide.').trim().toLowerCase(),
    telephone,
    motDePasse,
    codeParrain: z.string().trim().max(20).optional().or(z.literal('')),
    nbLogements: z.coerce.number().int().min(0).max(1000).optional(),
    avatar: avatarOptionnel,
  })
  .superRefine((valeurs, contexte) =>
    refuserMotDePasseContextuel(valeurs, contexte, [
      valeurs.nom,
      valeurs.email,
      valeurs.telephone,
    ]),
  )

export const schemaConnexion = z.object({
  email: z.email('Adresse email invalide.').trim().toLowerCase(),
  motDePasse: z.string().min(1, 'Le mot de passe est obligatoire.'),
})

export const schemaEmailSeul = z.object({
  email: z.email('Adresse email invalide.').trim().toLowerCase(),
})

export const schemaNouveauMotDePasse = z
  .object({
    motDePasse,
    confirmation: z.string(),
  })
  .refine((d) => d.motDePasse === d.confirmation, {
    message: 'Les deux mots de passe ne correspondent pas.',
    path: ['confirmation'],
  })

/**
 * Changement depuis les paramètres : le mot de passe actuel est exigé.
 *
 * Sans lui, un navigateur laissé ouvert quelques minutes suffit à prendre le
 * contrôle définitif du compte — c'est la raison pour laquelle tous les vrais
 * services le demandent, et la raison pour laquelle l'oubli passe par un lien
 * envoyé par email plutôt que par ce formulaire.
 */
export const schemaChangementMotDePasse = z
  .object({
    motDePasseActuel: z.string().min(1, 'Saisissez votre mot de passe actuel.'),
    motDePasse,
    confirmation: z.string(),
  })
  .refine((d) => d.motDePasse === d.confirmation, {
    message: 'Les deux mots de passe ne correspondent pas.',
    path: ['confirmation'],
  })
  .refine((d) => d.motDePasse !== d.motDePasseActuel, {
    message: 'Le nouveau mot de passe doit être différent de l’actuel.',
    path: ['motDePasse'],
  })

// ─── Entités métier ─────────────────────────────────────────────────────────

export const schemaLocataire = z.object({
  nom: texteObligatoire('Le nom du locataire', 2, 120),
  telephone,
  email: z.email('Adresse email invalide.').trim().toLowerCase().optional().or(z.literal('')),
  consentement: z.coerce.boolean().refine((v) => v === true, {
    message:
      'Vous devez attester avoir informé le locataire de la collecte de ses données.',
  }),
  avatar: avatarOptionnel,
})

export const schemaLogement = z.object({
  adresse: texteObligatoire("L'adresse", 3, 300),
  type: z.enum(['Appartement', 'Maison', 'Studio', 'Boutique', 'Autre'], {
    error: 'Sélectionnez un type de logement.',
  }),
  ville: texteObligatoire('La ville', 2, 120),
  pays: z.string().trim().min(2).max(80).default('Bénin'),
})

export const schemaBail = z
  .object({
    logementId: z.uuid('Sélectionnez un logement.'),
    locataireId: z.uuid('Sélectionnez un locataire.'),
    loyerMensuel: montant,
    dateDebut: dateISO,
    dateFin: dateISO.optional().or(z.literal('')),
    jourEcheance: z.coerce
      .number({ error: "Jour d'échéance invalide." })
      .int()
      .min(1, "Le jour d'échéance doit être entre 1 et 31.")
      .max(31, "Le jour d'échéance doit être entre 1 et 31."),
    toleranceJours: z.coerce
      .number({ error: 'Tolérance invalide.' })
      .int()
      .min(0, 'La tolérance ne peut pas être négative.')
      .max(60, 'La tolérance ne peut pas dépasser 60 jours.')
      .default(5),
    depotGarantie: z.coerce
      .number()
      .min(0, 'Le dépôt de garantie ne peut pas être négatif.')
      .max(999_999_999)
      .optional(),
  })
  .refine((d) => !d.dateFin || d.dateFin >= d.dateDebut, {
    message: 'La date de fin doit être postérieure à la date de début.',
    path: ['dateFin'],
  })

export const schemaPaiement = z.object({
  bailId: z.uuid('Sélectionnez un bail.'),
  montant,
  datePaiement: dateISO,
  // Premier jour du mois de loyer concerné ; la fin de période en est déduite.
  periodeDebut: dateISO,
  modePaiement: z.enum(['Espèces', 'Mobile Money', 'Virement bancaire', 'Autre'], {
    error: 'Sélectionnez un mode de paiement.',
  }),
  typePaiement: z
    .enum(['Loyer', 'Charges', 'Dépôt de garantie'], {
      error: 'Sélectionnez un type de paiement.',
    })
    .default('Loyer'),
})

// ─── Paramètres ─────────────────────────────────────────────────────────────

export const schemaProfil = z.object({
  nom: texteObligatoire('Le nom', 2, 120),
  telephone,
  adresse: z.string().trim().max(300).optional().or(z.literal('')),
})

export const schemaPreferences = z.object({
  notifEmail: z.coerce.boolean().default(false),
  notifWhatsApp: z.coerce.boolean().default(false),
})

// ─── Onboarding (3 étapes, spec §6.1.2) ─────────────────────────────────────

export const schemaOnboarding = z.object({
  // Étape 2 — premier locataire.
  locataireNom: texteObligatoire('Le nom du locataire', 2, 120),
  locataireTelephone: telephone,
  consentement: z.coerce.boolean().refine((v) => v === true, {
    message:
      'Vous devez attester avoir informé le locataire de la collecte de ses données.',
  }),
  // Étape 3 — premier bail et son logement.
  logementAdresse: texteObligatoire("L'adresse du logement", 3, 300),
  logementVille: texteObligatoire('La ville', 2, 120),
  logementType: z
    .enum(['Appartement', 'Maison', 'Studio', 'Boutique', 'Autre'])
    .default('Appartement'),
  loyerMensuel: montant,
  jourEcheance: z.coerce.number().int().min(1).max(31),
  dateDebut: dateISO,
})

// ─── Utilitaires ────────────────────────────────────────────────────────────

/** Résultat uniforme renvoyé par toutes les Server Actions de formulaire. */
export interface EtatFormulaire {
  erreur?: string
  erreursChamps?: Record<string, string>
  succes?: string
}

/** Transforme les erreurs Zod en dictionnaire champ → premier message. */
export function erreursChamps(erreur: z.ZodError): Record<string, string> {
  const resultat: Record<string, string> = {}

  for (const probleme of erreur.issues) {
    const champ = probleme.path.join('.')
    if (champ && !resultat[champ]) resultat[champ] = probleme.message
  }

  return resultat
}
