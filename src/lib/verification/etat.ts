import 'server-only'

import { creerClientServeur } from '@/lib/supabase/serveur'
import type { Bailleur } from '@/lib/types/database'
import { canauxDisponibles } from '@/lib/verification/canaux'
import {
  comptePleinementVerifie,
  etapeCourante,
  etapesRestantes,
  type EtapeVerification,
  type EtatVerification,
} from '@/lib/verification/regles'

/**
 * Où en est la vérification d'un compte — la lecture qui fait autorité.
 *
 * ─── Deux sources, une seule vérité chacune ─────────────────────────────────
 *
 *     email      auth.users.email_confirmed_at, lu dans la session
 *     téléphone  bailleurs.telephone_verifie_le
 *
 * L'email vient de GoTrue parce que c'est GoTrue qui le remplit, au moment où
 * il valide son propre code. Le recopier dans `bailleurs` aurait créé deux
 * vérités à tenir d'accord, et un jour l'une aurait menti.
 *
 * ─── Pourquoi c'est lu côté serveur, à chaque fois ──────────────────────────
 *
 * `getUser()` interroge le serveur d'authentification au lieu de faire
 * confiance au jeton présent dans le cookie. C'est plus lent d'un aller-retour,
 * et c'est le prix à payer : un jeton se fabrique, une réponse de GoTrue non.
 */

export interface EtatComplet extends EtatVerification {
  /** Un canal peut-il réellement acheminer un code ? Sinon l'exigence est suspendue. */
  telephoneExigible: boolean
  email: string
  telephone: string
  pleinementVerifie: boolean
  etape: EtapeVerification | null
  restantes: number
  /** Canal du code validé, quand le téléphone l'a été. */
  canal: string | null
  emailVerifieLe: string | null
  telephoneVerifieLe: string | null
}

/**
 * L'état de vérification du bailleur passé en argument.
 *
 * Le profil est fourni par l'appelant, qui vient de le lire : le relire ici
 * doublerait la requête sur chaque page de l'application.
 */
export async function etatVerification(bailleur: Bailleur): Promise<EtatComplet> {
  const supabase = await creerClientServeur()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const emailVerifieLe = user?.email_confirmed_at ?? null
  const etat: EtatVerification = {
    emailVerifie: Boolean(emailVerifieLe),
    telephoneVerifie: Boolean(bailleur.telephone_verifie_le),
  }

  // Aucun canal pour acheminer un code au téléphone : l'exigence est suspendue
  // le temps qu'un fournisseur existe. Voir `comptePleinementVerifie`.
  const telephoneExigible = canauxDisponibles().length > 0

  return {
    ...etat,
    telephoneExigible,
    // L'adresse de la session prime : c'est celle que GoTrue a confirmée.
    // `bailleurs.email` n'en est qu'une copie, posée à l'inscription.
    email: user?.email ?? bailleur.email,
    telephone: bailleur.telephone,
    pleinementVerifie: comptePleinementVerifie(etat, { telephoneExigible }),
    etape: etapeCourante(etat),
    restantes: etapesRestantes(etat),
    canal: bailleur.telephone_canal_verification,
    emailVerifieLe,
    telephoneVerifieLe: bailleur.telephone_verifie_le,
  }
}
