import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { EnTeteMe } from '@/components/me/navigation'
import { TransitionPage } from '@/components/ui/transition-page'
import { mesBaux } from '@/lib/locataire'
import { ESPACE_ME } from '@/lib/roles'
import { locataireCourant, rolesDuCompte } from '@/lib/session'

/**
 * La mise en page de Sikaloc_Me.
 *
 * ─── Ce que le groupe de routes `(espace)` sépare ───────────────────────────
 *
 * Cette mise en page enveloppe les écrans du locataire connecté. Elle n'entoure
 * NI `/me/rejoindre` NI `/me/invitation/[jeton]`, qui s'adressent précisément à
 * quelqu'un qui n'a pas encore de compte : leur poser une barre d'onglets vers
 * des écrans inaccessibles serait une promesse en trompe-l'œil.
 *
 * ─── Un locataire sans bail rattaché ────────────────────────────────────────
 *
 * Il arrive : un compte créé depuis une invitation dont le rattachement a
 * échoué, ou une fiche détachée depuis. Le renvoyer vers l'explication vaut
 * mieux que quatre onglets vides qui ressemblent à une panne.
 */
export const metadata: Metadata = {
  title: { template: `%s · ${ESPACE_ME.nom}`, default: ESPACE_ME.nom },
}

export default async function LayoutMe({ children }: { children: React.ReactNode }) {
  // Trois lectures indépendantes — le garde, les rôles, les baux. Aucune n'a
  // besoin du résultat des autres, et `mesBaux()` est mémorisé le temps de la
  // requête : la page qui suit la relira sans repayer l'aller-retour.
  const [compte, roles, baux] = await Promise.all([
    locataireCourant(),
    rolesDuCompte(),
    mesBaux(),
  ])

  if (baux.length === 0) redirect('/me/rejoindre')

  return (
    <div className="flex min-h-screen flex-col bg-canvas-soft">
      <EnTeteMe email={compte.email} aussiBailleur={roles.estBailleur} />

      <main className="flex-1 px-lg py-xl sm:px-xl sm:py-2xl">
        <div className="mx-auto max-w-[900px]">
          <TransitionPage>{children}</TransitionPage>
        </div>
      </main>

      <footer className="border-t border-hairline px-lg py-lg">
        <p className="mx-auto max-w-[900px] text-caption text-mute-soft">
          {ESPACE_ME.nom} · Les informations affichées sont celles enregistrées
          par votre bailleur. Lui seul peut les corriger.
        </p>
      </footer>
    </div>
  )
}
