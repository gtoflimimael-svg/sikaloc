import 'server-only'

import { createHash } from 'node:crypto'
import { createElement } from 'react'
import sharp from 'sharp'

import {
  DocumentQuittance,
  type DonneesQuittance,
  type VersementPdf,
} from '@/lib/pdf/document-quittance'
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
import { apercuDocumentPaiement, typeDocumentPaiement } from '@/lib/documents-paiement'
import { reconnaitreFormat } from '@/lib/signature/fichier'
import type { EtatSignaturePdf } from '@/lib/pdf/document-quittance'

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

interface SignatureChargee {
  dataUri: string | null
  etat: EtatSignaturePdf
}

/**
 * Charge la signature privée après l'autorisation du document et la normalise
 * pour le moteur PDF. WebP est accepté par l'import, mais le renderer PDF ne
 * sait pas l'embarquer : une conversion PNG en mémoire conserve le trait sans
 * modifier l'objet stocké ni l'accès au bucket.
 */
async function chargerSignature(chemin: string | null): Promise<SignatureChargee> {
  if (!chemin) return { dataUri: null, etat: 'non-apposee' }

  try {
    const admin = creerClientAdmin()
    const { data, error } = await admin.storage.from('signatures').download(chemin)
    if (error || !data) return { dataUri: null, etat: 'indisponible' }

    const buffer = Buffer.from(await data.arrayBuffer())
    const format = await reconnaitreFormat(data)
    if (!format) return { dataUri: null, etat: 'indisponible' }

    const octets = format === 'webp' ? await sharp(buffer).png().toBuffer() : buffer
    const typeMime = format === 'jpeg' ? 'image/jpeg' : 'image/png'

    return {
      dataUri: `data:${typeMime};base64,${octets.toString('base64')}`,
      etat: 'apposee',
    }
  } catch {
    // Le document peut être émis, mais l'état reste distinct d'une absence.
    return { dataUri: null, etat: 'indisponible' }
  }
}

/**
 * Résultat privé pour les routes d'étape : une référence de profil seule ne
 * suffit pas, le fichier doit être présent et lisible dans le bucket privé.
 */
export async function signatureBailleurDisponible(chemin: string | null): Promise<boolean> {
  return (await chargerSignature(chemin)).etat === 'apposee'
}

/** Les données du rendu proviennent d'une lecture SQL autorisée et cohérente. */
interface ContexteQuittance {
  paiement: Paiement
  bail: Bail
  bailleur: Bailleur
  logement: Logement
  locataire: Locataire
  finances?: {
    montant: number; cumul_loyer: number; loyer_mensuel: number | null;
    montant_exigible?: number | null; solde_restant: number | null;
    trop_percu?: number
    est_partiel: boolean | null; periode_debut: string; periode_fin: string;
    date_paiement: string; mode_paiement: string; type_paiement: TypePaiement
    versements?: { id: string; empreinte: string }[]
  }
}

interface DocumentAutorise {
  quittance: Quittance
  contexte: ContexteQuittance
  signee: boolean
}

function estPartielSnapshot(
  finances: ContexteQuittance['finances'],
  valeurLigne: boolean | null,
): boolean | null {
  if (finances && Object.hasOwn(finances, 'est_partiel')) return finances.est_partiel ?? null
  return valeurLigne
}

export const REFUS_QUITTANCE = 'Opération impossible ou non autorisée.'

