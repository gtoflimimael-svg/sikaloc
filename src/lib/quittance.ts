import 'server-only'

import { createHash } from 'node:crypto'
import { createElement } from 'react'

import { DocumentQuittance, type DonneesQuittance } from '@/lib/pdf/document-quittance'
import { creerClientAdmin } from '@/lib/supabase/admin'

/** Durée de validité du lien de téléchargement transmis au locataire (§9.2). */
export const VALIDITE_LIEN_SECONDES = 30 * 24 * 60 * 60

/**
 * Numérotation — v2.1 §2.3 : format `AAAA-NNNN`, séquentiel par bailleur.
 *
 * Le numéro n'est plus calculé ici : le trigger `attribuer_numero_document` le
 * pose au moment de l'insertion, via un `insert … on conflict do update …
 * returning` sur la table des compteurs. Postgres y prend un verrou de ligne,
 * ce qui rend l'attribution atomique même sur deux émissions simultanées — ce
 * qui n'aurait pas été le cas d'un compteur calculé côté application.
 *
 * Corollaire : l'application n'a aucun moyen de forcer un numéro, et le
 * document reçoit toujours celui que la base lui attribue.
 */

/** Empreinte SHA-256 du fichier, pour vérifier qu'il n'a pas été altéré. */
export function empreinte(pdf: Buffer): string {
  return createHash('sha256').update(pdf).digest('hex')
}

/** Charge une signature (bailleur ou locataire) et l'encode en data URI pour le PDF. */
async function chargerSignature(chemin: string | null): Promise<string | null> {
  if (!chemin) return null

  try {
    const admin = creerClientAdmin()
    const { data, error } = await admin.storage.from('signatures').download(chemin)
    if (error || !data) return null

    const buffer = Buffer.from(await data.arrayBuffer())
    const typeMime = data.type || 'image/png'

    return `data:${typeMime};base64,${buffer.toString('base64')}`
  } catch {
    // Une signature illisible ne doit pas empêcher d'émettre la quittance :
    // le document sort avec un cadre de signature vide.
    return null
  }
}

interface PaiementComplet {
  id: string
  bailleur_id: string
  bail_id: string
  montant: number
  date_paiement: string
  periode_debut: string
  periode_fin: string
  mode_paiement: string
  type_paiement: string
  est_partiel: boolean
  statut: string
}

/**
 * Rassemble tout ce que le PDF doit imprimer.
 *
 * Lecture via le client admin : la génération est déclenchée depuis une action
 * serveur qui a déjà vérifié la propriété du paiement, et le webhook de
 * régénération n'a pas de session.
 */
export async function rassemblerDonnees(
  paiementId: string,
  options: { apercu?: boolean; numeroDocument?: string; dateGeneration?: string } = {},
): Promise<DonneesQuittance | null> {
  const admin = creerClientAdmin()

  const { data: paiement } = await admin
    .from('paiements')
    .select('*')
    .eq('id', paiementId)
    .single<PaiementComplet>()

  if (!paiement) return null

  const [{ data: bail }, { data: bailleur }] = await Promise.all([
    admin
      .from('baux')
      .select(
        'loyer_mensuel, logement:logements(adresse, ville, pays, type), locataire:locataires(nom, telephone, signature_chemin)',
      )
      .eq('id', paiement.bail_id)
      .single(),
    admin
      .from('bailleurs')
      .select('nom, telephone, adresse, signature_chemin, plan, date_fin_abonnement')
      .eq('id', paiement.bailleur_id)
      .single(),
  ])

  if (!bail || !bailleur) return null

  // PostgREST renvoie les relations to-one comme objet, mais le typage généré
  // les décrit parfois comme tableau : on normalise les deux formes.
  const logement = Array.isArray(bail.logement) ? bail.logement[0] : bail.logement
  const locataire = Array.isArray(bail.locataire) ? bail.locataire[0] : bail.locataire

  if (!logement || !locataire) return null

  const type: 'Quittance' | 'Reçu' = paiement.est_partiel ? 'Reçu' : 'Quittance'

  // Les deux signatures sont indépendantes : les charger en parallèle évite de
  // doubler la latence de deux allers-retours Storage successifs.
  const [signatureBailleur, signatureLocataire] = await Promise.all([
    chargerSignature(bailleur.signature_chemin),
    chargerSignature(locataire.signature_chemin ?? null),
  ])

  return {
    // Le numéro vient toujours de la base (trigger d'attribution) ; il est
    // passé ici après l'insertion de la ligne `quittances`.
    numeroDocument: options.numeroDocument ?? '',
    type,
    dateGeneration: options.dateGeneration ?? new Date().toISOString(),
    pays: logement.pays ?? 'Bénin',

    bailleurNom: bailleur.nom,
    bailleurTelephone: bailleur.telephone,
    bailleurAdresse: bailleur.adresse,

    locataireNom: locataire.nom,
    locataireTelephone: locataire.telephone,
    signatureLocataireDataUri: signatureLocataire,

    logementAdresse: logement.adresse,
    logementVille: logement.ville,
    logementPays: logement.pays ?? 'Bénin',
    logementType: logement.type,

    loyerMensuel: Number(bail.loyer_mensuel),
    periodeDebut: paiement.periode_debut,
    periodeFin: paiement.periode_fin,

    montant: Number(paiement.montant),
    datePaiement: paiement.date_paiement,
    modePaiement: paiement.mode_paiement,
    typePaiement: paiement.type_paiement,
    estPartiel: paiement.est_partiel,

    signatureDataUri: signatureBailleur,
    apercu: options.apercu,
  }
}

