-- Archive temporaire de SIKALOC_FIND.
-- Les définitions, données, politiques RLS, Storage, propriétaires et droits
-- service_role restent inchangés. Pour restaurer l'API, exécuter manuellement
-- supabase/rollback/20261109193149_retirer_acces_api_find_archive.sql après
-- restauration du code Find.

revoke execute on function public.annonce_publiee(text)
  from public, anon, authenticated;
revoke execute on function public.annonces_publiees(integer, integer)
  from public, anon, authenticated;
revoke execute on function public.annonces_publiees_sitemap()
  from public, anon, authenticated;
revoke execute on function public.annonces_recherche(
  text, text, public.type_logement, integer, integer,
  smallint, smallint, smallint, boolean, text[], integer, integer
) from public, anon, authenticated;
revoke execute on function public.lieux_publies()
  from public, anon, authenticated;
revoke execute on function public.photos_publiees(text)
  from public, anon, authenticated;
revoke execute on function public.profil_public_bailleur(text)
  from public, anon, authenticated;

revoke execute on function public.candidatures_de_mes_annonces(text, integer, integer)
  from public, anon, authenticated;
revoke execute on function public.candidatures_par_annonce()
  from public, anon, authenticated;
revoke execute on function public.enregistrer_profil_candidat(text, text)
  from public, anon, authenticated;
revoke execute on function public.mes_candidatures()
  from public, anon, authenticated;
revoke execute on function public.repondre_candidature(uuid, public.statut_candidature)
  from public, anon, authenticated;
revoke execute on function public.retirer_candidature(uuid)
  from public, anon, authenticated;
revoke execute on function public.soumettre_candidature(text, text)
  from public, anon, authenticated;

-- Les tables avaient des droits directs pour authenticated, qui permettraient
-- de contourner la fermeture des RPC via /rest/v1/<table>. Leurs données et RLS
-- sont conservés ; seul l'accès client direct est retiré. service_role est intact.
revoke all privileges on table
  public.annonces,
  public.annonce_photos,
  public.candidats,
  public.candidatures
from public, anon, authenticated;

notify pgrst, 'reload schema';
