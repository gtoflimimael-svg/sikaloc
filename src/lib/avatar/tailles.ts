// ⚠ Généré avec atomes.ts — nombre d'options par catégorie.
// Séparé de `atomes.ts` pour que le client puisse borner les index sans
// embarquer les 563 Ko de tracés.

export const CATEGORIES = ['tenue', 'coiffure', 'visage', 'pilosite', 'accessoire'] as const
export type Categorie = (typeof CATEGORIES)[number]

export const NB_OPTIONS: Record<Categorie, number> = {
  tenue: 10,
  coiffure: 24,
  visage: 20,
  pilosite: 12,
  accessoire: 9,
}
