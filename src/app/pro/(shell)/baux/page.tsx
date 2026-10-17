import type { Metadata } from 'next'
import Link from 'next/link'

import { ResumeListe } from '@/components/ui/listes'
import { LienFiltre } from '@/components/ui/lien-filtre'
import { Illustration } from '@/components/ui/illustration'
import { AvatarPeep } from '@/components/ui/avatar-peep'
import { Alerte, Badge, EnTetePage, EtatVide } from '@/components/ui/retours'
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

  const { data: baux, error: erreurBaux } = await requete
  const liste = baux ?? []

  return (
    <div>
      <EnTetePage
        titre="Baux"
        description="Le contrat qui relie un logement, un locataire et un loyer."
        action={
          <Link href="/pro/baux/nouveau" className="btn btn-primary">
            Nouveau bail
          </Link>
        }
      />

      <nav aria-label="Filtrer les baux par statut" className="mb-lg flex flex-wrap gap-xs">
        {FILTRES.map((option) => {
          const actif = (statut ?? 'tous') === option.valeur

          return (
            <LienFiltre
              key={option.valeur}
              href={option.valeur === 'tous' ? '/pro/baux' : `/pro/baux?statut=${option.valeur}`}
              actif={actif}
            >
              {option.libelle}
            </LienFiltre>
          )
        })}
      </nav>

      {erreurBaux ? (
        <Alerte ton="erreur">Les baux ne peuvent pas être chargés. Actualisez la page pour réessayer.</Alerte>
      ) : liste.length === 0 ? (
        <EtatVide
          icone={<Illustration nom="lecture" taille={200} decorative />}
          titre={filtre ? `Aucun bail ${filtre.toLowerCase()}` : 'Aucun bail enregistré'}
          description="Un bail relie un logement à un locataire. C’est lui qui déclenche le suivi des loyers et la détection des impayés."
          action={
            <Link href="/pro/baux/nouveau" className="btn btn-primary">
              Créer un bail
            </Link>
          }
        />
      ) : (
        <>
        <ResumeListe>{liste.length} {liste.length > 1 ? 'baux' : 'bail'} affiché{liste.length > 1 ? 's' : ''}</ResumeListe>
        <ul className="space-y-sm" aria-label="Baux affichés">
          {liste.map((bail) => {
            const logement = Array.isArray(bail.logement) ? bail.logement[0] : bail.logement
            const locataire = Array.isArray(bail.locataire) ? bail.locataire[0] : bail.locataire

            return (
              <li key={bail.id}>
              <Link
                href={`/pro/baux/${bail.id}`}
                className="card list-card block transition-colors hover:border-hairline-strong"
              >
                <div className="list-row">
                  <div className="flex min-w-0 items-start gap-sm">
                    <AvatarPeep
                      id={locataire?.id ?? bail.locataire_id}
                      avatar={locataire?.avatar}
                      nom={locataire?.nom}
                    />
                    <div className="min-w-0">
                      <h2 className="list-title">
                        {locataire?.nom ?? 'Locataire inconnu'}
                      </h2>
                      <p className="list-copy text-body-sm text-mute">
                        {logement?.adresse ?? '—'}
                        {logement?.ville ? `, ${logement.ville}` : ''}
                      </p>
                      <p className="mt-sm text-body-sm text-body">
                        Depuis le {formaterDate(bail.date_debut)} · échéance le{' '}
                        {bail.jour_echeance} du mois · tolérance {bail.tolerance_jours} j
                      </p>
                    </div>
                  </div>

                  <div className="list-aside">
                    <Badge ton={bail.statut === 'Actif' ? 'positive' : 'neutral'}>
                      {bail.statut}
                    </Badge>
                    <p className="money text-body-md font-semibold text-ink">
                      {formaterFCFA(bail.loyer_mensuel)}
                      <span className="text-caption font-normal text-mute"> /mois</span>
                    </p>
                  </div>
                </div>
              </Link>
              </li>
            )
          })}
        </ul>
        </>
      )}
    </div>
  )
}
