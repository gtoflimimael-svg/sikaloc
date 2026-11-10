# Sikaloc — matrice des routes actives

Base de contrôle historique au 21 octobre 2026, branche `codex/refonte-recette-finale-5` ; inventaire des routes actives actualisé le 9 novembre 2026. « Code » signifie seulement qu'un fichier `page.tsx` existe. V = inspection visuelle réelle ; F = parcours fonctionnel réel ; S = essai d'autorisation réel. `NV` signifie non vérifié, jamais PASS. Les pages authentifiées requièrent un environnement jetable avec sessions fictives ; les données de Sikaloc-Test ne sont pas présumées jetables. Cette matrice n'est pas une attestation de publication.

| Zone | Route | Code | Intervention/constat du lot 5 | V | F | S | Statut |
|---|---|---|---|---|---|---|---|
| Public | `/` | Présent | Fondations du lot 1 conservées ; parcours non rejoué | NV | NV | NV | Réserve |
| Public | `/pro` | Présent | Offre et captures à revérifier avec données de démonstration | NV | NV | NV | Réserve |
| Public | `/questions` | Présent | Formulaire public ; réception et réponse non rejouées | NV | NV | NV | Réserve |
| Auth | `/questions/gestion` | Présent | Espace interne protégé par identifiants admin explicites | NV | NV | NV | Réserve |
| Public | `/blog` | Présent | Liste conservée ; lecture non rejouée | NV | NV | NV | Réserve |
| Public | `/blog/[slug]` | Présent | Article conservé ; lecture non rejouée | NV | NV | NV | Réserve |
| Public | `/guide/confirmer` | Présent | État de confirmation non rejoué | NV | NV | NV | Réserve |
| Public | `/guide/desinscription` | Présent | Désinscription non déclenchée | NV | NV | NV | Réserve |
| Public | `/legal/conditions` | Présent | Texte juridique non remanié | NV | NV | NV | Réserve |
| Public | `/legal/confidentialite` | Présent | Texte juridique non remanié | NV | NV | NV | Réserve |
| Public | `/legal/mentions` | Présent | Texte juridique non remanié | NV | NV | NV | Réserve |
| Auth | `/connexion` | Présent | Session réelle non rejouée | NV | NV | NV | Réserve |
| Auth | `/entrer` | Présent | Orientation des rôles non rejouée | NV | NV | NV | Réserve |
| Auth | `/inscription` | Présent | Envoi email non déclenché | NV | NV | NV | Réserve |
| Auth | `/mot-de-passe-oublie` | Présent | Transport email non déclenché | NV | NV | NV | Réserve |
| Auth | `/reinitialiser-mot-de-passe` | Présent | Jeton réel non testé | NV | NV | NV | Réserve |
| Auth | `/verification` | Présent | OTP réel non rejoué | NV | NV | NV | Réserve |
| Auth | `/verification/reussie` | Présent | Écran de bienvenue après OTP | NV | NV | NV | Réserve |
| Me | `/me` | Présent | Synthèse locataire non rejouée | NV | NV | NV | Réserve |
| Me | `/me/bail` | Présent | Contrat privé non rejoué | NV | NV | NV | Réserve |
| Me | `/me/loyers` | Présent | Historique indéterminé à tester sur SQL réel | NV | NV | NV | Réserve |
| Me | `/me/paiements` | Présent | Paiements et pièces privées non rejoués | NV | NV | NV | Réserve |
| Me | `/me/preferences` | Présent | Persistance non rejouée | NV | NV | NV | Réserve |
| Me | `/me/rejoindre` | Présent | Invitation non rejouée | NV | NV | NV | Réserve |
| Me | `/me/invitation/[jeton]` | Présent | Jetons valides/expirés non rejoués | NV | NV | NV | Réserve |
| Pro | `/pro/tableau-de-bord` | Présent | Texte d'absence de retard corrigé ; KPI non comparés au SQL | NV | NV | NV | Partiel |
| Pro | `/pro/impayes` | Présent | Texte d'absence de retard corrigé ; vue SQL non exécutée | NV | NV | NV | Partiel |
| Pro | `/pro/logements` | Présent | Liste lue ; création/suppression non rejouées | NV | NV | NV | Réserve |
| Pro | `/pro/logements/nouveau` | Présent | Formulaire non rejoué | NV | NV | NV | Réserve |
| Pro | `/pro/logements/[id]/modifier` | Présent | Préremplissage et mutation non rejoués | NV | NV | NV | Réserve |
| Pro | `/pro/locataires` | Présent | Liste non rejouée | NV | NV | NV | Réserve |
| Pro | `/pro/locataires/nouveau` | Présent | Téléphone/validation non rejoués | NV | NV | NV | Réserve |
| Pro | `/pro/locataires/[id]/modifier` | Présent | Modification non rejouée | NV | NV | NV | Réserve |
| Pro | `/pro/baux` | Présent | Liste lue ; transitions non rejouées | NV | NV | NV | Réserve |
| Pro | `/pro/baux/nouveau` | Présent | Création non rejouée | NV | NV | NV | Réserve |
| Pro | `/pro/baux/[id]` | Présent | Contrat et droits non rejoués | NV | NV | NV | Réserve |
| Pro | `/pro/baux/[id]/modifier` | Présent | Loyers historisés non vérifiés en base | NV | NV | NV | Réserve |
| Pro | `/pro/baux/[id]/historique` | Présent | Audit chronologique non rejoué | NV | NV | NV | Réserve |
| Pro | `/pro/paiements` | Présent | Liste lue ; montants non confrontés à PostgreSQL | NV | NV | NV | Réserve |
| Pro | `/pro/paiements/nouveau` | Présent | Brouillon non créé | NV | NV | NV | Réserve |
| Pro | `/pro/paiements/[id]/modifier` | Présent | Correction non rejouée | NV | NV | NV | Réserve |
| Pro | `/pro/paiements/[id]/confirmer` | Présent | Confirmation/PDF non rejoués | NV | NV | NV | Réserve |
| Pro | `/pro/paiements/[id]/confirmer/signature` | Présent | Étape de signature intégrée ; recette visuelle antérieure | NV | NV | NV | Réserve |
| Pro | `/pro/quittances/[id]` | Présent | Lecture de l'autorisation inspectée ; PDF non téléchargé | NV | NV | NV | Réserve |
| Pro | `/pro/onboarding` | Présent | Activation non rejouée | NV | NV | NV | Réserve |
| Pro | `/pro/parametres` | Présent | Navigation non rejouée | NV | NV | NV | Réserve |
| Pro | `/pro/parametres/profil` | Présent | Enregistrement non rejoué | NV | NV | NV | Réserve |
| Pro | `/pro/parametres/preferences` | Présent | Préférences non rejouées | NV | NV | NV | Réserve |
| Pro | `/pro/parametres/signature` | Présent | Signature privée non rejouée | NV | NV | NV | Réserve |
| Pro | `/pro/parametres/abonnement` | Présent | Faux succès du retour sans transaction corrigé + test unitaire ; fournisseur non testé | NV | Test local | NV | Partiel |
| Pro | `/pro/parametres/parrainage` | Présent | Crédits non rejoués | NV | NV | NV | Réserve |
| Pro | `/pro/parametres/donnees` | Présent | Export non rejoué | NV | NV | NV | Réserve |

