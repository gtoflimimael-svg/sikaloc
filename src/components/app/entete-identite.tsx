import { Check, TriangleAlert } from 'lucide-react'

import { PhotoProfil } from '@/components/ui/photo-profil'
import { etatIdentite } from '@/lib/identite'
import type { Bailleur } from '@/lib/types/database'

/**
 * En-tête du profil — la photo en premier, et ce qu'il en est.
 *
 * ─── Pourquoi un bloc dédié ─────────────────────────────────────────────────
 *
 * La page de profil commençait par un formulaire de nom et de téléphone. Dire
 * que la photo est la représentation principale et la reléguer au troisième
 * bloc aurait été une contradiction visible : l'ordre d'une page est une
 * affirmation autant que son texte.
 *
 * ─── Ce qu'il annonce, et ce qu'il n'annonce pas ────────────────────────────
 *
 * Photo présente : un constat, sans félicitation ni badge de confiance. Le
 * produit ne vérifie pas d'identité, et rien ici ne doit laisser croire qu'une
 * photo déposée vaut certification.
 *
 * Photo absente : le décompte, sans menace. Aucune fonctionnalité n'est retirée
 * au terme des cinq jours, et le ton ne doit pas suggérer le contraire.
 */
export function EnteteIdentite({ bailleur }: { bailleur: Bailleur }) {
  const etat = etatIdentite(bailleur)
  const aPhoto = etat.statut === 'photo'

  return (
    <div className="card card-lg flex flex-wrap items-center gap-lg">
      <PhotoProfil
        id={bailleur.id}
        nom={bailleur.nom}
        avatar={bailleur.avatar}
        aPhoto={aPhoto}
        taille={88}
      />

      <div className="min-w-0 flex-1">
        <p className="truncate text-title-lg font-semibold text-ink">{bailleur.nom}</p>
        <p className="mt-xxs truncate text-body-sm text-mute">{bailleur.email}</p>

        {aPhoto ? (
          <p className="mt-sm inline-flex items-center gap-xs text-caption font-semibold text-positive-deep">
            <Check size={14} strokeWidth={2.5} aria-hidden="true" />
            Photo ajoutée
          </p>
        ) : (
          <div className="mt-sm">
            <p className="inline-flex items-center gap-xs text-caption font-semibold text-warning-content">
              <TriangleAlert size={14} strokeWidth={2.2} aria-hidden="true" />
              Ajoutez votre photo
            </p>
            <p className="mt-xxs text-caption text-mute">
              {etat.statut === 'expire'
                ? 'Votre avatar vous représente depuis plus de cinq jours.'
                : `Votre avatar vous représente encore ${etat.joursRestants} jour${
                    etat.joursRestants > 1 ? 's' : ''
                  }.`}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
