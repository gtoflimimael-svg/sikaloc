import 'server-only'

import { createHash } from 'node:crypto'
import { createElement } from 'react'

import { DocumentQuittance, type DonneesQuittance } from '@/lib/pdf/document-quittance'
import { creerClientAdmin } from '@/lib/supabase/admin'
import { creerClientServeur } from '@/lib/supabase/serveur'
import { bailleurAvecEcriture } from '@/lib/session'
import type {
  Bail,
  Bailleur,
  Logement,
  Locataire,
  Paiement,
  Quittance,
  TypePaiement,
} from '@/lib/types/database'
import { typeDocumentPaiement } from '@/lib/documents-paiement'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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

/** Les données du rendu proviennent d'une lecture SQL autorisée et cohérente. */
interface ContexteQuittance {
  paiement: Paiement
  bail: Bail
  bailleur: Bailleur
  logement: Logement
  locataire: Locataire
  finances?: {
    montant: number; cumul_loyer: number; loyer_mensuel: number; solde_restant: number;
    trop_percu?: number
    est_partiel: boolean; periode_debut: string; periode_fin: string;
    date_paiement: string; mode_paiement: string; type_paiement: TypePaiement
  }
}

interface DocumentAutorise {
  quittance: Quittance
  contexte: ContexteQuittance
  signee: boolean
}

export const REFUS_QUITTANCE = 'Opération impossible ou non autorisée.'

async function identiteServeur(): Promise<string> {
  const client = await creerClientServeur()
  const { data: { user }, error } = await client.auth.getUser()
  if (error || !user) throw new Error(REFUS_QUITTANCE)
  return user.id
}

/** Toujours dériver l'acteur de la session, même pour un appel interne. */
export async function obtenirDocumentAutorise(id: string): Promise<DocumentAutorise | null> {
  const acteur = await identiteServeur()
  if (!UUID.test(id)) return null
  const { data, error } = await creerClientAdmin().rpc('lire_quittance_autorisee', {
    p_acteur: acteur, p_quittance: id,
  })
  if (error || !data) return null
  return data as unknown as DocumentAutorise
}

async function donneesDuContexte(
  c: ContexteQuittance,
  options: { numeroDocument?: string; dateGeneration?: string; apercu?: boolean } = {},
): Promise<DonneesQuittance> {
  const { paiement, bail, bailleur, logement, locataire } = c
  const finances = c.finances
  const [signatureBailleur, signatureLocataire] = await Promise.all([
    chargerSignature(bailleur.signature_chemin),
    chargerSignature(locataire.signature_chemin ?? null),
  ])
  const typePaiement = finances?.type_paiement ?? paiement.type_paiement
  const estPartiel = finances?.est_partiel ?? paiement.est_partiel
  const loyerMensuel = typePaiement === 'Loyer'
    ? Number(finances?.loyer_mensuel ?? bail.loyer_mensuel)
    : 0
  const montantCumule = typePaiement === 'Loyer' && finances
    ? Number(finances.cumul_loyer)
    : undefined
  return {
    numeroDocument: options.numeroDocument ?? '',
    type: typeDocumentPaiement(typePaiement, estPartiel),
    dateGeneration: options.dateGeneration ?? new Date().toISOString(),
    pays: logement.pays ?? 'Bénin',
    bailleurNom: bailleur.nom, bailleurTelephone: bailleur.telephone,
    bailleurAdresse: bailleur.adresse,
    locataireNom: locataire.nom, locataireTelephone: locataire.telephone,
    signatureLocataireDataUri: signatureLocataire,
    logementAdresse: logement.adresse, logementVille: logement.ville,
    logementPays: logement.pays ?? 'Bénin', logementType: logement.type,
    loyerMensuel,
    montantCumule,
    montantExcedentaire: typePaiement === 'Loyer'
      ? Number(finances?.trop_percu ?? Math.max(0, (montantCumule ?? Number(paiement.montant)) - loyerMensuel))
      : 0,
    periodeDebut: finances?.periode_debut ?? paiement.periode_debut, periodeFin: finances?.periode_fin ?? paiement.periode_fin,
    montant: Number(finances?.montant ?? paiement.montant), datePaiement: finances?.date_paiement ?? paiement.date_paiement!,
    modePaiement: finances?.mode_paiement ?? paiement.mode_paiement, typePaiement,
    estPartiel, signatureDataUri: signatureBailleur,
    apercu: options.apercu,
  }
}

