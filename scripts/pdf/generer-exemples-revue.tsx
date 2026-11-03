import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createElement } from 'react'

import { renderToBuffer } from '@react-pdf/renderer'

import type { DonneesQuittance } from '../../src/lib/pdf/document-quittance'
import { DocumentQuittance } from '../../src/lib/pdf/document-quittance'

const dateGeneration = '2026-03-09T10:30:00.000Z'
const base = {
  modeDocument: 'exemple' as const,
  dateGeneration,
  pays: 'Bénin',
  bailleurNom: 'Bailleur de démonstration',
  bailleurTelephone: '',
  bailleurAdresse: null,
  locataireNom: 'Locataire de démonstration',
  locataireTelephone: '',
  logementAdresse: 'Adresse fictive de démonstration',
  logementVille: 'Cotonou',
  logementPays: 'Bénin',
  logementType: 'Appartement de démonstration',
  loyerMensuel: 120_000,
  montantExigible: 120_000,
  periodeDebut: '2026-03-01',
  periodeFin: '2026-03-31',
  typePaiement: 'Loyer' as const,
  signatureDataUri: null,
  signatureLocataireDataUri: null,
}

const exemples: Array<{ fichier: string; donnees: DonneesQuittance }> = [
  {
    fichier: 'A-quittance-un-versement.pdf',
    donnees: {
      ...base,
      numeroDocument: 'EXEMPLE-QUITTANCE-01',
      type: 'Quittance',
      montant: 120_000,
      montantCumule: 120_000,
      datePaiement: '2026-03-05',
      modePaiement: 'Mobile Money',
      estPartiel: false,
      versements: [{ montant: 120_000, datePaiement: '2026-03-05', modePaiement: 'Mobile Money' }],
    },
  },
  {
    fichier: 'B-quittance-trois-versements.pdf',
    donnees: {
      ...base,
      numeroDocument: 'EXEMPLE-QUITTANCE-03',
      type: 'Quittance',
      montant: 30_000,
      montantCumule: 120_000,
      datePaiement: '2026-03-09',
      modePaiement: 'Virement',
      estPartiel: false,
      versements: [
        { montant: 40_000, datePaiement: '2026-03-01', modePaiement: 'Espèces' },
        { montant: 50_000, datePaiement: '2026-03-05', modePaiement: 'Mobile Money' },
        { montant: 30_000, datePaiement: '2026-03-09', modePaiement: 'Virement' },
      ],
    },
  },
  {
    fichier: 'C-recu-versement-partiel.pdf',
    donnees: {
      ...base,
      numeroDocument: 'EXEMPLE-RECU-PARTIEL',
      type: 'Reçu',
      montant: 40_000,
      montantCumule: 40_000,
      datePaiement: '2026-03-05',
      modePaiement: 'Mobile Money',
      estPartiel: true,
      versements: [{ montant: 40_000, datePaiement: '2026-03-05', modePaiement: 'Mobile Money' }],
    },
  },
]

async function main(): Promise<void> {
  const dossier = process.argv[2]
  if (!dossier) {
    throw new Error('Indiquez le dossier local de sortie en premier argument.')
  }

  await mkdir(dossier, { recursive: true })
  for (const exemple of exemples) {
    const element = createElement(DocumentQuittance, exemple.donnees) as Parameters<
      typeof renderToBuffer
    >[0]
    const pdf = await renderToBuffer(element)
    await writeFile(join(dossier, exemple.fichier), pdf)
    process.stdout.write(`${join(dossier, exemple.fichier)} (${pdf.byteLength} octets)\n`)
  }
}

void main().catch((erreur: unknown) => {
  process.stderr.write(`Impossible de générer les exemples PDF : ${String(erreur)}\n`)
  process.exitCode = 1
})
