/**
 * Dépose les poids du détecteur de visage dans `public/`.
 *
 *     npm run preparer:modeles
 *
 * ─── Pourquoi copier plutôt que servir depuis node_modules ──────────────────
 *
 * `.vercelignore` n'embarque pas `node_modules` tel quel, et rien ne garantit
 * qu'un chemin interne de paquet reste stable. `public/` est le seul endroit
 * dont Next.js promet qu'il sera servi à l'identique.
 *
 * ─── Pourquoi seulement deux fichiers ───────────────────────────────────────
 *
 * `@vladmandic/face-api` livre dix modèles, dont la reconnaissance faciale
 * (~6,2 Mo) et l'estimation d'âge et de genre. Sikaloc n'a besoin que de
 * détecter des visages et de les compter : on ne copie que le TinyFaceDetector.
 *
 * Ce n'est pas qu'une question de poids. Servir un modèle de reconnaissance
 * faciale depuis nos propres serveurs le rendrait chargeable par n'importe
 * quelle page du site, et rendrait la frontière « on n'active pas la biométrie »
 * beaucoup plus facile à franchir par inadvertance.
 */

import { copyFile, mkdir, stat } from 'node:fs/promises'
import { join } from 'node:path'

const SOURCE = 'node_modules/@vladmandic/face-api/model'
const CIBLE = 'public/modeles/visage'

const FICHIERS = [
  'tiny_face_detector_model-weights_manifest.json',
  'tiny_face_detector_model.bin',
]

await mkdir(CIBLE, { recursive: true })

let total = 0
for (const fichier of FICHIERS) {
  const depuis = join(SOURCE, fichier)
  const vers = join(CIBLE, fichier)
  await copyFile(depuis, vers)
  const { size } = await stat(vers)
  total += size
  console.log(`  ${String(Math.round(size / 1024)).padStart(5)} Ko  ${fichier}`)
}

console.log(`\n✓ ${FICHIERS.length} fichiers, ${Math.round(total / 1024)} Ko au total, dans ${CIBLE}/`)
