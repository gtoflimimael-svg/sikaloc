import Link from 'next/link'

import { BandeauAbonnement } from '@/components/app/bandeau-abonnement'
import { MenuCompte } from '@/components/app/menu-compte'
import { BarreLaterale, EnTeteMobile } from '@/components/app/navigation'
import { VisiteGuidee } from '@/components/app/visite-guidee'
import { TransitionPage } from '@/components/ui/transition-page'
import { abonnementActif } from '@/lib/plan'
import { bailleurCourant } from '@/lib/session'
import { avancement, ouvertureAutomatique } from '@/lib/visite/etapes'
import { creerClientServeur } from '@/lib/supabase/serveur'

export default async function LayoutApplication({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await creerClientServeur()

  // Ce layout enveloppe CHAQUE page de l'application : la moindre latence
  // gagnée ici se paie à chaque navigation. Le profil du bailleur et le
  // compteur d'impayés sont deux lectures indépendantes — toutes deux scopées
  // par les RLS via le cookie de session, aucune n'a besoin du résultat de
  // l'autre — donc parties en parallèle plutôt qu'à la suite.
  //
  // `head: true` sur le compteur ne rapatrie aucune ligne : seul le total
  // voyage.
  const [bailleur, { count }] = await Promise.all([
    bailleurCourant(),
    supabase.from('v_impayes').select('bail_id', { count: 'exact', head: true }),
  ])

  const impayes = count ?? 0

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
    <div className="flex min-h-screen bg-canvas-soft">
      <BarreLaterale impayes={impayes} />

      <div className="flex min-w-0 flex-1 flex-col">
        <EnTeteMobile
          impayes={impayes}
          nomBailleur={bailleur.nom}
          idBailleur={bailleur.id}
          avatarBailleur={bailleur.avatar}
          emailBailleur={bailleur.email}
          plan={plan}
        />

        <BandeauAbonnement bailleur={bailleur} />

        <header className="hidden h-16 shrink-0 items-center justify-end gap-lg border-b border-hairline bg-canvas px-xl lg:flex">
          <Link
            href="/app/paiements/nouveau"
            // Repère de la visite guidée. Le bouton équivalent de l'en-tête
            // mobile porte le même : `cibleVisible` retient celui qui est
            // réellement à l'écran, quel que soit l'ordre du DOM.
            data-visite="bouton-paiement"
            className="btn btn-primary btn-sm"
          >
            Enregistrer un paiement
          </Link>
          <MenuCompte
            id={bailleur.id}
            avatar={bailleur.avatar}
            nom={bailleur.nom}
            email={bailleur.email}
            plan={plan}
          />
        </header>

        <main className="flex-1 px-lg py-xl sm:px-xl sm:py-2xl">
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
