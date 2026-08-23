/**
 * Compare le schéma réel de la base à ce que le code attend.
 *
 *   npm run verifier:schema            # base de production (via .env.local)
 *
 * ─── Pourquoi ce script existe ──────────────────────────────────────────────
 *
 * Le 23 août 2026, la génération de quittance était cassée depuis trois jours :
 * la colonne `locataires.signature_chemin` n'existait pas en production. Son
 * code et sa migration avaient été livrés, la migration n'avait jamais été
 * appliquée. Aucune alerte n'a été levée — l'erreur était proprement attrapée
 * et affichée à l'utilisateur, donc invisible côté serveur.
 *
 * Les identifiants de migration locaux et distants ayant divergé,
 * `supabase db push` ne peut pas servir de garde-fou. Ce script le remplace :
 * il lit les types TypeScript de `src/lib/types/database.ts` — la seule
 * description du schéma que le code utilise réellement — et vérifie que chaque
 * colonne existe vraiment.
 *
 * À lancer avant tout déploiement touchant à la base.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL
const CLE = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!URL_BASE || !CLE) {
  console.error(
    'Variables manquantes. Lancez avec l’environnement chargé :\n' +
      '  set -a && . ./.env.local && set +a && npm run verifier:schema',
  )
  process.exit(1)
}

/** Les tables du schéma `public`, telles que `Database` les déclare. */
const TABLES: Record<string, string> = {
  bailleurs: 'Bailleur',
  locataires: 'Locataire',
  logements: 'Logement',
  baux: 'Bail',
  paiements: 'Paiement',
  quittances: 'Quittance',
  abonnements_transactions: 'AbonnementTransaction',
  recompenses_parrainage: 'RecompenseParrainage',
  tentatives_connexion: 'TentativeConnexion',
  emails_a_envoyer: 'EmailAEnvoyer',
  journal_purges: 'JournalPurge',
  compteurs_documents: 'CompteurDocuments',
}

/**
 * Extrait les noms de colonnes d'un type `export type X = { … }`.
 *
 * Une lecture du fichier, et non un `import` : le but est de vérifier ce que
 * décrit la source, sans dépendre de sa compilation.
 */
function colonnesAttendues(source: string, nomType: string): string[] {
  const debut = source.indexOf(`export type ${nomType} = {`)
  if (debut === -1) return []
  const fin = source.indexOf('\n}', debut)
  const bloc = source.slice(debut, fin)

  return [...bloc.matchAll(/^\s{2}([a-z_][a-z0-9_]*)\??:/gm)].map((m) => m[1])
}

/** La table répond-elle ? `limit=0` ne lit aucune donnée. */
async function tableAccessible(table: string): Promise<boolean> {
  const reponse = await fetch(`${URL_BASE}/rest/v1/${table}?select=*&limit=0`, {
    headers: { apikey: CLE!, Authorization: `Bearer ${CLE}` },
  })
  return reponse.ok
}

async function colonneExiste(table: string, colonne: string): Promise<boolean> {
  const reponse = await fetch(`${URL_BASE}/rest/v1/${table}?select=${colonne}&limit=0`, {
    headers: { apikey: CLE!, Authorization: `Bearer ${CLE}` },
  })
  return reponse.ok
}

async function main() {
  const source = readFileSync(join(process.cwd(), 'src/lib/types/database.ts'), 'utf8')

  console.log(`Schéma comparé à ${URL_BASE}\n`)

  let manquantes = 0
  let verifiees = 0
  const tablesAbsentes: string[] = []

  for (const [table, nomType] of Object.entries(TABLES)) {
    const attendues = colonnesAttendues(source, nomType)
    if (attendues.length === 0) {
      console.log(`  ${table.padEnd(26)} type ${nomType} introuvable dans database.ts`)
      continue
    }

    if (!(await tableAccessible(table))) {
      console.log(`  ${table.padEnd(26)} ✗ TABLE INACCESSIBLE`)
      tablesAbsentes.push(table)
      continue
    }

    const absentes: string[] = []
    for (const colonne of attendues) {
      verifiees++
      if (!(await colonneExiste(table, colonne))) absentes.push(colonne)
    }

    if (absentes.length === 0) {
      console.log(`  ${table.padEnd(26)} ✓ ${attendues.length} colonnes`)
    } else {
      manquantes += absentes.length
      console.log(`  ${table.padEnd(26)} ✗ MANQUE : ${absentes.join(', ')}`)
    }
  }

  console.log(`\n  ${verifiees} colonnes vérifiées sur ${Object.keys(TABLES).length} tables.`)

  if (manquantes === 0 && tablesAbsentes.length === 0) {
    console.log('\n✓ La base correspond à ce que le code attend.')
    return
  }

  console.log(
    `\n✗ ${manquantes} colonne(s) manquante(s)` +
      (tablesAbsentes.length ? `, ${tablesAbsentes.length} table(s) inaccessible(s)` : '') +
      '.\n  Une migration a probablement été écrite sans être appliquée.',
  )
  process.exit(1)
}

main().catch((erreur) => {
  console.error(erreur)
  process.exit(1)
})
