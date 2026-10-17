import 'server-only'

import { createHash } from 'node:crypto'

import { zipSync } from 'fflate'

import { formaterDate, formaterHorodatage } from '@/lib/format'
import { creerClientAdmin } from '@/lib/supabase/admin'
import type { Database } from '@/lib/types/database'

/**
 * Export complet des données d'un bailleur, en archive ZIP.
 *
 * La politique de confidentialité promet que « le bailleur peut exporter ses
 * documents avant suppression », et `src/lib/acces.ts` va plus loin : un compte
 * suspendu ou supprimé n'a plus qu'un seul droit, « export uniquement ». Cette
 * fonction est donc la sortie de secours du produit — celle qui doit marcher
 * quand plus rien d'autre ne marche.
 *
 * ─── Pourquoi une archive et pas un simple tableur ──────────────────────────
 *
 * « Ses documents » désigne les quittances. Un tableau de chiffres sans les PDF
 * ne tient pas la promesse : c'est précisément au moment où l'on efface son
 * compte qu'on veut ses pièces justificatives, pas leur résumé.
 *
 * ─── Pourquoi `zipSync` et un stockage sans compression ─────────────────────
 *
 * Les PDF sont déjà compressés : les repasser dans deflate coûte du temps
 * processeur pour un gain de taille nul, parfois négatif. Les entrées sont donc
 * stockées telles quelles (`level: 0`), et seul le tableur, lui compressible,
 * est réellement compressé.
 *
 * ─── Le client à privilèges ─────────────────────────────────────────────────
 *
 * La lecture passe par `creerClientAdmin` et filtre explicitement sur
 * `bailleur_id`. C'est délibéré : un compte suspendu ou supprimé peut voir ses
 * lectures refusées par les RLS, or c'est exactement l'état où l'export doit
 * fonctionner. Le filtre explicite remplace la garantie que les RLS
 * apporteraient — il est donc la seule chose qui empêche un bailleur de lire
 * les données d'un autre, et ne doit jamais être retiré.
 */

