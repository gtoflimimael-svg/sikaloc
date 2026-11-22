// Configuration Supabase de la pile E2E, dérivée de `supabase/config.toml`.
// Isolée ici pour être testée (tests/e2e-garde.test.mjs).

export function configurationE2E(source) {
  let config = source
    .replace(/^project_id = ".*"$/m, 'project_id = "sikaloc-e2e"')
    // Tous les ports 543xx de la pile locale deviennent 553xx, commentaires compris.
    .replace(/\b543(\d\d)\b/g, '553$1')
  // Désactive l'envoi SMTP réel et le seed de développement, section par section.
  config = config.replace(/(\[auth\.email\.smtp\][^[]*?)enabled = true/, '$1enabled = false')
  config = config.replace(/(\[db\.seed\][^[]*?)enabled = true/, '$1enabled = false')
  return config
}
