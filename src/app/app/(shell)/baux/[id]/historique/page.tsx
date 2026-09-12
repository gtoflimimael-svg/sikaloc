import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { FormulaireHistorique } from '@/components/app/formulaire-historique'
import { EnTetePage } from '@/components/ui/retours'
import { echeancesADeclarer, echeancesAnterieuresReglees } from '@/lib/echeances'
import { formaterDate, formaterPeriode } from '@/lib/format'
import { bailleurOnboarde } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'
import type { Echeance } from '@/lib/types/database'

export const metadata: Metadata = { title: 'Historique des loyers' }

/**
 * L'étape qui manquait entre « ce bail a commencé en janvier » et « voici vos
 * huit impayés ».
 *
 * ─── Pourquoi elle vit après l'enregistrement du bail ───────────────────────
 *
 * Les mois à renseigner sont calculés par `v_echeances`, qui a besoin du bail
 * en base — sa date de début, son jour d'échéance, sa tolérance, et la date à
 * laquelle Sikaloc l'a appris. Les recalculer côté navigateur aurait produit un
 * second jeu de règles à tenir d'accord avec le premier.
 *
 * Et surtout : un bail dont la saisie échoue à cette étape ne doit pas être
 * perdu. Le cahier des charges prévoit explicitement qu'un bailleur puisse ne
 * pas vouloir renseigner l'historique tout de suite — ce qui suppose que le
 * bail existe sans lui. Tant qu'il n'est pas renseigné, aucune de ces échéances
 * n'est réclamée : elles restent « À déterminer ».
 */
export default async function PageHistorique({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await creerClientServeur()

  const [, { data: bail }, { data: lignes }] = await Promise.all([
    bailleurOnboarde(),
    supabase
      .from('baux')
      .select(
        'id, loyer_mensuel, date_debut, date_fin, created_at, historique_declare_le, locataire:locataires(nom), logement:logements(adresse, ville)',
      )
      .eq('id', id)
      .maybeSingle(),
    supabase.from('v_echeances').select('*').eq('bail_id', id),
  ])

  if (!bail) redirect('/app/baux')

  const echeances = (lignes ?? []) as Echeance[]
  const aDeclarer = echeancesADeclarer(echeances)
  const dejaReglees = echeancesAnterieuresReglees(echeances)

  // ─── Déclaration, ou correction ? ────────────────────────────────────────
  //
  // Une fois l'historique déclaré, l'écran reste atteignable : c'est ce qui
  // permet de rattraper un mois coché à tort. Mais il ne parle plus de la même
  // chose — ces mois sont désormais réclamés au locataire, et le dire
  // autrement laisserait croire qu'ils dorment encore quelque part.
  const correction = Boolean(bail.historique_declare_le)

  // Rien à demander : bail commencé aujourd'hui ou plus tard, ou historique
  // déjà renseigné. On ne fait pas perdre un écran pour rien.
  if (aDeclarer.length === 0) redirect(`/app/baux/${id}`)

  const locataire = Array.isArray(bail.locataire) ? bail.locataire[0] : bail.locataire
  const logement = Array.isArray(bail.logement) ? bail.logement[0] : bail.logement

  return (
    <div>
      <EnTetePage
        titre={correction ? 'Corriger l’historique' : 'Historique des loyers'}
        description={
          correction
            ? 'Ces mois sont actuellement comptés en retard. Cochez ceux qui ont en réalité été réglés.'
            : 'Ce bail a commencé avant son enregistrement dans Sikaloc. Indiquez les mois déjà réglés pour ne pas les compter en retard.'
        }
      />

      <div className="card mb-xl">
        <dl className="grid gap-md sm:grid-cols-3">
          <div>
            <dt className="text-caption text-mute">Locataire</dt>
            <dd className="text-body-md font-semibold text-ink">
              {locataire?.nom ?? '—'}
            </dd>
          </div>
          <div>
            <dt className="text-caption text-mute">Logement</dt>
            <dd className="text-body-md text-body">
              {logement ? `${logement.adresse}, ${logement.ville}` : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-caption text-mute">Bail</dt>
            <dd className="text-body-md text-body">
              Depuis le {formaterDate(bail.date_debut)}
              {bail.date_fin ? ` jusqu’au ${formaterDate(bail.date_fin)}` : ''}
            </dd>
          </div>
        </dl>

        {/*
          Les mois déjà réglés ne sont pas à cocher — ils portent un paiement.
          Les taire donnerait l'impression que Sikaloc les a oubliés.
        */}
        {dejaReglees.length > 0 ? (
          <p className="mt-lg border-t border-hairline pt-lg text-body-sm text-mute">
            Déjà réglé d’après vos paiements enregistrés :{' '}
            <strong className="text-ink">
              {dejaReglees.map((e) => formaterPeriode(e.periode_debut)).join(', ')}
            </strong>
            . Ces mois ne sont pas redemandés.
          </p>
        ) : null}
      </div>

      <div className="card">
        <FormulaireHistorique
          bailId={id}
          echeances={aDeclarer}
          loyerMensuel={Number(bail.loyer_mensuel)}
        />
      </div>

      <p className="mt-lg text-center text-caption text-mute">
        <Link href={`/app/baux/${id}`} className="underline">
          Retour au bail
        </Link>
        {correction
          ? ' — les mois non cochés resteront comptés en retard.'
          : ' — vous pouvez revenir plus tard : tant que rien n’est renseigné, aucun de ces mois n’est réclamé.'}
      </p>
    </div>
  )
}