/** Échappe une valeur pour le format CSV (RFC 4180). */
function champCsv(valeur: unknown): string {
  if (valeur === null || valeur === undefined) return ''
  const brut = String(valeur)
  // Un texte ne doit jamais être interprété comme une formule de tableur.
  const texte = typeof valeur === 'string' && /^[\s\u0000-\u001f\u007f\uFEFF]*[=+@-]/u.test(brut) ? `'${brut}` : brut
  // Guillemets, points-virgules et sauts de ligne imposent l'encadrement.
  if (/[";\n\r]/.test(texte)) return `"${texte.replaceAll('"', '""')}"`
  return texte
}

function versCsv(entetes: string[], lignes: unknown[][]): string {
  const corps = [entetes, ...lignes].map((l) => l.map(champCsv).join(';')).join('\r\n')
  // BOM UTF-8 : sans lui, Excel lit « Bénin » comme « BÃ©nin ». Le
  // point-virgule comme séparateur pour la même raison — c'est ce qu'attend
  // un Excel configuré en français.
  return '﻿' + corps
}

export interface ResultatExport {
  archive: Buffer
  nomFichier: string
  /** Pour le journal : ce que l'archive contient réellement. */
  resume: { paiements: number; quittances: number; pdf: number; pdfManquants: number }
}

export async function exporterDonnees(bailleurId: string): Promise<ResultatExport> {
  const admin = creerClientAdmin()

  const debut = Date.now()
  const verifierDelai = () => {
    if (Date.now() - debut > 200_000) throw new Error('Export trop volumineux : délai dépassé.')
  }
  let taille = 0
  const compter = (octets: number) => {
    taille += octets
    if (taille > 64 * 1024 * 1024) throw new Error('Export trop volumineux : limite mémoire préventive.')
    verifierDelai()
  }
  const signal = () => AbortSignal.timeout(15_000)
  const bailleur = await admin.from('bailleurs').select('*').eq('id', bailleurId).abortSignal(signal()).maybeSingle()
  if (bailleur.error || !bailleur.data) throw new Error('Profil export indisponible.')

  // Curseur unique : pas d’offset décalé par une insertion/suppression.
  // Le comptage initial/final détecte les changements de cardinalité ; il ne
  // remplace pas un instantané transactionnel pour les mises à jour concurrentes.
  type TableExport = 'logements' | 'locataires' | 'baux' | 'paiements' | 'quittances'
  async function lire<T extends 'logements' | 'locataires' | 'baux' | 'paiements' | 'quittances'>(table: T): Promise<{ data: Database['public']['Tables'][T]['Row'][] }> {
    const source: TableExport = table
    const initial = await admin.from(source).select('id', { count: 'exact', head: true }).eq('bailleur_id', bailleurId).abortSignal(signal())
    if (initial.error || initial.count === null || initial.count > 50_000) throw new Error('Lecture export indisponible ou trop volumineuse.')
    const lignes: NonNullable<Awaited<ReturnType<typeof page>>['data']> = []
    function page(apres?: string) {
      let q = admin.from(source).select('*').eq('bailleur_id', bailleurId).order('id').limit(500)
      if (apres) q = q.gt('id', apres)
      return q.abortSignal(signal())
    }
    let apres: string | undefined
    for (;;) {
      verifierDelai()
      const resultat = await page(apres)
      if (resultat.error || !resultat.data) throw new Error('Une page de l’export est indisponible.')
      if (!resultat.data.length) break
      for (const ligne of resultat.data) {
        if (apres && ligne.id <= apres) throw new Error('Ordre de lecture export incohérent.')
        apres = ligne.id
        compter(Buffer.byteLength(JSON.stringify(ligne)))
        lignes.push(ligne)
      }
      if (lignes.length > 50_000) throw new Error('Export trop volumineux.')
      // Une page courte peut être plafonnée par le serveur : poursuivre jusqu’à vide.
    }
    const final = await admin.from(source).select('id', { count: 'exact', head: true }).eq('bailleur_id', bailleurId).abortSignal(signal())
    if (final.error || final.count !== initial.count || lignes.length !== initial.count) throw new Error('Données modifiées pendant l’export ; réessayez.')
    return { data: lignes as Database['public']['Tables'][T]['Row'][] }
  }
  // Séquentiel : borne les réponses simultanément en mémoire.
  const logements = await lire('logements')
  const locataires = await lire('locataires')
  const baux = await lire('baux')
  const paiements = await lire('paiements')
  const quittances = await lire('quittances')
  paiements.data.sort((a, b) => (a.date_paiement ?? '').localeCompare(b.date_paiement ?? '') || a.id.localeCompare(b.id))
  quittances.data.sort((a, b) => a.date_generation.localeCompare(b.date_generation) || a.id.localeCompare(b.id))

  const fichiers: Record<string, [Uint8Array, { level: 0 | 6 }]> = {}
  const texte = (contenu: string) => {
    const octets = new TextEncoder().encode(contenu)
    compter(octets.byteLength)
    return octets
  }

  // ── Tableurs ──────────────────────────────────────────────────────────────
  const nomLocataire = new Map((locataires.data ?? []).map((l) => [l.id, l.nom]))
  const adresseLogement = new Map((logements.data ?? []).map((l) => [l.id, l.adresse]))
  const bailVers = new Map(
    (baux.data ?? []).map((b) => [b.id, { locataire: b.locataire_id, logement: b.logement_id }]),
  )

  fichiers['paiements.csv'] = [
    texte(
      versCsv(
        ['Date', 'Locataire', 'Logement', 'Période début', 'Période fin', 'Montant (FCFA)', 'Mode', 'Nature', 'Partiel', 'Statut'],
        (paiements.data ?? []).map((p) => {
          const lien = bailVers.get(p.bail_id)
          return [
            formaterDate(p.date_paiement),
            lien ? (nomLocataire.get(lien.locataire) ?? '') : '',
            lien ? (adresseLogement.get(lien.logement) ?? '') : '',
            formaterDate(p.periode_debut),
            formaterDate(p.periode_fin),
            p.montant,
            p.mode_paiement,
            p.type_paiement,
            p.est_partiel ? 'oui' : 'non',
            p.statut,
          ]
        }),
      ),
    ),
    { level: 6 },
  ]

  fichiers['quittances.csv'] = [
    texte(
      versCsv(
        ['Numéro', 'Type', 'Date de génération', 'Pays', 'Empreinte SHA-256', 'Fichier dans l’archive'],
        (quittances.data ?? []).map((q) => [
          q.numero_document ?? '',
          q.type,
          formaterHorodatage(q.date_generation),
          q.pays,
          q.hash_sha256 ?? '',
          q.pdf_chemin ? `quittances/${q.type}-${q.numero_document ?? q.id}.pdf` : 'non disponible',
        ]),
      ),
    ),
    { level: 6 },
  ]

  fichiers['logements.csv'] = [
    texte(
      versCsv(
        ['Adresse', 'Ville', 'Pays', 'Type'],
        (logements.data ?? []).map((l) => [l.adresse, l.ville, l.pays, l.type]),
      ),
    ),
    { level: 6 },
  ]

  fichiers['locataires.csv'] = [
    texte(
      versCsv(
        ['Nom', 'Téléphone', 'Email'],
        (locataires.data ?? []).map((l) => [l.nom, l.telephone, l.email ?? '']),
      ),
    ),
    { level: 6 },
  ]

  // ── PDF des quittances ────────────────────────────────────────────────────
  // Séquentiel et non en parallèle : un bailleur de longue date peut avoir des
  // centaines de quittances, et ouvrir autant de téléchargements simultanés
  // saturerait la fonction avant de rendre quoi que ce soit.
  let pdf = 0
  let pdfManquants = 0

  for (const q of quittances.data ?? []) {
    if (!q.pdf_chemin) {
      pdfManquants++
      continue
    }
    if (!q.pdf_chemin.startsWith(`${bailleurId}/`) || q.pdf_chemin.includes('..')) throw new Error('Chemin PDF hors périmètre.')
    const { data, error } = await admin.storage.from('quittances').download(q.pdf_chemin, {}, { signal: signal() })
    if (error || !data) {
      throw new Error('Un PDF référencé ne peut pas être téléchargé.')
    }
    const nom = `quittances/${q.type}-${q.numero_document ?? q.id}.pdf`
    if (/[\\/]/.test(`${q.type}-${q.numero_document ?? q.id}`) || fichiers[nom]) throw new Error('Nom de document incohérent.')
    compter(data.size)
    const octets = new Uint8Array(await data.arrayBuffer())
    if (q.hash_sha256 && createHash('sha256').update(octets).digest('hex') !== q.hash_sha256) throw new Error('Intégrité PDF invalide.')
    fichiers[nom] = [octets, { level: 0 }]
    pdf++
  }

  // ── Note de lecture ───────────────────────────────────────────────────────
  const nom = bailleur.data?.nom ?? 'Bailleur'
  fichiers['LISEZ-MOI.txt'] = [
    texte(
      [
        `Export Sikaloc — ${nom}`,
        `Généré le ${formaterHorodatage(new Date().toISOString())}`,
        '',
        'CONTENU',
        '  paiements.csv    tous vos paiements enregistrés',
        '  quittances.csv   la liste de vos quittances, avec leur empreinte',
        '  logements.csv    vos logements',
        '  locataires.csv   vos locataires',
        '  quittances/      les fichiers PDF, un par quittance',
        '',
        'Les lectures sont paginées ; cet export n’est pas un instantané transactionnel.',
        'En cas de modifications simultanées, relancez l’export pendant une période calme.',
        'Les textes pouvant être des formules sont préfixés par une apostrophe.',
        '',
        'OUVRIR LES TABLEURS',
        '  Les fichiers .csv s’ouvrent avec Excel, LibreOffice ou Google Sheets.',
        '  Le séparateur est le point-virgule.',
        '',
        'VÉRIFIER UN DOCUMENT',
        '  Chaque quittance a une empreinte SHA-256, notée dans quittances.csv.',
        '  Elle permet de démontrer qu’un PDF n’a pas été modifié depuis son',
        '  émission : recalculez l’empreinte du fichier et comparez-la.',
        '',
        pdfManquants > 0
          ? `NOTE — ${pdfManquants} quittance(s) n’ont pas de PDF associé dans le coffre.\n  Elles figurent dans quittances.csv, sans fichier correspondant.`
          : 'Toutes vos quittances sont accompagnées de leur PDF.',
        '',
        'Sikaloc n’est pas partie au contrat de bail et ne fournit aucun conseil',
        'juridique. Ces documents sont émis sous votre responsabilité.',
      ].join('\n'),
    ),
    { level: 6 },
  ]

  const horodatage = new Date().toISOString().slice(0, 10)

  verifierDelai()
  return {
    archive: Buffer.from(zipSync(fichiers)),
    nomFichier: `sikaloc-export-${horodatage}.zip`,
    resume: {
      paiements: (paiements.data ?? []).length,
      quittances: (quittances.data ?? []).length,
      pdf,
      pdfManquants,
    },
  }
}
