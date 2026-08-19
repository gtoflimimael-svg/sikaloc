import 'server-only'

import { creerClientAdmin } from '@/lib/supabase/admin'

/**
 * Limitation des tentatives de connexion — spec §6.1.1 : 5 essais, blocage
 * 15 minutes.
 *
 * Le comptage vit en base plutôt qu'en mémoire : sur Vercel, chaque requête
 * peut atterrir sur une instance différente, un compteur en mémoire ne
 * protégerait rien.
 */

const MAX_TENTATIVES = 5
const FENETRE_MINUTES = 15

export interface EtatBlocage {
  bloque: boolean
  minutesRestantes: number
}

const NON_BLOQUE: EtatBlocage = { bloque: false, minutesRestantes: 0 }

export async function verifierBlocage(email: string): Promise<EtatBlocage> {
  try {
    const admin = creerClientAdmin()
    const depuis = new Date(Date.now() - FENETRE_MINUTES * 60_000).toISOString()

    const { data, error } = await admin
      .from('tentatives_connexion')
      .select('tentee_le')
      .eq('email', email.toLowerCase())
      .eq('reussie', false)
      .gte('tentee_le', depuis)
      .order('tentee_le', { ascending: true })

    if (error || !data || data.length < MAX_TENTATIVES) return NON_BLOQUE

    // Le blocage court à partir de la plus ancienne tentative de la fenêtre.
    const premiere = new Date(data[0].tentee_le).getTime()
    const finBlocage = premiere + FENETRE_MINUTES * 60_000
    const restant = Math.ceil((finBlocage - Date.now()) / 60_000)

    if (restant <= 0) return NON_BLOQUE

    return { bloque: true, minutesRestantes: restant }
  } catch {
    // Sans clé service_role, le compteur applicatif est indisponible. Supabase
    // Auth applique son propre rate limiting côté serveur : on laisse passer
    // plutôt que de bloquer toutes les connexions sur un défaut de config.
    return NON_BLOQUE
  }
}

export async function enregistrerTentative(
  email: string,
  reussie: boolean,
  ip?: string | null,
): Promise<void> {
  try {
    const admin = creerClientAdmin()
    await admin.from('tentatives_connexion').insert({
      email: email.toLowerCase(),
      reussie,
      ip: ip ?? null,
    })

    // Une connexion réussie remet le compteur à zéro.
    if (reussie) {
      await admin
        .from('tentatives_connexion')
        .delete()
        .eq('email', email.toLowerCase())
        .eq('reussie', false)
    }
  } catch {
    // Voir verifierBlocage : la journalisation ne doit jamais casser le login.
  }
}
