import { bailleurCourant } from '@/lib/session'

/**
 * Garde d'authentification de l'espace bailleur.
 *
 * Le proxy (`src/proxy.ts`) redirige déjà les visiteurs anonymes ; cette
 * vérification côté serveur en est le doublon volontaire — c'est elle qui
 * protège réellement les données, le proxy ne fait qu'éviter un aller-retour.
 *
 * Ce layout reste volontairement nu : l'onboarding s'affiche en plein écran,
 * tandis que le reste de l'application vit dans le groupe `(shell)` qui ajoute
 * la barre latérale.
 */
export default async function LayoutEspaceBailleur({
  children,
}: {
  children: React.ReactNode
}) {
  await bailleurCourant()

  return children
}
