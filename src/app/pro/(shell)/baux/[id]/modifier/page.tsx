import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { FormulaireBail } from '@/components/app/formulaire-bail'
import { Alerte, EnTetePage } from '@/components/ui/retours'
import { modifierBail } from '@/lib/actions/baux'
import { bailleurOnboarde } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'
import { formaterTelephone } from '@/lib/telephone'

export const metadata: Metadata = { title: 'Modifier le bail' }

export default async function PageModifierBail({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await creerClientServeur()

  const [, reponseBail, reponseLogements, reponseLocataires] = await Promise.all([
    bailleurOnboarde(),
    supabase.from('baux').select('*').eq('id', id).maybeSingle(),
    supabase.from('logements').select('id, adresse, ville, baux(id, statut)').order('adresse'),
    supabase.from('locataires').select('id, nom, telephone').order('nom'),
  ])
  const { data: bail, error: erreurBail } = reponseBail
  const { data: logements, error: erreurLogements } = reponseLogements
  const { data: locataires, error: erreurLocataires } = reponseLocataires

  if (erreurBail) {
    return <Alerte ton="erreur">Le bail n’a pas pu être chargé. Actualisez la page pour réessayer.</Alerte>
  }
  if (!bail) notFound()
  if (erreurLogements || erreurLocataires) {
    return (
      <Alerte ton="erreur">
        Les logements et locataires disponibles n’ont pas pu être chargés. Aucune modification
        n’est possible avant de réessayer.
      </Alerte>
    )
  }

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
          libelle: `${l.nom} — ${formaterTelephone(l.telephone)}`,
        }))}
      />
    </div>
  )
}
