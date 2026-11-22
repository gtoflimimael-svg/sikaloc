import { MarqueSikaloc } from '@/components/ui/logo'

/**
 * Affiché pendant que le serveur détermine l'espace de destination, juste
 * après la connexion. Remplace l'écran vide observé en recette (UX-03).
 */
export default function ChargementEntrer() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-canvas-soft px-lg py-3xl">
      <div role="status" aria-live="polite" aria-busy="true" className="flex flex-col items-center text-center">
        <MarqueSikaloc />
        <p className="mt-xl text-title-lg font-semibold text-ink">Ouverture de votre espace…</p>
        <p className="mt-xs text-body-sm text-mute">Un instant, nous préparons votre tableau de bord.</p>
        <div aria-hidden="true" className="mt-xl h-1 w-40 overflow-hidden rounded-full bg-canvas-sage">
          <div className="h-full w-1/3 rounded-full bg-ink-deep motion-safe:animate-pulse" />
        </div>
      </div>
    </main>
  )
}
