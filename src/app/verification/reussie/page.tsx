import type { Metadata } from 'next'

import { BienvenueVerification } from '@/components/verification/bienvenue'
import { bailleurCourant, rolesDuCompte } from '@/lib/session'
import { ESPACE_PRO } from '@/lib/roles'
import { creerClientServeur } from '@/lib/supabase/serveur'

export const metadata: Metadata = { title: 'Bienvenue sur Sikaloc' }

export default async function PageVerificationReussie() {
  const supabase = await creerClientServeur()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user?.email_confirmed_at) {
    return <BienvenueVerification destination={null} />
  }

  const roles = await rolesDuCompte()
  if (!roles.estBailleur || roles.estLocataire) {
    return <BienvenueVerification destination={null} />
  }

  // Ce garde confirme aussi l'éventuelle étape téléphone si un canal
  // opérationnel l'exige. La bienvenue n'est jamais affichée avant l'accès Pro.
  await bailleurCourant()

  return <BienvenueVerification destination={ESPACE_PRO.tableauDeBord} />
}
