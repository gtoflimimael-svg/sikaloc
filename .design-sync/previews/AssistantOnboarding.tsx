import { AssistantOnboarding } from 'sikaloc-mvp'

export function PremiereEtape() {
  return (
    <AssistantOnboarding
      nomBailleur="Comlan Houngbédji"
      telephoneBailleur="+229 97 12 34 56"
      emailBailleur="comlan@exemple.bj"
      nbLogementsDeclare={9}
    />
  )
}
