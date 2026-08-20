import type { Metadata } from 'next'

import { BailImpossible, diagnostiquer } from '@/components/app/bail-impossible'
import { FormulaireBail } from '@/components/app/formulaire-bail'
import { EnTetePage } from '@/components/ui/retours'
import { creerBail } from '@/lib/actions/baux'
import { capacites } from '@/lib/plan'
import { bailleurOnboarde } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'

export const metadata: Metadata = { title: 'Nouveau bail' }

export default async function PageNouveauBail() {
  const supabase = await creerClientServeur()

  const [bailleur, { data: logements }, { data: locataires }] = await Promise.all([
    bailleurOnboarde(),
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

  // Le total compte autant que le disponible : « aucun logement libre » et
  // « aucun logement » appellent deux messages différents, et le plafond du
  // plan décide si « en ajouter un » est seulement possible.
  const situation = {
    totalLogements: (logements ?? []).length,
    logementsLibres: logementsLibres.length,
    totalLocataires: (locataires ?? []).length,
    maxLogements: capacites(bailleur).maxLogements,
  }

  const impossible = diagnostiquer(situation) !== null

  return (
    <div className="mx-auto max-w-[42rem]">
      <EnTetePage
        titre="Nouveau bail"
        description={
          impossible ? undefined : 'Seuls les logements sans bail actif sont proposés.'
        }
      />

      {impossible ? (
        <BailImpossible situation={situation} />
      ) : (
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
      )}
    </div>
  )
}
