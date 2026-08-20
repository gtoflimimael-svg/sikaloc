import { writeFileSync } from 'node:fs'
import { ATOMES } from './src/lib/avatar/atomes'

const FR: Record<string, string> = {
  // Tenues
  'Blazer Black Tee': 'Blazer et t-shirt', 'Button Shirt 1': 'Chemise boutonnée',
  'Button Shirt 2': 'Chemise à motifs', 'Coffee': 'Tasse à la main', 'Device': 'Téléphone à la main',
  'Dress': 'Robe', 'Explaining': 'Bras ouverts', 'Fur Jacket': 'Veste épaisse',
  'Gaming': 'Manette en main', 'Gym Shirt': 'Débardeur',
  // Coiffures
  'Afro': 'Afro', 'Bangs 2': 'Frange dégradée', 'Bangs': 'Frange',
  'Bantu Knots': 'Nœuds bantous', 'Bear': 'Cheveux ébouriffés', 'Bun 2': 'Chignon haut',
  'Bun': 'Chignon', 'Buns': 'Deux chignons', 'Cornrows 2': 'Tresses collées',
  'Cornrows': 'Cornrows', 'Flat Top Long': 'Coupe carrée longue', 'Flat Top': 'Coupe carrée',
  'Gray Bun': 'Chignon grisonnant', 'Gray Medium': 'Mi-longs grisonnants',
  'Gray Short': 'Courts grisonnants', 'Hijab': 'Foulard', 'Long Afro': 'Afro long',
  'Long Bangs': 'Longs à frange', 'Long Curly': 'Longs bouclés', 'Long': 'Cheveux longs',
  'Medium 1': 'Mi-longs', 'Medium 2': 'Mi-longs ondulés', 'Medium 3': 'Mi-longs volumineux',
  'Medium Bangs 2': 'Mi-longs à frange',
  // Visages
  'Angry with Fang': 'Contrarié', 'Awe': 'Émerveillé', 'Blank': 'Neutre', 'Calm': 'Serein',
  'Cheeky': 'Malicieux', 'Concerned Fear': 'Inquiet', 'Concerned': 'Soucieux',
  'Contempt': 'Dubitatif', 'Cute': 'Doux', 'Cyclops': 'Rêveur', 'Driven': 'Déterminé',
  'Eating Happy': 'Gourmand', 'Explaining': 'En pleine explication', 'Eyes Closed': 'Yeux fermés',
  'Fear': 'Surpris', 'Hectic': 'Débordé', 'Loving Grin 1': 'Grand sourire',
  'Loving Grin 2': 'Sourire complice', 'Monster': 'Espiègle', 'Old': 'Sage',
  // Pilosité
  'None': 'Aucune', 'Chin': 'Bouc au menton', 'Full 2': 'Barbe fournie',
  'Full 3': 'Barbe taillée', 'Full 4': 'Barbe longue', 'Full': 'Barbe pleine',
  'Goatee 1': 'Bouc', 'Goatee 2': 'Bouc fin', 'Moustache 1': 'Moustache',
  'Moustache 2': 'Moustache fine', 'Moustache 3': 'Moustache épaisse', 'Moustache 4': 'Moustache large',
  // Accessoires
  'Eyepatch': 'Cache-œil', 'Glasses 2': 'Lunettes rondes', 'Glasses 3': 'Lunettes fines',
  'Glasses 4': 'Lunettes carrées', 'Glasses 5': 'Lunettes épaisses', 'Glasses': 'Lunettes',
  'Sunglasses 2': 'Lunettes de soleil rondes', 'Sunglasses': 'Lunettes de soleil',
}

const cats = ['tenue','coiffure','visage','pilosite','accessoire'] as const
const CTX: Record<string, string> = {
  tenue: 'Tenue', coiffure: 'Coiffure', visage: 'Expression',
  pilosite: 'Barbe', accessoire: 'Lunettes',
}

let out = `// ⚠ Généré avec scripts/generer-noms-avatar.mts — ne pas éditer à la main.
//
// Libellés des options d'avatar, séparés de \`atomes.ts\` pour que le client
// puisse nommer chaque vignette sans embarquer les 566 Ko de tracés.

import type { Categorie } from '@/lib/avatar/tailles'

export const NOMS_OPTIONS: Record<Categorie, string[]> = {
`
for (const c of cats) {
  const noms = ATOMES[c].map(a => FR[a.nom] ?? a.nom)
  out += `  ${c}: [\n${noms.map(n => `    ${JSON.stringify(n)},`).join('\n')}\n  ],\n`
}
out += `}\n\nexport const LIBELLES_CATEGORIES: Record<Categorie, string> = {\n`
for (const c of cats) out += `  ${c}: ${JSON.stringify(CTX[c])},\n`
out += `}\n`

writeFileSync('src/lib/avatar/noms.ts', out)
console.log('écrit', out.length, 'octets')
