import type { Metadata } from 'next'
import { SlidersHorizontal } from 'lucide-react'

import { FormulairePreferencesLocataire } from '@/components/me/formulaire-preferences'
import { IntroPageMe } from '@/components/me/intro-page'
import { mesPreferences } from '@/lib/locataire'
import { locataireCourant } from '@/lib/session'

export const metadata: Metadata = { title: 'Mes préférences' }

/**
 * Le réglage des emails.
 *
 * ─── Pourquoi un écran plutôt qu'un lien de désabonnement ───────────────────
 *
 * Un lien dans le pied d'un email suppose d'avoir gardé cet email. Quelqu'un
 * qui veut que ça cesse cherche d'abord dans l'application, et ne doit pas
 * avoir à retrouver un message pour y arriver.
 *
 * Le lien dans les emails viendra en plus, pas à la place — voir la liste des
 * suites dans `docs/`.
 */
export default async function PagePreferences() {
  const compte = await locataireCourant()
  const preferences = await mesPreferences()

  return (
    <div className="space-y-xl">
      <IntroPageMe
        titre="Mes préférences"
        description="Ce que Sikaloc a le droit de vous envoyer."
        icone={<SlidersHorizontal size={24} />}
      />

      <FormulairePreferencesLocataire actif={preferences.notifEmail} />

      <p className="rounded-lg border border-hairline bg-canvas p-md text-body-sm text-mute">
        Les emails partent à <strong className="text-ink list-copy">{compte.email}</strong>,
        l’adresse de votre compte. Pour en changer, écrivez à votre bailleur : la
        fiche qu’il tient est celle qui sert d’adresse de contact.
      </p>
    </div>
  )
}
