'use client'

import { Monitor, Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'

export type Theme = 'clair' | 'sombre' | 'systeme'

const CLE = 'sikaloc-theme'

/**
 * Script injecté avant le premier rendu : il pose `data-theme` sur <html> avant
 * que le navigateur ne peigne. Sans lui, un utilisateur en mode nuit verrait un
 * éclair blanc à chaque chargement.
 *
 * Volontairement minuscule et sans dépendance — il s'exécute en bloquant.
 */
export const SCRIPT_ANTI_FLASH = `(function(){try{var t=localStorage.getItem('${CLE}');if(t==='clair'||t==='sombre'){document.documentElement.setAttribute('data-theme',t)}}catch(e){}})()`

function lire(): Theme {
  if (typeof window === 'undefined') return 'systeme'
  const t = window.localStorage.getItem(CLE)
  return t === 'clair' || t === 'sombre' ? t : 'systeme'
}

function appliquer(theme: Theme) {
  const racine = document.documentElement
  if (theme === 'systeme') {
    racine.removeAttribute('data-theme')
    window.localStorage.removeItem(CLE)
  } else {
    racine.setAttribute('data-theme', theme)
    window.localStorage.setItem(CLE, theme)
  }
}

const OPTIONS: { valeur: Theme; libelle: string; Icone: typeof Sun }[] = [
  { valeur: 'clair', libelle: 'Clair', Icone: Sun },
  { valeur: 'sombre', libelle: 'Nuit', Icone: Moon },
  { valeur: 'systeme', libelle: 'Système', Icone: Monitor },
]

/** Sélecteur à trois états — clair, nuit, et « suivre le système ». */
export function SelecteurTheme({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<Theme>('systeme')
  const [monte, setMonte] = useState(false)

  // Le thème n'est connu qu'au client : tant qu'on n'est pas monté, on rend
  // l'état neutre pour éviter une divergence d'hydratation.
  useEffect(() => {
    setTheme(lire())
    setMonte(true)
  }, [])

  function choisir(t: Theme) {
    setTheme(t)
    appliquer(t)
  }

  return (
    <div
      role="group"
      aria-label="Thème de l'interface"
      className="inline-flex items-center gap-xxs rounded-pill border border-hairline bg-canvas p-xxs"
    >
      {OPTIONS.map(({ valeur, libelle, Icone }) => {
        const actif = monte && theme === valeur
        return (
          <button
            key={valeur}
            type="button"
            onClick={() => choisir(valeur)}
            aria-pressed={actif}
            title={libelle}
            className={`inline-flex items-center gap-xs rounded-pill px-sm py-xxs text-caption font-medium transition-colors ${
              actif ? 'bg-surface-card text-ink' : 'text-mute hover:text-ink'
            }`}
          >
            <Icone size={15} strokeWidth={2} aria-hidden="true" />
            {!compact && <span>{libelle}</span>}
          </button>
        )
      })}
    </div>
  )
}
