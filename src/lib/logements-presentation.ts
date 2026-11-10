import type { PlanAbonnement } from '@/lib/types/database'

/** Une relation Supabase peut être sérialisée comme objet ou comme tableau. */
export function premiereRelation<T>(relation: T | T[] | null | undefined): T | undefined {
  return Array.isArray(relation) ? relation[0] : relation ?? undefined
}

/** Seul un bail au statut actif indique que le logement est occupé. */
export function trouverBailActif<T extends { statut: string }>(baux: readonly T[]): T | undefined {
  return baux.find((bail) => bail.statut === 'Actif')
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
 * L'interface ne charge plus les annonces. La base conserve ses contraintes
 * historiques et reste l'autorité pour refuser une suppression incompatible.
 */
export function peutSupprimerLogement(nombreBaux: number): boolean {
  return nombreBaux === 0
}
