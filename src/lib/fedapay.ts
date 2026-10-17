import 'server-only'

import { createHmac, timingSafeEqual } from 'node:crypto'

import { PRIX_STANDARD_FCFA } from '@/lib/plan'
import { chiffresNationaux } from '@/lib/telephone'

/**
 * Intégration FedaPay (Mobile Money) — remplace CinetPay depuis la v2.1.
 *
 * « Aucun paiement manuel accepté, même pour les pilotes » (spec §4.3) :
 * l'abonnement passe obligatoirement par ce flux, c'est lui qui valide la
 * volonté de payer.
 *
 * Documentation : https://docs.fedapay.com
 */

export const DEVISE = 'XOF'

export const MONTANT_ABONNEMENT = PRIX_STANDARD_FCFA
export const DESCRIPTION_ABONNEMENT = 'Abonnement Sikaloc — plan Standard (1 mois)'
export const FORMULE_ABONNEMENT = 'Standard'

export function identifiantTransactionValide(id: string): boolean {
  return /^[1-9][0-9]{0,19}$/.test(id)
}

interface ConfigFedaPay {
  cleSecrete: string
  base: string
  environnement: 'sandbox' | 'live'
}

/** Retourne la configuration, ou null si les clés ne sont pas fournies. */
export function configFedaPay(): ConfigFedaPay | null {
  const cleSecrete = process.env.FEDAPAY_SECRET_KEY
  if (!cleSecrete) return null

  // Le préfixe de la clé fait foi : une clé `sk_sandbox_…` ne doit jamais
  // partir vers l'API de production, quelle que soit la variable d'ambiance.
  const environnement: 'sandbox' | 'live' =
    cleSecrete.startsWith('sk_sandbox') || process.env.FEDAPAY_ENV === 'sandbox'
      ? 'sandbox'
      : 'live'

  return {
    cleSecrete,
    environnement,
    base:
      environnement === 'sandbox'
        ? 'https://sandbox-api.fedapay.com/v1'
        : 'https://api.fedapay.com/v1',
  }
}

