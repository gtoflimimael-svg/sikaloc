import 'server-only'

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { pileLocale } from '@/lib/courrier-local'

/**
 * La boîte WhatsApp locale — pour que développer n'écrive à personne.
 *
 * Le pendant de `courrier-local.ts`, pour le second canal. Sur la pile locale,
 * un WhatsApp est DÉPOSÉ sur le disque au lieu d'être remis à un fournisseur.
 * Tout le reste est identique : mêmes modèles, mêmes variables, même texte,
 * même clé d'idempotence. Ce qu'un banc inspecte est bien ce qui partirait.
 *
 * La bascule locale n'est PAS un drapeau d'environnement — un
 * `WHATSAPP_TRANSPORT=local` oublié ailleurs ferait disparaître de vrais
 * messages. Elle repose sur la même PREUVE que l'email : `pileLocale()`, qui
 * lit la clé de service et ne peut répondre vrai qu'en local (jeton
 * `iss: "supabase-demo"`, aucune référence de projet). En production, ce
 * transport ne s'active pas.
 */

/** Le dossier de dépôt, ignoré par git — le pendant de `.emails-locaux/`. */
export const DOSSIER_WHATSAPP = '.whatsapp-locaux'

export interface WhatsAppDepose {
  destinataire: string
  modele: string
  evenement: string
  texte: string
  variables: Record<string, unknown>
  lien: string | null
  idempotence: string | null
  depose_le: string
}

/** Ce transport dépose-t-il en local (au lieu d'appeler un fournisseur) ? */
export function whatsAppEnLocal(): boolean {
  return pileLocale()
}

/**
 * Écrit le message sur le disque et rend l'identifiant du dépôt.
 *
 * Un fichier par message, nommé par la clé d'idempotence : un rejeu réécrit le
 * même fichier au lieu d'en créer un second — l'idempotence, à la main, là où
 * aucun fournisseur ne la garantit (voir `whatsapp-transport.ts`).
 */
export function deposerWhatsAppLocal(message: Omit<WhatsAppDepose, 'depose_le'>): string {
  const dossier = join(process.cwd(), DOSSIER_WHATSAPP)
  mkdirSync(dossier, { recursive: true })

  const nom = `${message.idempotence ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`}.json`
  writeFileSync(
    join(dossier, nom),
    JSON.stringify({ ...message, depose_le: new Date().toISOString() }, null, 2),
    'utf8',
  )
  return nom
}
