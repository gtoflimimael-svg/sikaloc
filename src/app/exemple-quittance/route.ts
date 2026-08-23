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
 *   - `apercu: true` imprime le filigrane « APERÇU » en travers de la page ;
 *   - les données sont fictives, et le numéro de document le dit en toutes
 *     lettres plutôt que d'imiter la numérotation réelle (`Q-2026…`).
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
      // `inline` : le PDF s'ouvre dans l'onglet plutôt que de tomber dans les
      // téléchargements. Sur mobile, un téléchargement sort le visiteur du
      // parcours d'inscription, dont c'est ici la dernière hésitation.
      'Content-Disposition': 'inline; filename="exemple-quittance-sikaloc.pdf"',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  })
}