async function appeler<T>(
  config: ConfigFedaPay,
  chemin: string,
  options: { methode?: string; corps?: unknown } = {},
): Promise<{ ok: true; donnees: T } | { ok: false; message: string }> {
  try {
    const reponse = await fetch(`${config.base}${chemin}`, {
      method: options.methode ?? 'GET',
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
      headers: {
        Authorization: `Bearer ${config.cleSecrete}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: options.corps ? JSON.stringify(options.corps) : undefined,
    })

    const brut = await reponse.text()
    const donnees = brut ? JSON.parse(brut) : {}

    if (!reponse.ok) {
      const message =
        donnees?.message ??
        donnees?.errors?.[0]?.detail ??
        `FedaPay a répondu ${reponse.status}.`
      return { ok: false, message }
    }

    return { ok: true, donnees: donnees as T }
  } catch (erreur) {
    return {
      ok: false,
      message:
        erreur instanceof Error
          ? `Contact impossible avec FedaPay : ${erreur.message}`
          : 'Contact impossible avec FedaPay.',
    }
  }
}

export interface DemandePaiement {
  montant: number
  description: string
  urlRetour: string
  clientNom: string
  clientEmail: string
  clientTelephone: string
  /** Rattache la transaction au bailleur sans dépendre du libellé. */
  bailleurId: string
}

export interface ResultatInitiation {
  ok: boolean
  transactionId?: string
  urlPaiement?: string
  message?: string
}

/** Découpe « Koffi Adjovi » en prénom / nom, comme l'attend l'API. */
function decouperNom(nomComplet: string): { prenom: string; nom: string } {
  const mots = nomComplet.trim().split(/\s+/)
  if (mots.length === 1) return { prenom: mots[0], nom: mots[0] }

  return { prenom: mots[0], nom: mots.slice(1).join(' ') }
}

/**
 * Numéro au format attendu par FedaPay : chiffres seuls, sans indicatif.
 * Le pays est transmis séparément.
 *
 * Délègue à `chiffresNationaux` pour ne pas entretenir une deuxième règle de
 * découpage : le guichet de paiement est le dernier endroit où l'on veut
 * découvrir qu'un numéro était écrit autrement que prévu.
 */
function numeroLocal(telephone: string): string {
  return chiffresNationaux(telephone) ?? telephone.replace(/\D/g, '')
}

/**
 * Crée la transaction puis son lien de paiement.
 *
 * Deux appels sont nécessaires : `POST /transactions` enregistre l'opération,
 * `POST /transactions/{id}/token` produit l'URL du guichet.
 */
export async function initierPaiement(
  demande: DemandePaiement,
  enregistrer: (transaction: { id: string; reference: string; environnement: 'sandbox' | 'live' }) => Promise<void>,
): Promise<ResultatInitiation> {
  const config = configFedaPay()

  if (!config) {
    return {
      ok: false,
      message:
        'Le paiement Mobile Money n’est pas encore configuré. Renseignez FEDAPAY_SECRET_KEY.',
    }
  }

  if (demande.montant !== MONTANT_ABONNEMENT || demande.description !== DESCRIPTION_ABONNEMENT) {
    return { ok: false, message: 'Contrat d’abonnement invalide.' }
  }

  const { prenom, nom } = decouperNom(demande.clientNom)

  const creation = await appeler<{ 'v1/transaction'?: { id: number; reference: string }; id?: number; reference?: string }>(
    config,
    '/transactions',
    {
      methode: 'POST',
      corps: {
        description: demande.description,
        amount: Math.round(demande.montant),
        currency: { iso: DEVISE },
        callback_url: demande.urlRetour,
        custom_metadata: { bailleur_id: demande.bailleurId, produit: 'sikaloc_abonnement', formule: FORMULE_ABONNEMENT, mois: 1 },
        customer: {
          firstname: prenom,
          lastname: nom,
          email: demande.clientEmail,
          phone_number: { number: numeroLocal(demande.clientTelephone), country: 'bj' },
        },
      },
    },
  )

  if (!creation.ok) return { ok: false, message: creation.message }

  // L'API enveloppe parfois la ressource sous sa clé de type.
  const transaction = creation.donnees['v1/transaction'] ?? creation.donnees
  const transactionId = transaction?.id

  if (!transactionId || !identifiantTransactionValide(String(transactionId)) ||
      typeof transaction.reference !== 'string' || !transaction.reference || transaction.reference.length > 200) {
    return { ok: false, message: 'Référence de transaction FedaPay invalide.' }
  }

  // La référence et le contrat commercial sont persistés AVANT de délivrer
  // un lien de paiement. Un webhook arrivé après peut toujours les retrouver.
  try {
    await enregistrer({ id: String(transactionId), reference: transaction.reference, environnement: config.environnement })
  } catch {
    return { ok: false, message: 'Initialisation indisponible. Réessayez ultérieurement.' }
  }

  const jeton = await appeler<{ token?: string; url?: string }>(
    config,
    `/transactions/${transactionId}/token`,
    { methode: 'POST' },
  )

  if (!jeton.ok) return { ok: false, message: jeton.message }
  if (!jeton.donnees.url) {
    return { ok: false, message: 'FedaPay n’a pas renvoyé de lien de paiement.' }
  }

  return {
    ok: true,
    transactionId: String(transactionId),
    urlPaiement: jeton.donnees.url,
  }
}

export interface StatutTransaction {
  transactionId: string
  reference: string
  reglee: boolean
  statut: string
  montant: number
  devise: string
  bailleurId: string
  formule: 'Standard'
  environnement: 'sandbox' | 'live'
  /** Compatibilité avec les transactions créées avant les métadonnées C1. */
  contratHistorique: boolean
}

function objet(valeur: unknown): Record<string, unknown> {
  return valeur !== null && typeof valeur === 'object' && !Array.isArray(valeur)
    ? valeur as Record<string, unknown> : {}
}

/** GET avec la clé secrète du compte marchand, jamais la preuve du webhook. */
export async function verifierTransaction(transactionId: string): Promise<StatutTransaction | null> {
  if (!identifiantTransactionValide(transactionId)) return null
  const config = configFedaPay()
  if (!config) return null
  const reponse = await appeler<Record<string, unknown>>(config, `/transactions/${transactionId}`)
  if (!reponse.ok) return null
  const enveloppe = objet(reponse.donnees)
  const transaction = objet(enveloppe['v1/transaction'] ?? enveloppe)
  if (String(transaction.id) !== transactionId ||
      typeof transaction.reference !== 'string' || !transaction.reference || transaction.reference.length > 200) return null
  if (transaction.deleted_at != null || transaction.refunded_at != null ||
      (transaction.operation !== undefined && transaction.operation !== 'payment')) return null
  const montant = typeof transaction.amount === 'number' ? transaction.amount
    : typeof transaction.amount === 'string' && /^\d+(?:\.0+)?$/.test(transaction.amount)
      ? Number(transaction.amount) : NaN
  if (!Number.isSafeInteger(montant) || montant !== MONTANT_ABONNEMENT) return null
  if (typeof transaction.status !== 'string') return null
  const statut = transaction.status
  if (!['approved', 'transferred', 'pending', 'started', 'declined', 'canceled', 'failed'].includes(statut)) return null
  const meta = objet(transaction.custom_metadata)
  if (typeof meta.bailleur_id !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(meta.bailleur_id)) return null
  const contratHistorique = meta.produit === undefined && meta.formule === undefined && meta.mois === undefined
  if (contratHistorique) {
    // Seule l'ancienne description EXACTE permet de reconnaître le produit.
    // Le règlement exige aussi une ligne locale historique préexistante.
    if (transaction.description !== DESCRIPTION_ABONNEMENT) return null
  } else if (meta.produit !== 'sikaloc_abonnement' || meta.formule !== FORMULE_ABONNEMENT ||
      (meta.mois !== 1 && meta.mois !== '1')) return null

  // Selon la réponse, FedaPay renvoie currency.iso ou seulement currency_id.
  // Ne jamais déduire XOF d'un montant ni d'un identifiant de devise codé en dur.
  let devise = objet(transaction.currency).iso
  if (devise === undefined && transaction.currency_id !== undefined) {
    const id = String(transaction.currency_id)
    if (!identifiantTransactionValide(id)) return null
    const monnaie = await appeler<Record<string, unknown>>(config, `/currencies/${id}`)
    if (!monnaie.ok) return null
    const e = objet(monnaie.donnees)
    const c = objet(e['v1/currency'] ?? e)
    if (String(c.id) !== id) return null
    devise = c.iso
  }
  if (devise !== DEVISE) return null
  return { transactionId, reference: transaction.reference, reglee: statut === 'approved' || statut === 'transferred',
    statut, montant, devise, bailleurId: meta.bailleur_id, formule: FORMULE_ABONNEMENT,
    environnement: config.environnement, contratHistorique }
}

/** Fenêtre de rejeu, alignée sur `Webhook.DEFAULT_TOLERANCE` du SDK officiel. */
const TOLERANCE_SECONDES = 300

/**
 * Vérifie l'en-tête `X-FEDAPAY-SIGNATURE`.
 *
 * Format `t=<horodatage>,s=<signature>`, la signature étant un HMAC-SHA256 de
 * `<horodatage>.<corps brut>` en hexadécimal.
 *
 * La documentation FedaPay ne détaille pas l'algorithme et renvoie vers ses
 * bibliothèques officielles. Cette implémentation a donc été alignée sur la
 * source de `fedapay@1.2.5` (`src/Webhook.ts`, classe `WebhookSignature`) —
 * seul document faisant foi.
 *
 * Elle reste un contrôle supplémentaire, pas l'unique rempart : le crédit
 * d'abonnement est conditionné à `verifierTransaction`, qui interroge l'API
 * avec notre clé secrète.
 */
export function signatureWebhookValide(
  corpsBrut: string,
  entete: string | null,
  secret: string | undefined,
): boolean {
  if (!secret || !entete) return false

  // L'en-tête peut porter PLUSIEURS `s=` : c'est ainsi qu'une rotation de
  // secret se fait sans coupure, l'ancien et le nouveau cohabitant le temps du
  // basculement. Les collecter toutes — n'en garder qu'une, ce que ferait un
  // `Object.fromEntries`, ferait échouer une rotation sur deux.
  let horodatage: number | null = null
  const signatures: string[] = []

  for (const morceau of entete.split(',')) {
    const separateur = morceau.indexOf('=')
    if (separateur === -1) continue

    const cle = morceau.slice(0, separateur).trim()
    const valeur = morceau.slice(separateur + 1).trim()

    if (cle === 't') horodatage = Number(valeur)
    else if (cle === 's') signatures.push(valeur)
  }

  if (horodatage === null || !Number.isFinite(horodatage)) return false
  if (signatures.length === 0) return false

  // Rejeu : au-delà de cinq minutes, la notification est écartée.
  //
  // Seul le passé est borné, comme dans le SDK. Un horodatage futur ne rejoue
  // rien — la signature le couvre — alors que le rejeter exposerait à une
  // simple dérive d'horloge entre FedaPay et l'hébergeur, qui ferait échouer
  // toutes les notifications sans rien protéger.
  if (Math.floor(Date.now() / 1000) - horodatage > TOLERANCE_SECONDES) return false

  const attendue = Buffer.from(
    createHmac('sha256', secret).update(`${horodatage}.${corpsBrut}`, 'utf8').digest('hex'),
  )

  // Comparaison à temps constant, longueurs vérifiées au préalable :
  // timingSafeEqual lève une exception si elles diffèrent.
  return signatures.some((signature) => {
    const recue = Buffer.from(signature)
    return recue.length === attendue.length && timingSafeEqual(recue, attendue)
  })
}
