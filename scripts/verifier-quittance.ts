/**
 * Vérifie le cœur documentaire de Sikaloc sans base de données :
 *   1. la conversion des montants en toutes lettres (mention légale obligatoire) ;
 *   2. le rendu du PDF de quittance.
 *
 *   npm run verifier:quittance
 *
 * Le PDF de démonstration est écrit dans `apercu-quittance.pdf` à la racine du
 * projet — pratique pour relire le template sans lancer l'application.
 */

import { writeFile } from 'node:fs/promises'
import { createElement } from 'react'

import { renderToBuffer } from '@react-pdf/renderer'

import {
  DocumentQuittance,
  type DonneesQuittance,
} from '../src/lib/pdf/document-quittance'
import { montantEnLettres } from '../src/lib/montant-en-lettres'

// ─── 1. Montants en lettres ──────────────────────────────────────────────────

const CAS: [number, string][] = [
  [0, 'zéro'],
  [1, 'un'],
  [7, 'sept'],
  [16, 'seize'],
  [17, 'dix-sept'],
  [20, 'vingt'],
  [21, 'vingt et un'],
  [31, 'trente et un'],
  [70, 'soixante-dix'],
  [71, 'soixante et onze'],
  [77, 'soixante-dix-sept'],
  [80, 'quatre-vingts'],
  [81, 'quatre-vingt-un'],
  [91, 'quatre-vingt-onze'],
  [99, 'quatre-vingt-dix-neuf'],
  [100, 'cent'],
  [101, 'cent un'],
  [200, 'deux cents'],
  [250, 'deux cent cinquante'],
  [1000, 'mille'],
  [1001, 'mille un'],
  [2000, 'deux mille'],
  // « quatre-vingts » perd son s devant mille, qui est un adjectif numéral.
  [80_000, 'quatre-vingt mille'],
  [200_000, 'deux cent mille'],
  [60_000, 'soixante mille'],
  [150_000, 'cent cinquante mille'],
  [1_000_000, 'un million'],
  [2_000_000, 'deux millions'],
  [1_250_000, 'un million deux cent cinquante mille'],
  // Devant « millions », qui est un nom, l'accord est conservé.
  [200_000_000, 'deux cents millions'],
  [1_000_000_000, 'un milliard'],
]

let echecs = 0

console.log('── Montants en lettres ──────────────────────────────────────────')

for (const [valeur, attendu] of CAS) {
  const obtenu = montantEnLettres(valeur)
  const ok = obtenu === attendu

  if (!ok) echecs += 1

  console.log(
    `${ok ? '  ok  ' : ' ÉCHEC'} ${String(valeur).padStart(13)} → ${obtenu}` +
      (ok ? '' : `   (attendu : ${attendu})`),
  )
}

// ─── 2. Rendu du PDF ─────────────────────────────────────────────────────────

const exemple: DonneesQuittance = {
  numeroDocument: 'Q-8F3A2-20260817-9X4K',
  type: 'Quittance',
  dateGeneration: new Date('2026-08-17T14:32:00').toISOString(),
  pays: 'Bénin',

  bailleurNom: 'Koffi Adjovi',
  bailleurTelephone: '+229 97 12 34 56',
  bailleurAdresse: 'Lot 118, Quartier Haie Vive, Cotonou',

  locataireNom: 'Awa Kponou',
  locataireTelephone: '+229 96 55 44 33',

  logementAdresse: 'Lot 42, Quartier Fidjrossè',
  logementVille: 'Cotonou',
  logementPays: 'Bénin',
  logementType: 'Appartement',

  loyerMensuel: 60_000,
  periodeDebut: '2026-08-01',
  periodeFin: '2026-08-31',

  montant: 60_000,
  datePaiement: '2026-08-05',
  modePaiement: 'Mobile Money',
  typePaiement: 'Loyer',
  estPartiel: false,

  signatureDataUri: null,
  signatureLocataireDataUri: null,
}

// Le script tourne en CommonJS (le projet n'est pas en `type: module`) : le
// top-level await y est refusé, d'où cette fonction d'entrée.
async function rendreExemples(): Promise<void> {
  console.log('\n── Rendu PDF ────────────────────────────────────────────────────')

  try {
    const pdf = await renderToBuffer(
      createElement(DocumentQuittance, exemple) as Parameters<typeof renderToBuffer>[0],
    )

    await writeFile('apercu-quittance.pdf', pdf)
    console.log(`  ok   Quittance rendue (${(pdf.length / 1024).toFixed(1)} Ko)`)
    console.log('       → apercu-quittance.pdf')

    // Variante « Reçu » : paiement partiel.
    const recu = await renderToBuffer(
      createElement(DocumentQuittance, {
        ...exemple,
        numeroDocument: 'R-8F3A2-20260817-2M7B',
        type: 'Reçu',
        montant: 35_000,
        estPartiel: true,
      }) as Parameters<typeof renderToBuffer>[0],
    )

    await writeFile('apercu-recu.pdf', recu)
    console.log(`  ok   Reçu partiel rendu (${(recu.length / 1024).toFixed(1)} Ko)`)
    console.log('       → apercu-recu.pdf')

    // Cas fiscal : espèces au-delà de 100 000 FCFA, seul cas où le droit de
    // timbre est réellement susceptible de s'appliquer (art. 423 du CGI).
    const especes = await renderToBuffer(
      createElement(DocumentQuittance, {
        ...exemple,
        numeroDocument: '2026-0007',
        loyerMensuel: 150_000,
        montant: 150_000,
        modePaiement: 'Espèces',
      }) as Parameters<typeof renderToBuffer>[0],
    )

    await writeFile('apercu-especes.pdf', especes)
    console.log(`  ok   Quittance espèces > 100 000 (${(especes.length / 1024).toFixed(1)} Ko)`)
    console.log('       → apercu-especes.pdf')
  } catch (erreur) {
    echecs += 1
    console.error('  ÉCHEC du rendu PDF :', erreur)
  }

  console.log(
    echecs === 0
      ? '\n✓ Tout est conforme.\n'
      : `\n✗ ${echecs} vérification(s) en échec.\n`,
  )

  process.exit(echecs === 0 ? 0 : 1)
}

void rendreExemples()
