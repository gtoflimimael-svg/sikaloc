'use client'

import { Menu, X } from 'lucide-react'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { MarqueSikaloc } from '@/components/ui/logo'
import { SelecteurTheme } from '@/components/ui/theme'

/**
 * Tiroir de navigation mobile de la page d'accueil.
 *
 * Décalque volontaire de `EnTeteMobile` (`src/components/app/navigation.tsx`) :
 * même géométrie (`w-[86vw] max-w-[320px]`), même voile, même gestion d'Échap
 * et du défilement. Le visiteur qui devient bailleur retrouve exactement le
 * même geste des deux côtés de l'inscription.
 *
 * Sur mobile, l'en-tête ne pouvait pas afficher les trois ancres : elles sont
 * masquées sous `md`. Restaient « Se connecter » et « Commencer », deux
 * boutons qui, à eux seuls, poussaient la barre à 447 px de large pour un
 * écran de 360 px — la page débordait horizontalement. Le tiroir récupère les
 * ancres, « Se connecter » et le sélecteur de thème ; seul « Commencer »
 * reste à l'extérieur, parce qu'un CTA rangé dans un menu n'est plus un CTA.
 *
 * ─── Pourquoi un portail, et non un simple `fixed` ───────────────────────
 *
 * Le bouton vit dans `<header className="… backdrop-blur">` (`page.tsx:133`).
 * Une valeur de `backdrop-filter` autre que `none` fait de l'élément le BLOC
 * CONTENEUR de ses descendants en `position: fixed` (CSS Filter Effects 2),
 * exactement comme `transform` ou `filter`. Rendu dans l'en-tête, le panneau
 * `fixed inset-0` se résolvait donc contre la boîte de l'en-tête : mesuré à
 * 360 × 64 px au lieu de 360 × 800 px, soit un tiroir réduit à une bande de
 * 64 px sous laquelle la page restait visible et cliquable.
 *
 * `createPortal` vers `document.body` sort le panneau de ce bloc conteneur.
 * C'est la seule correction possible sans retirer le flou de l'en-tête.
 */

/**
 * Les ancres réelles de la page — `#etapes`, et non le `#comment` du rapport,
 * qui ne correspond à aucune section.
 *
 * Rangées dans l'ordre où les sections se présentent réellement à l'écran :
 * « Comment ça marche » vient avant « Fonctionnalités » dans le document. Un
 * menu qui annonce un autre ordre que celui du défilement fait passer les
 * ancres pour des pages séparées.
 */
const LIENS = [
  { href: '#etapes', libelle: 'Comment ça marche' },
  { href: '#fonctionnalites', libelle: 'Fonctionnalités' },
  { href: '#tarifs', libelle: 'Tarifs' },
  { href: '#faq', libelle: 'Questions fréquentes' },
]

/**
 * Volontairement plus large que `a, button` : le sélecteur de thème n'expose
 * que des boutons aujourd'hui, mais un champ ajouté demain dans le tiroir
 * sortirait silencieusement du piège à focus.
 */
