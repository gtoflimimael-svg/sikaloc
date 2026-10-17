import type { Metadata } from 'next'
import Link from 'next/link'

import { FormulaireNouvelleAnnonce } from '@/components/app/formulaire-nouvelle-annonce'
import { Illustration } from '@/components/ui/illustration'
import { Alerte, Badge, EnTetePage, EtatVide } from '@/components/ui/retours'
import { creerAnnonce } from '@/lib/actions/annonces'
import { LIBELLES_STATUT, TON_STATUT } from '@/lib/annonces/libelles'
import { bailleurOnboarde } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'
import type { StatutAnnonce } from '@/lib/types/database'

export const metadata: Metadata = { title: 'Nouvelle annonce' }

type LigneLogement = {
  id: string
  adresse: string
  ville: string
  type: string
  baux: { statut: string }[]
  annonces: { id: string; statut: StatutAnnonce }[]
}

export default async function PageNouvelleAnnonce({
  searchParams,
}: {
  searchParams: Promise<{ logement?: string }>
}) {
  const { logement: selection } = await searchParams
  const supabase = await creerClientServeur()

  const [, { data }] = await Promise.all([
    bailleurOnboarde(),
    supabase
      .from('logements')
      .select('id, adresse, ville, type, baux(statut), annonces(id, statut)')
      .order('created_at', { ascending: false }),
  ])

  const logements = (data ?? []) as unknown as LigneLogement[]

  // Un logement a au plus UNE annonce vivante (index unique de S1). Celui qui
  // en a une n'est pas proposé : on montre l'existante à la place.
  const vivante = (l: LigneLogement) => l.annonces.find((a) => a.statut !== 'cloturee')
  const libres = logements.filter((l) => !vivante(l))
  const avecAnnonce = logements.filter((l) => vivante(l))
  const loue = (l: LigneLogement) => l.baux.some((b) => b.statut === 'Actif')

  return (
    <div className="mx-auto max-w-[42rem] space-y-xl">
      <EnTetePage
        titre="Nouvelle annonce"
        description="Choisissez le logement à proposer. L’annonce commence en brouillon : rien n’est publié tant que vous ne l’avez pas décidé."
      />

      {logements.length === 0 ? (
        <EtatVide
          icone={<Illustration nom="plante" taille={200} decorative />}
          titre="Aucun logement enregistré"
          description="Une annonce se rattache à un logement. Enregistrez-le d’abord."
          action={
            <Link href="/pro/logements/nouveau" className="btn btn-primary">
              Ajouter un logement
            </Link>
          }
        />
      ) : libres.length === 0 ? (
        <Alerte ton="info">
          Chacun de vos logements a déjà une annonce en cours. Ouvrez-la ci-dessous, ou
          ajoutez un logement.
        </Alerte>
      ) : (
        <>
          {libres.some(loue) ? (
            <Alerte ton="info">
              Un logement loué peut préparer son annonce. Sa publication attendra que le bail en
              cours ait une date de fin, et que la disponibilité tombe après elle.
            </Alerte>
          ) : null}
          <FormulaireNouvelleAnnonce
            action={creerAnnonce}
            selection={libres.some((l) => l.id === selection) ? selection : undefined}
            logements={libres.map((l) => ({
              valeur: l.id,
              libelle: `${l.adresse} — ${l.ville} (${l.type})${loue(l) ? ' · loué' : ''}`,
            }))}
          />
        </>
      )}

      {avecAnnonce.length > 0 ? (
        <section className="space-y-md">
          <h2 className="text-display-xs font-semibold text-ink">Déjà en annonce</h2>
          <ul className="space-y-sm">
            {avecAnnonce.map((l) => {
              const annonce = vivante(l)!
              return (
                <li key={l.id} className="card flex flex-wrap items-center justify-between gap-md">
                  <div className="min-w-0">
                    <p className="text-body-md font-semibold text-ink">{l.adresse}</p>
                    <p className="text-body-sm text-mute">{l.ville}</p>
                  </div>
                  <div className="flex items-center gap-md">
                    <Badge ton={TON_STATUT[annonce.statut]}>{LIBELLES_STATUT[annonce.statut]}</Badge>
                    <Link href={`/pro/annonces/${annonce.id}`} className="btn btn-secondary btn-sm">
                      Voir l’annonce
                    </Link>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
