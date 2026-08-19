import Link from 'next/link'

import { BandeauAbonnement } from '@/components/app/bandeau-abonnement'
import { MenuCompte } from '@/components/app/menu-compte'
import { BarreLaterale, EnTeteMobile } from '@/components/app/navigation'
import { bailleurCourant } from '@/lib/session'
import { abonnementActif } from '@/lib/plan'
import { creerClientServeur } from '@/lib/supabase/serveur'

export default async function LayoutApplication({
  children,
}: {
  children: React.ReactNode
}) {
  const bailleur = await bailleurCourant()
  const supabase = await creerClientServeur()

  // Compteur d'impayés affiché en pastille de navigation. `head: true` ne
  // rapatrie aucune ligne : seul le total voyage.
  const { count } = await supabase
    .from('v_impayes')
    .select('bail_id', { count: 'exact', head: true })

  const impayes = count ?? 0
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
        />

        <BandeauAbonnement bailleur={bailleur} />

        <header className="hidden h-16 shrink-0 items-center justify-end gap-lg border-b border-hairline bg-canvas px-xl lg:flex">
          <Link href="/app/paiements/nouveau" className="btn btn-primary btn-sm">
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
          <div className="mx-auto max-w-[1100px]">{children}</div>
        </main>
      </div>
    </div>
  )
}
