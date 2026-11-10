-- Restauration manuelle des privilèges qui existaient sur Sikaloc-Test avant
-- 20261109193149_retirer_acces_api_find_archive.sql.
-- À exécuter uniquement après restauration du code Find. Ne pas placer ce fichier
-- dans supabase/migrations : il s'agit d'une procédure de retour arrière manuelle.

grant execute on function public.annonce_publiee(text)
  to anon, authenticated;
grant execute on function public.annonces_publiees(integer, integer)
  to anon, authenticated;
grant execute on function public.annonces_publiees_sitemap()
  to anon, authenticated;
grant execute on function public.annonces_recherche(
  text, text, public.type_logement, integer, integer,
  smallint, smallint, smallint, boolean, text[], integer, integer
) to anon, authenticated;
grant execute on function public.lieux_publies()
  to anon, authenticated;
grant execute on function public.photos_publiees(text)
  to anon, authenticated;
grant execute on function public.profil_public_bailleur(text)
  to anon, authenticated;

grant execute on function public.candidatures_de_mes_annonces(text, integer, integer)
  to authenticated;
grant execute on function public.candidatures_par_annonce()
  to authenticated;
grant execute on function public.enregistrer_profil_candidat(text, text)
  to authenticated;
grant execute on function public.mes_candidatures()
  to authenticated;
grant execute on function public.repondre_candidature(uuid, public.statut_candidature)
  to authenticated;
grant execute on function public.retirer_candidature(uuid)
  to authenticated;
grant execute on function public.soumettre_candidature(text, text)
  to authenticated;

grant select, insert, update, delete on table
  public.annonces,
  public.annonce_photos
to authenticated;
grant select, insert on table public.candidats to authenticated;
grant select, insert, update on table public.candidatures to authenticated;

notify pgrst, 'reload schema';
