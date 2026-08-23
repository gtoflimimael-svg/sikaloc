'use client'

import { ImageUp, PenLine, RotateCcw } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'

import { SignatureDessin } from '@/components/app/signature-dessin'
import { SignatureImport } from '@/components/app/signature-import'
import { BoutonSoumettre } from '@/components/ui/boutons'

type Mode = 'dessiner' | 'importer'

/**
 * Capture de signature — deux modes au choix.
 *
 *   • Dessiner : le bailleur signe directement à l'écran, au doigt ou à la
 *     souris. C'est le chemin le plus court, et le seul qui ne dépende ni d'un
 *     stylo, ni d'une feuille, ni de la lumière.
 *   • Importer : il photographie une signature déjà tracée sur papier, recadre
 *     autour du trait, et Sikaloc en retire le fond.
 *
 * « Dessiner » est proposé en premier parce qu'il aboutit toujours : aucune
 * photo ne peut être trop sombre, trop floue ou mal cadrée. L'import reste
 * indispensable pour le bailleur qui tient à SA signature, celle de ses
 * documents papier.
 *
 * Dans les deux cas, tout se passe sur l'appareil. Le fichier retenu est déposé
 * dans un <input type="file"> caché : la Server Action existante reçoit
 * exactement la même chose qu'avant, un PNG à fond transparent.
 */
export function CaptureSignature({
  nom = 'signature',
  onFichier,
}: {
  nom?: string
  /** Notifie le parent (utilisé par l'onboarding pour activer son bouton). */
  onFichier?: (fichier: File | null) => void
}) {
  const [mode, setMode] = useState<Mode>('dessiner')
  const [apercu, setApercu] = useState<string | null>(null)

  const champFichier = useRef<HTMLInputElement>(null)

  /** Publie le fichier retenu dans l'<input> caché que le formulaire poste. */
  const recevoir = useCallback(
    (fichier: File | null, image: string | null) => {
      const champ = champFichier.current
      if (champ) {
        const transfert = new DataTransfer()
        if (fichier) transfert.items.add(fichier)
        champ.files = transfert.files
      }

      setApercu(image)
      onFichier?.(fichier)
    },
    [onFichier],
  )

  function changerMode(suivant: Mode) {
    if (suivant === mode) return
    // Changer de mode invalide ce qui a été produit dans l'autre : garder
    // l'aperçu ferait croire que la signature affichée vient du mode courant.
    recevoir(null, null)
    setMode(suivant)
  }

  return (
    <div className="space-y-lg">
      {/* Le champ réellement posté — jamais visible. */}
      <input
        ref={champFichier}
        type="file"
        name={nom}
        accept="image/png"
        className="sr-only"
        tabIndex={-1}
      />

      <div role="tablist" aria-label="Méthode de signature" className="flex gap-xs">
        <BoutonMode
          actif={mode === 'dessiner'}
          onClick={() => changerMode('dessiner')}
          icone={<PenLine size={15} strokeWidth={2} aria-hidden="true" />}
          libelle="Dessiner"
        />
        <BoutonMode
          actif={mode === 'importer'}
          onClick={() => changerMode('importer')}
          icone={<ImageUp size={15} strokeWidth={2} aria-hidden="true" />}
          libelle="Importer une photo"
        />
      </div>

      {/* Le mode dessin reste monté quand on affiche l'aperçu : démonter le
          canvas effacerait le tracé, et « Recommencer » repartirait de zéro
          alors que l'utilisateur veut souvent juste retoucher son geste. */}
      <div className={mode === 'dessiner' ? undefined : 'hidden'}>
        <SignatureDessin onSignature={recevoir} />
      </div>

      {mode === 'importer' ? <SignatureImport onSignature={recevoir} /> : null}

      {/* ── Aperçu et validation ───────────────────────────────────────────── */}
      {apercu ? (
        <div className="anim-monte space-y-md border-t border-hairline pt-lg">
          <p className="field-label">Aperçu — tel qu’il apparaîtra sur vos quittances</p>
          <div className="flex min-h-[7rem] items-center justify-center rounded-lg border border-hairline bg-white p-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={apercu}
              alt="Aperçu de votre signature"
              className="max-h-[9rem] w-auto max-w-full"
            />
          </div>

          <div className="flex flex-wrap gap-md">
            <BoutonSoumettre libelleEnCours="Enregistrement…">
              Enregistrer cette signature
            </BoutonSoumettre>
            <button
              type="button"
              onClick={() => recevoir(null, null)}
              className="btn btn-secondary"
            >
              <RotateCcw size={15} strokeWidth={2} aria-hidden="true" />
              Recommencer
            </button>
          </div>

          <p className="text-caption text-mute">
            Seule cette image est envoyée. La photo d’origine ne quitte pas votre
            appareil.
          </p>
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
