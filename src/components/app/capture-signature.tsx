'use client'

import { Camera, RotateCcw, ScanLine, Upload, Wand2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { BoutonSoumettre } from '@/components/ui/boutons'
import { Alerte } from '@/components/ui/retours'
import { detourerSignature, ScanVide } from '@/lib/signature/scan'

type Mode = 'importer' | 'scanner'

/**
 * Capture de signature — import d'un fichier ou scan par la caméra.
 *
 * Le scan est le chemin conçu pour le terrain : un bailleur signe sur une
 * feuille, la photographie, et Sikaloc en extrait le trait sur fond
 * transparent. C'est le seul moyen d'obtenir une signature propre sans
 * scanner à plat, que très peu de bailleurs possèdent.
 *
 * Le fichier retenu est déposé dans un <input type="file"> caché : la Server
 * Action existante reçoit exactement la même chose, qu'il vienne du disque ou
 * de l'objectif.
 */
export function CaptureSignature({
  nom = 'signature',
  onFichier,
}: {
  nom?: string
  /** Notifie le parent (utilisé par l'onboarding pour activer son bouton). */
  onFichier?: (fichier: File | null) => void
}) {
  const [mode, setMode] = useState<Mode>('importer')
  const [apercu, setApercu] = useState<string | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [traitement, setTraitement] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)
  const [brute, setBrute] = useState<string | null>(null)

  const champFichier = useRef<HTMLInputElement>(null)
  const champPhoto = useRef<HTMLInputElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const flux = useRef<MediaStream | null>(null)

  const arreterCamera = useCallback(() => {
    flux.current?.getTracks().forEach((piste) => piste.stop())
    flux.current = null
    setCameraActive(false)
  }, [])

  useEffect(() => arreterCamera, [arreterCamera])

  /** Publie le fichier retenu dans l'<input> caché que le formulaire poste. */
  const publier = useCallback(
    (fichier: File | null) => {
      const champ = champFichier.current
      if (champ) {
        const transfert = new DataTransfer()
        if (fichier) transfert.items.add(fichier)
        champ.files = transfert.files
      }
      onFichier?.(fichier)
    },
    [onFichier],
  )

  async function traiter(source: Blob | string) {
    setTraitement(true)
    setErreur(null)

    try {
      const resultat = await detourerSignature(source)
      setApercu(resultat.apercu)
      publier(resultat.fichier)
    } catch (probleme) {
      setApercu(null)
      publier(null)
      setErreur(
        probleme instanceof ScanVide
          ? probleme.message
          : 'Le traitement de l’image a échoué. Réessayez avec une photo plus nette.',
      )
    } finally {
      setTraitement(false)
    }
  }

  async function ouvrirCamera() {
    setErreur(null)

    if (!navigator.mediaDevices?.getUserMedia) {
      // Navigateur ancien ou contexte non sécurisé : on retombe sur l'appareil
      // photo natif via `capture`, qui ne demande aucune permission live.
      champPhoto.current?.click()
      return
    }

    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 } },
        audio: false,
      })

      flux.current = media
      setCameraActive(true)

      if (video.current) {
        video.current.srcObject = media
        await video.current.play().catch(() => undefined)
      }
    } catch {
      setErreur(
        'Accès à la caméra refusé. Autorisez-la dans votre navigateur, ou prenez la photo avec votre appareil photo puis importez-la.',
      )
    }
  }

  function capturer() {
    const image = video.current
    if (!image) return

    const canvas = document.createElement('canvas')
    canvas.width = image.videoWidth
    canvas.height = image.videoHeight
    canvas.getContext('2d')?.drawImage(image, 0, 0)

    const cliche = canvas.toDataURL('image/jpeg', 0.92)
    setBrute(cliche)
    arreterCamera()
    void traiter(cliche)
  }

  function recommencer() {
    setApercu(null)
    setBrute(null)
    setErreur(null)
    publier(null)
    if (mode === 'scanner') void ouvrirCamera()
  }

  return (
    <div className="space-y-lg">
      {/* Le champ réellement posté — jamais visible. */}
      <input ref={champFichier} type="file" name={nom} accept="image/png" className="sr-only" tabIndex={-1} />

      {/* Repli appareil photo natif quand getUserMedia n'est pas disponible. */}
      <input
        ref={champPhoto}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const fichier = e.target.files?.[0]
          if (fichier) void traiter(fichier)
        }}
      />

      <div role="tablist" aria-label="Méthode" className="flex gap-xs">
        <BoutonMode
          actif={mode === 'importer'}
          onClick={() => {
            arreterCamera()
            setMode('importer')
          }}
          icone={<Upload size={15} strokeWidth={2} aria-hidden="true" />}
          libelle="Choisir un fichier"
        />
        <BoutonMode
          actif={mode === 'scanner'}
          onClick={() => {
            setMode('scanner')
            void ouvrirCamera()
          }}
          icone={<ScanLine size={15} strokeWidth={2} aria-hidden="true" />}
          libelle="Scanner ma signature"
        />
      </div>

      {erreur ? <Alerte ton="attention">{erreur}</Alerte> : null}

      {/* ── Import ─────────────────────────────────────────────────────────── */}
      {mode === 'importer' && !apercu ? (
        <div className="anim-apparait">
          <label htmlFor="signature-source" className="field-label">
            Image de votre signature
          </label>
          <input
            id="signature-source"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => {
              const fichier = e.target.files?.[0]
              if (fichier) void traiter(fichier)
            }}
            className="block w-full text-body-sm text-body file:mr-lg file:rounded-xl file:border-0 file:bg-canvas-soft file:px-lg file:py-md file:text-body-sm file:font-semibold file:text-ink hover:file:bg-surface-elevated"
          />
          <p className="field-hint">
            PNG, JPEG ou WebP. Même une photo prise au téléphone convient :
            Sikaloc en détache le trait et retire le fond, sur votre appareil.
          </p>
        </div>
      ) : null}

      {/* ── Scan ───────────────────────────────────────────────────────────── */}
      {mode === 'scanner' && cameraActive ? (
        <div className="anim-apparait space-y-md">
          <div className="relative overflow-hidden rounded-lg bg-surface-dark">
            <video
              ref={video}
              playsInline
              muted
              className="block max-h-[60vh] w-full object-contain"
            />
            {/* Gabarit de cadrage : format d'une signature, pas d'une photo. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-[6%] top-1/2 h-[34%] -translate-y-1/2 rounded-md border-2 border-dashed border-on-dark/70"
            />
            <p className="pointer-events-none absolute inset-x-0 bottom-sm text-center text-caption text-on-dark">
              Signez sur une feuille blanche, cadrez dans le rectangle.
            </p>
          </div>

          <div className="flex flex-wrap gap-md">
            <button type="button" onClick={capturer} className="btn btn-primary">
              <Camera size={16} strokeWidth={2} aria-hidden="true" />
              Capturer
            </button>
            <button type="button" onClick={arreterCamera} className="btn btn-secondary">
              Annuler
            </button>
          </div>
        </div>
      ) : null}

      {mode === 'scanner' && !cameraActive && !apercu && !traitement ? (
        <button
          type="button"
          onClick={ouvrirCamera}
          className="anim-apparait flex w-full flex-col items-center gap-sm rounded-lg border border-dashed border-hairline-strong bg-canvas px-lg py-2xl text-center transition-colors hover:bg-surface-soft"
        >
          <ScanLine size={26} strokeWidth={1.6} aria-hidden="true" className="text-primary" />
          <span className="text-body-md font-semibold text-ink">Ouvrir la caméra</span>
          <span className="max-w-[24rem] text-body-sm text-mute">
            Signez sur une feuille blanche, puis photographiez-la. Le fond est
            retiré automatiquement.
          </span>
        </button>
      ) : null}

      {/* ── Traitement ─────────────────────────────────────────────────────── */}
      {traitement ? (
        <div className="flex items-center gap-sm rounded-lg bg-canvas px-lg py-md text-body-sm text-body">
          <Wand2 size={16} strokeWidth={2} aria-hidden="true" className="anim-pulse text-primary" />
          Détourage du trait…
        </div>
      ) : null}

      {/* ── Aperçu ─────────────────────────────────────────────────────────── */}
      {apercu ? (
        <div className="anim-monte space-y-md">
          <p className="field-label">Aperçu — tel qu’il apparaîtra sur vos quittances</p>
          <div className="flex min-h-[7rem] items-center justify-center rounded-lg border border-hairline bg-white p-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={apercu}
              alt="Aperçu de votre signature détourée"
              className="max-h-[9rem] w-auto max-w-full"
            />
          </div>

          <div className="flex flex-wrap gap-md">
            <BoutonSoumettre libelleEnCours="Enregistrement…">
              Enregistrer cette signature
            </BoutonSoumettre>
            <button type="button" onClick={recommencer} className="btn btn-secondary">
              <RotateCcw size={15} strokeWidth={2} aria-hidden="true" />
              Recommencer
            </button>
          </div>

          {brute ? (
            <p className="text-caption text-mute">
              Seule l’image détourée est envoyée : la photo d’origine ne quitte
              pas votre appareil.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function BoutonMode({
  actif,
  onClick,
  icone,
  libelle,
}: {
  actif: boolean
  onClick: () => void
  icone: React.ReactNode
  libelle: string
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={actif}
      onClick={onClick}
      className={`inline-flex flex-1 items-center justify-center gap-xs rounded-md px-md py-sm text-body-sm font-medium transition-colors duration-150 sm:flex-none ${
        actif
          ? 'bg-primary text-on-primary'
          : 'border border-hairline bg-canvas text-mute hover:text-ink'
      }`}
    >
      {icone}
      {libelle}
    </button>
  )
}
