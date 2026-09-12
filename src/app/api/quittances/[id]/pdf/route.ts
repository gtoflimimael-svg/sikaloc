import { NextResponse, type NextRequest } from 'next/server'

import { empreinte, rassemblerDonnees, rendrePdf } from '@/lib/quittance'
import { creerClientAdmin } from '@/lib/supabase/admin'
import { creerClientServeur } from '@/lib/supabase/serveur'

/**
 * Téléchargement du PDF d'une quittance par son bailleur.
 *
 * La lecture passe par le client authentifié : les RLS de `quittances` font
 * l'autorisation, un identifiant deviné ne renvoie rien.
 *
 * Le fichier est servi depuis le coffre, et non régénéré à la volée : c'est
 * celui-là dont l'empreinte SHA-256 est enregistrée, donc le seul que le
 * bailleur puisse opposer si le locataire conteste le document reçu. Le rendu à
 * la demande ne sert que de filet si le dépôt a échoué.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await creerClientServeur()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ erreur: 'Authentification requise.' }, { status: 401 })
  }

  const { data: quittance } = await supabase
    .from('quittances')
    .select('paiement_id, numero_document, type, date_generation, pdf_chemin, hash_sha256')
    .eq('id', id)
    .maybeSingle()

  if (!quittance) {
    return NextResponse.json({ erreur: 'Document introuvable.' }, { status: 404 })
  }

  const nomFichier = `${quittance.type}-${quittance.numero_document}.pdf`

  function reponsePdf(pdf: Buffer, hash: string | null) {
    return new NextResponse(pdf as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${nomFichier}"`,
        'Cache-Control': 'private, no-store',
        // Permet de vérifier l'intégrité sans rouvrir l'application.
        ...(hash ? { 'X-Document-SHA256': hash } : {}),
      },
    })
  }

  /*
   * Un document signé ne se refabrique pas, même en repli.
   *
   * Le repli existait pour servir quand même un PDF si le coffre était
   * momentanément injoignable. Mais il rendait à la volée, avec la signature
   * ACTUELLE du profil : un bailleur ayant changé de signature aurait
   * téléchargé, sous le même numéro, un document portant une autre main — sans
   * rien remarquer. Mieux vaut une erreur franche qu'un document silencieusement
   * différent de celui qui a été remis au locataire.
   */
  const { data: apposition } = await supabase
    .from('signatures_apposees')
    .select('id')
    .eq('quittance_id', id)
    .maybeSingle()

  if (quittance.pdf_chemin) {
    const admin = creerClientAdmin()
    const { data, error } = await admin.storage
      .from('quittances')
      .download(quittance.pdf_chemin)

    if (!error && data) {
      return reponsePdf(Buffer.from(await data.arrayBuffer()), quittance.hash_sha256)
    }
  }

  // Le fichier n'est pas (ou plus) dans le coffre.
  //
  // Signé : on refuse. Refabriquer produirait un document différent de celui
  // qui a été remis, et le remettrait sous le même numéro.
  if (apposition) {
    return NextResponse.json(
      {
        erreur:
          'Ce document est signé et son fichier est momentanément indisponible. ' +
          'Il ne peut pas être refabriqué : la signature apposée ne serait plus ' +
          'celle d’origine. Réessayez dans quelques instants.',
      },
      { status: 503 },
    )
  }

  // Non signé : le repli garde son sens, rien n'est figé.
  const donnees = await rassemblerDonnees(quittance.paiement_id, {
    numeroDocument: quittance.numero_document ?? '',
    dateGeneration: quittance.date_generation,
  })

  if (!donnees) {
    return NextResponse.json({ erreur: 'Document incomplet.' }, { status: 404 })
  }

  const pdf = await rendrePdf(donnees)
  return reponsePdf(pdf, empreinte(pdf))
}
