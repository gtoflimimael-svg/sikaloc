/**
 * Sections des paramètres.
 *
 * Une section = une route (`/app/parametres/<cle>`) plutôt qu'un onglet dans
 * une page unique. Le gain n'est pas seulement visuel : chaque écran ne charge
 * que ses propres données. L'ancienne page lisait l'historique de facturation
 * et les filleuls même pour afficher l'onglet « Profil ».
 */

export const CLES_PARAMETRES = [
  'profil',
  'signature',
  'preferences',
  'parrainage',
  'abonnement',
  'donnees',
] as const

export type CleParametre = (typeof CLES_PARAMETRES)[number]

export interface SectionParametre {
  cle: CleParametre
  titre: string
  /** Phrase affichée sur le bloc de l'index. */
  details: string
  /** Description de l'écran lui-même, sous le fil d'Ariane. */
  description: string
}

export const SECTIONS_PARAMETRES: SectionParametre[] = [
  {
    cle: 'profil',
    titre: 'Profil',
    details:
      'Votre avatar, votre nom, votre téléphone et votre mot de passe. Ces informations figurent sur vos quittances.',
    description: 'Votre identité de bailleur et vos identifiants de connexion.',
  },
  {
    cle: 'signature',
    titre: 'Signature',
    details:
      'La signature incrustée sur chaque quittance PDF. Importez une image ou scannez-la avec votre téléphone.',
    description: 'Elle est apposée sur chacun de vos documents.',
  },
  {
    cle: 'preferences',
    titre: 'Préférences',
    details:
      'Les rappels que vous recevez par email et l’affichage des relances WhatsApp sur vos impayés.',
    description: 'Ce que Sikaloc vous envoie, et ce qu’il vous propose d’envoyer.',
  },
  {
    cle: 'parrainage',
    titre: 'Parrainage',
    details:
      'Votre code et votre lien d’invitation. Un mois offert pour vous et pour chaque filleul qui souscrit.',
    description: 'Invitez un bailleur, gagnez un mois.',
  },
  {
    cle: 'abonnement',
    titre: 'Abonnement',
    details:
      'Votre plan actuel, le passage au plan Standard par Mobile Money et votre historique de facturation.',
    description: 'Votre plan, votre paiement et vos factures.',
  },
  {
    cle: 'donnees',
    titre: 'Mes données',
    details:
      'Téléchargez tout ce que Sikaloc détient sur vous : paiements, quittances et leurs PDF, dans une seule archive.',
    description: 'Récupérez une copie complète de vos données, à tout moment.',
  },
]

export function sectionParametre(cle: CleParametre): SectionParametre {
  // La clé vient du typage : la section existe toujours.
  return SECTIONS_PARAMETRES.find((s) => s.cle === cle)!
}

export function estCleParametre(valeur: string | undefined): valeur is CleParametre {
  return CLES_PARAMETRES.includes(valeur as CleParametre)
}
