'use client'

import { Check, ChevronDown, PartyPopper, X } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { quitterVisite, terminerVisite } from '@/lib/actions/visite'
import {
  A_EXPLORER,
  ETAPES,
  ETAPE_FINALE,
  type AvancementVisite,
  type Etape,
} from '@/lib/visite/etapes'

/**
 * Visite guidée interactive.
 *
 * ─── Elle n'est PAS modale, et c'est tout le sujet ──────────────────────────
 *
 * Le didacticiel qu'elle remplace posait un `role="dialog" aria-modal="true"`
 * en `fixed inset-0`, qui captait tous les clics du viewport — y compris dans
 * le trou du halo. L'élément « éclairé » n'était donc pas cliquable, ce qui
 * rendait mécaniquement impossible un tutoriel attendant une vraie action.
 *
 * Ici la racine est `pointer-events-none` et seule la bulle réactive les
 * événements. Conséquences voulues, toutes :
 *   • la cible se clique ;
 *   • tout le reste de Sikaloc aussi — la visite n'interdit jamais rien ;
 *   • aucun piège à focus n'est nécessaire, puisque rien n'est piégé. Tab
 *     circule normalement dans la page, ce qu'un `aria-modal` interdirait.
 *
 * Le voile assombri n'est donc qu'un repère visuel, jamais une barrière.
 *
 * ─── Elle est pilotée par les données, pas par un curseur ───────────────────
 *
 * `avancement` vient du serveur, calculé sur les compteurs réels du bailleur.
 * Le composant ne décide pas de l'étape courante : il l'affiche. Quand une
 * action aboutit, le layout se re-rend avec de nouveaux compteurs, et l'étape
 * avance d'elle-même.
 *
 * C'est ce qui règle d'un coup la reprise après rafraîchissement, la navigation
 * manuelle, l'ordre inattendu et le changement d'appareil : il n'y a aucun état
 * local à perdre.
 */

/** Marge entre le halo et le bord de l'élément éclairé. */
const HALO = 8
/** Distance entre le halo et la bulle. */
const ECART = 14
/** En deçà, la bulle s'ancre en bas d'écran plutôt qu'à côté de la cible. */
const SEUIL_ETROIT = 640

interface Position {
  halo: { haut: number; gauche: number; largeur: number; hauteur: number } | null
  bulle: { haut: number; gauche: number } | null
}

/**
 * La cible visible, parmi les homonymes.
 *
 * `LiensNavigation` est rendu deux fois — barre latérale de bureau et tiroir
 * mobile — avec les mêmes valeurs `data-visite`. Un `querySelector` simple
 * renvoie toujours la première du DOM, c'est-à-dire l'aside masqué sous 1024 px.
 * On parcourt donc tous les homonymes et on retient celui qui est réellement à
 * l'écran.
 */
function cibleVisible(cle: string | undefined): HTMLElement | null {
  if (!cle) return null

  for (const noeud of document.querySelectorAll<HTMLElement>(`[data-visite="${cle}"]`)) {
    if (noeud.offsetParent !== null) return noeud
  }

  return null
}

