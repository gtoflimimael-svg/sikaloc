/**
 * Compare le schéma réel de la base à ce que le code attend.
 *
 *   set -a && . ./.env.local && set +a && npm run verifier:schema
 *
 * À lancer avant tout déploiement touchant à la base. La même vérification
 * tourne chaque nuit (`/api/cron/schema`) et alerte par email en cas d'écart ;
 * ce script sert à la demande, avant d'agir plutôt qu'après.
 *
 * La logique vit dans `src/lib/schema.ts`, partagée avec la tâche planifiée :
 * deux implémentations finiraient par diverger, et c'est précisément une
 * divergence entre deux descriptions du schéma qui a causé la panne du
 * 23 août 2026.
 */
import Module from 'node:module'

// `server-only` lève à l'import hors du rendu serveur Next. Le contrôle de
// schéma le porte à juste titre — il manipule la clé de service — mais un
// script en ligne de commande est un contexte serveur légitime.
//
// Le paquet fournit lui-même `empty.js` pour ce cas. Il n'est pas déclaré dans
// ses `exports`, d'où la résolution par chemin de fichier.
// Résolu AVANT d'installer le hook : le calculer à l'intérieur ferait rentrer
// `require.resolve` dans le hook qu'il est en train de définir.
const CHEMIN_VIDE = require.resolve('server-only').replace(/index\.js$/, 'empty.js')

const resoudre = (Module as unknown as { _resolveFilename: (...a: unknown[]) => string })
  ._resolveFilename
;(Module as unknown as { _resolveFilename: unknown })._resolveFilename = function (
  this: unknown,
  demande: unknown,
  ...reste: unknown[]
) {
  if (demande === 'server-only') return CHEMIN_VIDE
  return resoudre.call(this, demande, ...reste)
}

/**
 * Refuse de continuer si la liste figée a pris du retard sur les migrations.
 *
 * La liste est versionnée parce que `.vercelignore` exclut `/supabase` : les
 * migrations n'atteignent jamais la fonction déployée. Ce choix a un revers —
 * ajouter une migration sans relancer le générateur laisserait ses objets hors
 * surveillance, sans le moindre signe. Ce contrôle tourne ici parce que c'est le
 * seul endroit où les deux versions sont disponibles côte à côte.
 */
async function verifierFraicheur(): Promise<boolean> {
  const { extraire } = await import('./generer-objets-schema')
  const { OBJETS_DECLARES } = await import('../src/lib/schema-objets')

  const cle = (o: { categorie: string; nom: string }) => `${o.categorie}:${o.nom}`
  const frais = new Set(extraire().map(cle))
  const fige = new Set(OBJETS_DECLARES.map(cle))

  const absents = [...frais].filter((k) => !fige.has(k))
  const surnumeraires = [...fige].filter((k) => !frais.has(k))

  if (absents.length === 0 && surnumeraires.length === 0) return true

  console.error('✗ La liste figée ne correspond plus aux migrations.\n')
  if (absents.length > 0) {
    console.error(`  Déclarés par une migration mais absents de la liste :\n    ${absents.join('\n    ')}`)
  }
  if (surnumeraires.length > 0) {
    console.error(`  Dans la liste mais plus déclarés :\n    ${surnumeraires.join('\n    ')}`)
  }
  console.error('\n  Relancez « npm run generer:objets », puis committez le fichier produit.')

  return false
}

async function main() {
  const { decrireEcarts, verifierSchema } = await import('../src/lib/schema')

  if (!(await verifierFraicheur())) process.exit(1)

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error(
      'Variables manquantes. Lancez avec l’environnement chargé :\n' +
        '  set -a && . ./.env.local && set +a && npm run verifier:schema',
    )
    process.exit(1)
  }

  console.log(`Schéma comparé à ${process.env.NEXT_PUBLIC_SUPABASE_URL}\n`)

  const rapport = await verifierSchema()

  console.log(
    `  ${rapport.colonnesVerifiees} colonnes vérifiées sur ${rapport.tablesVerifiees} tables.\n` +
      `  ${rapport.objetsVerifies} objets déclarés par les migrations ` +
      '(contraintes, politiques, fonctions, vues, index, déclencheurs).',
  )

  if (rapport.conforme) {
    console.log('\n✓ La base correspond à ce que le code attend.')
    return
  }

  console.log('\n✗ Écarts détectés :\n')
  console.log(decrireEcarts(rapport))
  console.log(
    '\n  Une migration a probablement été écrite sans être appliquée.\n' +
      '  Les fonctionnalités qui en dépendent sont sans doute cassées,\n' +
      '  sans lever la moindre erreur serveur.',
  )
  process.exit(1)
}

main().catch((erreur) => {
  console.error(erreur)
  process.exit(1)
})
