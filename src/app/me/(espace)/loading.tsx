export default function ChargementMe() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="space-y-xl py-lg">
      <div>
        <p className="text-caption font-semibold text-mute">Sikaloc Me</p>
        <p className="mt-sm text-title-lg font-semibold">Chargement de votre espace…</p>
        <p className="mt-xs text-body-sm text-mute">Nous récupérons vos informations locatives.</p>
      </div>
      <div aria-hidden="true" className="space-y-lg border-t border-hairline pt-xl motion-safe:animate-pulse">
        <div className="h-5 w-2/3 rounded bg-canvas-sage" />
        <div className="h-4 w-1/2 rounded bg-canvas-sage" />
        <div className="h-px w-full bg-hairline" />
        <div className="h-4 w-3/4 rounded bg-canvas-sage" />
        <div className="h-4 w-1/3 rounded bg-canvas-sage" />
      </div>
    </div>
  )
}
