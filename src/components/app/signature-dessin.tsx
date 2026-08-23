'use client'

import { Eraser, Undo2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import SignaturePad from 'signature_pad'

/** Encre : le même noir légèrement bleuté que le détourage, pour que les deux modes rendent pareil. */
const ENCRE = '#13131a'

/**
 * Définition de rendu. `devicePixelRatio` seul donne un trait net à l'écran mais
 * pauvre à l'impression ; on force au moins 2× et on plafonne à 3× — au-delà, la
 * mémoire canvas grimpe vite sur un téléphone d'entrée de gamme sans gain
 * visible sur une quittance A4.
 */
function definition(): number {
  return Math.min(3, Math.max(2, window.devicePixelRatio || 1))
}

/** Marge conservée autour du tracé, en pixels de rendu. */
const MARGE = 16

/**
 * Signature dessinée à la main, au doigt ou à la souris.
 *
 * Repose sur `signature_pad` (MIT, sans dépendance) pour l'interpolation de
 * Bézier et la largeur variable selon la vitesse — c'est ce qui distingue un
 * trait manuscrit d'une polyligne. Le reste (mise à l'échelle, recadrage,
 * export) est écrit ici : `signature_pad` rend le canvas entier, alors qu'une
 * quittance a besoin du tracé seul, détouré, sur fond transparent.
 */
export function SignatureDessin({
  onSignature,
}: {
  /** Rend le PNG détouré, ou `null` si la zone est vide. */
  onSignature: (fichier: File | null, apercu: string | null) => void
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const cadre = useRef<HTMLDivElement>(null)
  const pad = useRef<SignaturePad | null>(null)
  const [vide, setVide] = useState(true)

  /**
   * Recadre le tracé sur son enveloppe et rend un PNG transparent.
   *
   * Le canvas fait la taille de la zone de dessin ; le tracé en occupe une
   * fraction. Sans recadrage, la signature arriverait sur la quittance entourée
   * d'un vide qui la ferait paraître minuscule.
   */
  const exporter = useCallback(() => {
    const c = canvas.current
    const p = pad.current
    if (!c || !p) return

    if (p.isEmpty()) {
      setVide(true)
      onSignature(null, null)
      return
    }

    setVide(false)

    const contexte = c.getContext('2d')
    if (!contexte) return

    const donnees = contexte.getImageData(0, 0, c.width, c.height).data
    let minX = c.width
    let minY = c.height
    let maxX = -1
    let maxY = -1

    for (let y = 0; y < c.height; y++) {
      for (let x = 0; x < c.width; x++) {
        // Seuil à 8 plutôt que 0 : l'antialiasing laisse un voile d'alpha 1-2
        // sur toute la trace du geste, qui gonflerait l'enveloppe.
        if (donnees[(y * c.width + x) * 4 + 3] <= 8) continue
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }

    if (maxX < 0) {
      setVide(true)
      onSignature(null, null)
      return
    }

    const x0 = Math.max(0, minX - MARGE)
    const y0 = Math.max(0, minY - MARGE)
    const largeur = Math.min(c.width, maxX + MARGE) - x0
    const hauteur = Math.min(c.height, maxY + MARGE) - y0

    const sortie = document.createElement('canvas')
    sortie.width = largeur
    sortie.height = hauteur
    sortie.getContext('2d')?.drawImage(c, x0, y0, largeur, hauteur, 0, 0, largeur, hauteur)

    const apercu = sortie.toDataURL('image/png')
    sortie.toBlob((blob) => {
      if (!blob) return
      onSignature(new File([blob], 'signature.png', { type: 'image/png' }), apercu)
    }, 'image/png')
  }, [onSignature])

  // ── Mise en place, et réajustement au redimensionnement ──────────────────
  useEffect(() => {
    const c = canvas.current
    if (!c) return

    const instance = new SignaturePad(c, {
      penColor: ENCRE,
      // Fond transparent : la quittance a le sien.
      backgroundColor: 'rgba(0,0,0,0)',
      minWidth: 0.9,
      maxWidth: 2.6,
      // Un peu de lissage sans transformer le geste en ruban mou.
      velocityFilterWeight: 0.65,
    })

    pad.current = instance
    instance.addEventListener('endStroke', exporter)

    /**
     * Le canvas doit être redimensionné en pixels réels, pas en CSS, sinon le
     * trait est flou. Redimensionner efface le contenu : on sauvegarde les
     * points et on les rejoue.
     *
     * La mesure porte sur le conteneur, jamais sur le canvas lui-même, et la
     * taille CSS du canvas est fixée explicitement. Mesurer le canvas serait une
     * boucle : sa taille d'affichage suivrait sa taille interne, qu'on vient de
     * calculer à partir d'elle, et chaque tour la multiplierait par le ratio.
     * Tant qu'une feuille de style contraint la boîte, cela ne se voit pas —
     * mais le jour où elle ne s'applique pas, l'onglet sature la mémoire.
     */
    const ajuster = () => {
      const boite = cadre.current
      if (!boite) return

      const largeurCss = boite.clientWidth
      const hauteurCss = boite.clientHeight
      if (largeurCss === 0 || hauteurCss === 0) return

      const ratio = definition()
      const points = instance.toData()

      c.style.width = `${largeurCss}px`
      c.style.height = `${hauteurCss}px`
      c.width = Math.round(largeurCss * ratio)
      c.height = Math.round(hauteurCss * ratio)
      c.getContext('2d')?.scale(ratio, ratio)

      instance.clear()
      if (points.length > 0) instance.fromData(points)
    }

    ajuster()

    const observateur = new ResizeObserver(ajuster)
    if (cadre.current) observateur.observe(cadre.current)

    return () => {
      observateur.disconnect()
      instance.removeEventListener('endStroke', exporter)
      instance.off()
    }
  }, [exporter])

  function effacer() {
    pad.current?.clear()
    setVide(true)
    onSignature(null, null)
  }

  function annulerDernier() {
    const p = pad.current
    if (!p) return

    const points = p.toData()
    if (points.length === 0) return

    points.pop()
    p.fromData(points)
    exporter()
  }

  return (
    <div className="anim-apparait space-y-md">
      <div
        ref={cadre}
        className="relative h-[13rem] overflow-hidden rounded-lg border border-hairline bg-white sm:h-[15rem]"
      >
        <canvas
          ref={canvas}
          // `touch-none` est indispensable : sans lui, un glissement du doigt
          // fait défiler la page au lieu de dessiner.
          className="block cursor-crosshair touch-none"
          aria-label="Zone de signature — dessinez avec le doigt ou la souris"
          role="img"
        />

        {/* Ligne de signature, comme sur un document papier. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-[8%] bottom-[22%] border-b border-dashed border-hairline-strong"
        />

        {vide ? (
          <p
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 flex items-center justify-center text-body-sm text-mute"
          >
            Signez ici
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-md">
        <button
          type="button"
          onClick={annulerDernier}
          disabled={vide}
          className="btn btn-secondary disabled:opacity-50"
        >
          <Undo2 size={15} strokeWidth={2} aria-hidden="true" />
          Annuler le dernier trait
        </button>
        <button
          type="button"
          onClick={effacer}
          disabled={vide}
          className="btn btn-tertiary disabled:opacity-50"
        >
          <Eraser size={15} strokeWidth={2} aria-hidden="true" />
          Tout effacer
        </button>
      </div>

      <p className="field-hint">
        Utilisez votre doigt sur téléphone, la souris sur ordinateur. Le tracé est
        recadré automatiquement.
      </p>
    </div>
  )
}
