import type { StatutAnnonce } from '@/lib/types/database'

/** Une relation Supabase peut être sérialisée comme objet ou comme tableau. */
export function premiereRelation<T>(relation: T | T[] | null | undefined): T | undefined {
  return Array.isArray(relation) ? relation[0] : relation ?? undefined
}

/** Seul un bail au statut actif indique que le logement est occupé. */
export function trouverBailActif<T extends { statut: string }>(baux: readonly T[]): T | undefined {
  return baux.find((bail) => bail.statut === 'Actif')
}

/** L'annonce clôturée ne représente plus une annonce active du logement. */
export function trouverAnnonceVivante<T extends { statut: string }>(
  annonces: readonly T[],
): T | undefined {
  return annonces.find((annonce) => annonce.statut !== 'cloturee')
}

/** Libellé et ton de présentation, sans transformer le statut métier. */
export function presenterStatutAnnonce(statut: StatutAnnonce): {
  libelle: string
  ton: 'positive' | 'warning' | 'neutral'
} | null {
  switch (statut) {
    case 'brouillon':
      return { libelle: 'Annonce en préparation', ton: 'neutral' }
    case 'publiee':
      return { libelle: 'Annonce publiée', ton: 'positive' }
    case 'suspendue':
      return { libelle: 'Annonce suspendue', ton: 'warning' }
    case 'cloturee':
      return null
  }
}
