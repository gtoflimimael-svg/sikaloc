import { z } from 'zod'

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

const telephone = z
  .string()
  .trim()
  .min(8, 'Le numéro de téléphone doit contenir au moins 8 chiffres.')
  .max(20, 'Le numéro de téléphone est trop long.')
  .regex(/^[\d\s+()-]+$/, 'Le numéro ne doit contenir que des chiffres.')

const motDePasse = z
  .string()
  .min(8, 'Le mot de passe doit contenir au moins 8 caractères.')
  .max(72, 'Le mot de passe ne peut pas dépasser 72 caractères.')
  .regex(/[a-zA-Z]/, 'Le mot de passe doit contenir au moins une lettre.')
  .regex(/\d/, 'Le mot de passe doit contenir au moins un chiffre.')

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

export const schemaInscription = z.object({
  nom: texteObligatoire('Le nom', 2, 120),
  email: z.email('Adresse email invalide.').trim().toLowerCase(),
  telephone,
  motDePasse,
  codeParrain: z.string().trim().max(20).optional().or(z.literal('')),
  nbLogements: z.coerce.number().int().min(0).max(1000).optional(),
  avatar: avatarOptionnel,
})

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
  avatar: avatarOptionnel,
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
