import type { Metadata } from 'next'

import { BandeauAbonnement } from '@/components/app/bandeau-abonnement'
import { MenuCompte } from '@/components/app/menu-compte'
import { BarreLaterale, ContextePro, EnTeteMobile } from '@/components/app/navigation'
import { VisiteGuidee } from '@/components/app/visite-guidee'
import { TransitionPage } from '@/components/ui/transition-page'
import { abonnementActif } from '@/lib/plan'
import { bailleurOnboarde } from '@/lib/session'
import { avancement, ouvertureAutomatique } from '@/lib/visite/etapes'
import { creerClientServeur } from '@/lib/supabase/serveur'

/**
 * Le titre des onglets de l'espace bailleur.
 *
 * Le gabarit de la racine dit « … · Sikaloc ». Ici il dit « … · Sikaloc Pro » :
 * sur un navigateur qui porte les deux espaces ouverts côte à côte, c'est
 * l'onglet qui les distingue.
 */
export const metadata: Metadata = {
  title: { template: '%s · Sikaloc Pro', default: 'Sikaloc Pro' },
}

export default async function LayoutApplication({
  children,
}: {
  children: React.ReactNode
}) {
  // La garde doit précéder la production du shell et du guide interactif.
  // Une garde limitée à la page du tableau de bord peut arriver après qu'un
  // layout parent a déjà été diffusé, laissant apparaître le dashboard avant
  // la redirection vers l'onboarding.
  const bailleur = await bailleurOnboarde()
  const supabase = await creerClientServeur()

  // La progression n'est lue que tant que la visite peut encore servir. Les
  // deux lectures sont parallèles, mais seulement après validation de l'accès.
  const visiteClose = Boolean(bailleur.tutoriel_vu_le)
  const lectureProgression = visiteClose
    ? { data: null }
    : supabase
        .from('v_progression_visite')
        .select('*')
        .eq('bailleur_id', bailleur.id)
        .maybeSingle()
  const [{ count }, { data: progression }] = await Promise.all([
    supabase.from('v_impayes').select('bail_id', { count: 'exact', head: true }),
    lectureProgression,
  ])
  const impayes = count ?? 0

  const parcours = progression
    ? avancement(progression, {
        tutoriel_vu_le: bailleur.tutoriel_vu_le,
        visite_quittee_le: bailleur.visite_quittee_le,
      })
    : null
  const plan = abonnementActif(bailleur) ? 'Standard' : 'Gratuit'

  return (
    <div className="pro-shell flex min-h-screen">
      <a href="#contenu-principal" className="skip-link">Aller au contenu</a>
      <BarreLaterale impayes={impayes} />

      <div className="flex min-w-0 flex-1 flex-col">
        <EnTeteMobile
          impayes={impayes}
          nomBailleur={bailleur.nom}
          emailBailleur={bailleur.email}
          plan={plan}
        />

        <BandeauAbonnement bailleur={bailleur} />

        <header className="pro-topbar hidden h-16 shrink-0 items-center justify-between gap-lg border-b border-hairline bg-canvas px-xl lg:flex">
          <ContextePro />
          <MenuCompte
            nom={bailleur.nom}
            email={bailleur.email}
            plan={plan}
          />
        </header>

        <main id="contenu-principal" tabIndex={-1} className="app-main pro-main flex-1">
          <div className="pro-content-frame">
            <TransitionPage>{children}</TransitionPage>
          </div>
        </main>
      </div>

      {/*
        Montée dans le shell, et non dans une page : `TransitionPage` porte une
        `key={chemin}` qui démonte son sous-arbre à chaque navigation. Une visite
        qui accompagne l'utilisateur d'un formulaire à l'autre ne peut pas vivre
        là-dedans.
      */}
      {parcours ? (
        <VisiteGuidee
          avancement={parcours}
          ouvertAuDemarrage={ouvertureAutomatique(parcours)}
        />
      ) : null}
    </div>
  )
}
