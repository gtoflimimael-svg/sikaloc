'use client'

import { Lock, ShieldCheck } from 'lucide-react'
import { useActionState } from 'react'

import { BoutonSoumettre } from '@/components/ui/boutons'
import { Alerte } from '@/components/ui/retours'
import { verifierIntegrite } from '@/lib/actions/paiements'
import { formaterHorodatage } from '@/lib/format'
import type { EtatFormulaire } from '@/lib/validation'

const ETAT_INITIAL: EtatFormulaire = {}

/**
 * Ce que le document dit de sa propre signature.
 *
 * ─── Ce qu'on montre, et ce qu'on tait ──────────────────────────────────────
 *
 * Le signataire, la date, et l'assurance que la signature ne bougera plus. Pas
 * l'empreinte, pas le chemin de la copie, pas le mécanisme : un bailleur n'a
 * pas à lire du hexadécimal pour être rassuré. L'empreinte reste affichée plus
 * bas sur la page, pour qui veut la comparer.
 *
 * ─── Les mots ───────────────────────────────────────────────────────────────
 *
 * « Signé », pas « certifié ». « Document intact », pas « authentique ». Les
 * quittances de Sikaloc portent « signature électronique simple, non
 * qualifiée » : cet encart ne doit rien promettre de plus que le document
 * lui-même.
 *
 * Une apposition rétroactive — quittance émise avant ce dispositif — le dit.
 * Elle n'apporte pas la même garantie, et le laisser croire serait malhonnête.
 */
export function BlocSigne({
  quittanceId,
  nomSignataire,
  apposeLe,
  retroactif,
  aCopieFigee,
}: {
  quittanceId: string
  nomSignataire: string
  apposeLe: string
  retroactif: boolean
  /** Une copie de la signature a-t-elle été figée à l'apposition ? */
  aCopieFigee: boolean
}) {
  const [etat, action] = useActionState(
    async () => verifierIntegrite(quittanceId),
    ETAT_INITIAL,
  )

  return (
    <section className="card mt-xl">
      <div className="flex items-start gap-md">
        <Lock size={18} strokeWidth={2} aria-hidden="true" className="mt-xxs shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <h2 className="text-title-sm font-semibold text-ink">Document signé</h2>

          <dl className="mt-md space-y-xs text-body-sm">
            <div className="flex flex-wrap gap-x-sm">
              <dt className="text-mute">Signataire</dt>
              <dd className="font-semibold text-ink">{nomSignataire}</dd>
            </div>
            <div className="flex flex-wrap gap-x-sm">
              <dt className="text-mute">{retroactif ? 'Émis le' : 'Signé le'}</dt>
              <dd className="text-body">{formaterHorodatage(apposeLe)}</dd>
            </div>
          </dl>

          <p className="mt-md text-caption leading-relaxed text-mute">
            {aCopieFigee
              ? 'La signature apposée sur ce document est conservée telle quelle. Changer votre signature dans vos paramètres ne la modifiera pas.'
              : retroactif
                ? 'Ce document a été émis avant la mise en place de la conservation des signatures. Le fichier archivé reste la pièce de référence : il porte la signature telle qu’elle a été apposée.'
                : 'Aucune copie de la signature n’a pu être conservée pour ce document. Le fichier archivé reste la pièce de référence.'}
          </p>
        </div>
      </div>

      <form action={action} className="mt-lg border-t border-hairline pt-lg">
        {etat.succes ? <Alerte ton="succes">{etat.succes}</Alerte> : null}
        {etat.erreur ? <Alerte ton="attention">{etat.erreur}</Alerte> : null}

        {!etat.succes && !etat.erreur ? (
          <p className="mb-md text-caption text-mute">
            Vérifiez que le fichier archivé correspond toujours à celui qui a été
            produit lors de la signature.
          </p>
        ) : null}

        <BoutonSoumettre variante="secondary" compact libelleEnCours="Vérification…">
          <ShieldCheck size={15} strokeWidth={2} aria-hidden="true" />
          Vérifier l’intégrité
        </BoutonSoumettre>
      </form>
    </section>
  )
}
