import type { PlanAbonnement, StatutAnnonce } from '@/lib/types/database'

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

/** Texte de quota concis, fondé sur le plan effectif et la liste visible. */
export function presenterQuotaLogements(
  plan: PlanAbonnement,
  nombre: number,
  limite: number | null,
): string {
  const logement = nombre === 1 ? 'logement' : 'logements'

  if (limite === null) return `${plan} · ${nombre} ${logement}`

  return `${plan} · ${nombre}/${limite} logements`
}

/** Localisation courte : le pays est omis pour le Bénin, contexte par défaut. */
export function presenterLocalisationLogement(
  type: string,
  ville: string,
  pays: string,
): string {
  const paysNormalise = pays
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('fr')
  const paysAafficher = paysNormalise && paysNormalise !== 'benin' ? pays.trim() : ''
  const villeEtPays = [ville.trim(), paysAafficher].filter(Boolean).join(', ')

  return [type.trim(), villeEtPays].filter(Boolean).join(' · ')
}

/**
 * Une annonce existante reste gérable, quel que soit l'état du logement.
 * Sans annonce, la remise en location ordinaire n'est proposée que si aucun
 * bail actif n'est connu. La préparation d'une disponibilité future reste
 * accessible depuis le parcours Annonces, qui en explique explicitement les
 * conditions.
 */
export function presenterActionAnnonce(
  annonceId: string | undefined,
  logementId: string,
  bailActif: boolean,
): { href: string; libelle: string } | null {
  if (annonceId) {
    return { href: `/pro/annonces/${annonceId}`, libelle: 'Gérer l’annonce' }
  }

  if (bailActif) return null

  return {
    href: `/pro/annonces/nouvelle?logement=${encodeURIComponent(logementId)}`,
    libelle: 'Préparer une annonce',
  }
}

/** La suppression est bloquée par les baux (même terminés) et les annonces vivantes. */
export function peutSupprimerLogement(nombreBaux: number, annonceVivante: boolean): boolean {
  return nombreBaux === 0 && !annonceVivante
}
