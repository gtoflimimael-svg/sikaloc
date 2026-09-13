import type { Metadata } from 'next'

import { FormulairePreferencesLocataire } from '@/components/me/formulaire-preferences'
import { EnTetePage } from '@/components/ui/retours'
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
      <EnTetePage
        titre="Mes préférences"
        description="Ce que Sikaloc a le droit de vous envoyer."
      />

      <FormulairePreferencesLocataire actif={preferences.notifEmail} />

      <p className="text-body-sm text-mute">
        Les emails partent à <strong className="text-ink">{compte.email}</strong>,
        l’adresse de votre compte. Pour en changer, écrivez à votre bailleur : la
        fiche qu’il tient est celle qui sert d’adresse de contact.
      </p>
    </div>
  )
}
