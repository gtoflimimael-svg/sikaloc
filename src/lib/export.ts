import 'server-only'

import { zipSync } from 'fflate'

import { formaterDate, formaterHorodatage } from '@/lib/format'
import { creerClientAdmin } from '@/lib/supabase/admin'

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
  const texte = String(valeur)
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

  const [bailleur, logements, locataires, baux, paiements, quittances] = await Promise.all([
    admin.from('bailleurs').select('*').eq('id', bailleurId).maybeSingle(),
    admin.from('logements').select('*').eq('bailleur_id', bailleurId),
    admin.from('locataires').select('*').eq('bailleur_id', bailleurId),
    admin.from('baux').select('*').eq('bailleur_id', bailleurId),
    admin.from('paiements').select('*').eq('bailleur_id', bailleurId).order('date_paiement'),
    admin.from('quittances').select('*').eq('bailleur_id', bailleurId).order('date_generation'),
  ])

  const fichiers: Record<string, [Uint8Array, { level: 0 | 6 }]> = {}
  const texte = (contenu: string) => new TextEncoder().encode(contenu)

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
    const { data, error } = await admin.storage.from('quittances').download(q.pdf_chemin)
    if (error || !data) {
      pdfManquants++
      continue
    }
    const nom = `quittances/${q.type}-${q.numero_document ?? q.id}.pdf`
    fichiers[nom] = [new Uint8Array(await data.arrayBuffer()), { level: 0 }]
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
