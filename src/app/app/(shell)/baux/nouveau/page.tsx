import type { Metadata } from 'next'

import { FormulaireBail } from '@/components/app/formulaire-bail'
import { EnTetePage } from '@/components/ui/retours'
import { creerBail } from '@/lib/actions/baux'
import { bailleurOnboarde } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'

export const metadata: Metadata = { title: 'Nouveau bail' }

export default async function PageNouveauBail() {
  await bailleurOnboarde()
  const supabase = await creerClientServeur()

  const [{ data: logements }, { data: locataires }] = await Promise.all([
    supabase
      .from('logements')
      .select('id, adresse, ville, baux(id, statut)')
      .order('adresse'),
    supabase.from('locataires').select('id, nom, telephone').order('nom'),
  ])

  // Un logement déjà sous bail actif n'est pas proposé : la base le refuserait
  // de toute façon (index unique partiel), autant l'écarter en amont.
  const logementsLibres = (logements ?? []).filter((logement) => {
    const baux = (logement.baux ?? []) as unknown as { statut: string }[]
    return !baux.some((b) => b.statut === 'Actif')
  })

  return (
    <div className="mx-auto max-w-[42rem]">
      <EnTetePage
        titre="Nouveau bail"
        description="Seuls les logements sans bail actif sont proposés."
      />

      <FormulaireBail
        action={creerBail}
        logements={logementsLibres.map((l) => ({
          valeur: l.id,
          libelle: `${l.adresse} — ${l.ville}`,
        }))}
        locataires={(locataires ?? []).map((l) => ({
          valeur: l.id,
          libelle: `${l.nom} — ${l.telephone}`,
        }))}
      />
    </div>
  )
}
