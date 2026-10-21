export default function ChargementMe() {
  return (
    <div role="status" aria-live="polite" className="space-y-lg">
      <div className="rounded-xl bg-surface-dark p-xl text-on-dark">
        <p className="text-caption font-semibold uppercase tracking-[.12em] text-primary">Sikaloc Me</p>
        <p className="mt-sm text-title-lg font-semibold">Chargement de votre espace…</p>
        <p className="mt-xs text-body-sm text-on-dark-mute">Nous récupérons vos informations locatives.</p>
      </div>
      <div aria-hidden="true" className="card space-y-md motion-safe:animate-pulse"><div className="h-5 w-2/3 rounded bg-canvas-sage" /><div className="h-4 w-1/2 rounded bg-canvas-sage" /><div className="h-20 rounded bg-canvas-sage" /></div>
    </div>
  )
}
