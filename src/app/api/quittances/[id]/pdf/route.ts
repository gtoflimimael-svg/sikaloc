import { NextResponse, type NextRequest } from 'next/server'

import { empreinte, obtenirDocumentAutorise, rassemblerDonnees, rendrePdf } from '@/lib/quittance'
import { creerClientAdmin } from '@/lib/supabase/admin'
import { creerClientServeur } from '@/lib/supabase/serveur'

/**
 * Téléchargement du PDF d'une quittance.
 *
 * ─── Deux demandeurs légitimes, deux chemins d'autorisation ─────────────────
 *
 *   Le serveur valide la session, puis lire_quittance_autorisee vérifie
 *   propriétaire ou compte locataire et toute la chaîne de rattachement.
 *
 * ─── Le fichier est servi, pas refabriqué ───────────────────────────────────
 *
 * C'est celui du coffre dont l'empreinte SHA-256 est enregistrée : le seul que
 * le bailleur puisse opposer si le locataire conteste le document reçu, et le
 * seul que le locataire puisse opposer en retour. Le rendu à la demande ne sert
 * que de filet si le dépôt a échoué, et jamais pour un document signé.
 */

/** Ce que la route a besoin de savoir, quelle que soit la porte empruntée. */
interface AccesDocument {
  paiementId: string
  numeroDocument: string | null
  type: string
  dateGeneration: string
  pdfChemin: string | null
  hash: string | null
  /** Une signature est apposée : le document ne se refabrique pas. */
  signee: boolean
}

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

  // Une seule lecture SQL lie demandeur, paiement, bail, logement et fichier.
  // L'identité est revalidée dans le helper privilégié lui-même.
  const document = await obtenirDocumentAutorise(id)
  const q = document?.quittance
  const acces: AccesDocument | null = document && q ? {
    paiementId: q.paiement_id,
    numeroDocument: q.numero_document,
    type: q.type,
    dateGeneration: q.date_generation,
    pdfChemin: q.pdf_chemin,
    hash: q.hash_sha256,
    signee: document.signee,
  } : null

  if (!acces) {
    // Même réponse pour « ce document n'existe pas » et « il ne vous appartient
    // pas » : distinguer les deux dirait à un curieux que l'identifiant qu'il a
    // deviné correspond à un document réel.
    return NextResponse.json({ erreur: 'Document introuvable.' }, { status: 404 })
  }

  const nomFichier = `${acces.type}-${acces.numeroDocument}.pdf`

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

  if (acces.pdfChemin) {
    const admin = creerClientAdmin()
    const { data, error } = await admin.storage.from('quittances').download(acces.pdfChemin)

    if (!error && data) {
      const pdf = Buffer.from(await data.arrayBuffer())
      if (acces.hash && empreinte(pdf) !== acces.hash) {
        return NextResponse.json(
          { erreur: 'Le contenu du document ne correspond pas à son empreinte enregistrée. Contactez le support.' },
          { status: 503, headers: { 'Cache-Control': 'private, no-store' } },
        )
      }
      return reponsePdf(pdf, acces.hash)
    }

    // Le chemin existe mais le coffre n'a pas répondu : c'est un incident, pas
    // une destruction. On le dit comme tel et on ne refabrique rien.
    return NextResponse.json(
      {
        erreur:
          'Le fichier de ce document est momentanément indisponible. ' +
          'Réessayez dans quelques instants.',
      },
      { status: 503 },
    )
  }

  /*
   * ─── Le fichier a-t-il DÉJÀ existé ? ──────────────────────────────────────
   *
   * `pdf_chemin` et `hash_sha256` sont écrits ensemble, en une seule mise à
   * jour, au moment du dépôt. Un hash SANS chemin n'a donc qu'une cause :
   * `prive.purger_donnees_personnelles()`, la purge J+90 qui suit un impayé
   * d'abonnement. Elle met `pdf_chemin` à NULL et fait effacer l'objet, mais
   * laisse la ligne, le numéro et le hash.
   *
   * Sans ce contrôle, le repli ci-dessous refabriquait un PDF à partir des
   * données PURGÉES — locataire « Locataire anonymisé », adresse du bailleur
   * vide, cadre de signature vide — et le servait SOUS LE NUMÉRO D'ORIGINE,
   * avec une empreinte recalculée. Une pièce comptable inventée portant le
   * numéro d'une vraie : c'est le contraire de ce que ce produit promet.
   *
   * Le nier serait pire que l'absence : on dit que le document a été détruit,
   * et pourquoi.
   */
  if (acces.hash) {
    return NextResponse.json(
      {
        erreur:
          'Ce document n’est plus disponible : son fichier a été supprimé lors ' +
          'de la purge des données, 90 jours après la résiliation du compte du ' +
          'bailleur. Il ne peut pas être refabriqué — les informations qu’il ' +
          'portait n’existent plus.',
      },
      { status: 410 },
    )
  }

  /*
   * Ni chemin ni empreinte : le document n'a jamais été déposé. Le dépôt a
   * échoué à la génération, et c'est précisément le cas pour lequel ce repli
   * existe.
   *
   * Signé : on refuse quand même. Le rendu à la volée utiliserait la signature
   * ACTUELLE du profil — un bailleur ayant changé de signature servirait, sous
   * le même numéro, un document portant une autre main.
   */
  if (acces.signee) {
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

  // Non signé et jamais déposé : le repli garde son sens, rien n'est figé.
  const donnees = await rassemblerDonnees(acces.paiementId, {
    numeroDocument: acces.numeroDocument ?? '',
    dateGeneration: acces.dateGeneration,
  })

  if (!donnees) {
    return NextResponse.json({ erreur: 'Document incomplet.' }, { status: 404 })
  }

  const pdf = await rendrePdf(donnees)
  return reponsePdf(pdf, empreinte(pdf))
}
