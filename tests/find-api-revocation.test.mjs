import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migration = await readFile(
  new URL('../supabase/migrations/20261109193149_retirer_acces_api_find_archive.sql', import.meta.url),
  'utf8',
);
const rollback = await readFile(
  new URL('../supabase/rollback/20261109193149_retirer_acces_api_find_archive.sql', import.meta.url),
  'utf8',
);
const normalize = (sql) => sql
  .replace(/--[^\n]*/g, '')
  .replace(/\s+/g, ' ')
  .replace(/\( /g, '(')
  .replace(/ \)/g, ')')
  .toLowerCase();
const normalizedMigration = normalize(migration);
const normalizedRollback = normalize(rollback);

const publicFindFunctions = [
  'annonce_publiee(text)',
  'annonces_publiees(integer, integer)',
  'annonces_publiees_sitemap()',
  'annonces_recherche(text, text, public.type_logement, integer, integer, smallint, smallint, smallint, boolean, text[], integer, integer)',
  'lieux_publies()',
  'photos_publiees(text)',
  'profil_public_bailleur(text)',
];

const authenticatedFindFunctions = [
  'candidatures_de_mes_annonces(text, integer, integer)',
  'candidatures_par_annonce()',
  'enregistrer_profil_candidat(text, text)',
  'mes_candidatures()',
  'repondre_candidature(uuid, public.statut_candidature)',
  'retirer_candidature(uuid)',
  'soumettre_candidature(text, text)',
];

test('retire les RPC Find exactes des rôles clients et fournit leur restauration', () => {
  assert.equal((normalizedMigration.match(/revoke execute on function/g) ?? []).length, 14);

  for (const signature of publicFindFunctions) {
    const revoke = `revoke execute on function public.${signature} from public, anon, authenticated`;
    const grant = `grant execute on function public.${signature} to anon, authenticated`;
    assert.ok(normalizedMigration.includes(revoke), `révocation absente : ${signature}`);
    assert.ok(normalizedRollback.includes(grant), `restauration absente : ${signature}`);
  }

  for (const signature of authenticatedFindFunctions) {
    const revoke = `revoke execute on function public.${signature} from public, anon, authenticated`;
    const grant = `grant execute on function public.${signature} to authenticated`;
    assert.ok(normalizedMigration.includes(revoke), `révocation absente : ${signature}`);
    assert.ok(normalizedRollback.includes(grant), `restauration absente : ${signature}`);
  }
});

test('ferme les tables REST Find sans toucher RLS, données, fonctions actives ou privilèges service_role', () => {
  assert.match(
    normalizedMigration,
    /revoke all privileges on table public\.annonces, public\.annonce_photos, public\.candidats, public\.candidatures from public, anon, authenticated/,
  );
  assert.match(normalizedRollback, /grant select, insert, update, delete on table public\.annonces, public\.annonce_photos to authenticated/);
  assert.match(normalizedRollback, /grant select, insert on table public\.candidats to authenticated/);
  assert.match(normalizedRollback, /grant select, insert, update on table public\.candidatures to authenticated/);
  assert.doesNotMatch(normalizedMigration, /\b(drop|delete|truncate|insert|update|create policy|alter table)\b/);
  assert.doesNotMatch(normalizedMigration, /\b(service_role|mes_roles|mes_baux|mes_echeances|mes_paiements|ma_quittance|preparer_emission_quittance)\b/);
});