/** Repli de téléchargement : seulement un document autorisé jamais publié/signé. */
export async function rassemblerDonnees(
  paiementId: string,
  options: { apercu?: boolean; numeroDocument?: string; dateGeneration?: string } = {},
): Promise<DonneesQuittance | null> {
  const acteur = await identiteServeur()
  if (!UUID.test(paiementId)) return null
  // La recherche admin ne rend rien à l'appelant; l'autorisation SQL ci-dessous
  // décide du droit avant tout chargement de signature ou rendu.
  const admin = creerClientAdmin()
  const { data: ligne, error } = await admin.from('quittances')
    .select('id').eq('paiement_id', paiementId).maybeSingle()
  if (error || !ligne) return null
  const { data, error: refus } = await admin.rpc('lire_quittance_autorisee', {
    p_acteur: acteur, p_quittance: ligne.id,
  })
  if (refus || !data) return null
  const document = data as unknown as DocumentAutorise
  if (document.signee || document.quittance.hash_sha256 || document.quittance.pdf_chemin) return null
  return donneesDuContexte(document.contexte, {
    apercu: options.apercu,
    numeroDocument: document.quittance.numero_document ?? '',
    dateGeneration: document.quittance.date_generation,
  })
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
 * Autorisation/validation atomiques, rendu d'un instantané, puis publication
 * conditionnelle. Aucun écrasement Storage : chaque émission a son propre jeton.
 * Une correction concurrente ou une autre émission invalide la publication.
 */
export async function genererEtStocker(
  paiementId: string,
  valider = false,
): Promise<QuittanceGeneree> {
  const acteur = await identiteServeur()
  if (!UUID.test(paiementId)) throw new Error(REFUS_QUITTANCE)
  const acces = await bailleurAvecEcriture()
  if (!acces.ok || acces.bailleur.id !== acteur) throw new Error(REFUS_QUITTANCE)
  const admin = creerClientAdmin()
  const { data, error } = await admin.rpc('preparer_emission_quittance', {
    p_acteur: acteur, p_paiement: paiementId, p_valider: valider,
  })
  if (error || !data) throw new Error(REFUS_QUITTANCE)
  const emission = data as unknown as {
    jeton: string; contexte: ContexteQuittance; quittance: DocumentAutorise['quittance'];
    deja_publiee?: boolean; en_cours?: boolean
  }
  if (emission.deja_publiee) {
    return { id: emission.quittance.id, numeroDocument: emission.quittance.numero_document ?? '', type: emission.quittance.type }
  }
  if (emission.en_cours) throw new Error('La génération est déjà en cours. Réessayez dans quelques instants.')
  const { quittance, contexte, jeton } = emission
  const chemin = `${acteur}/${quittance.numero_document}-${jeton}.pdf`
  let snapshot: string | null = null
  let hashSignature: string | null = null
  // Une perte de réponse à la publication est ambiguë : ne jamais effacer un
  // fichier que la transaction a peut-être déjà publié.
  let publicationCommencee = false
  try {
    const donnees = await donneesDuContexte(contexte, {
      numeroDocument: quittance.numero_document ?? '', dateGeneration: quittance.date_generation,
    })
    const pdf = await rendrePdf(donnees)
    // Copier les MÊMES octets que ceux incrustés, sans relire la signature mutable.
    if (donnees.signatureDataUri) {
      const source = contexte.bailleur.signature_chemin!
      const extension = source.split('.').pop()!
      snapshot = `${acteur}/apposees/${jeton}.${extension}`
      const octets = Buffer.from(donnees.signatureDataUri.split(',')[1], 'base64')
      hashSignature = empreinte(octets)
      const { error: depotSignature } = await admin.storage.from('signatures').upload(
        snapshot, octets, { contentType: donnees.signatureDataUri.slice(5).split(';')[0], upsert: false },
      )
      if (depotSignature) throw new Error(REFUS_QUITTANCE)
    }
    const { error: depot } = await admin.storage.from('quittances').upload(
      chemin, pdf, { contentType: 'application/pdf', upsert: false },
    )
    if (depot) throw new Error(REFUS_QUITTANCE)
    publicationCommencee = true
    const { error: publication } = await admin.rpc('publier_emission_quittance', {
      p_acteur: acteur, p_paiement: paiementId, p_jeton: jeton,
      p_hash: empreinte(pdf), p_snapshot: snapshot, p_hash_signature: hashSignature,
    })
    // Un SQLSTATE atteste un rejet SQL/rollback, contrairement à une erreur réseau.
    if (publication) {
      publicationCommencee = !/^[0-9A-Z]{5}$/.test(publication.code ?? '')
      throw new Error(REFUS_QUITTANCE)
    }
    return {
      id: quittance.id,
      numeroDocument: quittance.numero_document ?? '',
      type: typeDocumentPaiement(
        contexte.finances?.type_paiement ?? contexte.paiement.type_paiement,
        contexte.finances?.est_partiel ?? contexte.paiement.est_partiel,
      ),
    }
  } catch {
    if (!publicationCommencee) {
      // Uniquement les objets de CETTE tentative; jamais un document antérieur.
      await admin.storage.from('quittances').remove([chemin]).catch(() => undefined)
      if (snapshot) await admin.storage.from('signatures').remove([snapshot]).catch(() => undefined)
      await admin.rpc('liberer_emission_quittance', {
        p_acteur: acteur, p_paiement: paiementId, p_jeton: jeton,
      }).then(() => undefined, () => undefined)
    }
    throw new Error(REFUS_QUITTANCE)
  }
}

/**
 * URL signée valable 30 jours — c'est le lien envoyé au locataire par WhatsApp.
 *
 * Le bucket reste privé : sans signature valide, le document est inaccessible.
 */
export async function urlSignee(cheminPdf: string): Promise<string | null> {
  const acteur = await identiteServeur()
  const client = await creerClientServeur()
  const { data: document, error: refus } = await client.from('quittances')
    .select('id').eq('bailleur_id', acteur).eq('pdf_chemin', cheminPdf).maybeSingle()
  if (refus || !document) return null
  const autorise = await obtenirDocumentAutorise(document.id)
  if (!autorise || autorise.quittance.pdf_chemin !== cheminPdf) return null
  const admin = creerClientAdmin()

  const { data, error } = await admin.storage
    .from('quittances')
    .createSignedUrl(cheminPdf, VALIDITE_LIEN_SECONDES)

  if (error || !data) return null

  return data.signedUrl
}
