import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { FenetreCorrection } from '@/components/app/fenetre-correction'
import { BoutonAction } from '@/components/ui/action-confirmee'
import { Alerte, Badge } from '@/components/ui/retours'
import { regenererQuittance } from '@/lib/actions/paiements'
import {
  formaterDate,
  formaterFCFA,
  formaterHorodatage,
  formaterPeriode,
} from '@/lib/format'
import { montantEnLettresCapitalise } from '@/lib/montant-en-lettres'
import { capacites } from '@/lib/plan'
import { urlSignee } from '@/lib/quittance'
import { bailleurOnboarde } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'
import { lienEnvoiQuittance } from '@/lib/whatsapp'

export const metadata: Metadata = { title: 'Quittance' }

export default async function PageQuittance({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const bailleur = await bailleurOnboarde()
  const { id } = await params
  const supabase = await creerClientServeur()

  const { data: quittance } = await supabase
    .from('quittances')
    .select(
      '*, paiement:paiements(*), bail:baux(loyer_mensuel, logement:logements(adresse, ville, pays, type), locataire:locataires(nom, telephone))',
    )
    .eq('id', id)
    .maybeSingle()

  if (!quittance) notFound()

  const paiement = Array.isArray(quittance.paiement)
    ? quittance.paiement[0]
    : quittance.paiement
  const bail = Array.isArray(quittance.bail) ? quittance.bail[0] : quittance.bail
  const logement = Array.isArray(bail?.logement) ? bail?.logement[0] : bail?.logement
  const locataire = Array.isArray(bail?.locataire) ? bail?.locataire[0] : bail?.locataire

  if (!paiement || !locataire || !logement) notFound()

  // Lien signé 30 jours — c'est lui que reçoit le locataire (§6.1.11).
  const lienTelechargement = quittance.pdf_chemin
    ? await urlSignee(quittance.pdf_chemin)
    : null

  const lienWhatsApp = lienTelechargement
    ? lienEnvoiQuittance({
        locataireNom: locataire.nom,
        locataireTelephone: locataire.telephone,
        periodeDebut: paiement.periode_debut,
        lienTelechargement,
        bailleurNom: bailleur.nom,
        typeDocument: quittance.type,
      })
    : null

  const mentionsConformes = capacites(bailleur).quittanceConforme

  return (
    <div className="mx-auto max-w-[48rem] space-y-xl">
      <div className="print-hidden">
        <Link href="/app/paiements" className="text-body-sm text-mute hover:text-ink">
          ← Historique des paiements
        </Link>

        <div className="mt-lg flex flex-wrap items-start justify-between gap-lg">
          <div>
            <h1 className="text-display-md font-extrabold tracking-tight text-ink">
              {quittance.type === 'Quittance' ? 'Quittance de loyer' : 'Reçu de paiement'}
            </h1>
            <p className="mt-xs text-body-md text-mute">
              N° {quittance.numero_document} · générée le{' '}
              {formaterHorodatage(quittance.date_generation)}
            </p>
          </div>
          <Badge ton={quittance.type === 'Quittance' ? 'positive' : 'warning'}>
            {quittance.type}
          </Badge>
        </div>
      </div>

      {paiement.statut === 'Validé' ? (
        <div className="print-hidden">
          <FenetreCorrection valideLe={paiement.valide_le} paiementId={paiement.id} />
        </div>
      ) : null}

      {/* ── Actions ────────────────────────────────────────────────────── */}
      <section className="print-hidden flex flex-wrap items-start gap-md">
        <a
          href={`/api/quittances/${quittance.id}/pdf`}
          className="btn btn-tertiary"
          download
        >
          Télécharger le PDF
        </a>

        {lienWhatsApp ? (
          <a
            href={lienWhatsApp}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
          >
            Envoyer au locataire sur WhatsApp
          </a>
        ) : (
          <BoutonAction
            action={regenererQuittance.bind(null, paiement.id)}
            libelle="Générer le document"
            libelleEnCours="Génération…"
          />
        )}
      </section>

      {!lienTelechargement ? (
        <div className="print-hidden">
          <Alerte ton="attention">
            Le fichier PDF n&apos;est pas encore déposé dans le coffre. Générez-le
            pour obtenir un lien de partage valable 30 jours.
          </Alerte>
        </div>
      ) : null}

      {/* ── Aperçu du document ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-xl border border-hairline bg-canvas-soft p-2xl">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-[28deg] text-[64px] font-black text-mute-soft opacity-10"
        >
          APERÇU
        </span>

        <div className="relative">
          <div className="flex flex-wrap items-start justify-between gap-lg border-b border-hairline pb-lg">
            <div>
              <p className="text-display-xs font-semibold text-ink">Sikaloc</p>
              <p className="mt-xxs text-caption text-mute">
                {quittance.pays} · document électronique
              </p>
            </div>
            <div className="text-right">
              <p className="text-caption uppercase tracking-wide text-mute">N° de document</p>
              <p className="text-body-md font-semibold tabular text-ink">
                {quittance.numero_document}
              </p>
            </div>
          </div>

          <h2 className="mt-xl text-display-sm font-semibold tracking-tight text-ink">
            {quittance.type === 'Quittance' ? 'Quittance de loyer' : 'Reçu de paiement'}
          </h2>
          <p className="mt-xxs text-body-sm text-mute">
            Période du {formaterDate(paiement.periode_debut)} au{' '}
            {formaterDate(paiement.periode_fin)}
          </p>

          <div className="mt-xl grid gap-lg sm:grid-cols-2">
            <div className="rounded-lg bg-canvas p-lg">
              <p className="text-caption uppercase tracking-wide text-mute">Bailleur</p>
              <p className="mt-xs text-body-md font-semibold text-ink">{bailleur.nom}</p>
              <p className="text-body-sm text-body">Tél. {bailleur.telephone}</p>
              {bailleur.adresse ? (
                <p className="text-body-sm text-body">{bailleur.adresse}</p>
              ) : null}
            </div>

            <div className="rounded-lg bg-canvas p-lg">
              <p className="text-caption uppercase tracking-wide text-mute">Locataire</p>
              <p className="mt-xs text-body-md font-semibold text-ink">{locataire.nom}</p>
              <p className="text-body-sm text-body">Tél. {locataire.telephone}</p>
            </div>
          </div>

          <dl className="mt-xl space-y-sm">
            <LigneApercu terme="Adresse du logement" definition={logement.adresse} />
            <LigneApercu
              terme="Ville"
              definition={`${logement.ville}, ${logement.pays ?? 'Bénin'}`}
            />
            <LigneApercu
              terme="Loyer mensuel"
              definition={formaterFCFA(bail?.loyer_mensuel ?? 0)}
            />
            <LigneApercu
              terme="Date de paiement"
              definition={formaterDate(paiement.date_paiement)}
            />
            <LigneApercu terme="Mode de paiement" definition={paiement.mode_paiement} />
          </dl>

          <div className="mt-xl rounded-lg bg-primary-pale p-lg">
            <p className="text-caption text-ink-deep">Montant reçu</p>
            <p className="mt-xxs text-display-sm font-extrabold tabular text-ink-deep">
              {formaterFCFA(paiement.montant)}
            </p>
            <p className="mt-xxs text-body-sm italic text-ink-deep">
              {montantEnLettresCapitalise(paiement.montant)} francs CFA
            </p>
          </div>

          <div className="mt-xl border-l-4 border-l-primary pl-lg">
            <p className="text-body-md text-ink">
              Reçu de {locataire.nom} la somme de{' '}
              {montantEnLettresCapitalise(paiement.montant)} francs CFA (
              {formaterFCFA(paiement.montant)}) pour le loyer de la période du{' '}
              {formaterDate(paiement.periode_debut)} au{' '}
              {formaterDate(paiement.periode_fin)}.
            </p>
          </div>

          <div className="mt-xl space-y-sm border-t border-hairline pt-lg">
            {mentionsConformes ? (
              <p className="text-caption text-mute">
                <strong>Droit de timbre</strong> — Conformément à la législation en
                vigueur au {quittance.pays}, le droit de timbre est à la charge du
                locataire. Ce document est généré à titre informatif ;
                l&apos;acquittement effectif du droit de timbre relève de la
                responsabilité des parties.
              </p>
            ) : (
              <p className="text-caption text-warning-content">
                Le plan Gratuit émet des quittances basiques, sans mention du droit
                de timbre.{' '}
                <Link href="/app/parametres?onglet=abonnement" className="underline">
                  Passer au plan Standard
                </Link>{' '}
                pour des quittances conformes.
              </p>
            )}

            <p className="text-caption text-mute">
              Document généré électroniquement par la plateforme Sikaloc sous la
              responsabilité de {bailleur.nom}, enregistré le{' '}
              {formaterHorodatage(quittance.date_generation)}.
            </p>

            {!bailleur.signature_chemin ? (
              <p className="text-caption text-warning-content">
                Aucune signature enregistrée : le document sort avec un cadre de
                signature vide.{' '}
                <Link href="/app/parametres?onglet=signature" className="underline">
                  Ajouter ma signature
                </Link>
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <div className="print-hidden space-y-md">
        <p className="text-body-sm text-mute">
          Le lien envoyé au locataire est sécurisé et valable 30 jours. Il ne
          nécessite ni compte ni mot de passe. Période concernée :{' '}
          {formaterPeriode(paiement.periode_debut)}.
        </p>

        {quittance.hash_sha256 ? (
          <div className="rounded-lg border border-hairline bg-canvas p-lg">
            <p className="text-body-sm font-semibold text-ink">
              Empreinte d&apos;intégrité (SHA-256)
            </p>
            <p className="mt-xs text-caption text-mute">
              Elle identifie ce document de façon unique. Si un locataire
              conteste le fichier reçu, comparez son empreinte à celle-ci : la
              moindre modification la change entièrement.
            </p>
            <code className="mt-sm block overflow-x-auto whitespace-nowrap rounded-md bg-canvas-soft px-md py-sm font-mono text-caption text-body">
              {quittance.hash_sha256}
            </code>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function LigneApercu({ terme, definition }: { terme: string; definition: string }) {
  return (
    <div className="flex items-baseline justify-between gap-lg border-b border-hairline-soft py-xs">
      <dt className="text-body-sm text-mute">{terme}</dt>
      <dd className="text-right text-body-sm font-semibold tabular text-ink">{definition}</dd>
    </div>
  )
}
