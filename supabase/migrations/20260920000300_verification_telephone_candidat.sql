-- ═══════════════════════════════════════════════════════════════════════════
-- Sikaloc — S8-G : vérification du téléphone candidat par OTP
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ─── Généraliser, ne pas dupliquer ─────────────────────────────────────────
--
-- Le service OTP (`src/lib/verification/otp.ts`, table `codes_verification`)
-- est mûr : empreinte HMAC jamais en clair, expiration, cinq essais, cinq
-- demandes par heure, délai de renvoi, usage unique gagné par une écriture
-- conditionnelle, comparaison à temps constant. Le réécrire pour le candidat
-- aurait voulu dire un second mécanisme de sécurité à maintenir en parallèle.
--
-- Une seule chose l'attachait au bailleur : la colonne `bailleur_id`, clé
-- étrangère vers `bailleurs`. Or un code ne vérifie pas un bailleur, il vérifie
-- un COMPTE — et `bailleurs.id`, `candidats.id` sont tous deux l'identifiant du
-- compte (`auth.users.id`). On renomme donc la colonne en `compte_id` et on la
-- rattache à `auth.users`. Le bailleur ne change pas de comportement : il
-- passait déjà son propre id, qui est celui du compte. Le candidat entre par la
-- même porte.
--
-- `codes_verification` garde sa RLS sans policy — fermée à `anon` comme à
-- `authenticated`. Seul le service (client admin de `otp.ts`) y touche. Un
-- candidat ne lit ni n'écrit un code, ni le sien ni celui d'un autre.

-- ─── 1. La table OTP, clé sur le compte ────────────────────────────────────

alter table public.codes_verification
  drop constraint codes_verification_bailleur_id_fkey;

alter table public.codes_verification
  rename column bailleur_id to compte_id;

alter table public.codes_verification
  add constraint codes_verification_compte_id_fkey
  foreign key (compte_id) references auth.users (id) on delete cascade;

-- L'index de recherche suit le nom de la colonne.
drop index if exists public.idx_codes_verification_recherche;
create index idx_codes_verification_recherche
  on public.codes_verification (compte_id, type, cree_le desc);

comment on column public.codes_verification.compte_id is
  'Le COMPTE (auth.users) que ce code vérifie — bailleur ou candidat, indifféremment. '
  'La suppression du compte emporte ses codes.';

-- ─── 2. L'état de vérification du candidat ─────────────────────────────────
--
-- Le miroir de `bailleurs.telephone_verifie_le`. NULL = jamais vérifié. On ne
-- copie PAS `telephone_canal_verification` : le canal est une trace utile au
-- bailleur, dont le numéro sert à envoyer quittances et relances ; pour le
-- candidat, seul compte « vérifié ou non ». Une colonne de moins, pas une de
-- trop.

alter table public.candidats
  add column if not exists telephone_verifie_le timestamptz;

comment on column public.candidats.telephone_verifie_le is
  'Moment où le numéro du candidat a été vérifié par code OTP. NULL = pas vérifié. '
  'Réinitialisé à NULL dès que le numéro change (déclencheur).';

-- ─── 3. Changer de numéro efface la vérification ───────────────────────────
--
-- La règle absolue de S8-G : un ancien « vérifié » ne survit pas à un
-- changement de numéro. Imposé par la base, pas par l'application — une requête
-- directe qui changerait le numéro sans passer par le formulaire tomberait sur
-- la même règle.
--
-- Le déclencheur de canonisation (`canoniser_telephone`) s'exécute avant
-- celui-ci (ordre alphabétique, 'c' < 'r') : `new.telephone` est donc déjà
-- canonique quand on le compare à l'ancien. On ne réinitialise que sur un vrai
-- changement de numéro — modifier le nom ou le consentement WhatsApp ne touche
-- pas la vérification.

create or replace function prive.reinitialiser_verification_candidat()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.telephone is distinct from old.telephone then
    new.telephone_verifie_le := null;
  end if;
  return new;
end;
$$;

create trigger reinitialiser_verification_candidat
  before update of telephone on public.candidats
  for each row
  execute function prive.reinitialiser_verification_candidat();

-- ─── 4. L'éligibilité WhatsApp candidat exige désormais la vérification ─────
--
-- S8-F gardait : numéro canonique + consentement. S8-G ajoute la vérification,
-- comme pour le bailleur. La garde vit toujours en SQL, source unique de la
-- règle : le déclencheur `notifier_candidature` l'appelle, l'interface ne
-- décide rien.
--
-- Le bailleur (`whatsapp_du_bailleur`) n'est pas touché : il exigeait déjà la
-- vérification.

create or replace function prive.whatsapp_du_candidat(p_candidat uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select prive.telephone_canonique(c.telephone)
  from public.candidats c
  where c.id = p_candidat
    and c.telephone_verifie_le is not null      -- numéro vérifié (S8-G)
    and c.notif_whatsapp                          -- opt-in explicite (S8-F)
    and prive.telephone_canonique(c.telephone) is not null;
$$;
