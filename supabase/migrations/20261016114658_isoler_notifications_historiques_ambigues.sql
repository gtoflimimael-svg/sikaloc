-- L'ancien worker ne conservait ni réservation ni confirmation fiable.
-- Une tentative ancienne sans date exploitable ne peut pas bénéficier d'une
-- nouvelle fenêtre d'idempotence supposée : réconciliation opérateur d'abord.
do $$
declare t text;
begin
  foreach t in array array['emails_a_envoyer','notifications_candidature','notifications_whatsapp'] loop
    execute format('update public.%I set etat_traitement=''a_verifier'',
      derniere_erreur=''historique_non_confirme''
      where envoye_le is null and tentatives>0 and premiere_tentative is null
        and etat_traitement<>''reserve''',t);
  end loop;
end $$;
