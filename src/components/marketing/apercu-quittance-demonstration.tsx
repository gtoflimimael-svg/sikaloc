/**
 * L'aperçu intègre directement le PDF public rendu par le générateur utilisé
 * pour les documents réels. La route PDF porte les données fictives et le
 * marquage de démonstration ; aucune copie HTML du document ne peut diverger.
 */
export function ApercuQuittanceDemonstration() {
  return (
    <div className="home-document-stage">
      <iframe
        className="home-document-pdf"
        src="/exemple-quittance#view=FitH"
        title="Exemple de quittance Sikaloc — document fictif sans valeur justificative"
        loading="lazy"
      />
      <a className="home-document-open" href="/exemple-quittance" target="_blank" rel="noreferrer">
        Ouvrir le PDF en pleine page
      </a>
    </div>
  )
}
