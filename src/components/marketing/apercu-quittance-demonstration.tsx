'use client'

import { useEffect, useRef, useState } from 'react'
import type {
  PDFDocumentLoadingTask,
  PDFDocumentProxy,
  PDFPageProxy,
  RenderTask,
} from 'pdfjs-dist'

const SOURCE_PDF = '/exemple-quittance'
// Worker servi localement et aligné sur pdfjs-dist 6.3.289 (version verrouillée).
const WORKER_PDFJS = '/vendor/pdfjs/pdf.worker.min.mjs'

type EtatApercu = 'attente' | 'chargement' | 'pret' | 'erreur'

/**
 * Première page dessinée par PDF.js à partir des octets du vrai document.
 * L'aperçu et l'ouverture complète utilisent ainsi exactement la même route
 * PDF, sans seconde maquette HTML ni dépendance au lecteur natif du navigateur.
 */
export function ApercuQuittanceDemonstration() {
  const cadre = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [etat, setEtat] = useState<EtatApercu>('attente')

  useEffect(() => {
    let monte = true
    let demandeLancee = false
    let chargement: PDFDocumentLoadingTask | null = null
    let documentPdf: PDFDocumentProxy | null = null
    let pagePdf: PDFPageProxy | null = null
    let rendu: RenderTask | null = null
    let revisionRendu = 0
    let observateurVisibilite: IntersectionObserver | null = null
    let observateurTaille: ResizeObserver | null = null

    async function dessinerPage() {
      const page = pagePdf
      const surface = canvas.current
      if (!page || !surface) return

      const revision = ++revisionRendu
      if (rendu) {
        const renduPrecedent = rendu
        renduPrecedent.cancel()
        try {
          await renduPrecedent.promise
        } catch {
          // L'annulation précède un nouveau rendu suite au redimensionnement.
        }
        if (rendu === renduPrecedent) rendu = null
      }

      if (!monte || revision !== revisionRendu) return

      const largeur = Math.floor(surface.parentElement?.clientWidth ?? surface.clientWidth)
      if (largeur <= 0) return

      const largeurNative = page.getViewport({ scale: 1 }).width
      const viewport = page.getViewport({ scale: largeur / largeurNative })
      const echelleEcran = Math.min(window.devicePixelRatio || 1, 2)

      surface.width = Math.ceil(viewport.width * echelleEcran)
      surface.height = Math.ceil(viewport.height * echelleEcran)

      const contexte = surface.getContext('2d', { alpha: false })
      if (!contexte) throw new Error('Le rendu du PDF nécessite un canvas 2D.')

      const tache = page.render({
        canvasContext: contexte,
        viewport,
        transform: [echelleEcran, 0, 0, echelleEcran, 0, 0],
      })
      rendu = tache

      try {
        await tache.promise
      } catch (erreur) {
        if ((erreur as Error).name !== 'RenderingCancelledException') throw erreur
        return
      }
      if (monte && revision === revisionRendu) {
        rendu = null
        setEtat('pret')
      }
    }

    async function chargerPdf() {
      if (demandeLancee || !monte) return
      demandeLancee = true
      setEtat('chargement')

      try {
        const pdfjs = await import('pdfjs-dist')
        if (!monte) return

        pdfjs.GlobalWorkerOptions.workerSrc = WORKER_PDFJS
        chargement = pdfjs.getDocument({
          url: SOURCE_PDF,
          disableRange: true,
          isEvalSupported: false,
        })
        documentPdf = await chargement.promise
        if (!monte) return
        if (documentPdf.numPages < 1) throw new Error('Le PDF ne contient aucune page.')

        pagePdf = await documentPdf.getPage(1)
        if (!monte) return

        if (cadre.current && 'ResizeObserver' in window) {
          observateurTaille = new ResizeObserver(() => {
            void dessinerPage().catch(() => {
              if (monte) setEtat('erreur')
            })
          })
          observateurTaille.observe(cadre.current)
        }

        await dessinerPage()
      } catch {
        if (monte) setEtat('erreur')
      }
    }

    const element = cadre.current
    if (element && 'IntersectionObserver' in window) {
      observateurVisibilite = new IntersectionObserver(
        (entrees) => {
          if (entrees.some((entree) => entree.isIntersecting)) {
            void chargerPdf()
            observateurVisibilite?.disconnect()
          }
        },
        { rootMargin: '180px 0px' },
      )
      observateurVisibilite.observe(element)
    } else {
      void chargerPdf()
    }

    return () => {
      monte = false
      revisionRendu += 1
      observateurVisibilite?.disconnect()
      observateurTaille?.disconnect()
      rendu?.cancel()
      if (chargement) void chargement.destroy()
      else void documentPdf?.destroy()
    }
  }, [])

  return (
    <div className="home-document-stage">
      <div
        ref={cadre}
        className="home-document-pdf"
        role="region"
        aria-label="Aperçu de la première page du PDF d’exemple de quittance Sikaloc"
        aria-busy={etat === 'attente' || etat === 'chargement'}
      >
        <canvas
          ref={canvas}
          className="home-document-pdf-canvas"
          role="img"
          aria-label="Première page de la quittance PDF fictive, rendue directement depuis le document Sikaloc"
        />
        {etat !== 'pret' ? (
          <div
            className={`home-document-pdf-state${etat === 'erreur' ? ' home-document-pdf-state--error' : ''}`}
            role={etat === 'erreur' ? 'alert' : 'status'}
            aria-live="polite"
          >
            {etat === 'erreur'
              ? 'L’aperçu PDF est indisponible. Ouvrez le document complet pour le consulter.'
              : etat === 'attente'
                ? 'Aperçu de la quittance PDF.'
                : 'Chargement de la quittance PDF…'}
          </div>
        ) : null}
      </div>
      <a className="home-document-open" href={SOURCE_PDF} target="_blank" rel="noreferrer">
        Ouvrir le PDF en pleine page
      </a>
    </div>
  )
}
