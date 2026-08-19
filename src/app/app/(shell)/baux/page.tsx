import type { Metadata } from 'next'
import Link from 'next/link'

import { Illustration } from '@/components/ui/illustration'
import { AvatarPeep } from '@/components/ui/avatar-peep'
import { Badge, EnTetePage, EtatVide } from '@/components/ui/retours'
import { formaterDate, formaterFCFA } from '@/lib/format'
import { bailleurOnboarde } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'
import type { StatutBail } from '@/lib/types/database'

export const metadata: Metadata = { title: 'Baux' }

const FILTRES: { valeur: string; libelle: string }[] = [
  { valeur: 'tous', libelle: 'Tous' },
  { valeur: 'Actif', libelle: 'Actifs' },
  { valeur: 'Résilié', libelle: 'Résiliés' },
]

export default async function PageBaux({
  searchParams,
}: {
  searchParams: Promise<{ statut?: string }>
}) {
  await bailleurOnboarde()
  const { statut } = await searchParams
  const filtre = statut && statut !== 'tous' ? (statut as StatutBail) : null

  const supabase = await creerClientServeur()

  let requete = supabase
    .from('baux')
    .select(
      '*, logement:logements(id, adresse, ville, type), locataire:locataires(id, nom, telephone)',
    )
    .order('created_at', { ascending: false })

  if (filtre) requete = requete.eq('statut', filtre)

  const { data: baux } = await requete
  const liste = baux ?? []

  return (
    <div>
      <EnTetePage
        titre="Baux"
        description="Le contrat qui relie un logement, un locataire et un loyer."
        action={
          <Link href="/app/baux/nouveau" className="btn btn-primary">
            Nouveau bail
          </Link>
        }
      />

      <div className="mb-xl flex flex-wrap gap-sm">
        {FILTRES.map((option) => {
          const actif = (statut ?? 'tous') === option.valeur

          return (
            <Link
              key={option.valeur}
              href={option.valeur === 'tous' ? '/app/baux' : `/app/baux?statut=${option.valeur}`}
              className={`rounded-pill px-lg py-sm text-body-sm font-semibold transition-colors ${
                actif
                  ? 'bg-primary text-on-primary'
                  : 'bg-canvas text-mute hover:text-ink border border-hairline'
              }`}
            >
              {option.libelle}
            </Link>
          )
        })}
      </div>

      {liste.length === 0 ? (
        <EtatVide
          icone={<Illustration nom="lecture" taille={200} decorative />}
          titre={filtre ? `Aucun bail ${filtre.toLowerCase()}` : 'Aucun bail enregistré'}
          description="Un bail relie un logement à un locataire. C’est lui qui déclenche le suivi des loyers et la détection des impayés."
          action={
            <Link href="/app/baux/nouveau" className="btn btn-primary">
              Créer un bail
            </Link>
          }
        />
      ) : (
        <div className="space-y-md">
          {liste.map((bail) => {
            const logement = Array.isArray(bail.logement) ? bail.logement[0] : bail.logement
            const locataire = Array.isArray(bail.locataire) ? bail.locataire[0] : bail.locataire

            return (
              <Link
                key={bail.id}
                href={`/app/baux/${bail.id}`}
                className="card block transition-colors hover:border-hairline-strong"
              >
                <div className="flex flex-wrap items-start justify-between gap-lg">
                  <div className="flex min-w-0 items-start gap-lg">
                    <AvatarPeep
                      id={locataire?.id ?? bail.locataire_id}
                      avatar={locataire?.avatar}
                      nom={locataire?.nom}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-body-md font-semibold text-ink">
                        {locataire?.nom ?? 'Locataire inconnu'}
                      </p>
                      <p className="truncate text-body-sm text-mute">
                        {logement?.adresse ?? '—'}
                        {logement?.ville ? `, ${logement.ville}` : ''}
                      </p>
                      <p className="mt-sm text-body-sm text-body">
                        Depuis le {formaterDate(bail.date_debut)} · échéance le{' '}
                        {bail.jour_echeance} du mois · tolérance {bail.tolerance_jours} j
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-sm">
                    <Badge ton={bail.statut === 'Actif' ? 'positive' : 'neutral'}>
                      {bail.statut}
                    </Badge>
                    <p className="text-body-md font-semibold tabular text-ink">
                      {formaterFCFA(bail.loyer_mensuel)}
                      <span className="text-caption font-normal text-mute"> /mois</span>
                    </p>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
