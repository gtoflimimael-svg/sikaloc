'use client'

import { Check, Crop, Upload, ZoomIn } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import 'react-easy-crop/react-easy-crop.css'

import { Alerte } from '@/components/ui/retours'
import { AucuneSignature, extraireSignature, ImageInsuffisante } from '@/lib/signature/extraction'
import { FichierRefuse, verifierImage } from '@/lib/signature/fichier'

/**
 * Import d'une photo de signature, en deux temps : recadrer, puis détourer.
 *
 * Le recadrage n'est pas un confort. Les paramètres du détourage — rayon du
 * seuillage adaptatif, taille minimale des taches à écarter — se calculent sur
 * les dimensions de l'image reçue. Sur la photo d'une feuille A4 entière, ils
 * deviennent absurdes : le seuillage moyenne sur des zones énormes et le
 * dépoussiérage efface les traits fins de la signature elle-même. Recadrer
 * d'abord remet ces paramètres à l'échelle du trait, et c'était la première
 * cause de mauvaise qualité des versions précédentes.
 */
export function SignatureImport({
  onSignature,
}: {
  onSignature: (fichier: File | null, apercu: string | null) => void
}) {
  const [source, setSource] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [zone, setZone] = useState<Area | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [traitement, setTraitement] = useState(false)

  // Conservée pour révoquer l'URL objet : sans cela, la photo importée reste en
  // mémoire tant que l'onglet est ouvert.
  const urlObjet = useRef<string | null>(null)

  const liberer = useCallback(() => {
    if (urlObjet.current) {
      URL.revokeObjectURL(urlObjet.current)
      urlObjet.current = null
    }
  }, [])

  useEffect(() => liberer, [liberer])

  async function choisir(fichier: File) {
    setErreur(null)
    onSignature(null, null)

    try {
      // Le contenu réel, pas l'extension ni le type déclaré.
      await verifierImage(fichier)
    } catch (probleme) {
      setErreur(
        probleme instanceof FichierRefuse
          ? probleme.message
          : 'Ce fichier n’a pas pu être lu.',
      )
      return
    }

    liberer()
    const url = URL.createObjectURL(fichier)
    urlObjet.current = url

    setSource(url)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setZone(null)
  }

  /**
   * Découpe la zone choisie à la définition d'origine, puis lance le détourage.
   *
   * Le découpage se fait sur l'image source chargée à sa taille réelle, jamais
   * sur l'aperçu affiché : `croppedAreaPixels` est déjà exprimé dans le repère
   * de l'image d'origine, et redimensionner avant traitement reviendrait à
   * jeter du détail que le seuillage ne pourrait plus retrouver.
   */
  async function detourer() {
    if (!source || !zone) return

    setTraitement(true)
    setErreur(null)

    try {
      const image = await new Promise<HTMLImageElement>((resoudre, rejeter) => {
        const img = new Image()
        img.onload = () => resoudre(img)
        img.onerror = () => rejeter(new ImageInsuffisante('Image illisible.'))
        img.src = source
      })

      const decoupe = document.createElement('canvas')
      decoupe.width = Math.max(1, Math.round(zone.width))
      decoupe.height = Math.max(1, Math.round(zone.height))

      const contexte = decoupe.getContext('2d')
      if (!contexte) throw new ImageInsuffisante('Traitement d’image indisponible.')

      contexte.imageSmoothingQuality = 'high'
      contexte.drawImage(
        image,
        Math.round(zone.x),
        Math.round(zone.y),
        decoupe.width,
        decoupe.height,
        0,
        0,
        decoupe.width,
        decoupe.height,
      )

      // PNG et non JPEG : une recompression avec pertes juste avant le
      // seuillage ajoute des halos autour du trait, que l'algorithme prend
      // ensuite pour de l'encre.
      const morceau = await new Promise<Blob | null>((r) => decoupe.toBlob(r, 'image/png'))
      if (!morceau) throw new ImageInsuffisante('Découpe impossible.')

      const resultat = await extraireSignature(morceau)
      onSignature(resultat.fichier, resultat.apercu)

      // La photo d'origine a fini son office : on la libère tout de suite.
      liberer()
      setSource(null)
    } catch (probleme) {
      onSignature(null, null)
      setErreur(
        probleme instanceof AucuneSignature || probleme instanceof ImageInsuffisante
          ? probleme.message
          : 'Le traitement de l’image a échoué. Réessayez avec une photo plus nette.',
      )
    } finally {
      setTraitement(false)
    }
  }

  // ── Choix du fichier ─────────────────────────────────────────────────────
  if (!source) {
    return (
      <div className="anim-apparait space-y-md">
        {erreur ? <Alerte ton="attention">{erreur}</Alerte> : null}

        <label
          htmlFor="signature-source"
          className="flex w-full cursor-pointer flex-col items-center gap-sm rounded-lg border border-dashed border-hairline-strong bg-canvas px-lg py-2xl text-center transition-colors hover:bg-surface-soft"
        >
          <Upload size={26} strokeWidth={1.6} aria-hidden="true" className="text-primary" />
          <span className="text-body-md font-semibold text-ink">
            Choisir une photo de votre signature
          </span>
          <span className="max-w-[26rem] text-body-sm text-mute">
            Signez sur une feuille blanche et photographiez-la. Vous recadrerez
            ensuite autour du trait — le fond est retiré sur votre appareil, la
            photo ne part jamais sur nos serveurs.
          </span>
        </label>

        <input
          id="signature-source"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          capture="environment"
          className="sr-only"
          onChange={(e) => {
            const fichier = e.target.files?.[0]
            if (fichier) void choisir(fichier)
            // Permet de re-choisir le même fichier après une erreur.
            e.target.value = ''
          }}
        />
      </div>
    )
  }

  // ── Recadrage ────────────────────────────────────────────────────────────
  return (
    <div className="anim-apparait space-y-md">
      {erreur ? <Alerte ton="attention">{erreur}</Alerte> : null}

      <div>
        <p className="field-label">Cadrez au plus près de votre signature</p>
        <div className="relative h-[16rem] overflow-hidden rounded-lg bg-surface-dark sm:h-[20rem]">
          <Cropper
            image={source}
            crop={crop}
            zoom={zoom}
            // 3:1 — les proportions d'une signature manuscrite, pas d'une photo.
            aspect={3}
            showGrid={false}
            objectFit="contain"
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_, pixels) => setZone(pixels)}
          />
        </div>
      </div>

      <label className="flex items-center gap-md">
        <ZoomIn size={16} strokeWidth={2} aria-hidden="true" className="shrink-0 text-mute" />
        <span className="sr-only">Zoom</span>
        <input
          type="range"
          min={1}
          max={5}
          step={0.05}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-canvas-soft accent-primary"
        />
      </label>

      <div className="flex flex-wrap gap-md">
        <button
          type="button"
          onClick={detourer}
          disabled={!zone || traitement}
          className="btn btn-primary disabled:opacity-60"
        >
          {traitement ? (
            <>
              <Crop size={16} strokeWidth={2} aria-hidden="true" className="anim-pulse" />
              Détourage…
            </>
          ) : (
            <>
              <Check size={16} strokeWidth={2} aria-hidden="true" />
              Détourer cette zone
            </>
          )}
        </button>
        <button
          type="button"
          onClick={() => {
            liberer()
            setSource(null)
            setErreur(null)
          }}
          className="btn btn-secondary"
        >
          Choisir une autre photo
        </button>
      </div>
    </div>
  )
}
