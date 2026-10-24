import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { AssistantOnboarding } from '@/components/app/onboarding'
import { SikalocSpaceBrand } from '@/components/ui/logo'
import { bailleurCourant } from '@/lib/session'
import { ESPACE_PRO } from '@/lib/roles'

export const metadata: Metadata = { title: 'Bienvenue' }

/**
 * Onboarding guidé en 4 étapes (§6.1.2).
 *
 * L'étape 1 (« Votre activité ») est déjà remplie par le formulaire
 * d'inscription : nom, téléphone et email y sont collectés. On les montre en
 * lecture, plutôt que de les redemander.
 *
 * L'étape 2 recueille la signature. Elle ne peut pas vivre dans le formulaire
 * d'inscription : à ce moment-là le compte n'existe pas encore, et il n'y a
 * donc aucun dossier de stockage où déposer l'image.
 */
export default async function PageOnboarding() {
  const bailleur = await bailleurCourant()

  if (bailleur.onboarding_termine) redirect(ESPACE_PRO.tableauDeBord)

  return (
    <div className="onboarding-page min-h-screen bg-canvas-soft">
      <header className="onboarding-page-header flex h-16 items-center justify-center border-b border-hairline bg-canvas px-lg">
        <SikalocSpaceBrand href={null} taille="sm" espace="Pro" />
      </header>

      <main className="onboarding-page-main mx-auto max-w-[640px] px-lg py-3xl">
        <AssistantOnboarding
          nomBailleur={bailleur.nom}
          telephoneBailleur={bailleur.telephone}
          emailBailleur={bailleur.email}
          signatureExistante={Boolean(bailleur.signature_chemin)}
        />
      </main>
    </div>
  )
}
