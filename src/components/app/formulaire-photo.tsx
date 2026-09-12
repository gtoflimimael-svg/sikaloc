'use client'

import { Check, Upload, X } from 'lucide-react'
import { useActionState, useRef, useState } from 'react'

import { BoutonAction } from '@/components/ui/action-confirmee'
import { BoutonSoumettre } from '@/components/ui/boutons'
import { Alerte } from '@/components/ui/retours'
import { supprimerPhoto, televerserPhoto } from '@/lib/actions/parametres'
import { MESSAGES, POIDS_MAXIMAL, type Verdict } from '@/lib/identite'
import type { EtatFormulaire } from '@/lib/validation'

const ETAT_INITIAL: EtatFormulaire = {}

/**
 * Dépôt de la photo de profil, avec analyse avant envoi.
 *
 * ─── Rien ne part avant d'avoir été accepté ─────────────────────────────────
 *
 * La photo est examinée sur l'appareil du bailleur. Une photo écartée n'atteint
 * jamais nos serveurs : c'est la mesure de confidentialité la plus simple qui
 * soit, et la moins contournable. Le moteur d'analyse (~1,4 Mo) n'est chargé
 * qu'au premier fichier choisi, jamais à l'ouverture de la page.
 *
 * ─── Le ton ─────────────────────────────────────────────────────────────────
 *
 * Un refus est un problème de cadrage, pas un soupçon. On dit ce qui manque et
 * comment faire mieux — jamais « photo non conforme », jamais rien qui laisse
 * entendre qu'on doute de la personne. Et jamais que Sikaloc vérifie son
 * identité : ce n'est pas ce qui se passe ici.
 */
export function FormulairePhoto({
  nom,
  aPhoto,
}: {
  nom: string
  aPhoto: boolean
}) {
  const [etat, action] = useActionState(televerserPhoto, ETAT_INITIAL)
  const [verdict, setVerdict] = useState<Verdict | null>(null)
  const [analyse, setAnalyse] = useState(false)
  const [apercu, setApercu] = useState<string | null>(null)
  const champ = useRef<HTMLInputElement>(null)

  const choisir = async (fichier: File | undefined) => {
    setVerdict(null)
    setApercu(null)
    if (!fichier) return

    if (fichier.size > POIDS_MAXIMAL) {
      setVerdict({
        accepte: false,
        motif: 'illisible',
        controles: [{ cle: 'taille', libelle: 'Image exploitable', ok: false }],
      })
      return
    }

    setAnalyse(true)
    try {
      const { analyserPhoto } = await import('@/lib/identite')
      const resultat = await analyserPhoto(fichier)
      setVerdict(resultat)
      if (resultat.accepte) setApercu(URL.createObjectURL(fichier))
      // Une photo refusée n'est pas laissée dans le champ : elle partirait à la
      // soumission suivante sans être réexaminée.
      else if (champ.current) champ.current.value = ''
    } finally {
      setAnalyse(false)
    }
  }

  const refus = verdict && !verdict.accepte ? MESSAGES[verdict.motif!] : null

  return (
    <form action={action} className="card card-lg space-y-lg">
      <div>
        <h2 className="text-title-lg font-semibold text-ink">Votre photo de profil</h2>
        <p className="mt-xxs text-body-sm text-mute">
          Elle vous représentera dans Sikaloc, et dans l’espace que vos locataires
          auront bientôt. Une photo claire de votre visage, vous seul dessus.
        </p>
      </div>

      {etat.erreur ? <Alerte ton="erreur">{etat.erreur}</Alerte> : null}
      {etat.succes ? <Alerte ton="succes">{etat.succes}</Alerte> : null}

      <div className="flex flex-wrap items-start gap-lg">
        {apercu ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={apercu}
            alt="Aperçu de la photo choisie"
            className="size-24 shrink-0 rounded-pill object-cover ring-1 ring-hairline"
          />
        ) : aPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/api/photo"
            alt={`Photo de profil de ${nom}`}
            className="size-24 shrink-0 rounded-pill object-cover ring-1 ring-hairline"
          />
        ) : (
          <div className="flex size-24 shrink-0 items-center justify-center rounded-pill bg-canvas-soft text-mute">
            <Upload size={22} strokeWidth={1.8} aria-hidden="true" />
          </div>
        )}

        <div className="min-w-0 flex-1 space-y-sm">
          <label className="btn btn-secondary btn-sm cursor-pointer">
            <input
              ref={champ}
              type="file"
              name="photo"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => void choisir(e.target.files?.[0])}
              className="sr-only"
            />
            {aPhoto ? 'Changer de photo' : 'Choisir une photo'}
          </label>

          {analyse ? (
            <p className="text-caption text-mute" role="status">
              Analyse de la photo…
            </p>
          ) : null}

          {verdict ? <Controles verdict={verdict} /> : null}

          {refus ? (
            <div className="rounded-md bg-warning-pale p-md">
              <p className="text-body-sm font-semibold text-warning-content">{refus.titre}</p>
              <p className="mt-xxs text-caption leading-relaxed text-warning-content">
                {refus.conseil}
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {/*
        Le bouton n'apparaît qu'une fois la photo acceptée : proposer d'envoyer
        ce qu'on vient de refuser n'aurait pas de sens.
      */}
      {verdict?.accepte ? (
        <BoutonSoumettre libelleEnCours="Enregistrement…">
          Enregistrer cette photo
        </BoutonSoumettre>
      ) : null}

      {aPhoto ? (
        <div className="border-t border-hairline pt-lg">
          <BoutonAction
            action={supprimerPhoto}
            libelle="Retirer ma photo"
            libelleEnCours="Suppression…"
            variante="secondary"
            compact
          />
          <p className="mt-xs text-caption text-mute">
            Votre avatar vous représentera de nouveau, et une nouvelle période de
            cinq jours s’ouvrira.
          </p>
        </div>
      ) : null}

      <p className="text-caption leading-relaxed text-mute-soft">
        L’analyse est faite sur votre appareil : une photo qui ne convient pas
        n’est jamais envoyée. Sikaloc ne conserve aucune donnée biométrique et ne
        vérifie pas votre identité — cette photo sert à vous représenter, rien de plus.
      </p>
    </form>
  )
}

/** Les contrôles, dans l'ordre, comme une liste qui se coche. */
function Controles({ verdict }: { verdict: Verdict }) {
  return (
    <ul className="space-y-xxs" aria-live="polite">
      {verdict.controles.map((c) => (
        <li
          key={c.cle}
          className={`flex items-center gap-xs text-caption ${
            c.ok ? 'text-positive-deep' : 'text-negative-darkest'
          }`}
        >
          {c.ok ? (
            <Check size={13} strokeWidth={2.5} aria-hidden="true" className="shrink-0" />
          ) : (
            <X size={13} strokeWidth={2.5} aria-hidden="true" className="shrink-0" />
          )}
          {c.libelle}
        </li>
      ))}
    </ul>
  )
}
