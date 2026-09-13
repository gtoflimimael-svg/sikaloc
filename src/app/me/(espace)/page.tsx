import { ArrowRight, CircleHelp, House, Phone, TriangleAlert } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { BadgeLoyer } from '@/components/me/etat-loyer'
import { Alerte } from '@/components/ui/retours'
import { formaterDate, formaterFCFA, formaterPeriode } from '@/lib/format'
import {
  echeancesEnRetard,
  echeancesIndeterminees,
  EXPLICATION_ETAT,
  mesBaux,
  mesEcheances,
  prochaineEcheance,
  resteADevoir,
} from '@/lib/locataire'
import { ESPACE_ME } from '@/lib/roles'
import { formaterTelephone } from '@/lib/telephone'
import type { BailLocataire, EcheanceLocataire } from '@/lib/types/database'

/*
 * Titre écrit en entier, et pas seulement « Accueil ».
 *
 * Un `title.template` de layout ne s'applique PAS à la page du MÊME segment —
 * seulement à ses segments enfants.
 * Et `absolute` par-dessus, sinon le gabarit de la RACINE s'applique à son
 * tour et produit « Accueil · Sikaloc_Me · Sikaloc ». `/me/loyers` hérite donc de
 * « … · Sikaloc_Me », mais `/me` retomberait sur le gabarit de la racine et
 * s'annoncerait « Accueil · Sikaloc », sans dire dans lequel des deux espaces
 * on se trouve. C'est précisément ce que l'onglet doit distinguer.
 */
export const metadata: Metadata = { title: { absolute: `Accueil · ${ESPACE_ME.nom}` } }

/**
 * L'accueil de Sikaloc_Me.
 *
 * ─── La question à laquelle cet écran répond ────────────────────────────────
 *
 * « Est-ce que je dois quelque chose, et combien ? »
 *
 * Tout le reste — l'historique, le détail du bail — vit dans les autres
 * onglets. Un locataire ouvre cette page une fois par mois, souvent debout,
 * sur un téléphone : la réponse doit être lisible sans faire défiler.
 *
 * ─── Plusieurs baux, et ce n'est pas un cas limite ──────────────────────────
 *
 * Une même personne peut louer à deux bailleurs. Chaque bail a sa carte, avec
 * son logement et son bailleur nommés : sans cela, deux loyers dus se
 * mélangeraient en un seul chiffre qui ne correspondrait à rien.
 */
export default async function PageAccueilMe() {
  const [baux, echeances] = await Promise.all([mesBaux(), mesEcheances()])

  const enRetard = echeancesEnRetard(echeances)
  const indeterminees = echeancesIndeterminees(echeances)
  const nom = baux[0]?.locataire_nom ?? ''

  return (
    <div className="space-y-xl">
      <div>
        <h1 className="text-display-md font-extrabold tracking-tight text-ink">
          Bonjour {nom.split(' ')[0]}
        </h1>
        <p className="mt-xs text-body-md text-mute">
          {baux.length > 1
            ? `Vos ${baux.length} locations, et où en sont vos loyers.`
            : 'Votre logement, et où en sont vos loyers.'}
        </p>
      </div>

      {/*
        Le retard d'abord, et seulement s'il existe. Un bandeau permanent
        « tout va bien » userait son propre signal : le jour où il change, on
        ne le verrait plus.
      */}
      {enRetard.length > 0 ? (
        <Alerte ton="attention">
          <span className="flex items-start gap-sm">
            <TriangleAlert size={17} strokeWidth={2} aria-hidden="true" className="mt-xxs shrink-0" />
            <span>
              <strong>
                {enRetard.length === 1
                  ? '1 loyer en retard'
                  : `${enRetard.length} loyers en retard`}
              </strong>{' '}
              — {formaterFCFA(enRetard.reduce((s, e) => s + Number(e.montant_du), 0))} au
              total. Si vous avez déjà réglé, signalez-le à votre bailleur : lui
              seul peut l’enregistrer.
            </span>
          </span>
        </Alerte>
      ) : null}

      {baux.map((bail) => (
        <CarteBail key={bail.bail_id} bail={bail} echeances={echeances} />
      ))}

      {/*
        Le message le plus important de l'écran, et le moins spectaculaire.

        Un locataire qui a réglé deux ans de loyer en espèces avant que son
        bailleur n'ouvre Sikaloc verrait ces mois sans règlement enregistré. Ils
        ne sont PAS des impayés, et cet encadré est le seul endroit qui le lui
        dit noir sur blanc.
      */}
      {indeterminees.length > 0 ? (
        <section className="rounded-xl border border-hairline bg-canvas p-xl">
          <p className="flex items-start gap-sm text-body-md font-semibold text-ink">
            <CircleHelp size={18} strokeWidth={2} aria-hidden="true" className="mt-xxs shrink-0" />
            {indeterminees.length === 1
              ? '1 mois antérieur à Sikaloc'
              : `${indeterminees.length} mois antérieurs à Sikaloc`}
          </p>
          <p className="mt-sm text-body-md text-mute">
            {EXPLICATION_ETAT['À déterminer']} Ces mois n’entrent dans aucun
            total, et ne vous sont pas réclamés ici.
          </p>
          <Link
            href="/me/loyers"
            className="mt-lg inline-flex items-center gap-xs text-body-sm font-semibold text-ink hover:underline"
          >
            Voir lesquels
            <ArrowRight size={15} strokeWidth={2} aria-hidden="true" />
          </Link>
        </section>
      ) : null}
    </div>
  )
}

