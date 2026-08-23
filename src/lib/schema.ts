import 'server-only'

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Comparaison du schéma réel de la base à ce que le code attend.
 *
 * Née d'une panne : le 23 août 2026, la génération de quittance était cassée
 * depuis trois jours parce que `locataires.signature_chemin` n'existait pas en
 * production — code et migration livrés ensemble, migration jamais appliquée.
 *
 * Le silence est ce qui rend cette panne instructive. L'erreur était attrapée
 * proprement et rendue au formulaire : aucune exception serveur, rien dans les
 * journaux. Seul un utilisateur pouvait la découvrir.
 *
 * Les identifiants de migration locaux et distants ayant divergé,
 * `supabase db push` ne peut pas servir de garde-fou (il rejouerait des
 * migrations déjà appliquées sous d'autres noms). Ce module le remplace.
 *
 * La source de vérité est `src/lib/types/database.ts` : c'est la seule
 * description du schéma dont le code se sert réellement. Le fichier est lu au
 * lieu d'être importé, pour vérifier ce que la source DÉCRIT plutôt que ce que
 * le compilateur en a fait. `next.config.ts` l'inclut dans le traçage, sans
 * quoi ce chemin serait introuvable dans la fonction déployée.
 */

/** Tables du schéma `public`, associées au type qui les décrit. */
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

export interface EcartSchema {
  table: string
  /** Colonnes décrites par le code mais absentes de la base. */
  colonnesManquantes: string[]
  /** La table elle-même est injoignable. */
  tableInaccessible: boolean
}

export interface RapportSchema {
  conforme: boolean
  tablesVerifiees: number
  colonnesVerifiees: number
  ecarts: EcartSchema[]
}

/** Extrait les noms de colonnes d'un bloc `export type X = { … }`. */
function colonnesAttendues(source: string, nomType: string): string[] {
  const debut = source.indexOf(`export type ${nomType} = {`)
  if (debut === -1) return []
  const fin = source.indexOf('\n}', debut)

  return [...source.slice(debut, fin).matchAll(/^\s{2}([a-z_][a-z0-9_]*)\??:/gm)].map((m) => m[1])
}

export async function verifierSchema(): Promise<RapportSchema> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const cle = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !cle) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis pour vérifier le schéma.',
    )
  }

  const entetes = { apikey: cle, Authorization: `Bearer ${cle}` }
  const source = readFileSync(join(process.cwd(), 'src/lib/types/database.ts'), 'utf8')

  // `limit=0` : PostgREST valide la colonne demandée sans renvoyer la moindre
  // ligne. Rien des données du bailleur ne transite ici.
  const existe = async (table: string, selection: string) =>
    (await fetch(`${url}/rest/v1/${table}?select=${selection}&limit=0`, { headers: entetes })).ok

  const ecarts: EcartSchema[] = []
  let colonnesVerifiees = 0

  for (const [table, nomType] of Object.entries(TABLES)) {
    const attendues = colonnesAttendues(source, nomType)
    if (attendues.length === 0) continue

    if (!(await existe(table, '*'))) {
      ecarts.push({ table, colonnesManquantes: [], tableInaccessible: true })
      continue
    }

    const manquantes: string[] = []
    for (const colonne of attendues) {
      colonnesVerifiees++
      if (!(await existe(table, colonne))) manquantes.push(colonne)
    }

    if (manquantes.length > 0) {
      ecarts.push({ table, colonnesManquantes: manquantes, tableInaccessible: false })
    }
  }

  return {
    conforme: ecarts.length === 0,
    tablesVerifiees: Object.keys(TABLES).length,
    colonnesVerifiees,
    ecarts,
  }
}

/** Résumé lisible d'un écart, pour un journal ou un email. */
export function decrireEcarts(rapport: RapportSchema): string {
  return rapport.ecarts
    .map((e) =>
      e.tableInaccessible
        ? `• table « ${e.table} » injoignable`
        : `• ${e.table} : ${e.colonnesManquantes.join(', ')}`,
    )
    .join('\n')
}