export class SignatureQuittanceRequiseError extends Error {
  constructor() {
    super('SIGNATURE_QUITTANCE_REQUISE')
    this.name = 'SignatureQuittanceRequiseError'
  }
}

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
  options: { numeroDocument?: string; dateGeneration?: string } = {},
): Promise<DonneesQuittance> {
  const { paiement, bail, bailleur, logement, locataire } = c
  const finances = c.finances
  const [signatureBailleur, signatureLocataire] = await Promise.all([
    chargerSignature(bailleur.signature_chemin),
    chargerSignature(locataire.signature_chemin ?? null),
  ])
  const typePaiement = finances?.type_paiement ?? paiement.type_paiement
  const estPartiel = estPartielSnapshot(finances, paiement.est_partiel)
  const typeDocument = typeDocumentPaiement(typePaiement, estPartiel)
  if (typeDocument === 'Quittance' && signatureBailleur.etat !== 'apposee') {
    throw new SignatureQuittanceRequiseError()
  }
  const loyerMensuel = typePaiement === 'Loyer'
    ? typeof finances?.loyer_mensuel === 'number' ? finances.loyer_mensuel : null
    : 0
  const montantExigible = typePaiement !== 'Loyer'
    ? null
    : typeof finances?.montant_exigible === 'number'
      ? finances.montant_exigible
      : null
  const montantCumule = typePaiement === 'Loyer' && finances
    ? Number(finances.cumul_loyer)
    : undefined
  const datePaiement = finances?.date_paiement ?? paiement.date_paiement
  if (!datePaiement) throw new Error(REFUS_QUITTANCE)
  const versementCourant: VersementPdf = {
    montant: Number(finances?.montant ?? paiement.montant),
    datePaiement,
    modePaiement: finances?.mode_paiement ?? paiement.mode_paiement,
  }
  const estQuittanceComplete = typePaiement === 'Loyer'
    && estPartiel === false && montantExigible !== null
  let versements: VersementPdf[] = [versementCourant]

  if (estQuittanceComplete) {
    const instantane = finances?.versements ?? []
    const ids = instantane.map((versement) => versement.id)

    if (new Set(ids).size !== ids.length || ids.some((id) => !UUID.test(id))) {
      throw new Error(REFUS_QUITTANCE)
    }
    if (ids.length > 0 && !ids.includes(paiement.id)) {
      throw new Error(REFUS_QUITTANCE)
    }

    if (ids.length === 1) {
      if (Math.abs((montantCumule ?? versementCourant.montant) - versementCourant.montant) > 0.001) {
        throw new Error(REFUS_QUITTANCE)
      }
    } else if (ids.length > 1) {
      // Les identifiants viennent de l'instantané financier produit par la RPC
      // autorisée. Cette lecture serveur n'élargit ni les droits ni les règles :
      // elle ne récupère que les lignes nécessaires à leur représentation PDF.
      const { data, error } = await creerClientAdmin()
        .from('paiements')
        .select('id,montant,date_paiement,mode_paiement,type_paiement,statut,bail_id,bailleur_id,periode_debut')
        .in('id', ids)
        .eq('bail_id', bail.id)
        .eq('bailleur_id', bailleur.id)
        .eq('periode_debut', finances?.periode_debut ?? paiement.periode_debut)
        .eq('type_paiement', 'Loyer')
        .eq('statut', 'Validé')

      if (error || !data || data.length !== ids.length) throw new Error(REFUS_QUITTANCE)

      const lignes = data.map((ligne) => ({
        montant: Number(ligne.montant),
        datePaiement: ligne.date_paiement,
        modePaiement: ligne.mode_paiement,
      }))
      const totalVersements = lignes.reduce((total, ligne) => total + ligne.montant, 0)
      if (
        data.some((ligne) => !ids.includes(ligne.id)) ||
        Math.abs(totalVersements - (montantCumule ?? 0)) > 0.001
      ) throw new Error(REFUS_QUITTANCE)

      versements = lignes.sort((a, b) =>
        (a.datePaiement ?? '').localeCompare(b.datePaiement ?? ''),
      )
    } else if (Math.abs((montantCumule ?? versementCourant.montant) - versementCourant.montant) > 0.001) {
      // Pas de détail de versements fiable : ne pas émettre une quittance qui
      // afficherait un total collectif sans pouvoir l'expliquer.
      throw new Error(REFUS_QUITTANCE)
    }
  }

  return {
    modeDocument: 'reel',
    numeroDocument: options.numeroDocument ?? '',
    type: typeDocument,
    dateGeneration: options.dateGeneration ?? new Date().toISOString(),
    pays: logement.pays ?? 'Bénin',
    bailleurNom: bailleur.nom, bailleurTelephone: bailleur.telephone,
    bailleurAdresse: bailleur.adresse,
    locataireNom: locataire.nom, locataireTelephone: locataire.telephone,
    signatureLocataireDataUri: signatureLocataire.dataUri,
    signatureLocataireEtat: signatureLocataire.etat,
    logementAdresse: logement.adresse, logementVille: logement.ville,
    logementPays: logement.pays ?? 'Bénin', logementType: logement.type,
    loyerMensuel, montantExigible,
    montantCumule,
    montantExcedentaire: typePaiement === 'Loyer' && montantExigible !== null
      ? Number(finances?.trop_percu ?? Math.max(0, (montantCumule ?? Number(paiement.montant)) - montantExigible))
      : 0,
    periodeDebut: finances?.periode_debut ?? paiement.periode_debut, periodeFin: finances?.periode_fin ?? paiement.periode_fin,
    montant: versementCourant.montant, datePaiement,
    modePaiement: finances?.mode_paiement ?? paiement.mode_paiement, typePaiement,
    estPartiel,
    versements,
    signatureDataUri: signatureBailleur.dataUri,
    signatureBailleurEtat: signatureBailleur.etat,
  }
}

