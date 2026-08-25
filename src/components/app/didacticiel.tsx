'use client'

import {
  BellRing,
  Building2,
  FileCheck,
  LayoutDashboard,
  Receipt,
  ScrollText,
  Users,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { marquerTutorielVu } from '@/lib/actions/onboarding'

/**
 * Didacticiel d'accueil du tableau de bord.
 *
 * Il remplace les deux étapes retirées de l'onboarding : plutôt que d'exiger un
 * locataire et un bail avant d'entrer, on laisse entrer et on montre où aller.
 *
 * Une étape par écran, jamais tout d'un coup : l'assistant précédent affichait
 * quatre formulaires d'affilée, et c'est précisément ce qui le rendait pesant.
 *
 * Rendu par `createPortal` dans `document.body` — même raison que pour le menu
 * mobile : l'en-tête de l'application porte un `backdrop-blur`, qui crée un
 * bloc conteneur et piège les enfants en `position: fixed`.
 */

interface Etape {
  Icone: typeof LayoutDashboard
  titre: string
  texte: string
  lien?: { libelle: string; href: string }
}

const ETAPES: Etape[] = [
  {
    Icone: LayoutDashboard,
    titre: 'Votre tableau de bord',
    texte:
      'Il est vide pour l’instant, c’est normal. Une fois vos premiers loyers enregistrés, vous y verrez ce qui est encaissé ce mois-ci, ce qui est en retard, et depuis combien de jours.',
  },
  {
    Icone: Building2,
    titre: 'Commencez par un logement',
    texte:
      'Adresse, ville, type. C’est le point de départ : un bail se rattache toujours à un logement. Le plan gratuit en accepte deux.',
    lien: { libelle: 'Ajouter un logement', href: '/app/logements/nouveau' },
  },
  {
    Icone: Users,
    titre: 'Puis un locataire',
    texte:
      'Nom, téléphone, et son accord pour l’enregistrement de ses données. L’email est facultatif — il sert à lui envoyer ses documents.',
    lien: { libelle: 'Ajouter un locataire', href: '/app/locataires/nouveau' },
  },
  {
    Icone: ScrollText,
    titre: 'Le bail les relie',
    texte:
      'Il associe un logement à un locataire, avec le loyer, le jour d’échéance et la tolérance que vous accordez avant qu’un retard soit signalé.',
    lien: { libelle: 'Créer un bail', href: '/app/baux/nouveau' },
  },
  {
    Icone: Receipt,
    titre: 'Enregistrez les paiements',
    texte:
      'À chaque loyer reçu : le montant, la date, le mode de règlement. Vous avez cinq minutes pour corriger une erreur de saisie, puis le paiement est figé.',
    lien: { libelle: 'Enregistrer un paiement', href: '/app/paiements/nouveau' },
  },
  {
    Icone: FileCheck,
    titre: 'La quittance se génère seule',
    texte:
      'À la confirmation du paiement. Numérotée, horodatée, signée. Si le loyer n’est payé qu’en partie, c’est un reçu qui est produit, avec le solde restant écrit dessus.',
  },
  {
    Icone: BellRing,
    titre: 'Les retards remontent d’eux-mêmes',
    texte:
      'Passé l’échéance et la tolérance du bail, le loyer bascule en impayé et apparaît en haut de cette page. Vous n’avez rien à surveiller.',
  },
]

export function Didacticiel({ ouvertAuDemarrage }: { ouvertAuDemarrage: boolean }) {
  const [ouvert, setOuvert] = useState(ouvertAuDemarrage)
  const [index, setIndex] = useState(0)
  const [monte, setMonte] = useState(false)
  const panneau = useRef<HTMLDivElement>(null)

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMonte(true), [])

  const fermer = useCallback(() => {
    setOuvert(false)
    // L'enregistrement est délibérément ignoré s'il échoue : le didacticiel
    // s'ouvrirait à nouveau à la prochaine visite, ce qui est sans gravité.
    void marquerTutorielVu()
  }, [])

  // Échap ferme, et le défilement de la page est bloqué tant que le panneau est
  // ouvert : sans cela, la page glisse derrière le voile au premier geste.
  useEffect(() => {
    if (!ouvert) return

    const surTouche = (evenement: KeyboardEvent) => {
      if (evenement.key === 'Escape') fermer()
    }

    const precedent = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', surTouche)
    panneau.current?.focus()

    return () => {
      document.body.style.overflow = precedent
      document.removeEventListener('keydown', surTouche)
    }
  }, [ouvert, fermer])

  if (!monte) return null

  if (!ouvert) {
    return (
      <button
        type="button"
        onClick={() => {
          setIndex(0)
          setOuvert(true)
        }}
        className="text-body-sm font-semibold text-mute underline hover:text-ink"
      >
        Revoir la visite guidée
      </button>
    )
  }

  const etape = ETAPES[index]
  const dernier = index === ETAPES.length - 1

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-surface-dark/60 p-lg sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="didacticiel-titre"
    >
      {/* Le voile ferme au clic, comme partout ailleurs dans l'application. */}
      <button
        type="button"
        aria-label="Fermer la visite guidée"
        onClick={fermer}
        className="absolute inset-0 cursor-default"
        tabIndex={-1}
      />

      <div
        ref={panneau}
        tabIndex={-1}
        className="anim-monte relative w-full max-w-[32rem] rounded-xl bg-canvas p-xl shadow-xl outline-none"
      >
        <div className="flex items-start justify-between gap-lg">
          <p className="text-caption-uppercase uppercase text-primary">
            Visite guidée · {index + 1} sur {ETAPES.length}
          </p>
          <button
            type="button"
            onClick={fermer}
            aria-label="Fermer"
            className="btn-icon -mr-sm -mt-sm shrink-0"
          >
            <X size={18} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>

        <etape.Icone
          size={28}
          strokeWidth={1.7}
          aria-hidden="true"
          className="mt-lg text-primary"
        />

        <h2 id="didacticiel-titre" className="mt-md text-display-sm font-bold text-ink">
          {etape.titre}
        </h2>
        <p className="mt-sm text-body-md leading-relaxed text-body">{etape.texte}</p>

        {etape.lien ? (
          <Link
            href={etape.lien.href}
            onClick={fermer}
            className="lien-anime mt-lg inline-block text-body-sm font-semibold text-ink"
          >
            {etape.lien.libelle} →
          </Link>
        ) : null}

        <div className="mt-xl flex gap-xs" aria-hidden="true">
          {ETAPES.map((_, rang) => (
            <span
              key={rang}
              className={`h-1 flex-1 rounded-pill ${
                rang <= index ? 'bg-primary' : 'bg-hairline'
              }`}
            />
          ))}
        </div>

        <div className="mt-lg flex flex-wrap items-center gap-md">
          {dernier ? (
            <button type="button" onClick={fermer} className="btn btn-primary">
              J’ai compris
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIndex(index + 1)}
              className="btn btn-primary"
            >
              Suivant
            </button>
          )}

          {index > 0 ? (
            <button
              type="button"
              onClick={() => setIndex(index - 1)}
              className="btn btn-secondary"
            >
              Retour
            </button>
          ) : null}

          {!dernier ? (
            <button
              type="button"
              onClick={fermer}
              className="ml-auto text-body-sm text-mute underline hover:text-ink"
            >
              Passer
            </button>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  )
}
