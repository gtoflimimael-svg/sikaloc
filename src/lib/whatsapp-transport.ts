import 'server-only'

import { urlCandidaturesPro, urlMesCandidatures } from '@/lib/liens-candidature'
import { deposerWhatsAppLocal, whatsAppEnLocal } from '@/lib/whatsapp-local'

/**
 * Le transport WhatsApp des notifications de candidature (S8-F).
 *
 * ─── Ce que le métier connaît ──────────────────────────────────────────────
 *
 * Une seule fonction : `envoyerWhatsApp(destinataire, modele, variables, clé)`.
 * Il ignore tout de Meta, de Twilio, d'un token, d'une URL de fournisseur. Le
 * jour où l'un est branché, cela se passe ICI, et nulle part ailleurs.
 *
 * ─── Ce qui part, et où ────────────────────────────────────────────────────
 *
 *   pile locale  → dépôt dans `.whatsapp-locaux/` (rien ne quitte la machine)
 *   production   → un fournisseur réel… qui n'est pas encore branché.
 *
 * Aucun fournisseur n'étant retenu à cette étape, le transport réel répond un
 * échec explicite et normalisé plutôt que d'inventer un envoi. La file
 * conserve alors le message et réessaiera : le jour où le fournisseur arrive,
 * les messages en attente partent d'eux-mêmes.
 */

export type ModeleWhatsApp =
  | 'candidature_recue'
  | 'candidature_en_etude'
  | 'candidature_acceptee'
  | 'candidature_refusee'
  | 'candidature_retiree'

export interface VariablesWhatsApp {
  reference?: unknown
  type?: unknown
  ville?: unknown
  quartier?: unknown
  annonce_id?: unknown
  candidat_nom?: unknown
  [cle: string]: unknown
}

export interface ResultatWhatsApp {
  ok: boolean
  /** Identifiant rendu par le transport (dépôt local, ou message du fournisseur). */
  id?: string
  /** Erreur normalisée, jamais le corps brut d'un fournisseur. */
  message?: string
  etat?: 'temporaire' | 'definitif' | 'indisponible' | 'incertain'
}

interface MessageWhatsApp {
  corps: string
  lien: string
}

/**
 * Compose le texte d'un WhatsApp — les cinq modèles de S8-D, en texte simple.
 *
 * Mêmes règles de minimisation que l'email : le nom du candidat, ce que Find
 * publie déjà de l'annonce, un lien. Ni téléphone, ni email de l'autre partie,
 * ni identifiant interne — sauf le lien du bailleur, qui EST l'adresse de sa
 * page. L'acceptation redit qu'elle ne réserve rien et ne crée aucun bail.
 */
export function composerWhatsApp(
  modele: ModeleWhatsApp,
  variables: VariablesWhatsApp,
): MessageWhatsApp {
  const type = String(variables.type ?? 'Logement')
  const quartier = String(variables.quartier ?? '').trim()
  const ville = String(variables.ville ?? '').trim()
  const lieu = [quartier, ville].filter(Boolean).join(', ')
  const logement = lieu ? `${type} à ${lieu}` : type
  const reference = String(variables.reference ?? '')
  const candidat = String(variables.candidat_nom ?? '').trim() || 'Un candidat'
  const lienCandidat = urlMesCandidatures()
  const lienBailleur = urlCandidaturesPro(variables.annonce_id)

  switch (modele) {
    case 'candidature_recue':
      return {
        lien: lienBailleur,
        corps:
          `Sikaloc — nouvelle candidature\n\n` +
          `${candidat} a candidaté à votre annonce : ${logement} (réf. ${reference}).\n\n` +
          `Lisez son message et répondez ici : ${lienBailleur}\n\n` +
          `Ses coordonnées ne vous sont pas transmises.`,
      }
    case 'candidature_en_etude':
      return {
        lien: lienCandidat,
        corps:
          `Sikaloc — votre candidature est à l’étude\n\n` +
          `Le bailleur du ${logement.toLowerCase()} (réf. ${reference}) a mis votre candidature à l’étude.\n\n` +
          `Cela signifie qu’il l’a vue ; Sikaloc ne peut annoncer ni décision, ni délai.\n\n` +
          `Vos candidatures : ${lienCandidat}`,
      }
    case 'candidature_acceptee':
      return {
        lien: lienCandidat,
        corps:
          `Sikaloc — votre candidature est acceptée\n\n` +
          `Le bailleur du ${logement.toLowerCase()} (réf. ${reference}) a accepté votre candidature.\n\n` +
          `Cette acceptation ne réserve pas le logement et ne crée aucun bail : la suite se convient directement avec le bailleur.\n\n` +
          `Vos candidatures : ${lienCandidat}`,
      }
    case 'candidature_refusee':
      return {
        lien: lienCandidat,
        corps:
          `Sikaloc — votre candidature n’a pas été retenue\n\n` +
          `Le bailleur du ${logement.toLowerCase()} (réf. ${reference}) n’a pas retenu votre candidature.\n\n` +
          `D’autres logements sont publiés sur Sikaloc_Find : ${lienCandidat}`,
      }
    case 'candidature_retiree':
      return {
        lien: lienBailleur,
        corps:
          `Sikaloc — candidature retirée\n\n` +
          `${candidat} a retiré sa candidature : ${logement} (réf. ${reference}).\n\n` +
          `Elle reste visible dans votre espace, marquée « retirée ». Aucune action n’est attendue.\n\n` +
          `Vos candidatures : ${lienBailleur}`,
      }
  }
}

/**
 * Remet un WhatsApp à son transport.
 *
 * `idempotence` (l'identifiant de la ligne de file) est la clé de déduplication.
 * En local, le fichier porte cette clé : un rejeu réécrit le même fichier.
 * Aucun transport réel n'est branché. Son éventuelle future intégration devra
 * définir sa politique d'idempotence et de réconciliation : une panne réseau
 * ambiguë ne prouve jamais l'absence de doublon externe.
 */
export function whatsAppOperationnel(): boolean {
  return whatsAppEnLocal()
}

export async function envoyerWhatsApp(
  destinataire: string,
  modele: ModeleWhatsApp,
  variables: VariablesWhatsApp,
  idempotence?: string,
): Promise<ResultatWhatsApp> {
  let message: MessageWhatsApp
  try {
    message = composerWhatsApp(modele, variables)
    if (!message) throw new Error(`modèle inconnu : ${modele}`)
  } catch (erreur) {
    return {
      ok: false,
      etat: 'definitif',
      message:
        erreur instanceof Error
          ? `Message WhatsApp impossible à composer : ${erreur.message}`
          : `Message WhatsApp impossible à composer (modèle « ${modele} »).`,
    }
  }

  // Pile locale : on dépose, rien ne quitte la machine.
  if (whatsAppEnLocal()) {
    try {
      const depot = deposerWhatsAppLocal({
        destinataire,
        modele,
        evenement: String(variables.evenement ?? modele),
        texte: message.corps,
        variables,
        lien: message.lien,
        idempotence: idempotence ?? null,
      })
      return { ok: true, id: `local:${depot}` }
    } catch (erreur) {
      return {
        ok: false,
        message: erreur instanceof Error ? `Dépôt WhatsApp local impossible : ${erreur.message}` : 'Dépôt WhatsApp local impossible.',
      }
    }
  }

  // Production : aucun fournisseur n'est encore branché. On le dit franchement,
  // sans rien inventer. La file garde le message ; il partira quand un
  // transport réel sera configuré ici.
  return {
    ok: false,
    etat: 'indisponible',
    message: 'Transport WhatsApp non configuré : aucun fournisseur branché.',
  }
}
