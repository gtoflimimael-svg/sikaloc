import type { Metadata } from 'next'
import localFont from 'next/font/local'

import { BandeauAbonnement } from '@/components/app/bandeau-abonnement'
import { MenuCompte } from '@/components/app/menu-compte'
import { ActionPaiementTopbar, BarreLaterale, ContextePro, EnTeteMobile } from '@/components/app/navigation'
import { VisiteGuidee } from '@/components/app/visite-guidee'
import { TransitionPage } from '@/components/ui/transition-page'
import { abonnementActif } from '@/lib/plan'
import { bailleurCourant } from '@/lib/session'
import { avancement, ouvertureAutomatique } from '@/lib/visite/etapes'
import { creerClientServeur } from '@/lib/supabase/serveur'

const manropePro = localFont({
  src: [
    { path: '../../fonts/Manrope-PDF-Regular.ttf', weight: '400' },
    { path: '../../fonts/Manrope-PDF-Medium.ttf', weight: '500' },
    { path: '../../fonts/Manrope-PDF-SemiBold.ttf', weight: '600' },
    { path: '../../fonts/Manrope-PDF-Bold.ttf', weight: '700' },
    { path: '../../fonts/Manrope-PDF-Extrabold.ttf', weight: '800' },
  ],
  variable: '--font-pro-display',
  display: 'swap',
  preload: false,
})

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
  const supabase = await creerClientServeur()

  // Le profil est d'abord résolu afin de borner explicitement les compteurs à
  // ce bailleur. `head: true` ne rapatrie aucune ligne : seul le total voyage.
  const [bailleur, { count }] = await Promise.all([
    bailleurCourant(),
    supabase.from('v_impayes').select('bail_id', { count: 'exact', head: true }),
  ])
  const bauxActifsReponse = await supabase
    .from('baux')
    .select('id', { count: 'exact', head: true })
    .eq('bailleur_id', bailleur.id)
    .eq('statut', 'Actif')

  const impayes = count ?? 0
  const aBauxActifs = !bauxActifsReponse.error && (bauxActifsReponse.count ?? 0) > 0

  // La progression n'est lue que tant que la visite peut encore servir. Pour un
  // bailleur qui l'a terminée — le cas de tous les jours — ce layout, qui
  // enveloppe CHAQUE page, ne paie aucune requête supplémentaire.
  const visiteClose = Boolean(bailleur.tutoriel_vu_le)
  const { data: progression } = visiteClose
    ? { data: null }
    : await supabase
        .from('v_progression_visite')
        .select('*')
        .eq('bailleur_id', bailleur.id)
        .maybeSingle()

  const parcours = progression
    ? avancement(progression, {
        tutoriel_vu_le: bailleur.tutoriel_vu_le,
        visite_quittee_le: bailleur.visite_quittee_le,
      })
    : null
  const plan = abonnementActif(bailleur) ? 'Standard' : 'Gratuit'

  return (
    <div className={`${manropePro.variable} pro-shell flex min-h-screen`}>
      <a href="#contenu-principal" className="skip-link">Aller au contenu</a>
      <BarreLaterale impayes={impayes} />

      <div className="flex min-w-0 flex-1 flex-col">
        <EnTeteMobile
          impayes={impayes}
          aBauxActifs={aBauxActifs}
          nomBailleur={bailleur.nom}
          emailBailleur={bailleur.email}
          plan={plan}
        />

        <BandeauAbonnement bailleur={bailleur} />

        <header className="pro-topbar hidden h-16 shrink-0 items-center justify-between gap-lg border-b border-hairline bg-canvas px-xl lg:flex">
          <ContextePro />
          <ActionPaiementTopbar aBauxActifs={aBauxActifs} />
          <MenuCompte
            nom={bailleur.nom}
            email={bailleur.email}
            plan={plan}
          />
        </header>

        <main id="contenu-principal" tabIndex={-1} className="app-main pro-main flex-1">
          <div className="mx-auto max-w-[1100px]">
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