function CarteBail({
  bail,
  echeances,
}: {
  bail: BailLocataire
  echeances: EcheanceLocataire[]
}) {
  const prochaine = prochaineEcheance(echeances, bail.bail_id)
  const du = resteADevoir(echeances, bail.bail_id)
  const resilie = bail.statut !== 'Actif'
  // Comptés par bail : avec deux logements, le total global ne dirait pas
  // lequel des deux porte l'incertitude.
  const indeterminesDuBail = echeances.filter(
    (e) => e.bail_id === bail.bail_id && e.etat === 'À déterminer',
  ).length

  return (
    <section className="rounded-xl border border-hairline bg-canvas p-xl">
      <div className="flex flex-wrap items-start justify-between gap-lg">
        <div className="min-w-0">
          <p className="flex items-center gap-sm text-caption uppercase tracking-wide text-mute">
            <House size={15} strokeWidth={2} aria-hidden="true" />
            {bail.logement_type}
          </p>
          <p className="mt-xs text-display-xs font-semibold text-ink">
            {bail.logement_adresse}
          </p>
          <p className="text-body-sm text-mute">
            {bail.logement_ville}, {bail.logement_pays}
          </p>
        </div>

        <div className="text-right">
          <p className="text-caption uppercase tracking-wide text-mute">Loyer mensuel</p>
          <p className="mt-xxs text-display-xs font-extrabold tabular text-ink">
            {formaterFCFA(bail.loyer_mensuel)}
          </p>
        </div>
      </div>

      {/* ── Où en est ce bail ────────────────────────────────────────────── */}
      <div className="mt-xl rounded-lg bg-canvas-soft p-lg">
        {resilie ? (
          /*
            `v_echeances` ne calcule que les baux actifs : un bail résilié
            n'aurait aucune ligne, et une liste vide ressemblerait à une panne.
            On dit donc pourquoi elle est vide.
          */
          <p className="text-body-md text-mute">
            Ce bail est <strong className="text-ink">résilié</strong>. Vos
            quittances et vos paiements restent consultables, mais aucun loyer
            n’est plus calculé pour ce logement.
          </p>
        ) : prochaine ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-md">
              <div>
                <p className="text-caption uppercase tracking-wide text-mute">
                  {prochaine.etat === 'Impayé' ? 'Loyer le plus ancien non réglé' : 'Prochain loyer'}
                </p>
                <p className="mt-xxs text-body-lg font-semibold text-ink">
                  {formaterPeriode(prochaine.periode_debut)}
                </p>
                <p className="text-body-sm text-mute">
                  À régler avant le {formaterDate(prochaine.date_echeance)}
                  {/*
                    La tolérance du bail est dite, parce qu'elle change la
                    date qui compte vraiment. La taire ferait croire à un
                    retard le lendemain de l'échéance alors que le bail
                    accorde encore quelques jours.
                  */}
                  {bail.tolerance_jours > 0
                    ? ` (${bail.tolerance_jours} jour${bail.tolerance_jours > 1 ? 's' : ''} de tolérance)`
                    : null}
                </p>
              </div>
              <div className="text-right">
                <BadgeLoyer etat={prochaine.etat} />
                <p className="mt-sm text-display-xs font-extrabold tabular text-ink">
                  {formaterFCFA(prochaine.montant_du)}
                </p>
              </div>
            </div>

            <p className="mt-lg border-t border-hairline pt-md text-body-sm text-mute">
              {EXPLICATION_ETAT[prochaine.etat]}
            </p>

            {du > 0 && du !== Number(prochaine.montant_du) ? (
              <p className="mt-sm text-body-sm font-semibold text-negative">
                Total en retard sur ce logement : {formaterFCFA(du)}
              </p>
            ) : null}
          </>
        ) : indeterminesDuBail > 0 ? (
          /*
            Rien à régler, mais des mois dont Sikaloc ne sait rien.

            Écrire « vous êtes à jour » ici serait une affirmation que le
            produit ne peut pas tenir : ces mois n'ont pas été jugés, ils ont
            été mis de côté. Un locataire qui lirait « à jour » et que son
            bailleur relancerait ensuite sur l'un de ces mois aurait été
            trompé par cet écran.
          */
          <p className="text-body-md text-ink">
            Aucun loyer ne vous est réclamé pour ce logement.{' '}
            <span className="text-mute">
              {indeterminesDuBail === 1
                ? 'Un mois antérieur reste à confirmer avec votre bailleur.'
                : `${indeterminesDuBail} mois antérieurs restent à confirmer avec votre bailleur.`}
            </span>
          </p>
        ) : (
          <p className="text-body-md text-ink">
            Vous êtes à jour. Aucun loyer n’est dû pour ce logement.
          </p>
        )}
      </div>

      {/* ── Qui contacter ────────────────────────────────────────────────── */}
      <div className="mt-lg flex flex-wrap items-center justify-between gap-md">
        <div className="text-body-sm">
          <span className="text-mute">Bailleur : </span>
          <span className="font-semibold text-ink">{bail.bailleur_nom}</span>
        </div>
        <a
          href={`tel:${bail.bailleur_telephone}`}
          className="btn btn-tertiary btn-sm"
        >
          <Phone size={15} strokeWidth={2} aria-hidden="true" />
          {formaterTelephone(bail.bailleur_telephone)}
        </a>
      </div>
    </section>
  )
}
