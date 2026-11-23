# Sikaloc — matrice des pages actives

**État au 22 novembre 2026.** Une ligne par `page.tsx` actif ; `tests/route-coverage.test.mjs`
échoue si une route est ajoutée ou retirée sans mise à jour de ce tableau. L'état général du
projet est dans [`ETAT-SIKALOC.md`](ETAT-SIKALOC.md).

**Colonnes.** V = la page s'affiche (statut 200, un seul `h1`, sans erreur affichée, sans
débordement). F = un parcours fonctionnel a été joué sur cette page. S = un essai
d'autorisation a été joué (accès anonyme, autre compte ou autre rôle).

**Preuves.**
- **E2E** : `tests/e2e/parcours.e2e.mjs`, rejoué par la CI (`bout-en-bout`) à chaque PR, sur une
  pile Supabase jetable.
- **R** : recette locale du 22/11/2026 sur la pile de démonstration, comptes Pro et Me, ordinateur
  et, pour les pages principales, mobile (75 contrôles, 0 échec).
- **NV** : non vérifié dans un navigateur. Ce n'est pas un défaut constaté.

Aucune de ces preuves ne porte encore sur un environnement hébergé : la recette sur
Sikaloc-Test est une réserve ouverte.

| Zone | Route | V | F | S | Réserve restante |
|---|---|---|---|---|---|
| Public | `/` | NV | NV | — | En-tête CSP à nonce vérifié (E2E) ; rendu non rejoué depuis le lot 4 |
| Public | `/pro` | NV | NV | — | Présentation de l'offre |
| Public | `/questions` | NV | NV | — | Envoi d'une question non rejoué |
| Auth | `/questions/gestion` | NV | NV | NV | Accès réservé aux UUID de `SIKALOC_QUESTIONS_ADMIN_IDS` non rejoué |
| Public | `/blog` | NV | — | — | En-tête CSP à nonce vérifié (E2E) |
| Public | `/blog/[slug]` | NV | — | — | |
| Public | `/guide/confirmer` | NV | NV | — | |
| Public | `/guide/desinscription` | NV | NV | — | |
| Public | `/legal/conditions` | NV | — | — | Validation juridique formelle en attente |
| Public | `/legal/confidentialite` | NV | — | — | Validation juridique formelle en attente |
| Public | `/legal/mentions` | — | — | — | Répond 404 tant que l'éditeur n'est pas renseigné (LEG-01) |
| Auth | `/connexion` | E2E | E2E | E2E | Connexion de chaque rôle ; blocage après 5 échecs |
| Auth | `/entrer` | R | NV | — | Aiguillage d'un compte à double rôle non rejoué |
| Auth | `/inscription` | NV | NV | — | En-tête CSP vérifié (E2E) ; création de compte par le formulaire non rejouée |
| Auth | `/mot-de-passe-oublie` | NV | NV | — | Envoi d'email non déclenché |
| Auth | `/reinitialiser-mot-de-passe` | NV | NV | — | Jeton réel non testé |
| Auth | `/verification` | NV | NV | — | Code OTP réel non rejoué |
| Auth | `/verification/reussie` | NV | — | — | |
| Me | `/me` | E2E, R | E2E | E2E | Espace Pro fermé au locataire |
| Me | `/me/bail` | E2E, R | — | E2E | |
| Me | `/me/loyers` | E2E, R | — | E2E | |
| Me | `/me/paiements` | E2E, R | E2E | E2E | Téléchargement de la quittance par le locataire |
| Me | `/me/preferences` | E2E, R | NV | E2E | Enregistrement des préférences non rejoué |
| Me | `/me/rejoindre` | NV | NV | — | Invitation acceptée par la RPC dans les données de test, pas par la page |
| Me | `/me/invitation/[jeton]` | NV | NV | NV | Jetons valides et expirés non rejoués dans le navigateur |
| Pro | `/pro/tableau-de-bord` | E2E, R | — | E2E | Accès anonyme renvoyé vers la connexion |
| Pro | `/pro/impayes` | E2E, R | NV | — | Relance WhatsApp non déclenchée |
| Pro | `/pro/logements` | E2E, R | — | — | |
| Pro | `/pro/logements/nouveau` | R | NV | — | Création non rejouée |
| Pro | `/pro/logements/[id]/modifier` | R | NV | — | Modification non rejouée |
| Pro | `/pro/locataires` | E2E, R | — | — | |
| Pro | `/pro/locataires/nouveau` | R | NV | — | Création non rejouée |
| Pro | `/pro/locataires/[id]/modifier` | R | NV | — | Modification non rejouée |
| Pro | `/pro/baux` | E2E, R | — | — | |
| Pro | `/pro/baux/nouveau` | R | NV | — | Création non rejouée |
| Pro | `/pro/baux/[id]` | E2E, R | — | E2E | Bail d'un autre bailleur introuvable |
| Pro | `/pro/baux/[id]/modifier` | R | NV | — | Changement de loyer non rejoué dans le navigateur |
| Pro | `/pro/baux/[id]/historique` | R | — | — | |
| Pro | `/pro/paiements` | E2E, R | — | E2E | Accès anonyme renvoyé vers la connexion |
| Pro | `/pro/paiements/nouveau` | E2E, R | E2E | — | Saisie ; une saisie répétée reprend le même brouillon |
| Pro | `/pro/paiements/[id]/modifier` | NV | NV | — | Correction dans la fenêtre de 5 minutes non rejouée |
| Pro | `/pro/paiements/[id]/confirmer` | E2E | E2E | — | Récapitulatif fidèle au document émis |
| Pro | `/pro/paiements/[id]/confirmer/signature` | E2E | E2E | — | Signature puis émission en un clic |
| Pro | `/pro/quittances/[id]` | E2E, R | E2E | E2E | PDF valide ; PDF refusé sans session (401) |
| Pro | `/pro/onboarding` | NV | NV | — | Couvert par des tests statiques seulement |
| Pro | `/pro/parametres` | E2E, R | — | — | |
| Pro | `/pro/parametres/profil` | E2E, R | NV | — | Enregistrement non rejoué |
| Pro | `/pro/parametres/preferences` | R | NV | — | Enregistrement non rejoué |
| Pro | `/pro/parametres/signature` | E2E, R | NV | — | Signature déposée pendant le paiement (E2E), pas depuis cette page |
| Pro | `/pro/parametres/abonnement` | E2E, R | E2E | — | FedaPay simulé : un seul crédit, rejeux et fausses signatures sans effet ; FedaPay réel non essayé |
| Pro | `/pro/parametres/parrainage` | R | NV | — | Crédits de parrainage non rejoués |
| Pro | `/pro/parametres/donnees` | E2E, R | NV | — | Export non rejoué |

Total : 52 routes (18 publiques ou d'authentification, 7 Me, 27 Pro). Les routes Find, les
candidatures et les annonces Pro ont été retirées du code actif le 9 novembre 2026 ; leurs données
et objets SQL restent conservés (SEC-09). L'historique d'octobre de cette matrice est dans
[`docs/archives/2026-10/`](docs/archives/2026-10/README.md).
