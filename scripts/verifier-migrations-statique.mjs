import { createHash } from 'node:crypto'
import { readdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Contrôle des migrations, sans connexion à une base.
 *
 * 1. Structure : noms `AAAAMMJJHHMMSS_nom.sql`, versions uniques, fichiers non vides.
 * 2. Immuabilité (OPS-06) : `supabase/migrations.lock.json` garde l'empreinte
 *    SHA-256 de chaque migration livrée. Une migration déjà appliquée n'est
 *    jamais rejouée par Supabase : la réécrire laisse les bases existantes sur
 *    l'ancienne version, en silence. C'est arrivé le 31/10/2026 avec
 *    `20261020185126_fiabiliser_loyers_echeances.sql`. Désormais :
 *      • migration verrouillée modifiée ou supprimée → échec ;
 *      • nouvelle migration non verrouillée → échec ;
 *      • nouvelle migration plus ancienne que la dernière verrouillée → échec.
 *
 * `--verrouiller` ajoute au verrou les nouvelles migrations, et elles seules :
 * il ne réécrit jamais une empreinte existante.
 */

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dossier = path.join(racine, 'supabase', 'migrations')
const fichierVerrou = path.join(racine, 'supabase', 'migrations.lock.json')
const verrouiller = process.argv.includes('--verrouiller')

const noms = (await readdir(dossier)).filter((nom) => nom.endsWith('.sql')).sort()
const erreurs = []
const versions = new Set()

if (noms.length === 0) erreurs.push('Aucune migration SQL trouvée.')

for (const nom of noms) {
  const correspondance = nom.match(/^(\d{14})_.+\.sql$/)
  if (!correspondance) {
    erreurs.push(`Nom de migration invalide : ${nom}`)
    continue
  }
  if (versions.has(correspondance[1])) erreurs.push(`Version dupliquée : ${correspondance[1]}`)
  versions.add(correspondance[1])
  if ((await stat(path.join(dossier, nom))).size === 0) erreurs.push(`Migration vide : ${nom}`)
}

async function empreinte(nom) {
  // Fins de ligne normalisées : un passage par Windows ne doit pas compter
  // comme une réécriture.
  const contenu = (await readFile(path.join(dossier, nom), 'utf8')).replace(/\r\n/g, '\n')
  return createHash('sha256').update(contenu).digest('hex')
}

let verrou = {}
try {
  verrou = JSON.parse(await readFile(fichierVerrou, 'utf8'))
} catch (cause) {
  if (cause?.code !== 'ENOENT') erreurs.push('supabase/migrations.lock.json est illisible.')
}

const verrouillees = Object.keys(verrou).sort()
const derniere = verrouillees.at(-1) ?? ''

for (const nom of verrouillees) {
  if (!noms.includes(nom)) {
    erreurs.push(`Migration livrée supprimée ou renommée : ${nom}. Restaurez-la ; corrigez par une nouvelle migration.`)
    continue
  }
  if ((await empreinte(nom)) !== verrou[nom]) {
    erreurs.push(
      `Migration livrée modifiée : ${nom}. Les bases qui l'ont déjà appliquée ne verront jamais ce changement. ` +
      'Restaurez son contenu et écrivez une nouvelle migration corrective.',
    )
  }
}

const nouvelles = noms.filter((nom) => !(nom in verrou))
for (const nom of nouvelles) {
  if (nom < derniere) {
    erreurs.push(`Nouvelle migration plus ancienne que la dernière livrée (${derniere}) : ${nom}. Renommez-la avec un horodatage récent.`)
  }
}

if (verrouiller && erreurs.length === 0 && nouvelles.length > 0) {
  for (const nom of nouvelles) verrou[nom] = await empreinte(nom)
  const trie = Object.fromEntries(Object.keys(verrou).sort().map((nom) => [nom, verrou[nom]]))
  await writeFile(fichierVerrou, `${JSON.stringify(trie, null, 2)}\n`)
  console.log(`${nouvelles.length} migration(s) ajoutée(s) au verrou : ${nouvelles.join(', ')}`)
} else if (!verrouiller) {
  for (const nom of nouvelles) {
    erreurs.push(`Migration non verrouillée : ${nom}. Lancez « npm run verrouiller:migrations » et commitez le verrou.`)
  }
}

if (erreurs.length) {
  console.error(erreurs.join('\n'))
  process.exitCode = 1
} else {
  console.log(`${noms.length} migrations : noms valides, versions uniques, ordre déterministe, empreintes verrouillées conformes.`)
  console.log('Contrôle statique seulement : la validation SQL réelle est faite par la CI sur une base jetable.')
}
