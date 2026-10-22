import { NextResponse } from 'next/server'

import { rendrePdf } from '@/lib/quittance'

/**
 * Exemple public de quittance — cible du lien « Voir un exemple de quittance »
 * du hero (`src/app/page.tsx`).
 *
 * Le rapport Axe 1 proposait une lightbox ou une modale ; le dépôt n'a aucun
 * composant de ce type, et le même rapport interdit d'ajouter du JavaScript
 * pour cet axe. Servir le vrai PDF résout les deux : zéro JavaScript, et le
 * visiteur voit le document réellement produit plutôt qu'une capture d'écran
 * qui se périmerait au premier changement de gabarit.
 *
 * Le document est rendu par le même `rendrePdf` que les quittances réelles :
 * il ne peut donc pas diverger du produit. Deux garde-fous le distinguent
 * d'une pièce opposable :
 *   - `apercu: true` imprime « EXEMPLE — DOCUMENT FICTIF — SANS VALEUR
 *     JUSTIFICATIVE » dans un bandeau discret ;
 *   - les données sont génériques et le numéro n'imite pas la numérotation
 *     réelle (`Q-2026…`).
 *
 * Un seul exemple, et non un par plan : depuis que la mention du droit de
 * timbre est imprimée sur toutes les quittances, les deux plans produisent le
 * même document. La route `/exemple-quittance-gratuit`, qui montrait la version
 * amputée, a disparu avec la distinction qu'elle illustrait.
 */

/** Rendu une fois au build puis servi depuis le cache : le document est fixe. */
export const dynamic = 'force-static'

export async function GET() {
  const pdf = await rendrePdf({
    numeroDocument: 'EXEMPLE-SIKALOC',
    type: 'Quittance',
    // Date fixe : `force-static` fige la réponse, une date « du jour » y serait
    // gelée au build et vieillirait à vue d'œil sur le document.
    dateGeneration: '2026-03-05T10:30:00.000Z',
    pays: 'Bénin',

    bailleurNom: 'Bailleur de démonstration',
    bailleurTelephone: '',
    bailleurAdresse: null,

    locataireNom: 'Locataire de démonstration',
    locataireTelephone: '',

    logementAdresse: 'Logement de démonstration',
    logementVille: 'Cotonou',
    logementPays: 'Bénin',
    logementType: 'Appartement de démonstration',

    loyerMensuel: 75_000,
    periodeDebut: '2026-03-01',
    periodeFin: '2026-03-31',

    montant: 75_000,
    datePaiement: '2026-03-05',
    modePaiement: 'Mobile Money',
    typePaiement: 'Loyer',
    estPartiel: false,

    // Aucune signature : un exemple public ne doit pas diffuser de signature,
    // même dessinée. Le gabarit imprime alors son cadre de signature vide.
    signatureDataUri: null,
    signatureLocataireDataUri: null,

    apercu: true,
  })

  return new NextResponse(pdf as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      // `inline` : le même PDF peut s'ouvrir dans l'onglet et dans l'aperçu
      // intégré de l'accueil, sans copie HTML du modèle documentaire.
      'Content-Disposition': 'inline; filename="exemple-quittance-sikaloc.pdf"',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  })
}
