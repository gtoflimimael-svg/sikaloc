import 'server-only'

import { readdirSync, readFileSync } from 'node:fs'
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

/** Objet déclaré par une migration mais introuvable dans la base. */
export interface ObjetManquant {
  categorie: string
  nom: string
  /** Fichier de migration qui le déclare — désigne la migration à appliquer. */
  migration: string
}

export interface RapportSchema {
  conforme: boolean
  tablesVerifiees: number
  colonnesVerifiees: number
  ecarts: EcartSchema[]
  /** Objets vérifiés au-delà des colonnes : contraintes, politiques, etc. */
  objetsVerifies: number
  objetsManquants: ObjetManquant[]
  /**
   * Renseigné quand l'inventaire n'a pas pu être lu — fonction absente ou
   * droits insuffisants. Distinguer « rien ne manque » de « je n'ai pas pu
   * regarder » est le cœur du problème que ce module traite.
   */
  inventaireIndisponible?: string
}

/** Extrait les noms de colonnes d'un bloc `export type X = { … }`. */
function colonnesAttendues(source: string, nomType: string): string[] {
  const debut = source.indexOf(`export type ${nomType} = {`)
  if (debut === -1) return []
  const fin = source.indexOf('\n}', debut)

  return [...source.slice(debut, fin).matchAll(/^\s{2}([a-z_][a-z0-9_]*)\??:/gm)].map((m) => m[1])
}

/**
 * Objets de schéma déclarés par les migrations, dans l'ordre des fichiers.
 *
 * Les migrations sont la bonne source de vérité ici : la panne à prévenir est
 * exactement « migration écrite, jamais appliquée ». Un objet nommé dans un
 * fichier et absent de la base désigne donc, sans ambiguïté, une migration
 * restée sur l'étagère.
 *
 * L'ordre compte : une migration peut supprimer ce qu'une précédente a créé.
 * `quittances_numero_document_key` est dans ce cas — la chercher en base serait
 * une fausse alerte.
 */
function objetsDeclares(): ObjetManquant[] {
  const dossier = join(process.cwd(), 'supabase/migrations')

  let fichiers: string[]
  try {
    fichiers = readdirSync(dossier)
      .filter((f) => f.endsWith('.sql'))
      .sort()
  } catch {
    // Les migrations ne sont pas déployées avec la fonction : dans ce cas le
    // contrôle se limite aux colonnes, ce que l'appelant saura signaler.
    return []
  }

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

  const declares = new Map<string, ObjetManquant>()

  for (const fichier of fichiers) {
    let sql: string
    try {
      sql = readFileSync(join(dossier, fichier), 'utf8')
    } catch {
      continue
    }

    // Les commentaires SQL contiennent des exemples et des noms cités ; les
    // lire produirait des attentes qu'aucune instruction ne crée.
    const instructions = sql
      .split('\n')
      .filter((ligne) => !ligne.trimStart().startsWith('--'))
      .join('\n')

    for (const { categorie, expression } of MOTIFS) {
      for (const trouve of instructions.matchAll(expression)) {
        const valeur = trouve[1] ?? trouve[2]
        if (valeur) declares.set(`${categorie}:${valeur}`, { categorie, nom: valeur, migration: fichier })
      }
    }

    for (const { categorie, expression } of SUPPRESSIONS) {
      for (const trouve of instructions.matchAll(expression)) {
        const valeur = trouve[1] ?? trouve[2]
        if (valeur) declares.delete(`${categorie}:${valeur}`)
      }
    }
  }

  return [...declares.values()]
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

  // ── Objets hors colonnes ─────────────────────────────────────────────────
  const attendus = objetsDeclares()
  const objetsManquants: ObjetManquant[] = []
  let inventaireIndisponible: string | undefined

  if (attendus.length > 0) {
    const reponse = await fetch(`${url}/rest/v1/rpc/inventaire_schema`, {
      method: 'POST',
      headers: { ...entetes, 'Content-Type': 'application/json' },
      body: '{}',
    })

    if (!reponse.ok) {
      inventaireIndisponible =
        `inventaire illisible (HTTP ${reponse.status}) — la migration ` +
        '20260824000100_inventaire_schema.sql est-elle appliquée ?'
    } else {
      const lignes = (await reponse.json()) as { categorie: string; nom: string }[]
      const presents = new Set(lignes.map((l) => `${l.categorie}:${l.nom}`))

      for (const objet of attendus) {
        if (!presents.has(`${objet.categorie}:${objet.nom}`)) objetsManquants.push(objet)
      }
    }
  }

  return {
    // Un inventaire illisible n'est pas une conformité : c'est précisément le
    // silence qui avait laissé la panne du 20 août passer trois jours.
    conforme: ecarts.length === 0 && objetsManquants.length === 0 && !inventaireIndisponible,
    tablesVerifiees: Object.keys(TABLES).length,
    colonnesVerifiees,
    ecarts,
    objetsVerifies: attendus.length,
    objetsManquants,
    ...(inventaireIndisponible ? { inventaireIndisponible } : {}),
  }
}

/** Résumé lisible d'un écart, pour un journal ou un email. */
export function decrireEcarts(rapport: RapportSchema): string {
  const lignes = rapport.ecarts.map((e) =>
    e.tableInaccessible
      ? `• table « ${e.table} » injoignable`
      : `• ${e.table} : ${e.colonnesManquantes.join(', ')}`,
  )

  if (rapport.inventaireIndisponible) {
    lignes.push(`• ${rapport.inventaireIndisponible}`)
  }

  // Groupé par migration : c'est le fichier à appliquer, pas l'objet isolé, qui
  // constitue l'action à mener.
  const parMigration = new Map<string, ObjetManquant[]>()
  for (const objet of rapport.objetsManquants) {
    const liste = parMigration.get(objet.migration) ?? []
    liste.push(objet)
    parMigration.set(objet.migration, liste)
  }

  for (const [migration, objets] of parMigration) {
    lignes.push(
      `• ${migration} — non appliquée ? ${objets.length} objet(s) absent(s) : ` +
        objets.map((o) => `${o.categorie} ${o.nom}`).join(', '),
    )
  }

  return lignes.join('\n')
}