const FOCUSABLES = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export function MenuMobile({ connecte }: { connecte: boolean }) {
  const [ouvert, setOuvert] = useState(false)
  const [monte, setMonte] = useState(false)
  const declencheur = useRef<HTMLButtonElement>(null)
  const panneau = useRef<HTMLDivElement>(null)

  // `createPortal` exige `document`, absent au rendu serveur : attendre le
  // montage est la seule façon de savoir qu'il existe.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMonte(true), [])

  /**
   * `rendreLeFocus` distingue les deux façons de refermer.
   *
   * Échap, le voile et la croix sont des renoncements : le focus doit revenir
   * sur le bouton qui a ouvert le tiroir, là où l'utilisateur l'avait laissé.
   * Un clic sur une ancre est une navigation : y ramener le focus obligerait
   * à retraverser tout l'en-tête pour atteindre la section qu'on vient de
   * demander. On laisse alors le focus suivre le lien.
   */
  const fermer = useCallback((rendreLeFocus: boolean) => {
    setOuvert(false)
    if (rendreLeFocus) declencheur.current?.focus()
  }, [])

  // Un tiroir ouvert ne doit pas laisser la page défiler derrière lui. On
  // restaure la valeur précédente plutôt que la chaîne vide : rien ne garantit
  // que le body n'avait pas déjà un `overflow` posé par un autre composant.
  useEffect(() => {
    if (!ouvert) return
    const precedent = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = precedent
    }
  }, [ouvert])

  /**
   * Au-delà de `lg`, l’en-tête de bureau reprend tout et le tiroir passe en
   * `display: none` — mais le verrou de défilement, lui, resterait posé. Une
   * simple rotation de téléphone en mode paysage figeait alors la page : plus
   * de molette, plus de bouton visible pour refermer. On referme donc au
   * franchissement du seuil. Sans restitution du focus : à cette largeur, le
   * déclencheur est masqué, et `focus()` sur un élément masqué ne fait rien.
   */
  useEffect(() => {
    if (!ouvert) return
    const requete = window.matchMedia('(min-width: 1024px)')
    function surSeuil() {
      if (requete.matches) setOuvert(false)
    }
    surSeuil()
    requete.addEventListener('change', surSeuil)
    return () => requete.removeEventListener('change', surSeuil)
  }, [ouvert])

  /**
   * Échap referme, Tab reste enfermé.
   *
   * L'écouteur est posé sur le `document` et non sur le panneau : si le focus
   * s'échappe malgré tout — clic sur une zone non focalisable, `activeElement`
   * retombé sur `<body>` —, un gestionnaire attaché au panneau ne recevrait
   * plus rien et la tabulation repartirait dans la page masquée.
   */
  useEffect(() => {
    if (!ouvert) return

    function surTouche(evenement: KeyboardEvent) {
      if (evenement.key === 'Escape') {
        evenement.preventDefault()
        fermer(true)
        return
      }
      if (evenement.key !== 'Tab') return

      const boite = panneau.current
      if (!boite) return

      // Relu à chaque frappe : le contenu du tiroir peut changer entre-temps.
      // `getClientRects()` écarte ce qui est masqué — un `focus()` sur un
      // élément invisible échoue en silence et laisse le piège grand ouvert.
      const cibles = Array.from(
        boite.querySelectorAll<HTMLElement>(FOCUSABLES),
      ).filter((element) => element.getClientRects().length > 0)

      if (cibles.length === 0) {
        evenement.preventDefault()
        boite.focus()
        return
      }

      const premier = cibles[0]
      const dernier = cibles[cibles.length - 1]
      const actif = document.activeElement

      if (!boite.contains(actif)) {
        evenement.preventDefault()
        ;(evenement.shiftKey ? dernier : premier).focus()
        return
      }
      if (evenement.shiftKey && actif === premier) {
        evenement.preventDefault()
        dernier.focus()
      } else if (!evenement.shiftKey && actif === dernier) {
        evenement.preventDefault()
        premier.focus()
      }
    }

    document.addEventListener('keydown', surTouche)
    return () => document.removeEventListener('keydown', surTouche)
  }, [ouvert, fermer])

  /**
   * Le focus entre sur le panneau lui-même, pas sur la croix : avec
   * `role="dialog"` et `aria-modal`, c'est ce qui fait annoncer « Menu,
   * dialogue » au lecteur d'écran avant d'énumérer les liens.
   *
   * Cet effet ne s'exécute qu'à l'ouverture. La restitution du focus est
   * confiée à `fermer()`, et non à la branche `else` d'un effet : celle-ci se
   * déclencherait aussi au premier montage, `ouvert` valant alors `false` —
   * le bouton hamburger volait le focus dès l'hydratation de la page.
   */
  useEffect(() => {
    if (ouvert) panneau.current?.focus()
  }, [ouvert])

  return (
    <>
      <button
        ref={declencheur}
        type="button"
        onClick={() => setOuvert(true)}
        className="btn-icon lg:hidden"
        aria-label="Ouvrir le menu"
        aria-haspopup="dialog"
        aria-expanded={ouvert}
        aria-controls="menu-mobile-accueil"
      >
        <Menu size={20} strokeWidth={2} aria-hidden="true" />
      </button>

      {monte && ouvert
        ? createPortal(
            /*
              `z-[60]` et non `z-50` : l'en-tête collant est lui-même à `z-50`
              (`page.tsx:133`). À égalité, seul l'ordre du DOM tranche — et le
              portail, greffé sur `<body>`, n'a plus de position stable par
              rapport à l'en-tête. On tranche explicitement.
            */
            <div className="fixed inset-0 z-[60] lg:hidden">
              {/*
                Le voile est décoratif : `aria-hidden` et pas de `tabindex`.
                En faire un `<button>` plein écran, comme le voulait le
                rapport, insère une cible invisible de 360 × 800 px dans
                l'ordre de tabulation et duplique le libellé « Fermer le
                menu » déjà porté par la croix. Échap et la croix suffisent au
                clavier ; le voile ne sert que la souris et le doigt.
              */}
              <div
                aria-hidden="true"
                onClick={() => fermer(true)}
                className="anim-apparait absolute inset-0 bg-surface-dark/60"
              />

              {/*
                `h-full` sur un parent en `inset-0` plutôt que `h-screen` :
                `100vh` se mesure sur le grand viewport, barre d'adresse
                rétractée comprise, et déborde donc du visible sur iOS comme
                sur Android. Un parent en `position: fixed`, lui, suit le
                viewport réel. `overscroll-contain` empêche le défilement du
                tiroir de se propager à la page une fois arrivé en butée.
              */}
              <div
                ref={panneau}
                id="menu-mobile-accueil"
                role="dialog"
                aria-modal="true"
                aria-label="Menu"
                tabIndex={-1}
                className="anim-glisse-droite relative ml-auto flex h-full w-[86vw] max-w-[320px] flex-col overflow-y-auto overscroll-contain bg-canvas p-lg outline-none"
              >
                <div className="mb-lg flex items-center justify-between">
                  <MarqueSikaloc href={null} taille="sm" />
                  <button
                    type="button"
                    onClick={() => fermer(true)}
                    className="btn-icon"
                    aria-label="Fermer le menu"
                  >
                    <X size={18} strokeWidth={2} aria-hidden="true" />
                  </button>
                </div>

                <nav aria-label="Navigation principale">
                  <ul className="flex flex-col">
                    {LIENS.map((lien) => (
                      <li key={lien.href}>
                        <Link
                          href={lien.href}
                          onClick={() => fermer(false)}
                          className="block border-b border-hairline py-md text-body-lg font-medium text-ink transition-colors hover:text-primary"
                        >
                          {lien.libelle}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>

                <div className="mt-auto space-y-lg pt-xl">
                  <Link
                    href={connecte ? '/app' : '/connexion'}
                    onClick={() => fermer(false)}
                    className="btn btn-secondary w-full"
                  >
                    {connecte ? 'Mon tableau de bord' : 'Se connecter'}
                  </Link>

                  <SelecteurTheme />
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
