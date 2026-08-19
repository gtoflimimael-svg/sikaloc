import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { AssistantOnboarding } from '@/components/app/onboarding'
import { MarqueSikaloc } from '@/components/ui/logo'
import { bailleurCourant } from '@/lib/session'

export const metadata: Metadata = { title: 'Bienvenue' }

/**
 * Onboarding guidé en 3 étapes (§6.1.2).
 *
 * L'étape 1 (« Votre activité ») est déjà remplie par le formulaire
 * d'inscription : nom, téléphone, email, mot de passe et nombre de logements y
 * sont collectés. On la montre en lecture, cochée, plutôt que de la redemander.
 */
export default async function PageOnboarding() {
  const bailleur = await bailleurCourant()

  if (bailleur.onboarding_termine) redirect('/app')

  return (
    <div className="min-h-screen bg-canvas-soft">
      <header className="flex h-16 items-center justify-center border-b border-hairline bg-canvas px-lg">
        <MarqueSikaloc href={null} taille="sm" />
      </header>

      <main className="mx-auto max-w-[640px] px-lg py-3xl">
        <AssistantOnboarding
          nomBailleur={bailleur.nom}
          telephoneBailleur={bailleur.telephone}
          emailBailleur={bailleur.email}
          nbLogementsDeclare={bailleur.nb_logements_declare}
        />
      </main>
    </div>
  )
}
