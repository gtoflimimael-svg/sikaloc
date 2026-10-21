import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { BoutonAction, GroupeActions } from '@/components/ui/action-confirmee'
import { Alerte, Badge, EnTetePage } from '@/components/ui/retours'
import { supprimerPaiement, validerPaiement } from '@/lib/actions/paiements'
import { formaterDate, formaterFCFA, formaterPeriode } from '@/lib/format'
import { apercuDocumentPaiement } from '@/lib/documents-paiement'
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
  const { id } = await params
  const supabase = await creerClientServeur()

  const [, { data: paiement }] = await Promise.all([
    bailleurOnboarde(),
    supabase
      .from('paiements')
      .select(
        '*, bail:baux(id, jour_echeance, logement:logements(adresse, ville), locataire:locataires(nom, telephone)), quittance:quittances(id)',
      )
      .eq('id', id)
      .maybeSingle(),
  ])

  if (!paiement) notFound()

  const quittance = Array.isArray(paiement.quittance)
    ? paiement.quittance[0]
    : paiement.quittance

  // Paiement déjà validé et document émis : rien à confirmer, on l'affiche.
  if (paiement.statut === 'Validé' && quittance?.id) {
    redirect(`/pro/quittances/${quittance.id}`)
  }

  const bail = Array.isArray(paiement.bail) ? paiement.bail[0] : paiement.bail
  const logement = Array.isArray(bail?.logement) ? bail?.logement[0] : bail?.logement
  const locataire = Array.isArray(bail?.locataire) ? bail?.locataire[0] : bail?.locataire

  const montant = Number(paiement.montant)
  const { data: echeance, error: erreurEcheance } = paiement.type_paiement === 'Loyer'
    ? await supabase
        .from('v_echeances')
        .select('loyer_mensuel, montant_paye')
        .eq('bail_id', paiement.bail_id)
        .eq('periode_debut', paiement.periode_debut)
        .maybeSingle()
    : { data: null, error: null }
  const loyerApplicable = echeance ? Number(echeance.loyer_mensuel) : null
  const montantPayeAuPrealable = echeance ? Number(echeance.montant_paye) : null
  // La vue inclut ce paiement s'il est déjà validé mais que l'émission doit
  // être reprise : ne pas compter son montant deux fois dans l'aperçu.
  const cumulValideAvant = montantPayeAuPrealable === null
    ? null
    : montantPayeAuPrealable - (paiement.statut === 'Validé' ? montant : 0)
  const apercu = apercuDocumentPaiement({
    typePaiement: paiement.type_paiement,
    montant,
    loyerApplicable,
    cumulValideAvant,
  })

  return (
    <div className="mx-auto max-w-[42rem] space-y-xl">
      <div>
        <Link href="/pro/paiements/nouveau" className="text-body-sm text-mute hover:text-ink">
          ← Modifier la saisie
        </Link>
        <EnTetePage titre="Confirmer le paiement"
          description="Vérifiez avant de valider. Après confirmation, vous disposerez de 5 minutes pour corriger." />
      </div>

      {paiement.type_paiement !== 'Loyer' ? (
        <Alerte ton="info">
          La confirmation émettra un <strong>reçu</strong> pour {paiement.type_paiement.toLowerCase()}.
          Ce document atteste la somme reçue, mais ne constitue pas une quittance de loyer.
        </Alerte>
      ) : apercu.estPartiel ? (
        <Alerte ton="attention">
          Le cumul des versements reste inférieur au loyer applicable à cette période. Le document émis sera
          un <strong>reçu</strong>, pas une quittance : il ne libère pas le
          locataire du solde de {formaterFCFA(apercu.solde ?? 0)}.
        </Alerte>
      ) : null}

      {paiement.type_paiement === 'Loyer' && (erreurEcheance || !echeance) ? (
        <Alerte ton="info">
          Le loyer historique de cette période n’est pas disponible dans l’aperçu. Le calcul financier
          et le type de document seront déterminés par la validation sécurisée avant l’émission.
        </Alerte>
      ) : null}

      <div className="card card-lg">
        <div className="mb-lg flex flex-wrap items-center justify-between gap-sm">
          <h2 className="text-body-md font-semibold text-ink">{paiement.statut === 'Validé' ? 'Montant validé' : 'Montant à confirmer'}</h2>
          <Badge ton={paiement.statut === 'Validé' ? 'positive' : 'warning'}>{paiement.statut}</Badge>
        </div>
        <p className="text-body-lg text-ink">
          Vous allez enregistrer un paiement de{' '}
          <strong className="font-semibold money">{formaterFCFA(montant)}</strong>{' '}
          {paiement.type_paiement === 'Loyer'
            ? 'pour le loyer de'
            : `pour ${paiement.type_paiement.toLowerCase()} sur la période`}{' '}
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
          {loyerApplicable !== null ? (
            <Ligne terme="Loyer applicable à la période" definition={formaterFCFA(loyerApplicable)} montant />
          ) : null}
          {paiement.type_paiement === 'Loyer' && apercu.cumul !== null && apercu.solde !== null ? (
            <>
              <Ligne terme="Cumul après confirmation" definition={formaterFCFA(apercu.cumul)} montant />
              <Ligne terme="Solde de la période après confirmation" definition={formaterFCFA(apercu.solde)} montant />
            </>
          ) : null}
          <div className="flex flex-col gap-xs pt-sm sm:flex-row sm:items-center sm:justify-between sm:gap-lg">
            <dt className="text-body-sm text-mute">Document qui sera émis</dt>
            <dd>
              {apercu.typeDocument ? (
                <Badge ton={apercu.typeDocument === 'Reçu' ? 'warning' : 'positive'}>
                  {apercu.typeDocument === 'Reçu' ? 'Reçu' : 'Quittance de loyer'}
                </Badge>
              ) : <Badge ton="neutral">Déterminé à la validation</Badge>}
            </dd>
          </div>
        </dl>
      </div>

      <GroupeActions>
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
      </GroupeActions>
    </div>
  )
}

function Ligne({ terme, definition, montant = false }: { terme: string; definition: string; montant?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-xs sm:flex-row sm:items-baseline sm:justify-between sm:gap-lg">
      <dt className="text-body-sm text-mute">{terme}</dt>
      <dd className={`min-w-0 text-body-md font-semibold text-ink sm:text-right ${montant ? 'money' : 'list-copy'}`}>{definition}</dd>
    </div>
  )
}
