import { NextResponse, type NextRequest } from 'next/server'

import { empreinte, rassemblerDonnees, rendrePdf } from '@/lib/quittance'
import { creerClientAdmin } from '@/lib/supabase/admin'
import { creerClientServeur } from '@/lib/supabase/serveur'

/**
 * Téléchargement du PDF d'une quittance.
 *
 * ─── Deux demandeurs légitimes, deux chemins d'autorisation ─────────────────
 *
 *   le bailleur   les RLS de `quittances` répondent : un identifiant deviné
 *                 ne rend rien.
 *   le locataire  `ma_quittance()` répond : la fonction déduit l'appelant de
 *                 sa session et rend zéro ligne si le document n'est pas le
 *                 sien.
 *
 * Le second chemin n'est essayé QUE si le premier n'a rien rendu. Aucune
 * ligne de l'autorisation du bailleur n'est touchée : ce qui marchait hier
 * marche à l'identique.
 *
 * ─── Pourquoi le locataire ne passe pas par les RLS ─────────────────────────
 *
 * Parce que les politiques de `quittances` disent `auth.uid() = bailleur_id`,
 * et qu'un locataire n'est le bailleur de personne. Les réécrire pour lui
 * aurait ouvert la table entière, colonne par colonne, à tous les locataires —
 * voir la migration 20260913000700.
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

  // ── Porte 1 : le bailleur, par les RLS ───────────────────────────────────
  const { data: quittance } = await supabase
    .from('quittances')
    .select('paiement_id, numero_document, type, date_generation, pdf_chemin, hash_sha256')
    .eq('id', id)
    .maybeSingle()

  let acces: AccesDocument | null = null

  if (quittance) {
    const { data: apposition } = await supabase
      .from('signatures_apposees')
      .select('id')
      .eq('quittance_id', id)
      .maybeSingle()

    acces = {
      paiementId: quittance.paiement_id,
      numeroDocument: quittance.numero_document,
      type: quittance.type,
      dateGeneration: quittance.date_generation,
      pdfChemin: quittance.pdf_chemin,
      hash: quittance.hash_sha256,
      signee: Boolean(apposition),
    }
  } else {
    // ── Porte 2 : le locataire, par sa surface d'accès ─────────────────────
    const { data: lignes } = await supabase.rpc('ma_quittance', { p_quittance_id: id })
    const mienne = lignes?.[0]

    if (mienne) {
      /*
       * Le chemin du fichier est relu ICI, avec la clé d'administration, et
       * pas rendu par la fonction.
       *
       * `ma_quittance()` est exécutable par `authenticated` : tout ce qu'elle
       * rend est atteignable depuis un navigateur avec la clé publique. Or
       * `pdf_chemin` commence par l'identifiant de compte du bailleur. La
       * fonction établit donc l'appartenance, et le serveur — seul — fait le
       * lien avec le fichier.
       */
      const { data: fichier } = await creerClientAdmin()
        .from('quittances')
        .select('pdf_chemin')
        .eq('id', id)
        .maybeSingle()

      acces = {
        paiementId: mienne.paiement_id,
        numeroDocument: mienne.numero_document,
        type: mienne.type,
        dateGeneration: mienne.date_generation,
        pdfChemin: fichier?.pdf_chemin ?? null,
        hash: mienne.hash_sha256,
        signee: mienne.signee,
      }
    }
  }

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
      return reponsePdf(Buffer.from(await data.arrayBuffer()), acces.hash)
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
