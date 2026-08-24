/**
 * Fige la liste des objets déclarés par les migrations.
 *
 *   npm run generer:objets      (à relancer après toute nouvelle migration)
 *
 * Le contrôle de schéma a besoin de savoir ce que les migrations promettent :
 * contraintes, politiques, fonctions, vues, index, déclencheurs. Lire le dossier
 * `supabase/migrations` à l'exécution paraissait naturel — mais les fichiers
 * n'arrivent pas dans la fonction déployée, et le contrôle se retrouvait à
 * vérifier zéro objet en annonçant « conforme ».
 *
 * La liste est donc calculée ici et écrite dans un module TypeScript ordinaire
 * que le bundler embarque comme n'importe quel import. Plus rien à tracer, plus
 * rien à perdre.
 *
 * Pourquoi pas au build : `.vercelignore` exclut délibérément `/scripts` et
 * `/supabase` pour alléger l'envoi. Ni ce script ni les migrations n'existent
 * sur Vercel — c'était d'ailleurs la vraie raison pour laquelle la lecture à
 * l'exécution échouait. Le fichier produit est donc versionné, et
 * `npm run verifier:schema` refuse de passer s'il a pris du retard sur les
 * migrations.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export interface ObjetDeclare {
  categorie: string
  nom: string
  migration: string
}

const DOSSIER = join(process.cwd(), 'supabase/migrations')
const SORTIE = join(process.cwd(), 'src/lib/schema-objets.ts')

// Les noms peuvent être nus ou entre guillemets — les politiques de ce projet
// portent des libellés français avec espaces et accents.
const nom = String.raw`(?:"([^"]+)"|([a-zA-Z_][\w]*))`

const MOTIFS: { categorie: string; expression: RegExp }[] = [
  { categorie: 'contrainte', expression: new RegExp(String.raw`add\s+constraint\s+${nom}`, 'gi') },
  { categorie: 'politique', expression: new RegExp(String.raw`create\s+policy\s+${nom}`, 'gi') },
  {
    categorie: 'fonction',
    expression: new RegExp(
      String.raw`create\s+(?:or\s+replace\s+)?function\s+(?:[a-zA-Z_]\w*\.)?${nom}`,
      'gi',
    ),
  },
  {
    categorie: 'vue',
    expression: new RegExp(
      String.raw`create\s+(?:or\s+replace\s+)?view\s+(?:[a-zA-Z_]\w*\.)?${nom}`,
      'gi',
    ),
  },
  {
    categorie: 'index',
    expression: new RegExp(
      String.raw`create\s+(?:unique\s+)?index\s+(?:concurrently\s+)?(?:if\s+not\s+exists\s+)?${nom}`,
      'gi',
    ),
  },
  { categorie: 'declencheur', expression: new RegExp(String.raw`create\s+trigger\s+${nom}`, 'gi') },
]

const SUPPRESSIONS: { categorie: string; expression: RegExp }[] = [
  {
    categorie: 'contrainte',
    expression: new RegExp(String.raw`drop\s+constraint\s+(?:if\s+exists\s+)?${nom}`, 'gi'),
  },
  {
    categorie: 'politique',
    expression: new RegExp(String.raw`drop\s+policy\s+(?:if\s+exists\s+)?${nom}`, 'gi'),
  },
  {
    categorie: 'index',
    expression: new RegExp(String.raw`drop\s+index\s+(?:if\s+exists\s+)?${nom}`, 'gi'),
  },
  {
    categorie: 'declencheur',
    expression: new RegExp(String.raw`drop\s+trigger\s+(?:if\s+exists\s+)?${nom}`, 'gi'),
  },
]

export function extraire(): ObjetDeclare[] {
  const fichiers = readdirSync(DOSSIER)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  if (fichiers.length === 0) {
    throw new Error(`Aucune migration trouvée dans ${DOSSIER}.`)
  }

  // L'ordre compte : une migration peut supprimer ce qu'une précédente a créé.
  // `quittances_numero_document_key` est dans ce cas.
  const declares = new Map<string, ObjetDeclare>()

  for (const fichier of fichiers) {
    // Les commentaires SQL contiennent des exemples et des noms cités ; les
    // lire produirait des attentes qu'aucune instruction ne crée.
    const instructions = readFileSync(join(DOSSIER, fichier), 'utf8')
      .split('\n')
      .filter((ligne) => !ligne.trimStart().startsWith('--'))
      .join('\n')

    for (const { categorie, expression } of MOTIFS) {
      for (const trouve of instructions.matchAll(expression)) {
        const valeur = trouve[1] ?? trouve[2]
        if (valeur) {
          declares.set(`${categorie}:${valeur}`, { categorie, nom: valeur, migration: fichier })
        }
      }
    }

    for (const { categorie, expression } of SUPPRESSIONS) {
      for (const trouve of instructions.matchAll(expression)) {
        const valeur = trouve[1] ?? trouve[2]
        if (valeur) declares.delete(`${categorie}:${valeur}`)
      }
    }
  }

  return [...declares.values()].sort((a, b) =>
    `${a.categorie}${a.nom}`.localeCompare(`${b.categorie}${b.nom}`),
  )
}

export function ecrire(): ObjetDeclare[] {
  const objets = extraire()
  const contenu = `// Fichier généré par \`npm run generer:objets\` — ne pas modifier à la main.
//
// Liste des objets que les migrations promettent à la base. Le contrôle de
// schéma compare cette liste à l'inventaire réel de la production.
//
// Figée ici parce que \`.vercelignore\` exclut \`/supabase\` : les migrations
// n'accompagnent pas la fonction déployée et sont illisibles à l'exécution.
// \`npm run verifier:schema\` signale si cette liste a pris du retard.

export interface ObjetDeclare {
  categorie: string
  nom: string
  /** Migration qui le déclare — désigne le fichier à appliquer s'il manque. */
  migration: string
}

export const OBJETS_DECLARES: ObjetDeclare[] = ${JSON.stringify(objets, null, 2)}
`

  writeFileSync(SORTIE, contenu, 'utf8')
  return objets
}

// Lancé directement : on écrit. Importé par le contrôle de schéma : on se
// contente d'exposer `extraire`, qui sert alors à détecter un retard.
if (process.argv[1] && process.argv[1].endsWith('generer-objets-schema.ts')) {
  const objets = ecrire()
  const parCategorie = new Map<string, number>()
  for (const o of objets) parCategorie.set(o.categorie, (parCategorie.get(o.categorie) ?? 0) + 1)

  console.log(
    `${objets.length} objets figés dans src/lib/schema-objets.ts — ` +
      [...parCategorie].map(([c, n]) => `${n} ${c}`).join(', '),
  )
}
