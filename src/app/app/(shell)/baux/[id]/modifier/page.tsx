import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { FormulaireBail } from '@/components/app/formulaire-bail'
import { EnTetePage } from '@/components/ui/retours'
import { modifierBail } from '@/lib/actions/baux'
import { bailleurOnboarde } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'

export const metadata: Metadata = { title: 'Modifier le bail' }

export default async function PageModifierBail({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await bailleurOnboarde()
  const { id } = await params
  const supabase = await creerClientServeur()

  const [{ data: bail }, { data: logements }, { data: locataires }] = await Promise.all([
    supabase.from('baux').select('*').eq('id', id).maybeSingle(),
    supabase.from('logements').select('id, adresse, ville, baux(id, statut)').order('adresse'),
    supabase.from('locataires').select('id, nom, telephone').order('nom'),
  ])

  if (!bail) notFound()

  // Le logement actuellement rattaché reste proposé, même s'il porte un bail
  // actif — c'est celui-ci.
  const logementsDisponibles = (logements ?? []).filter((logement) => {
    if (logement.id === bail.logement_id) return true
    const baux = (logement.baux ?? []) as unknown as { statut: string }[]
    return !baux.some((b) => b.statut === 'Actif')
  })

  return (
    <div className="mx-auto max-w-[42rem]">
      <EnTetePage titre="Modifier le bail" />

      <FormulaireBail
        action={modifierBail.bind(null, id)}
        bail={bail}
        logements={logementsDisponibles.map((l) => ({
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
