import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { BoutonAction } from '@/components/ui/action-confirmee'
import { Alerte, Badge } from '@/components/ui/retours'
import { supprimerPaiement, validerPaiement } from '@/lib/actions/paiements'
import { formaterDate, formaterFCFA, formaterPeriode } from '@/lib/format'
import { montantEnLettresCapitalise } from '@/lib/montant-en-lettres'
import { bailleurOnboarde } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'

export const metadata: Metadata = { title: 'Confirmer le paiement' }

/**
 * Récapitulatif de confirmation — spec §6.1.7, étape 4.
 *
 * C'est le dernier point d'arrêt avant que le paiement ne devienne un fait
 * comptable et que la quittance ne soit émise.
 */
export default async function PageConfirmationPaiement({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await bailleurOnboarde()
  const { id } = await params
  const supabase = await creerClientServeur()

  const { data: paiement } = await supabase
    .from('paiements')
    .select(
      '*, bail:baux(id, loyer_mensuel, jour_echeance, logement:logements(adresse, ville), locataire:locataires(nom, telephone)), quittance:quittances(id)',
    )
    .eq('id', id)
    .maybeSingle()

  if (!paiement) notFound()

  const quittance = Array.isArray(paiement.quittance)
    ? paiement.quittance[0]
    : paiement.quittance

  // Paiement déjà validé et document émis : rien à confirmer, on l'affiche.
  if (paiement.statut === 'Validé' && quittance?.id) {
    redirect(`/app/quittances/${quittance.id}`)
  }

  const bail = Array.isArray(paiement.bail) ? paiement.bail[0] : paiement.bail
  const logement = Array.isArray(bail?.logement) ? bail?.logement[0] : bail?.logement
  const locataire = Array.isArray(bail?.locataire) ? bail?.locataire[0] : bail?.locataire

  const loyer = Number(bail?.loyer_mensuel ?? 0)
  const montant = Number(paiement.montant)
  const reliquat = Math.max(0, loyer - montant)

  return (
    <div className="mx-auto max-w-[42rem] space-y-xl">
      <div>
        <Link href="/app/paiements/nouveau" className="text-body-sm text-mute hover:text-ink">
          ← Modifier la saisie
        </Link>
        <h1 className="mt-lg text-display-md font-extrabold tracking-tight text-ink">
          Confirmer le paiement
        </h1>
        <p className="mt-xs text-body-md text-mute">
          Vérifiez avant de valider. Après confirmation, vous disposerez de
          5 minutes pour corriger.
        </p>
      </div>

      {paiement.est_partiel ? (
        <Alerte ton="attention">
          Ce montant est inférieur au loyer de la période. Le document émis sera
          un <strong>reçu</strong>, pas une quittance : il ne libère pas le
          locataire du solde de {formaterFCFA(reliquat)}.
        </Alerte>
      ) : null}

      <div className="card card-lg">
        <p className="text-body-lg text-ink">
          Vous allez enregistrer un paiement de{' '}
          <strong className="font-semibold">{formaterFCFA(montant)}</strong> pour
          le loyer de{' '}
          <strong className="font-semibold">
            {formaterPeriode(paiement.periode_debut)}
          </strong>
          .
        </p>
        <p className="mt-sm text-body-sm italic text-mute">
          Soit {montantEnLettresCapitalise(montant)} francs CFA.
        </p>

        <dl className="mt-xl space-y-md border-t border-hairline-soft pt-xl">
          <Ligne terme="Locataire" definition={locataire?.nom ?? '—'} />
          <Ligne
            terme="Logement"
            definition={`${logement?.adresse ?? '—'}${logement?.ville ? `, ${logement.ville}` : ''}`}
          />
          <Ligne
            terme="Période couverte"
            definition={`${formaterDate(paiement.periode_debut)} — ${formaterDate(paiement.periode_fin)}`}
          />
          <Ligne terme="Date du paiement" definition={formaterDate(paiement.date_paiement)} />
          <Ligne terme="Mode de paiement" definition={paiement.mode_paiement} />
          <Ligne terme="Nature" definition={paiement.type_paiement} />
          <Ligne terme="Loyer mensuel du bail" definition={formaterFCFA(loyer)} />
          <div className="flex items-center justify-between gap-lg pt-sm">
            <dt className="text-body-sm text-mute">Document qui sera émis</dt>
            <dd>
              <Badge ton={paiement.est_partiel ? 'warning' : 'positive'}>
                {paiement.est_partiel ? 'Reçu' : 'Quittance de loyer'}
              </Badge>
            </dd>
          </div>
        </dl>
      </div>

      <div className="flex flex-wrap items-start gap-md">
        <BoutonAction
          action={validerPaiement.bind(null, id)}
          libelle="Confirmer et générer le document"
          libelleEnCours="Génération…"
        />
        <BoutonAction
          action={supprimerPaiement.bind(null, id)}
          libelle="Abandonner"
          libelleEnCours="Suppression…"
          variante="secondary"
        />
      </div>
    </div>
  )
}

function Ligne({ terme, definition }: { terme: string; definition: string }) {
  return (
    <div className="flex items-baseline justify-between gap-lg">
      <dt className="text-body-sm text-mute">{terme}</dt>
      <dd className="text-right text-body-md font-semibold tabular text-ink">{definition}</dd>
    </div>
  )
}
