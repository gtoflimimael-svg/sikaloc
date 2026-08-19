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

  if (quittance.pdf_chemin) {
    const admin = creerClientAdmin()
    const { data, error } = await admin.storage
      .from('quittances')
      .download(quittance.pdf_chemin)

    if (!error && data) {
      return reponsePdf(Buffer.from(await data.arrayBuffer()), quittance.hash_sha256)
    }
  }

  // Repli : le fichier n'est pas (ou plus) dans le coffre.
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
