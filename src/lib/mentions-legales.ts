/**
 * Informations légales du site.
 *
 * ─── À REMPLIR PAR LE FONDATEUR ─────────────────────────────────────────────
 *
 * Tant qu'un seul champ d'`EDITEUR` vaut `null`, la page `/legal/mentions`
 * répond 404 et aucun lien n'y mène. C'est délibéré : une page de mentions
 * légales incomplète est pire que pas de page du tout, parce qu'elle donne
 * l'apparence d'une conformité qu'elle n'a pas.
 *
 * Ces informations ne peuvent pas être devinées depuis le dépôt, et personne
 * d'autre que le fondateur ne peut les fournir.
 */

export interface Editeur {
  /** Dénomination exacte, telle qu'immatriculée. */
  denomination: string | null
  /** Forme juridique : entreprise individuelle, SARL, SAS… */
  formeJuridique: string | null
  /** Adresse du siège, complète. */
  adresse: string | null
  /** Numéro d'immatriculation — RCCM au Bénin. `false` si non immatriculé. */
  immatriculation: string | false | null
  /** Personne responsable de ce qui est publié sur le site. */
  directeurPublication: string | null
  /** Adresse de contact réellement relevée. */
  email: string | null
  /** Téléphone. `false` si vous ne souhaitez pas le publier. */
  telephone: string | false | null
}

export const EDITEUR: Editeur = {
  denomination: null,
  formeJuridique: null,
  adresse: null,
  immatriculation: null,
  directeurPublication: null,
  email: null,
  telephone: null,
}

/** La page ne s'affiche que si tout est renseigné. */
export function mentionsCompletes(): boolean {
  return Object.values(EDITEUR).every((valeur) => valeur !== null)
}

/**
 * Prestataires d'hébergement.
 *
 * Établis depuis la configuration réelle du dépôt : `.vercel/project.json` et
 * `vercel.json` pour l'application (région `fra1`, Francfort), l'URL Supabase
 * de `.env.local` pour la base et les fichiers, `RESEND_API_KEY` et
 * `src/lib/emails.ts` pour l'acheminement des messages.
 *
 * Les adresses postales viennent des pages légales publiques de ces sociétés et
 * demandent une relecture avant publication : le dépôt ne peut pas les établir.
 */
export const HEBERGEURS = [
  {
    role: 'Application web',
    nom: 'Vercel Inc.',
    adresse: '440 N Barranca Ave #4133, Covina, CA 91723, États-Unis',
    precision: 'Déploiement en région Francfort (Europe).',
  },
  {
    role: 'Base de données et fichiers',
    nom: 'Supabase, Inc.',
    adresse: '970 Toa Payoh North #07-04, Singapour 318992',
    precision: 'Données hébergées en Europe.',
  },
  {
    role: 'Acheminement des emails',
    nom: 'Resend (Plus Five Five, Inc.)',
    adresse: '2261 Market Street #5039, San Francisco, CA 94114, États-Unis',
    precision: 'Emails transactionnels uniquement.',
  },
] as const
