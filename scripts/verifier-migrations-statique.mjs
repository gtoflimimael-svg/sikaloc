import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dossier = path.join(racine, 'supabase', 'migrations')
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

if (erreurs.length) {
  console.error(erreurs.join('\n'))
  process.exitCode = 1
} else {
  console.log(`${noms.length} migrations : noms valides, versions uniques et ordre lexical déterministe.`)
  console.log('Contrôle structurel seulement : aucune validation SQL et aucune connexion à une base.')
}
