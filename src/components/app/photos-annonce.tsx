'use client'

import { useActionState, useState } from 'react'

import { ActionConfirmee } from '@/components/ui/action-confirmee'
import { BoutonSoumettre } from '@/components/ui/boutons'
import { Alerte, Badge } from '@/components/ui/retours'
import { ajouterPhotoAnnonce, retirerPhotoAnnonceAction } from '@/lib/actions/annonce-photos'
import type { EtatFormulaire } from '@/lib/validation'

const ETAT_INITIAL: EtatFormulaire = {}
const POIDS_MAX = 3 * 1024 * 1024
const PHOTOS_MAX = 8

export type PhotoGeree = { id: string; position: number; largeur: number; hauteur: number }

/**
 * Les photos d'une annonce, dans l'espace Pro.
 *
 * L'envoi passe par le seul pipeline qui existe (S3) : `ajouterPhotoAnnonce`,
 * qui vérifie, nettoie et ré-encode côté serveur. Les contrôles faits ici —
 * format, poids — évitent d'envoyer 3 Mo pour un refus certain ; ils ne
 * protègent rien.
 *
 * `<img>` et non `next/image` : les images viennent d'une route authentifiée
 * (`/api/annonces/photos/[id]`), que l'optimiseur de Next appellerait sans le
 * cookie de session. Même choix que `photo-profil.tsx`.
 */
export function PhotosAnnonce({
  annonceId,
  photos,
  modifiable,
  publiee,
}: {
  annonceId: string
  photos: PhotoGeree[]
  modifiable: boolean
  publiee: boolean
}) {
  const [etat, envoyer] = useActionState(ajouterPhotoAnnonce.bind(null, annonceId), ETAT_INITIAL)
  const [erreurLocale, setErreurLocale] = useState<string | null>(null)
  const complet = photos.length >= PHOTOS_MAX

  function verifier(evenement: React.ChangeEvent<HTMLInputElement>) {
    setErreurLocale(null)
    const fichier = evenement.target.files?.[0]
    if (!fichier) return
    if (!['image/jpeg', 'image/webp'].includes(fichier.type)) {
      setErreurLocale('Format non accepté. Utilisez une photo JPEG ou WebP.')
      evenement.target.value = ''
    } else if (fichier.size > POIDS_MAX) {
      setErreurLocale('La photo dépasse 3 Mo. Choisissez une image plus légère.')
      evenement.target.value = ''
    }
  }

  return (
    <section className="card card-lg space-y-lg">
      <div className="flex flex-wrap items-baseline justify-between gap-sm">
        <h2 className="text-display-xs font-semibold text-ink">Photos</h2>
        <p className="text-body-sm text-mute">
          {photos.length} sur {PHOTOS_MAX}
        </p>
      </div>

      {photos.length === 0 ? (
        <Alerte ton="attention">
          Aucune photo pour l’instant. Une annonce ne se publie pas sans au moins une photo.
        </Alerte>
      ) : (
        <ul className="grid grid-cols-2 gap-md sm:grid-cols-4">
          {photos.map((photo) => (
            <li key={photo.id} className="space-y-sm">
              <div className="relative overflow-hidden rounded-md border border-hairline bg-canvas-soft">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/annonces/photos/${photo.id}`}
                  alt={photo.position === 0 ? 'Photo principale' : `Photo ${photo.position + 1}`}
                  width={photo.largeur}
                  height={photo.hauteur}
                  loading="lazy"
                  className="aspect-[4/3] w-full object-cover"
                />
                {photo.position === 0 ? (
                  <span className="absolute left-xs top-xs">
                    <Badge ton="positive">Principale</Badge>
                  </span>
                ) : null}
              </div>
              {modifiable ? (
                <ActionConfirmee
                  action={retirerPhotoAnnonceAction.bind(null, photo.id)}
                  libelle="Retirer"
                  varianteDeclencheur="tertiary"
                  titreConfirmation="Retirer cette photo ?"
                  messageConfirmation={
                    photo.position === 0 && photos.length > 1
                      ? 'La photo suivante deviendra la photo principale.'
                      : publiee && photos.length === 1
                        ? 'C’est la dernière photo d’une annonce publiée : elle ne peut pas être retirée.'
                        : 'Elle sera supprimée définitivement.'
                  }
                  libelleConfirmation="Retirer"
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {modifiable && !complet ? (
        <form action={envoyer} className="space-y-md border-t border-hairline-soft pt-lg">
          {etat.erreur ? <Alerte ton="erreur">{etat.erreur}</Alerte> : null}
          {etat.succes && !erreurLocale ? <Alerte ton="succes">{etat.succes}</Alerte> : null}
          {erreurLocale ? <Alerte ton="erreur">{erreurLocale}</Alerte> : null}
          <div>
            <label htmlFor="photo" className="field-label">
              {photos.length === 0 ? 'Ajouter la photo principale' : 'Ajouter une photo'}
            </label>
            <input
              id="photo"
              name="photo"
              type="file"
              accept="image/jpeg,image/webp"
              required
              onChange={verifier}
              className="block w-full text-body-sm"
            />
            <p className="field-hint">
              JPEG ou WebP, 3 Mo au plus. La photo est réduite et nettoyée de ses métadonnées
              (position GPS comprise) avant d’être enregistrée.
            </p>
          </div>
          <BoutonSoumettre libelleEnCours="Envoi…">Envoyer la photo</BoutonSoumettre>
        </form>
      ) : null}

      {modifiable && complet ? (
        <p className="text-body-sm text-mute">
          Huit photos au maximum : retirez-en une pour en ajouter une autre.
        </p>
      ) : null}
    </section>
  )
}
