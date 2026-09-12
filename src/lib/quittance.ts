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
  options: {
    apercu?: boolean
    numeroDocument?: string
    dateGeneration?: string
    /** Copie figée de la signature, quand le document en a déjà une. */
    cheminSignature?: string | null
  } = {},
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
  //
  // `options.cheminSignature` impose la COPIE FIGÉE prise à l'apposition. Sans
  // lui, on lirait `bailleur.signature_chemin` — le chemin du moment — et une
  // refabrication rendrait l'ancienne quittance avec la signature actuelle.
  // C'est exactement ce que le dispositif d'immuabilité existe pour empêcher.
  const [signatureBailleur, signatureLocataire] = await Promise.all([
    chargerSignature(options.cheminSignature ?? bailleur.signature_chemin),
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
    /*
     * Un document déjà signé ne se refabrique pas.
     *
     * La fabrication lit la signature du profil : sans ce garde, un bailleur
     * qui change de signature puis relance l'émission obtiendrait, sous le même
     * numéro, un document portant une autre main — et le fichier archivé serait
     * écrasé, avec son empreinte.
     *
     * La fenêtre de correction de 5 minutes reste ouverte : pendant ce délai le
     * paiement n'est pas figé, et le déclencheur en base autorise le retrait de
     * l'apposition. C'est la MÊME règle que `proteger_paiement_fige`, pas une
     * seconde.
     */
    const { data: apposition } = await admin
      .from('signatures_apposees')
      .select('chemin_snapshot')
      .eq('quittance_id', existante.id)
      .maybeSingle()

    if (apposition) {
      const { error: erreurRetrait } = await admin
        .from('signatures_apposees')
        .delete()
        .eq('quittance_id', existante.id)

      if (erreurRetrait) {
        throw new Error(
          'Ce document est signé : il ne peut plus être refabriqué. ' +
            'Corrigez le paiement dans les cinq minutes suivant sa validation, ' +
            'ou enregistrez un nouveau paiement.',
        )
      }

      // Le retrait a été autorisé : la copie figée de l'ancienne apposition
      // n'a plus lieu d'être, une nouvelle sera prise ci-dessous. On la retire
      // du coffre pour ne pas y laisser d'orphelin.
      if (apposition.chemin_snapshot) {
        await admin.storage.from('signatures').remove([apposition.chemin_snapshot])
      }
    }

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

  /*
   * Le rendu utilise la signature COURANTE — et c'est correct.
   *
   * On n'arrive ici que dans deux cas : première émission, ou correction dans
   * les cinq minutes. Dans les deux, la signature du moment est bien celle que
   * le bailleur appose. La copie figée est prise juste après, sur ce qui vient
   * d'être rendu, et c'est ELLE qui protégera le document ensuite.
   *
   * `cheminSignature` reste disponible pour un rendu qui devrait reproduire une
   * apposition passée — la vérification d'intégrité, par exemple.
   */
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
  const hashDocument = empreinte(pdf)

  await admin
    .from('quittances')
    .update({ pdf_chemin: chemin, hash_sha256: hashDocument })
    .eq('id', quittanceId)

  await apposerSignature({
    quittanceId,
    bailleurId: paiement.bailleur_id,
    nomSignataire: donnees.bailleurNom,
    hashDocument,
  })

  return { id: quittanceId, numeroDocument, type }
}

/**
 * Fige la signature sur le document qui vient d'être émis.
 *
 * ─── Pourquoi une copie, et pas une référence ───────────────────────────────
 *
 * Pointer vers `bailleurs.signature_chemin` ferait suivre l'ancienne quittance
 * à chaque changement de signature. On copie donc le fichier sous
 * `<bailleur_id>/apposees/<quittance_id>.<ext>` : ni le remplacement ni la
 * suppression de la signature courante n'atteignent ce préfixe.
 *
 * ─── Pourquoi l'échec n'annule pas l'émission ───────────────────────────────
 *
 * Le document est déjà déposé et son empreinte enregistrée : la pièce existe,
 * et le PDF porte la signature incrustée. Faire échouer l'émission pour un
 * défaut de traçabilité priverait le bailleur de sa quittance sans rien
 * protéger. L'anomalie est journalisée, sans jamais rien exposer du contenu.
 */
async function apposerSignature(entree: {
  quittanceId: string
  bailleurId: string
  nomSignataire: string
  hashDocument: string
}): Promise<void> {
  const admin = creerClientAdmin()

  const { data: bailleur } = await admin
    .from('bailleurs')
    .select('signature_chemin')
    .eq('id', entree.bailleurId)
    .maybeSingle()

  let cheminSnapshot: string | null = null
  let hashSignature: string | null = null

  const source = bailleur?.signature_chemin ?? null

  if (source) {
    const { data: fichier } = await admin.storage.from('signatures').download(source)

    if (fichier) {
      const octets = Buffer.from(await fichier.arrayBuffer())
      hashSignature = empreinte(octets)

      const extension = source.split('.').pop() ?? 'png'
      const cible = `${entree.bailleurId}/apposees/${entree.quittanceId}.${extension}`

      const { error } = await admin.storage
        .from('signatures')
        .upload(cible, octets, { contentType: fichier.type || 'image/png', upsert: true })

      if (!error) cheminSnapshot = cible
    }
  }

  const { error } = await admin.from('signatures_apposees').insert({
    quittance_id: entree.quittanceId,
    bailleur_id: entree.bailleurId,
    nom_signataire: entree.nomSignataire,
    chemin_snapshot: cheminSnapshot,
    hash_document: entree.hashDocument,
    hash_signature: hashSignature,
  })

  if (error) {
    // Ni le mot de passe, ni l'empreinte, ni le chemin : seulement le document
    // concerné, pour pouvoir régulariser.
    console.error(
      `[quittance] apposition non enregistrée pour ${entree.quittanceId} : ${error.message}`,
    )
  }
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
