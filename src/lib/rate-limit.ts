import 'server-only'

import { creerClientAdmin } from '@/lib/supabase/admin'

/**
 * Limitation des tentatives de connexion — spec §6.1.1 : 5 essais, blocage
 * 15 minutes.
 *
 * Le comptage vit en base plutôt qu'en mémoire : sur Vercel, chaque requête
 * peut atterrir sur une instance différente, un compteur en mémoire ne
 * protégerait rien.
 *
 * L'essai est RÉSERVÉ avant l'appel à Supabase Auth, sous verrou, par
 * `reserver_tentative_connexion` (SEC-03) : des requêtes parallèles ne peuvent
 * plus toutes passer le contrôle avant la première écriture. La fonction
 * applique trois limites sur 15 minutes : 5 échecs pour un couple email + IP,
 * 20 pour un email toutes IP confondues, 30 pour une IP tous emails confondus.
 */

export interface ReservationTentative {
  bloque: boolean
  minutesRestantes: number
  /** Identifiant de l'essai réservé, à conclure en cas de succès. */
  tentativeId: number | null
}

const NON_BLOQUE: ReservationTentative = { bloque: false, minutesRestantes: 0, tentativeId: null }

export async function reserverTentative(
  email: string,
  ip: string | null,
): Promise<ReservationTentative> {
  try {
    const { data, error } = await creerClientAdmin().rpc('reserver_tentative_connexion', {
      p_email: email,
      p_ip: ip ?? '',
    })
    if (error || !data || typeof data !== 'object') {
      throw new Error(error?.code ?? 'reponse_invalide')
    }
    const reponse = data as { bloque?: boolean; minutes_restantes?: number; tentative_id?: number }
    if (reponse.bloque) {
      return {
        bloque: true,
        minutesRestantes: Math.max(1, Number(reponse.minutes_restantes) || 1),
        tentativeId: null,
      }
    }
    return {
      bloque: false,
      minutesRestantes: 0,
      tentativeId: typeof reponse.tentative_id === 'number' ? reponse.tentative_id : null,
    }
  } catch (cause) {
    // Supabase Auth applique aussi sa propre limitation côté serveur : une
    // panne du compteur applicatif ne doit pas bloquer toutes les connexions.
    // Elle doit en revanche être visible (supervision), sans donnée personnelle.
    console.error('[auth.rate_limit] compteur de connexions indisponible', {
      cause: cause instanceof Error ? cause.message.slice(0, 64) : 'inconnue',
    })
    return NON_BLOQUE
  }
}

/** Marque l'essai réservé comme réussi et efface les échecs du même couple. */
export async function conclureTentative(tentativeId: number | null): Promise<void> {
  if (tentativeId === null) return
  try {
    const { error } = await creerClientAdmin().rpc('conclure_tentative_connexion', {
      p_tentative_id: tentativeId,
    })
    if (error) throw new Error(error.code ?? 'erreur')
  } catch (cause) {
    // La connexion a réussi : un échec de journalisation ne doit pas la casser.
    console.error('[auth.rate_limit] conclusion de tentative impossible', {
      cause: cause instanceof Error ? cause.message.slice(0, 64) : 'inconnue',
    })
  }
}

export function messageBlocage(minutesRestantes: number, prefixe = 'Trop de tentatives'): string {
  return `${prefixe}. Réessayez dans ${minutesRestantes} minute${minutesRestantes > 1 ? 's' : ''}.`
}