export function VisiteGuidee({
  avancement,
  ouvertAuDemarrage,
}: {
  avancement: AvancementVisite
  ouvertAuDemarrage: boolean
}) {
  const [ouvert, setOuvert] = useState(false)
  const [demarrageConnu, setDemarrageConnu] = useState(false)
  const [reduit, setReduit] = useState(false)
  const [monte, setMonte] = useState(false)
  const [position, setPosition] = useState<Position>({ halo: null, bulle: null })
  const [lisere, setLisere] = useState<Position['halo']>(null)
  const [felicite, setFelicite] = useState(false)
  const [champCourant, setChampCourant] = useState<string | null>(null)
  const [remplis, setRemplis] = useState<string[]>([])
  const bulle = useRef<HTMLDivElement>(null)
  const indexPrecedent = useRef(avancement.index)
  const chemin = usePathname()

  /**
   * Demande explicite de rejouer, posée par `reprendreVisite()`.
   *
   * Elle passe outre l'ouverture automatique, qui refuse — à raison — d'ouvrir
   * un parcours déjà complet. Ne pas s'imposer et refuser une demande sont deux
   * choses différentes.
   */
  const rejeuDemande = useSearchParams().get('visite') === '1'
  const doitOuvrir = ouvertAuDemarrage || rejeuDemande

  // `createPortal` exige `document`, absent au rendu serveur.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMonte(true), [])

  /**
   * Rouvrir quand le serveur le redemande.
   *
   * `useState(ouvertAuDemarrage)` ne lit sa valeur initiale qu'au montage. Après
   * « Reprendre la visite guidée », `reprendreVisite()` efface les deux dates et
   * revalide le layout : la prop repasse à `true`, mais le composant n'est pas
   * remonté et son état local restait à `false` — la visite ne se rouvrait pas.
   * Le banc l'a pris.
   *
   * Ajustement d'état pendant le rendu, et non dans un effet : c'est le motif
   * que React recommande pour une valeur dérivée d'une prop, et il évite le
   * rendu supplémentaire qu'un `useEffect` provoquerait.
   */
  if (doitOuvrir !== demarrageConnu) {
    setDemarrageConnu(doitOuvrir)
    if (doitOuvrir) {
      setOuvert(true)
      setReduit(false)
    }
  }

  const termine = avancement.complet
  const etape = termine ? null : ETAPES[avancement.index]

  /**
   * Sommes-nous déjà sur la page où l'action se fait ?
   *
   * Alors désigner l'entrée de menu qui a mené ici n'apprend plus rien — et la
   * bulle posée à côté d'elle recouvre le formulaire. Le banc l'a prise en
   * flagrant délit sur le bouton « Créer le logement », qui devenait
   * inaccessible : exactement ce qu'une visite ne doit jamais faire.
   *
   * Sur ces routes, on lâche le halo et on s'écarte dans un coin.
   */
  const surPlace = Boolean(etape?.routesAction?.some((r) => chemin.startsWith(r)))

  /**
   * Retour immédiat quand une étape vient d'être franchie.
   *
   * `avancement` est recalculé par le serveur : sa progression est la preuve
   * que l'action a réellement abouti, pas qu'un formulaire a été soumis.
   */
  useEffect(() => {
    if (avancement.index > indexPrecedent.current) {
      setFelicite(true)
      setReduit(false)
      const minuterie = setTimeout(() => setFelicite(false), 2600)
      indexPrecedent.current = avancement.index
      return () => clearTimeout(minuterie)
    }
    indexPrecedent.current = avancement.index
  }, [avancement.index])

  /**
   * Accompagnement dans le formulaire.
   *
   * On désigne le champ sur lequel l'utilisateur travaille — celui qui a le
   * focus, sinon le premier encore vide — et on coche ceux qui sont faits.
   *
   * Aucun voile sombre ici, contrairement au reste de la visite : assombrir un
   * formulaire qu'on est en train de lire ne l'éclaire pas, ça le gêne. Un
   * simple liseré sur le champ courant suffit.
   */
  useEffect(() => {
    if (!ouvert || !monte || !surPlace || !etape?.champs) return

    const relever = () => {
      const formulaire = document.querySelector('form')
      if (!formulaire) return

      const valeur = (nom: string) => {
        const champ = formulaire.elements.namedItem(nom) as HTMLInputElement | null
        if (!champ) return null
        return champ.type === 'checkbox' ? (champ.checked ? 'oui' : '') : champ.value.trim()
      }

      const faits = etape.champs!.filter((c) => valeur(c.nom)).map((c) => c.nom)
      setRemplis(faits)

      // Le champ qui a le focus prime : c'est celui que l'utilisateur regarde.
      const actif = document.activeElement as HTMLElement | null
      const nomActif = actif?.getAttribute('name')
      const suivi =
        nomActif && etape.champs!.some((c) => c.nom === nomActif)
          ? nomActif
          : (etape.champs!.find((c) => !faits.includes(c.nom))?.nom ?? null)

      setChampCourant(suivi)
    }

    relever()
    document.addEventListener('focusin', relever)
    document.addEventListener('input', relever)
    document.addEventListener('change', relever)

    return () => {
      document.removeEventListener('focusin', relever)
      document.removeEventListener('input', relever)
      document.removeEventListener('change', relever)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvert, monte, surPlace, etape?.cle, chemin])

  /**
   * Liseré sur le champ courant.
   *
   * Séparé du halo principal : il ne porte pas d'assombrissement, et il suit un
   * champ de formulaire plutôt qu'une entrée de menu.
   */
  useLayoutEffect(() => {
    // Rien à mesurer : le rendu se garde lui-même sur `champCourant`, inutile
    // d'effacer un état que personne ne lira.
    if (!ouvert || !monte || !surPlace || !champCourant) return

    const placer = () => {
      const formulaire = document.querySelector('form')
      const champ = formulaire?.elements.namedItem(champCourant) as HTMLElement | null
      if (!champ || champ.offsetParent === null) {
        setLisere(null)
        return
      }

      // Le libellé et l'aide vivent au-dessus et en dessous du champ : on cadre
      // le bloc entier plutôt que la seule boîte de saisie.
      const bloc = champ.closest('div') ?? champ
      const zone = bloc.getBoundingClientRect()
      setLisere({
        haut: zone.top - 6,
        gauche: zone.left - 6,
        largeur: zone.width + 12,
        hauteur: zone.height + 12,
      })
    }

    placer()
    window.addEventListener('resize', placer)
    window.addEventListener('scroll', placer, true)
    return () => {
      window.removeEventListener('resize', placer)
      window.removeEventListener('scroll', placer, true)
    }
  }, [ouvert, monte, surPlace, champCourant, chemin])

  /**
   * Place le halo sur la cible et la bulle à côté.
   *
   * En `useLayoutEffect` : mesurer après peinture ferait sauter la bulle d'un
   * coin de l'écran à sa place à chaque changement d'étape ou de page.
   */
  useLayoutEffect(() => {
    if (!ouvert || !monte || reduit) return

    // Sur la page de l'action : aucune mesure, aucune mise en vue forcée. La
    // visite accompagne, elle ne pilote plus. Le rendu ignore `position` dans
    // ce cas — inutile de l'effacer, et un `setState` dans un effet n'aurait
    // servi qu'à provoquer un second rendu.
    if (surPlace) return

    const placer = () => {
      const cible = cibleVisible(etape?.cible)

      // Cible absente de cet écran : on centre plutôt que de pointer dans le
      // vide. L'étape n'est jamais sautée pour autant.
      if (!cible) {
        setPosition({ halo: null, bulle: null })
        return
      }

      const zone = cible.getBoundingClientRect()
      const hauteurBulle = bulle.current?.offsetHeight ?? 260
      const largeurBulle = bulle.current?.offsetWidth ?? 360

      const halo = {
        haut: zone.top - HALO,
        gauche: zone.left - HALO,
        largeur: zone.width + HALO * 2,
        hauteur: zone.height + HALO * 2,
      }

      // Sur écran étroit, se coller à la cible produit une bulle à cheval sur
      // le bord. On l'ancre en bas, comme une feuille, et le halo suffit à
      // désigner l'élément.
      if (window.innerWidth < SEUIL_ETROIT) {
        setPosition({ halo, bulle: null })
        return
      }

      // À droite si la place existe, sinon dessous, sinon au-dessus. Le
      // résultat est ensuite ramené dans la fenêtre.
      let haut = zone.top
      let gauche = zone.right + ECART

      if (gauche + largeurBulle > window.innerWidth - 12) {
        gauche = zone.left
        haut = zone.bottom + ECART

        if (haut + hauteurBulle > window.innerHeight - 12) {
          haut = zone.top - hauteurBulle - ECART
        }
      }

      setPosition({
        halo,
        bulle: {
          haut: Math.max(12, Math.min(haut, window.innerHeight - hauteurBulle - 12)),
          gauche: Math.max(12, Math.min(gauche, window.innerWidth - largeurBulle - 12)),
        },
      })
    }

    placer()

    // La page n'est PAS verrouillée en défilement : la visite n'empêche rien.
    // On suit donc le défilement au lieu de l'interdire, et on amène la cible
    // à l'écran si elle n'y est pas.
    cibleVisible(etape?.cible)?.scrollIntoView({ block: 'center', behavior: 'smooth' })

    window.addEventListener('resize', placer)
    window.addEventListener('scroll', placer, true)
    // Rattrape le chargement des polices et les transitions de page.
    const rattrapage = setTimeout(placer, 160)

    return () => {
      window.removeEventListener('resize', placer)
      window.removeEventListener('scroll', placer, true)
      clearTimeout(rattrapage)
    }
  }, [ouvert, monte, reduit, surPlace, etape?.cible, chemin, avancement.index])

  const quitter = useCallback(() => {
    setOuvert(false)
    void quitterVisite()
  }, [])

  const terminer = useCallback(() => {
    setOuvert(false)
    void terminerVisite()
  }, [])

  if (!monte || !ouvert) return null

  // Sur place : coin bas-gauche sur grand écran — au-dessus de la barre
  // latérale, qui ne porte que des liens — et bande basse sur mobile, où elle
  // est masquée. Jamais au centre : c'est là que vivent les formulaires.
  const centree = !surPlace && position.halo === null
  const ancreeEnBas = position.halo !== null && position.bulle === null

  return createPortal(
    <div
      // `pointer-events-none` : rien ici n'intercepte un clic, sauf la bulle.
      // C'est ce qui rend la cible cliquable et l'application utilisable.
      className="pointer-events-none fixed inset-0 z-[90]"
      role="region"
      aria-label="Visite guidée"
    >
      {/*
        L'assombrissement vient d'une ombre portée démesurée autour du halo :
        un seul élément, aucun masque SVG, et le trou reste net quelle que soit
        la forme de la cible.
      */}
      {!surPlace && position.halo ? (
        <div
          aria-hidden="true"
          className="absolute rounded-lg transition-all duration-200"
          style={{
            top: position.halo.haut,
            left: position.halo.gauche,
            width: position.halo.largeur,
            height: position.halo.hauteur,
            boxShadow: '0 0 0 9999px rgb(21 21 24 / 0.55)',
            outline: '2px solid var(--color-primary)',
            outlineOffset: '-1px',
          }}
        />
      ) : surPlace ? null : (
        <div aria-hidden="true" className="absolute inset-0 bg-surface-dark/45" />
      )}

      {/*
        Liseré du champ en cours de saisie. Pas d'ombre portée, donc pas
        d'assombrissement : le formulaire reste parfaitement lisible, et rien
        n'intercepte le curseur.
      */}
      {surPlace && champCourant && lisere ? (
        <div
          aria-hidden="true"
          className="absolute rounded-md transition-all duration-200"
          style={{
            top: lisere.haut,
            left: lisere.gauche,
            width: lisere.largeur,
            height: lisere.hauteur,
            outline: '2px solid var(--color-primary)',
            outlineOffset: '0px',
          }}
        />
      ) : null}

      <div
        ref={bulle}
        // `pointer-events-auto` : la bulle est le seul élément interactif de la
        // couche. Tout le reste des clics traverse vers l'application.
        className={`pointer-events-auto anim-monte w-[min(23rem,calc(100vw-1.5rem))] rounded-xl bg-canvas p-lg shadow-xl ${
          surPlace
            ? 'absolute bottom-lg left-1/2 -translate-x-1/2 lg:left-lg lg:translate-x-0'
            : centree
              ? 'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2'
              : ancreeEnBas
                ? 'absolute bottom-lg left-1/2 -translate-x-1/2'
                : 'absolute'
        }`}
        style={
          surPlace || centree || ancreeEnBas
            ? undefined
            : { top: position.bulle?.haut ?? 0, left: position.bulle?.gauche ?? 0 }
        }
      >
        {reduit ? (
          <button
            type="button"
            onClick={() => setReduit(false)}
            className="flex w-full items-center justify-between gap-md text-left"
          >
            <span className="text-body-sm font-semibold text-ink">
              Visite guidée · étape {Math.min(avancement.index + 1, ETAPES.length)} sur{' '}
              {ETAPES.length}
            </span>
            <ChevronDown size={16} strokeWidth={2} aria-hidden="true" className="rotate-180 text-mute" />
          </button>
        ) : (
          <>
            <div className="flex items-baseline justify-between gap-md">
              <p className="text-caption-uppercase uppercase text-primary">
                {termine ? 'Parcours terminé' : `Étape ${avancement.index + 1} sur ${ETAPES.length}`}
              </p>
              <div className="flex items-center gap-xs">
                <button
                  type="button"
                  onClick={() => setReduit(true)}
                  aria-label="Réduire la visite"
                  className="btn-icon -mr-xxs size-7"
                >
                  <ChevronDown size={15} strokeWidth={2} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={termine ? terminer : quitter}
                  aria-label="Fermer la visite"
                  className="btn-icon -mr-sm size-7"
                >
                  <X size={15} strokeWidth={2} aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* `aria-live` annonce le changement d'étape sans voler le focus. */}
            <div aria-live="polite">
              {felicite && !termine ? (
                <p className="anim-apparait mt-md flex items-center gap-xs text-body-sm font-semibold text-positive-deep">
                  <Check size={16} strokeWidth={2.5} aria-hidden="true" />
                  C’est fait. On continue.
                </p>
              ) : null}

              <h2 className="mt-md text-title-lg font-bold text-ink">
                {termine ? (
                  <>
                    <span aria-hidden="true">🎉 </span>
                    {ETAPE_FINALE.titre}
                  </>
                ) : (
                  etape?.titre
                )}
              </h2>
              {surPlace && etape?.champs ? null : (
                <p className="mt-sm text-body-sm leading-relaxed text-body">
                  {termine ? ETAPE_FINALE.message : etape?.message}
                </p>
              )}
            </div>

            {termine ? <AExplorer /> : null}

            {surPlace && etape?.champs ? (
              <ListeChamps
                champs={etape.champs}
                courant={champCourant}
                remplis={remplis}
              />
            ) : (
              <ListeJalons jalons={avancement.jalons} />
            )}

            <div className="mt-lg flex flex-wrap items-center gap-sm">
              {termine ? (
                <button type="button" onClick={terminer} className="btn btn-primary btn-sm">
                  <PartyPopper size={15} strokeWidth={2} aria-hidden="true" />
                  Terminer la visite
                </button>
              ) : (
                <>
                  {etape?.lien && !surPlace ? (
                    <Link
                      href={etape.lien.href}
                      className="btn btn-primary btn-sm"
                      onClick={() => setReduit(false)}
                    >
                      {etape.lien.libelle}
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    onClick={quitter}
                    className="text-caption text-mute underline hover:text-ink"
                  >
                    Quitter
                  </button>
                </>
              )}
            </div>

            {!termine ? (
              <p className="mt-sm text-caption text-mute-soft">
                Vous pourrez la reprendre depuis le tableau de bord.
              </p>
            ) : null}
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}

/**
 * Ce qu'il reste à découvrir, affiché au terme du parcours.
 *
 * Des liens, pas des promesses : chaque ligne dit ce que l'écran fait, et y
 * mène. La visite se ferme au clic — on n'accompagne plus quelqu'un qui a fini.
 */
function AExplorer() {
  return (
    <div className="mt-lg space-y-xs">
      <p className="text-caption font-semibold text-body-strong">À découvrir ensuite</p>
      {A_EXPLORER.map((piste) => (
        <Link
          key={piste.cle}
          href={piste.href}
          className="block rounded-md bg-canvas-soft p-sm transition-colors hover:bg-surface-card"
        >
          <span className="block text-caption font-semibold text-ink">{piste.libelle} →</span>
          <span className="mt-xxs block text-caption leading-relaxed text-mute">
            {piste.texte}
          </span>
        </Link>
      ))}
    </div>
  )
}

/**
 * Accompagnement du formulaire, champ par champ.
 *
 * Il remplace la liste des jalons le temps du remplissage : à cet instant, ce
 * qui importe n'est pas de savoir qu'il reste trois étapes, c'est de savoir
 * quoi écrire dans la case qu'on a sous les yeux.
 *
 * Rien n'est bloquant : les champs peuvent être remplis dans n'importe quel
 * ordre, et un champ facultatif laissé vide n'empêche jamais d'avancer.
 */
function ListeChamps({
  champs,
  courant,
  remplis,
}: {
  champs: NonNullable<Etape['champs']>
  courant: string | null
  remplis: string[]
}) {
  const aide = champs.find((c) => c.nom === courant)?.aide

  return (
    <div className="mt-lg rounded-md bg-canvas-soft p-md">
      <ul className="space-y-xxs">
        {champs.map((champ) => {
          const fait = remplis.includes(champ.nom)
          const actif = champ.nom === courant

          return (
            <li
              key={champ.nom}
              className={`flex items-center gap-xs text-caption ${
                fait ? 'text-positive-deep' : actif ? 'font-semibold text-ink' : 'text-mute-soft'
              }`}
            >
              {fait ? (
                <Check size={13} strokeWidth={2.5} aria-hidden="true" className="shrink-0" />
              ) : (
                <span
                  aria-hidden="true"
                  className={`size-2 shrink-0 rounded-pill ${
                    actif ? 'bg-primary ring-2 ring-primary-pale' : 'bg-hairline'
                  }`}
                />
              )}
              {champ.libelle}
            </li>
          )
        })}
      </ul>

      {/*
        `aria-live` : le lecteur d'écran suit le champ sans qu'on lui vole le
        focus. `data-visite` reprend la convention des repères de la visite —
        c'est par lui que le banc désigne cette aide, plutôt que par un
        sélecteur qui attraperait la première zone live venue.
      */}
      <p
        data-visite="aide-champ"
        className="mt-sm text-caption leading-relaxed text-body"
        aria-live="polite"
      >
        {aide ?? 'Tout est renseigné — vous pouvez enregistrer.'}
      </p>
    </div>
  )
}

/**
 * « Votre première location » — l'avancement, jalon par jalon.
 *
 * Pas d'emoji : le système de design n'en utilise nulle part, et leur rendu
 * varie d'un appareil à l'autre. Une pastille pleine, cerclée ou creuse dit la
 * même chose et suit les jetons de couleur.
 */
function ListeJalons({ jalons }: { jalons: AvancementVisite['jalons'] }) {
  const faits = jalons.filter((j) => j.accompli).length

  return (
    <div className="mt-lg rounded-md bg-canvas-soft p-md">
      <div className="flex items-baseline justify-between gap-sm">
        <p className="text-caption font-semibold text-body-strong">Votre première location</p>
        <p className="text-caption tabular text-mute">
          {faits}/{jalons.length}
        </p>
      </div>

      <ul className="mt-sm space-y-xxs">
        {jalons.map((jalon) => (
          <li
            key={jalon.cle}
            className={`flex items-center gap-xs text-caption ${
              jalon.accompli
                ? 'text-positive-deep'
                : jalon.courant
                  ? 'font-semibold text-ink'
                  : 'text-mute-soft'
            }`}
          >
            {/*
              L'emoji est décoratif : il double une information déjà portée par
              la couleur et par le texte alternatif qui suit. Un lecteur d'écran
              qui l'annoncerait dirait « cercle vert », ce qui n'apprend rien.
            */}
            <span aria-hidden="true" className="shrink-0 leading-none">
              {jalon.accompli ? '🟢' : jalon.courant ? '🟡' : '⚪'}
            </span>
            {jalon.libelle}
            <span className="sr-only">
              {jalon.accompli ? ' — accompli' : jalon.courant ? ' — en cours' : ' — à faire'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
