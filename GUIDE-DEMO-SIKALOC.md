# Guide de démonstration locale Sikaloc

Cette démonstration présente les espaces Pro, Me et Find avec un jeu de données entièrement fictif. Elle fonctionne dans le navigateur, sans compte, base ou service externe.

## Démarrer

Depuis le dossier `MVP Sika`, ouvrez un terminal et lancez :

```bash
SIKALOC_DEMO_LOCAL=1 npm run dev
```

Puis ouvrez **http://localhost:3000/demo**.

L’activation est temporaire pour ce terminal : elle ne modifie pas `.env.local`. Si le serveur local est déjà lancé, arrêtez-le avec `Ctrl+C`, puis relancez-le avec la commande ci-dessus. Le mode doit rester désactivé pour une utilisation normale.

## Ce que vous pouvez présenter

La démo s’ouvre sur **Mariam Adandé**, le profil Pro principal. Le sélecteur en haut permet de passer entre trois profils propriétaires, sept locataires et deux candidats. Les boutons Pro, Me et Find changent aussi d’espace et choisissent un profil correspondant.

### Sikaloc Pro — parcours conseillé

1. **Vue d’ensemble** : montrez les logements, les baux, les sommes enregistrées et les périodes à compléter.
2. **Logements** : consultez les biens du profil actif. Le bouton d’ajout crée un logement fictif uniquement dans ce navigateur ; il n’est pas publié dans Find.
3. **Locataires** et **Baux** : montrez les relations entre personnes, logements et contrats d’exemple.
4. **Paiements** : ouvrez une période partielle ou à régler, puis ajoutez un versement de démonstration. Le solde et le statut changent localement.
5. **Documents** : sélectionnez un aperçu. Il porte la mention « DÉMONSTRATION — DOCUMENT FICTIF » ; aucun PDF officiel n’est produit.
6. **Annonces & demandes** : faites évoluer le statut d’une candidature. Une réponse positive ne crée pas de bail.

### Sikaloc Me

Choisissez un des cinq profils locataires, par exemple **Célestin Hounkpatin**. Son bail, son logement, les périodes, les versements et les documents proviennent du même jeu que celui consulté par le bailleur associé dans Pro. L’espace Me est en lecture seule, à l’exception d’une préférence de démonstration locale.

Dans le produit réel, l’accès locataire dépend d’un compte authentifié et d’une relation/invitation valide. Le sélecteur de la démo ne crée ni compte ni invitation.

### Sikaloc Find

Passez à Find. Essayez de filtrer par ville, type ou plafond de loyer, puis ouvrez les détails d’un bien et déposez une candidature fictive. La demande apparaît dans les candidatures du propriétaire correspondant. Les images sont des illustrations architecturales, pas des photographies de logements disponibles.

## Données présentes au départ

- 3 profils Pro, 7 profils Me et 2 profils candidats.
- 12 logements et 9 baux, dont des baux terminés.
- 45 périodes de loyer : 40 réglées, 2 partielles (5 versements fractionnés au total) et 3 sans versement. Cela représente 45 opérations de paiement historiques.
- 21 aperçus documentaires fictifs : contrats, quittances et reçus associés aux versements partiels.
- 10 candidatures sans doublon sur les annonces de démonstration. Cinq annonces publiées sont visibles dans Find ; les autres biens restent au portefeuille sans être présentés comme disponibles.

Les montants, adresses de quartier, profils, périodes et statuts sont des exemples synthétiques. Aucun numéro de téléphone ni email de contact n’est fourni. Les courriels fictifs ne sont pas nécessaires pour utiliser la démo.

## Sauvegarde et réinitialisation locale

Les modifications sont conservées sous une seule clé dédiée du `localStorage` de ce navigateur. Elles ne sont pas envoyées à Supabase.

Utilisez **Réinitialiser** dans l’en-tête pour remettre uniquement les données de démonstration à leur état initial. Une confirmation est demandée. Le bouton ne vide pas le stockage du navigateur et ne touche à aucun autre site ou environnement.

Si le stockage local est bloqué par le navigateur, la démo reste consultable, mais les changements ne seront pas mémorisés.

## Ce que cette démo ne fait pas

- Elle ne se connecte pas à Supabase et ne crée aucun utilisateur.
- Elle n’exécute aucune action serveur de Pro, Me ou Find.
- Elle n’émet aucun paiement, email ou SMS.
- Elle ne génère ni ne télécharge de quittance ou PDF officiel.
- Elle ne publie pas réellement d’annonce et n’envoie pas une candidature à un bailleur.
- Elle ne crée pas de bail automatiquement après une candidature.

Les actions annoncées comme interactives sont des simulations locales destinées à présenter les parcours et les relations de données, pas une validation fonctionnelle du produit réel.

Le sélecteur de profils sert uniquement à changer de point de vue dans le jeu fictif : il ne constitue pas un contrôle d’accès. Cette démo ne valide donc ni l’authentification réelle, ni les autorisations serveur, ni les politiques RLS.

## Sécurité et arrêt

La route n’est rendue que si `SIKALOC_DEMO_LOCAL=1`, que Next.js est en développement et que l’hôte est `localhost`, `127.0.0.1` ou `[::1]`. Sur cette seule route, le proxy ne demande pas de session Supabase. Toutes les autres routes conservent leurs protections et leur comportement existants.

Pour terminer, arrêtez le serveur avec `Ctrl+C`. Rien n’est poussé vers GitHub ni publié sur Vercel par cette procédure.
