import type { Metadata } from 'next'
import Link from 'next/link'

import { Illustration } from '@/components/ui/illustration'
import { AvatarPeep } from '@/components/ui/avatar-peep'
import { CarteMetrique } from '@/components/app/carte-metrique'
import { Badge, EtatVide } from '@/components/ui/retours'
import {
  formaterDateCourte,
  formaterFCFA,
  formaterPeriode,
} from '@/lib/format'
import { bailleurOnboarde } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'
import type { Impaye, MetriquesDashboard } from '@/lib/types/database'

export const metadata: Metadata = { title: 'Tableau de bord' }

export default async function PageTableauDeBord({
  searchParams,
}: {
  searchParams: Promise<{ bienvenue?: string }>
}) {
  const bailleur = await bailleurOnboarde()
  const { bienvenue } = await searchParams
  const supabase = await creerClientServeur()

  const [metriquesReponse, impayesReponse, paiementsReponse] = await Promise.all([
    supabase.from('v_metriques_dashboard').select('*').maybeSingle(),
    supabase
      .from('v_impayes')
      .select('*')
      // Tri par ancienneté : le plus vieux retard en tête (§6.1.8).
      .order('periode_debut', { ascending: true })
      .limit(4),
    supabase
      .from('paiements')
      .select(
        'id, montant, date_paiement, periode_debut, statut, mode_paiement, bail:baux(locataire:locataires(nom))',
      )
      .eq('statut', 'Validé')
      .order('date_paiement', { ascending: false })
      .limit(5),
  ])

  const metriques = (metriquesReponse.data ?? null) as MetriquesDashboard | null
  const impayes = (impayesReponse.data ?? []) as Impaye[]
  const paiements = paiementsReponse.data ?? []

  const tauxRecouvrement =
    metriques && Number(metriques.loyers_attendus_mois) > 0
      ? Math.round(
          (Number(metriques.loyers_percus_mois) / Number(metriques.loyers_attendus_mois)) * 100,
        )
      : 0

  return (
    <div className="space-y-2xl">
      {bienvenue ? (
        <div className="card-sage">
          <p className="text-display-xs font-semibold text-ink-deep">
            Bienvenue sur Sikaloc, {bailleur.nom.split(' ')[0]} 👋
          </p>
          <p className="mt-sm text-body-md text-body">
            Votre premier bail est enregistré. Il ne reste qu&apos;une étape pour
            obtenir votre première quittance : saisir un paiement.
          </p>
          <Link href="/app/paiements/nouveau" className="btn btn-primary mt-lg">
            Enregistrer un paiement
          </Link>
        </div>
      ) : null}

      <div>
        <h1 className="text-display-md font-extrabold tracking-tight text-ink">
          Tableau de bord
        </h1>
        <p className="mt-xs text-body-md text-mute">
          Votre activité locative en temps réel.
        </p>
      </div>

      {/* ── Métriques (§6.1.3) ─────────────────────────────────────────── */}
      {/*
        Deux colonnes au maximum, jamais quatre. Le conteneur de l'application
        est plafonné à 1024 px : à quatre colonnes, chaque carte tombe à ~174 px
        utiles, alors qu'un montant FCFA en display fait 244 px — et 300 px dès
        qu'il passe à sept chiffres. Or `formaterFCFA` produit des espaces
        insécables : le montant ne peut pas s'enrouler, il déborde. Réduire la
        police ne ferait que repousser la casse au prochain bailleur au parc
        plus important.
      */}
      <section className="grid gap-lg sm:grid-cols-2">
        <CarteMetrique
          label="Taux d'occupation"
          valeur={`${Number(metriques?.taux_occupation ?? 0).toLocaleString('fr-FR')} %`}
          detail={`${metriques?.nb_baux_actifs ?? 0} bail(s) actif(s) · ${metriques?.nb_logements ?? 0} logement(s)`}
        />
        <CarteMetrique
          label="Taux de recouvrement"
          valeur={`${tauxRecouvrement} %`}
          detail={`${formaterFCFA(metriques?.loyers_percus_mois ?? 0)} sur ${formaterFCFA(metriques?.loyers_attendus_mois ?? 0)} attendus`}
        />
        <CarteMetrique
          label="Impayés"
          valeur={String(metriques?.nb_impayes ?? 0)}
          ton={Number(metriques?.nb_impayes ?? 0) > 0 ? 'alerte' : 'neutre'}
          detail={
            Number(metriques?.nb_impayes ?? 0) > 0
              ? `${formaterFCFA(metriques?.montant_impaye_total ?? 0)} à recouvrer`
              : 'Aucun loyer en retard'
          }
        />
        <CarteMetrique
          label="CA du mois"
          valeur={formaterFCFA(metriques?.ca_du_mois ?? 0)}
          ton="primary"
          detail="Paiements encaissés ce mois-ci"
        />
      </section>

      {/* ── Accès rapides (§6.1.3) ─────────────────────────────────────── */}
      <section className="flex flex-wrap gap-md">
        <Link href="/app/paiements/nouveau" className="btn btn-primary">
          Nouveau paiement
        </Link>
        <Link href="/app/baux/nouveau" className="btn btn-tertiary">
          Nouveau bail
        </Link>
        <Link href="/app/impayes" className="btn btn-tertiary">
          Envoyer une relance
        </Link>
      </section>

      {/* ── Impayés ────────────────────────────────────────────────────── */}
      <section>
        <div className="mb-lg flex items-center justify-between gap-md">
          <h2 className="text-display-sm font-semibold tracking-tight text-ink">
            Loyers en retard
          </h2>
          {impayes.length > 0 ? (
            <Link href="/app/impayes" className="text-body-sm font-semibold text-ink underline">
              Tout voir
            </Link>
          ) : null}
        </div>

        {impayes.length === 0 ? (
          <div className="rounded-lg bg-positive-pale p-xl">
            <p className="text-body-md font-semibold text-positive-deep">
              Aucun loyer en retard.
            </p>
            <p className="mt-xs text-body-sm text-body">
              Tous les loyers échus ont été réglés, tolérance comprise.
            </p>
          </div>
        ) : (
          <div className="space-y-md">
            {impayes.map((impaye) => (
              <div
                key={`${impaye.bail_id}-${impaye.periode_debut}`}
                className="flex flex-wrap items-center justify-between gap-md rounded-lg border border-hairline border-l-4 border-l-negative bg-surface-card p-lg"
              >
                <div className="flex min-w-0 items-center gap-md">
                  <AvatarPeep id={impaye.locataire_id} nom={impaye.locataire_nom} />
                  <div className="min-w-0">
                    <p className="truncate text-body-md font-semibold text-ink">
                      {impaye.locataire_nom}
                    </p>
                    <p className="truncate text-body-sm text-mute">
                      {formaterPeriode(impaye.periode_debut)} · {impaye.jours_de_retard} jour
                      {impaye.jours_de_retard > 1 ? 's' : ''} de retard ·{' '}
                      {impaye.logement_adresse}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-md">
                  <span className="text-body-md font-semibold tabular text-ink">
                    {formaterFCFA(impaye.montant_du)}
                  </span>
                  <Badge ton="negative">Impayé</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Derniers paiements ─────────────────────────────────────────── */}
      <section>
        <div className="mb-lg flex items-center justify-between gap-md">
          <h2 className="text-display-sm font-semibold tracking-tight text-ink">
            Derniers paiements
          </h2>
          {paiements.length > 0 ? (
            <Link
              href="/app/paiements"
              className="text-body-sm font-semibold text-ink underline"
            >
              Historique complet
            </Link>
          ) : null}
        </div>

        {paiements.length === 0 ? (
          <EtatVide
            icone={<Illustration nom="joie" taille={200} decorative />}
            titre="Aucun paiement enregistré"
            description="Dès votre premier paiement saisi, la quittance est générée automatiquement et apparaît ici."
            action={
              <Link href="/app/paiements/nouveau" className="btn btn-primary">
                Enregistrer un paiement
              </Link>
            }
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-hairline">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Locataire</th>
                  <th scope="col">Période</th>
                  <th scope="col" className="hidden sm:table-cell">
                    Date
                  </th>
                  <th scope="col" className="hidden md:table-cell">
                    Mode
                  </th>
                  <th scope="col" className="text-right">
                    Montant
                  </th>
                </tr>
              </thead>
              <tbody>
                {paiements.map((paiement) => {
                  const bail = paiement.bail as unknown as
                    | { locataire?: { nom?: string } | { nom?: string }[] }
                    | null
                  const locataire = Array.isArray(bail?.locataire)
                    ? bail?.locataire[0]
                    : bail?.locataire

                  return (
                    <tr key={paiement.id}>
                      <td className="font-semibold">{locataire?.nom ?? '—'}</td>
                      <td>{formaterPeriode(paiement.periode_debut)}</td>
                      <td className="hidden sm:table-cell">
                        {formaterDateCourte(paiement.date_paiement)}
                      </td>
                      <td className="hidden md:table-cell">{paiement.mode_paiement}</td>
                      <td className="text-right font-semibold tabular">
                        {formaterFCFA(paiement.montant)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
