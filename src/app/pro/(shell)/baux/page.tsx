import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight, Plus } from 'lucide-react'

import { Alerte } from '@/components/ui/retours'
import { formaterFCFA } from '@/lib/format'
import { formaterDateBail, normaliserFiltreBail } from '@/lib/baux-presentation'
import { bailleurOnboarde } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'
import type { StatutBail } from '@/lib/types/database'
import styles from './baux.module.css'

export const metadata: Metadata = { title: 'Baux' }

const FILTRES: { valeur: 'tous' | StatutBail; libelle: string }[] = [
  { valeur: 'tous', libelle: 'Tous' },
  { valeur: 'Actif', libelle: 'Actifs' },
  { valeur: 'Résilié', libelle: 'Résiliés' },
]

export default async function PageBaux({
  searchParams,
}: {
  searchParams: Promise<{ statut?: string | string[] }>
}) {
  await bailleurOnboarde()

  const { statut } = await searchParams
  const filtre = normaliserFiltreBail(typeof statut === 'string' ? statut : undefined)
  const filtreActif = filtre ?? 'tous'
  const supabase = await creerClientServeur()

  let requete = supabase
    .from('baux')
    .select(
      'id, statut, date_debut, loyer_mensuel, logement:logements(id, adresse, ville, type), locataire:locataires(id, nom)',
    )
    .order('created_at', { ascending: false })

  if (filtre) requete = requete.eq('statut', filtre)

  const { data: baux, error: erreurBaux } = await requete
  const liste = baux ?? []

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Baux</h1>
        <Link href="/pro/baux/nouveau" className={`btn btn-primary ${styles.newLease}`}>
          Nouveau bail
          <Plus size={17} strokeWidth={2} aria-hidden="true" />
        </Link>
      </header>

      <nav className={styles.filters} aria-label="Filtrer les baux par statut">
        {FILTRES.map((option) => {
          const actif = filtreActif === option.valeur
          const href =
            option.valeur === 'tous'
              ? '/pro/baux'
              : `/pro/baux?statut=${encodeURIComponent(option.valeur)}`

          return (
            <Link
              key={option.valeur}
              href={href}
              className={styles.filter}
              aria-current={actif ? 'page' : undefined}
            >
              {option.libelle}
            </Link>
          )
        })}
      </nav>

      {erreurBaux ? (
        <Alerte ton="erreur">
          Les baux ne peuvent pas être chargés. Actualisez la page pour réessayer.
        </Alerte>
      ) : liste.length === 0 ? (
        <section className={styles.empty} aria-labelledby="leases-empty-title" aria-live="polite">
          <h2 id="leases-empty-title">
            {filtre === 'Actif'
              ? 'Aucun bail actif.'
              : filtre === 'Résilié'
                ? 'Aucun bail résilié.'
                : 'Aucun bail pour le moment.'}
          </h2>
          {filtre ? (
            <Link href="/pro/baux" className={styles.allLeases}>
              Voir tous les baux
            </Link>
          ) : null}
        </section>
      ) : (
        <ul className={styles.list} aria-label="Baux">
          {liste.map((bail) => {
            const logement = Array.isArray(bail.logement) ? bail.logement[0] : bail.logement
            const locataire = Array.isArray(bail.locataire) ? bail.locataire[0] : bail.locataire
            const caracteristiques = [logement?.type, logement?.ville].filter(Boolean)
            const dateDebut = formaterDateBail(bail.date_debut)
            const identite = logement?.adresse ?? locataire?.nom ?? 'ce bail'

            return (
              <li key={bail.id} className={styles.row}>
                <div className={styles.property}>
                  <h2 className={styles.propertyName}>
                    {logement?.adresse ?? 'Logement indisponible'}
                  </h2>
                  {caracteristiques.length > 0 ? (
                    <p className={styles.propertyMeta}>{caracteristiques.join(' · ')}</p>
                  ) : null}
                </div>

                <div className={styles.tenant}>
                  <p className={styles.tenantName}>
                    {locataire?.nom ?? 'Locataire indisponible'}
                  </p>
                  {dateDebut ? (
                    <p className={styles.leaseStart}>
                      <span className="sr-only">Début du bail : </span>
                      Depuis le {dateDebut}
                    </p>
                  ) : null}
                </div>

                <p className={styles.status} data-status={bail.statut}>
                  {bail.statut}
                </p>

                <p className={styles.rent}>
                  <span>{formaterFCFA(bail.loyer_mensuel)}</span>
                  <span className={styles.rentPeriod} aria-hidden="true">/mois</span>
                  <span className="sr-only">par mois</span>
                </p>

                <Link
                  href={`/pro/baux/${bail.id}`}
                  className={styles.viewLease}
                  aria-label={`Voir le bail de ${identite}`}
                >
                  Voir le bail
                  <ChevronRight size={16} strokeWidth={1.8} aria-hidden="true" />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
