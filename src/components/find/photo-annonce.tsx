'use client'

import { ImageOff } from 'lucide-react'
import { useState } from 'react'

/** Photo de la projection publique, servie par la route de média Find. */
export function PhotoAnnonce({
  src,
  alt,
  largeur,
  hauteur,
  prioritaire = false,
}: {
  src: string | null
  alt: string
  largeur: number | null
  hauteur: number | null
  prioritaire?: boolean
}) {
  const [indisponible, setIndisponible] = useState(!src)

  return (
    <div className="find-card-photo">
      {!indisponible && src ? (
        // La route Find sert déjà l’image nettoyée et redimensionnée ; on
        // évite de la faire transiter une seconde fois par l’optimiseur.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          width={largeur ?? undefined}
          height={hauteur ?? undefined}
          loading={prioritaire ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={prioritaire ? 'high' : 'auto'}
          onError={() => setIndisponible(true)}
        />
      ) : (
        <div className="find-photo-fallback" role="img" aria-label={alt}>
          <ImageOff size={28} strokeWidth={1.5} aria-hidden="true" />
          <span>Photo momentanément indisponible</span>
        </div>
      )}
    </div>
  )
}