/** Repli de téléchargement : seulement un document autorisé jamais publié/signé. */
export async function rassemblerDonnees(
  paiementId: string,
  options: { numeroDocument?: string; dateGeneration?: string } = {},
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
  try {
    return await donneesDuContexte(document.contexte, {
      numeroDocument: options.numeroDocument ?? document.quittance.numero_document ?? '',
      dateGeneration: options.dateGeneration ?? document.quittance.date_generation,
    })
  } catch (erreur) {
    if (erreur instanceof SignatureQuittanceRequiseError) throw erreur
    return null
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
 * Précontrôle en lecture seule avant la RPC qui peut valider un paiement.
 * Sans lui, une signature absente ne serait détectée qu'après la RPC et un
 * paiement brouillon pourrait déjà être passé à « Validé ».
 *
 * Le type documentaire est calculé avec la même vue et la même règle que la
 * confirmation. Les reçus ne sont donc pas bloqués par l'absence de signature.
 */
async function verifierSignatureAvantPreparation({
  paiementId,
  acteur,
  bailleur,
  valider,
}: {
  paiementId: string
  acteur: string
  bailleur: Bailleur
  valider: boolean
}): Promise<void> {
  const client = await creerClientServeur()
  const { data: paiement, error: erreurPaiement } = await client
    .from('paiements')
    .select('id,bailleur_id,bail_id,montant,periode_debut,type_paiement,statut')
    .eq('id', paiementId)
    .eq('bailleur_id', acteur)
    .maybeSingle()

  if (erreurPaiement || !paiement || paiement.bailleur_id !== acteur) {
    throw new Error(REFUS_QUITTANCE)
  }
  if (paiement.type_paiement !== 'Loyer') return
  if (!valider && paiement.statut !== 'Validé') return

  // Une confirmation répétée d'un paiement déjà émis reste idempotente : la
  // RPC décidera si le document existant correspond toujours à ce paiement.
  if (valider && paiement.statut === 'Validé') {
    const { data: existante, error: erreurQuittance } = await client
      .from('quittances')
      .select('pdf_chemin,hash_sha256')
      .eq('paiement_id', paiementId)
      .eq('bailleur_id', acteur)
      .maybeSingle()
    if (erreurQuittance) throw new Error(REFUS_QUITTANCE)
    if (existante?.pdf_chemin && existante.hash_sha256) return
  }

  const { data: echeance, error: erreurEcheance } = await client
    .from('v_echeances')
    .select('montant_exigible,montant_paye')
    .eq('bail_id', paiement.bail_id)
    .eq('periode_debut', paiement.periode_debut)
    .maybeSingle()

  if (erreurEcheance) throw new Error(REFUS_QUITTANCE)

  const loyerApplicable = typeof echeance?.montant_exigible === 'number'
    ? Number(echeance.montant_exigible)
    : null
  const montantPaye = echeance ? Number(echeance.montant_paye) : null
  const cumulValideAvant = montantPaye === null
    ? null
    : montantPaye - (paiement.statut === 'Validé' ? Number(paiement.montant) : 0)
  const apercu = apercuDocumentPaiement({
    typePaiement: paiement.type_paiement,
    montant: Number(paiement.montant),
    loyerApplicable,
    cumulValideAvant,
  })

  if (!apercu.typeDocument) throw new Error(REFUS_QUITTANCE)
  if (apercu.typeDocument !== 'Quittance') return

  const signature = await chargerSignature(bailleur.signature_chemin)
  if (signature.etat !== 'apposee') throw new SignatureQuittanceRequiseError()
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
  await verifierSignatureAvantPreparation({
    paiementId,
    acteur,
    bailleur: acces.bailleur,
    valider,
  })
  const admin = creerClientAdmin()
  const { data, error } = await admin.rpc('preparer_emission_quittance', {
    p_acteur: acteur, p_paiement: paiementId, p_valider: valider,
  })
  if (error?.message.includes('SIGNATURE_QUITTANCE_REQUISE')) {
    throw new SignatureQuittanceRequiseError()
  }
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
      // Le snapshot conserve les mêmes octets que ceux inclus au PDF. Les
      // WebP importés sont alors des PNG normalisés, avec une extension exacte.
      const extension = donnees.signatureDataUri.startsWith('data:image/jpeg;') ? 'jpg' : 'png'
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
        typeof contexte.finances?.montant_exigible !== 'number'
          ? null
          : estPartielSnapshot(contexte.finances, contexte.paiement.est_partiel),
      ),
    }
  } catch (erreur) {
    if (!publicationCommencee) {
      // Uniquement les objets de CETTE tentative; jamais un document antérieur.
      await admin.storage.from('quittances').remove([chemin]).catch(() => undefined)
      if (snapshot) await admin.storage.from('signatures').remove([snapshot]).catch(() => undefined)
      await admin.rpc('liberer_emission_quittance', {
        p_acteur: acteur, p_paiement: paiementId, p_jeton: jeton,
      }).then(() => undefined, () => undefined)
    }
    if (erreur instanceof SignatureQuittanceRequiseError) throw erreur
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
