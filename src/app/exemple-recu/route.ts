import { NextResponse } from 'next/server'

import { rendrePdf } from '@/lib/quittance'

/**
 * Exemple public de REÇU — le pendant de `/exemple-quittance`.
 *
 * La distinction entre quittance et reçu est le point que les carnets ignorent
 * et que Sikaloc tranche tout seul. La montrer suppose de montrer les deux
 * documents : un visiteur à qui l'on décrit une différence sans la lui mettre
 * sous les yeux doit croire sur parole.
 *
 * Même `rendrePdf` que les documents réels, mêmes garde-fous que l'exemple de
 * quittance : filigrane « APERÇU », données fictives, numéro qui n'imite pas la
 * numérotation réelle, aucune signature diffusée.
 *
 * Les chiffres sont ceux de l'exemple de quittance — même bail, même locataire,
 * même période — pour que les deux documents se comparent ligne à ligne. Seul
 * le montant versé change : 45 000 sur un loyer de 75 000, soit 30 000 de
 * solde, que le document calcule et imprime.
 */

/** Rendu une fois au build puis servi depuis le cache : le document est fixe. */
export const dynamic = 'force-static'

export async function GET() {
  const pdf = await rendrePdf({
    numeroDocument: 'EXEMPLE-SIKALOC',
    type: 'Reçu',
    // Date fixe : `force-static` fige la réponse, une date « du jour » y serait
    // gelée au build et vieillirait à vue d'œil sur le document.
    dateGeneration: '2026-03-05T10:30:00.000Z',
    pays: 'Bénin',

    bailleurNom: 'Awa Hounkpatin',
    bailleurTelephone: '+229 97 00 00 00',
    bailleurAdresse: 'Lot 128, Cadjèhoun, Cotonou',

    locataireNom: 'Koffi Adjovi',
    locataireTelephone: '+229 96 00 00 00',

    logementAdresse: 'Appartement B2, rue 12.045, Fidjrossè',
    logementVille: 'Cotonou',
    logementPays: 'Bénin',
    logementType: 'Appartement 2 chambres',

    loyerMensuel: 75_000,
    periodeDebut: '2026-03-01',
    periodeFin: '2026-03-31',

    montant: 45_000,
    datePaiement: '2026-03-05',
    modePaiement: 'Mobile Money',
    typePaiement: 'Loyer',
    estPartiel: true,

    signatureDataUri: null,
    signatureLocataireDataUri: null,

    apercu: true,
  })

  return new NextResponse(pdf as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="exemple-recu-sikaloc.pdf"',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  })
}