Total : 52 routes uniques dans la version active (18 publiques/Auth, 7 Me, 27 Pro). Les routes Find, les candidatures et les annonces Pro ont été retirées du code actif le 9 novembre 2026 ; leurs données et objets SQL restent conservés. Les statuts « Réserve » signalent l'absence de recette, pas un défaut démontré. Aucune inspection visuelle authentifiée des 52 pages n'a été réalisée dans ce lot ; les largeurs 320/390/768/1024/1440 restent donc non validées. Voir `REGISTRE-RESERVES.md`.

## Archive historique — consolidation visuelle locale

Branche `codex/consolidation-livraison-3`, issue de `76037c70626c078f34d661d00df047dc321d417c`. Les huit pages Pro qui affichent un état vide (tableau de bord, logements, locataires, baux, détail d'un bail, annonces, nouvelle annonce sans logement et paiements) utilisent désormais des images WebP éditoriales Sikaloc à la place du SVG Transhumans. Le bandeau du composant commun de formulaire a également été épuré. Les autres interventions mentionnées ci-dessus sont l'historique des lots précédents ; elles ne signifient pas qu'une page est visuellement ou fonctionnellement recettée.

À la demande de l'utilisateur, aucune validation technique ou visuelle n'a été exécutée pour cette consolidation. Les colonnes V/F/S demeurent **NV** pour les 58 routes. Voir `ETAT-FINAL-SIKALOC.md` pour le relevé historique page par page et `REGISTRE-RESERVES.md` pour les conditions bloquantes.

## Archive historique — audit de cohérence de l’espace Pro connecté

Branche `codex/mvp-sika-integrated`, 24 octobre 2026. Les 30 routes Pro ont été
réinventoriées dans le code. Les améliorations de cette intervention portent sur
le shell partagé (Manrope locale, largeur commune, contexte d’en-tête sans titre
dupliqué, raccourci de paiement non concurrent) et les libellés/états vides concernés.
Les illustrations 3D historiques restent disponibles aux autres expériences, mais
ne sont plus utilisées dans les états vides Pro listés ci-dessous. Cet audit source
ne vaut pas recette visuelle ou parcours métier : V/F/S restent NV jusqu’à revue
authentifiée dans le navigateur.

| Sous-route Pro | Route | État du code | Constat de cohérence | V | F | S |
|---|---|---|---|---|---|---|
| Sous-route Pro | `/pro/tableau-de-bord` | Présent | Tableau de bord existant, non redessiné dans cet addendum | NV | NV | NV |
| Sous-route Pro | `/pro/impayes` | Présent | Raccourci global de paiement masqué sur cette page | NV | NV | NV |
| Sous-route Pro | `/pro/logements` | Présent | État vide avec icône métier, visuel ancien retiré | NV | NV | NV |
| Sous-route Pro | `/pro/logements/nouveau` | Présent | Formulaire existant, revue source seulement | NV | NV | NV |
| Sous-route Pro | `/pro/logements/[id]/modifier` | Présent | Formulaire existant, revue source seulement | NV | NV | NV |
| Sous-route Pro | `/pro/locataires` | Présent | Marque Me normalisée, icône métier à l’état vide | NV | NV | NV |
| Sous-route Pro | `/pro/locataires/nouveau` | Présent | Formulaire existant, revue source seulement | NV | NV | NV |
| Sous-route Pro | `/pro/locataires/[id]/modifier` | Présent | Formulaire existant, revue source seulement | NV | NV | NV |
| Sous-route Pro | `/pro/baux` | Présent | État vide avec icône métier | NV | NV | NV |
| Sous-route Pro | `/pro/baux/nouveau` | Présent | Formulaire existant, revue source seulement | NV | NV | NV |
| Sous-route Pro | `/pro/baux/[id]` | Présent | Raccourci global masqué, état paiement avec icône métier | NV | NV | NV |
| Sous-route Pro | `/pro/baux/[id]/modifier` | Présent | Raccourci global masqué sur le détail du bail | NV | NV | NV |
| Sous-route Pro | `/pro/baux/[id]/historique` | Présent | Raccourci global masqué sur le détail du bail | NV | NV | NV |
| Sous-route Pro | `/pro/paiements` | Présent | Raccourci redondant masqué, état vide avec icône métier | NV | NV | NV |
| Sous-route Pro | `/pro/paiements/nouveau` | Présent | Raccourci redondant masqué | NV | NV | NV |
| Sous-route Pro | `/pro/paiements/[id]/modifier` | Présent | Raccourci redondant masqué | NV | NV | NV |
| Sous-route Pro | `/pro/paiements/[id]/confirmer` | Présent | Raccourci redondant masqué | NV | NV | NV |
| Sous-route Pro | `/pro/annonces` | Présent | Marque Find normalisée, icône métier à l’état vide | NV | NV | NV |
| Sous-route Pro | `/pro/annonces/nouvelle` | Présent | État vide logement avec icône métier | NV | NV | NV |
| Sous-route Pro | `/pro/annonces/[id]` | Présent | Marque Find normalisée dans les textes visibles | NV | NV | NV |
| Sous-route Pro | `/pro/annonces/[id]/candidatures` | Présent | Marque Find normalisée dans les textes visibles | NV | NV | NV |
| Sous-route Pro | `/pro/quittances/[id]` | Présent | Accès documentaire, non vérifié dans le navigateur | NV | NV | NV |
| Sous-route Pro | `/pro/parametres` | Présent | Page de paramètres existante, revue source seulement | NV | NV | NV |
| Sous-route Pro | `/pro/parametres/profil` | Présent | Page de profil existante, revue source seulement | NV | NV | NV |
| Sous-route Pro | `/pro/parametres/preferences` | Présent | Page de préférences existante, revue source seulement | NV | NV | NV |
| Sous-route Pro | `/pro/parametres/signature` | Présent | Page de signature existante, revue source seulement | NV | NV | NV |
| Sous-route Pro | `/pro/parametres/abonnement` | Présent | Page d’abonnement existante, revue source seulement | NV | NV | NV |
| Sous-route Pro | `/pro/parametres/parrainage` | Présent | Page de parrainage existante, revue source seulement | NV | NV | NV |
| Sous-route Pro | `/pro/parametres/donnees` | Présent | Page de données existante, revue source seulement | NV | NV | NV |
| Sous-route Pro | `/pro/onboarding` | Présent | Parcours existant, revue source seulement | NV | NV | NV |

Les contrôles réalisés pour cet addendum sont consignés dans le rapport de livraison ;
aucune donnée Demo n’a été modifiée.