/** Rend le PDF en mémoire. */
export async function rendrePdf(donnees: DonneesQuittance): Promise<Buffer> {
  // Import différé : @react-pdf/renderer pèse lourd et ne doit être chargé que
  // lorsqu'un document est réellement produit.
  const { renderToBuffer } = await import('@react-pdf/renderer')

  // `renderToBuffer` est typé sur les props de <Document>, alors qu'on lui
  // passe un composant qui *rend* un <Document>. Le cast est sûr : la racine
  // de DocumentQuittance est bien un <Document>.
  const element = createElement(DocumentQuittance, donnees) as Parameters<
    typeof renderToBuffer
  >[0]

  return renderToBuffer(element)
}

export interface QuittanceGeneree {
  id: string
  numeroDocument: string
  type: 'Quittance' | 'Reçu'
}

/**
 * Génère le PDF, le dépose dans le bucket privé et enregistre la quittance.
 *
 * Idempotent : si une quittance existe déjà pour ce paiement, elle est
 * régénérée sur place (même numéro, même chemin). C'est ce qui permet de
 * corriger un paiement pendant la fenêtre de 5 minutes sans laisser traîner
 * deux documents contradictoires portant des numéros différents.
 */
export async function genererEtStocker(paiementId: string): Promise<QuittanceGeneree> {
  const admin = creerClientAdmin()

  const { data: paiement } = await admin
    .from('paiements')
    .select('bailleur_id, bail_id, est_partiel')
    .eq('id', paiementId)
    .single()

  if (!paiement) throw new Error('Paiement introuvable.')

  const type: 'Quittance' | 'Reçu' = paiement.est_partiel ? 'Reçu' : 'Quittance'

  const { data: existante } = await admin
    .from('quittances')
    .select('id, numero_document')
    .eq('paiement_id', paiementId)
    .maybeSingle()

  /*
   * La ligne est écrite AVANT le rendu : c'est elle qui porte le numéro
   * (attribué par le trigger) et l'horodatage (`now()` de Postgres). Le PDF est
   * ensuite rendu à partir de ces valeurs, jamais l'inverse — l'application ne
   * choisit ni son numéro ni sa date d'émission (v2.1 §2.3 et §2.4).
   */
  let quittanceId: string
  let numeroDocument: string
  let dateGeneration: string

  if (existante) {
    // Régénération : le numéro identifie le document et ne bouge pas ; la date
    // est rafraîchie car le contenu a pu changer pendant la fenêtre de
    // correction.
    const { data, error } = await admin
      .from('quittances')
      .update({ type })
      .eq('id', existante.id)
      .select('id, numero_document, date_generation')
      .single()

    if (error || !data) {
      throw new Error(`Mise à jour du document impossible : ${error?.message ?? 'inconnu'}`)
    }

    quittanceId = data.id
    numeroDocument = data.numero_document ?? ''
    dateGeneration = data.date_generation
  } else {
    const { data, error } = await admin
      .from('quittances')
      .insert({
        bailleur_id: paiement.bailleur_id,
        paiement_id: paiementId,
        bail_id: paiement.bail_id,
        // Laissé vide à dessein : le trigger pose AAAA-NNNN de façon atomique.
        numero_document: null,
        type,
        pays: 'Bénin',
      })
      .select('id, numero_document, date_generation')
      .single()

    if (error || !data) {
      throw new Error(`L'enregistrement du document a échoué : ${error?.message ?? 'inconnu'}`)
    }

    quittanceId = data.id
    numeroDocument = data.numero_document ?? ''
    dateGeneration = data.date_generation
  }

  const donnees = await rassemblerDonnees(paiementId, { numeroDocument, dateGeneration })

  if (!donnees) {
    throw new Error("Le paiement est introuvable ou incomplet : impossible d'émettre le document.")
  }

  const pdf = await rendrePdf(donnees)
  const chemin = `${paiement.bailleur_id}/${numeroDocument}.pdf`

  const { error: erreurUpload } = await admin.storage
    .from('quittances')
    .upload(chemin, pdf, { contentType: 'application/pdf', upsert: true })

  if (erreurUpload) {
    throw new Error(`Le dépôt du document a échoué : ${erreurUpload.message}`)
  }

  // L'empreinte porte sur le fichier réellement déposé : c'est celui-là que le
  // locataire téléchargera, et c'est donc lui qu'il faut pouvoir vérifier.
  await admin
    .from('quittances')
    .update({ pdf_chemin: chemin, hash_sha256: empreinte(pdf) })
    .eq('id', quittanceId)

  return { id: quittanceId, numeroDocument, type }
}

/**
 * URL signée valable 30 jours — c'est le lien envoyé au locataire par WhatsApp.
 *
 * Le bucket reste privé : sans signature valide, le document est inaccessible.
 */
export async function urlSignee(cheminPdf: string): Promise<string | null> {
  const admin = creerClientAdmin()

  const { data, error } = await admin.storage
    .from('quittances')
    .createSignedUrl(cheminPdf, VALIDITE_LIEN_SECONDES)

  if (error || !data) return null

  return data.signedUrl
}
