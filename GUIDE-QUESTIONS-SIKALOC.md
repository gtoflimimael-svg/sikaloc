# Questions visiteurs — configuration et utilisation

## Ce qui est prêt dans le code

- La FAQ de l’accueil présente cinq réponses et le lien vers `/questions`.
- Le formulaire public recueille un nom, un sujet, une question, un seul canal et la coordonnée associée.
- Le serveur valide les champs, limite la taille des requêtes, vérifie l’origine et applique une limite persistante de cinq envois par adresse réseau et par fenêtre de 15 minutes.
- Les demandes sont insérées avec `service_role` côté serveur seulement. Les tables n’ont aucune politique RLS de lecture publique.
- `/questions/gestion` est réservé à une session Supabase Auth dont l’UUID figure explicitement dans la liste d’administrateurs côté serveur.
- L’équipe peut filtrer par statut, ouvrir une réponse dans le canal choisi, faire évoluer le statut et supprimer une demande.
- L’ouverture de l’application e-mail ou WhatsApp ne marque pas la demande comme répondue et n’envoie aucun message automatiquement.

La limite s’appuie sur les en-têtes d’adresse fournis par le proxy de confiance (priorité à `x-real-ip`, puis à la dernière adresse de `x-forwarded-for`). Vérifier que l’hébergement renseigne ces en-têtes de manière non falsifiable ; si aucun n’est fourni, les requêtes partagent une empreinte de repli commune.

## Configuration à effectuer avant la première utilisation

1. **Choisir la base dédiée à l’application.** La migration `supabase/migrations/20261022231507_questions_contact.sql` n’a pas été appliquée par cette intervention. L’appliquer uniquement à la base locale ou à l’environnement explicitement destiné à recevoir ces demandes, après vérification de sa destination. Ne pas la lancer contre une base existante ou de production sans autorisation distincte.
2. **Créer ou choisir les administrateurs dans Supabase Auth.** Copier leur UUID d’utilisateur depuis l’interface Auth, puis le définir côté serveur dans `SIKALOC_QUESTIONS_ADMIN_IDS`. Plusieurs UUID peuvent être séparés par des virgules. Ne pas utiliser de métadonnée de rôle modifiable par l’utilisateur.
3. Vérifier que l’environnement local possède `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY`. La clé de service ne doit jamais être préfixée `NEXT_PUBLIC_` ni envoyée au navigateur.
4. Facultatif : une notification d’exploitation sans données personnelles peut être activée ultérieurement en production seulement, avec `SIKALOC_QUESTIONS_NOTIFICATIONS_ACTIVE=true`, `EMAIL_EXPLOITATION` et la configuration Resend existante. Le code interdit cette notification en développement. Elle est désactivée par défaut.

La migration doit être appliquée séparément et de façon contrôlée. Aucun changement n’a été écrit dans une base pendant le développement de cette fonctionnalité.

## Démonstration locale

Après configuration de la base locale dédiée et des variables serveur, lancer le projet depuis `MVP Sika` avec `npm run dev`, puis ouvrir :

- `http://localhost:3000/questions` pour envoyer une demande fictive.
- `http://localhost:3000/questions/gestion` pour consulter et traiter les demandes avec une session dont l’UUID a été autorisé.

Choisir une coordonnée de démonstration que l’équipe contrôle. Les demandes envoyées sont réellement enregistrées dans la base configurée ; ne pas utiliser de renseignements personnels sans nécessité.

## Traitement d’une demande

Dans l’inbox, filtrer les demandes par statut. « Prendre en charge » place la demande en cours. L’action de réponse ouvre l’application e-mail ou WhatsApp préremplie avec une courte formule et la coordonnée que la personne a choisie. L’équipe doit envoyer elle-même la réponse, puis sélectionner « Marquer comme répondue ». Sikaloc ne prétend pas qu’un message a été envoyé simplement parce qu’une application s’est ouverte.

La suppression dans l’inbox est définitive. La table ne dispose pas encore de purge automatique : une personne autorisée doit supprimer les demandes lorsqu’elles ne sont plus nécessaires ou lorsqu’une demande de suppression est reçue. Les compteurs anti-abus ne conservent qu’une empreinte HMAC de l’adresse réseau et sont nettoyés lors d’une requête suivante après 24 heures d’inactivité.

## Limites et précautions

- Sans migration appliquée à une base isolée, l’API échoue de façon explicite et ne confirme pas l’enregistrement.
- Sans UUID d’administrateur configuré, l’inbox n’est accessible à personne.
- Les réponses sont manuelles. Aucun envoi WhatsApp automatique ni e-mail de réponse au visiteur n’est intégré.
- Les notifications d’exploitation ne sont pas actives par défaut et restent désactivées en local.
- La politique de confidentialité décrit maintenant ce traitement ; sa formulation juridique doit être revue avant une publication en production.
