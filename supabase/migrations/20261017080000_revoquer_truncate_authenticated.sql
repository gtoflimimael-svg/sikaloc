-- Sikaloc : retirer TRUNCATE des rôles publics.
-- Les droits des rôles serveur restent inchangés.

REVOKE TRUNCATE ON TABLE public.codes_verification FROM anon, authenticated;
REVOKE TRUNCATE ON TABLE public.compteurs_documents FROM anon, authenticated;
REVOKE TRUNCATE ON TABLE public.emails_a_envoyer FROM anon, authenticated;
REVOKE TRUNCATE ON TABLE public.inscriptions_guide FROM anon, authenticated;
REVOKE TRUNCATE ON TABLE public.invitations_locataire FROM anon, authenticated;
REVOKE TRUNCATE ON TABLE public.journal_purges FROM anon, authenticated;
REVOKE TRUNCATE ON TABLE public.tentatives_connexion FROM anon, authenticated;
