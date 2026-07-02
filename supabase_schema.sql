-- 1. UTENTI E PROFILI (public.profiles)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text unique not null,
  display_name text,
  avatar_url text,
  is_admin boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Abilita RLS su profiles
alter table public.profiles enable row level security;

create policy "Profili visibili a tutti" on public.profiles
  for select using (true);

create policy "Gli utenti aggiornano il proprio profilo" on public.profiles
  for update using (auth.uid() = id);


-- Trigger automatico per creare un profilo all'iscrizione tramite Google OAuth
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url, is_admin)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', 'Utente Anonimo'),
    coalesce(new.raw_user_meta_data->>'avatar_url', ''),
    false
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- 2. CANZONI PROPOSTE (public.proposals)
create table public.proposals (
  id uuid default gen_random_uuid() primary key,
  deezer_id text unique not null,
  title text not null,
  artist text not null,
  cover_url text,
  preview_url text,
  proposed_by uuid references public.profiles(id) on delete cascade not null,
  proposed_by_name text not null,
  proposed_at timestamp with time zone default timezone('utc'::text, now()) not null,
  player_name text,
  player_instrument text,
  under_review boolean default false not null,
  review_count integer default 0 not null
);

-- Abilita RLS su proposals
alter table public.proposals enable row level security;

create policy "Canzoni visibili a tutti" on public.proposals
  for select using (true);

create policy "Gli utenti inseriscono le proprie proposte" on public.proposals
  for insert with check (auth.uid() = proposed_by);

create policy "Solo admin elimina o modifica proposte" on public.proposals
  for all using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_admin = true
    )
  );


-- Trigger: Limite proposta settimanale (1 a settimana, reset Lunedì 00:00 UTC)
create or replace function check_weekly_proposal_limit()
returns trigger as $$
declare
  last_monday timestamp with time zone;
  proposal_count integer;
begin
  last_monday := date_trunc('week', now() at time zone 'utc');
  
  select count(*) into proposal_count
  from public.proposals
  where proposed_by = new.proposed_by
    and proposed_at >= last_monday;

  if proposal_count >= 1 then
    raise exception 'Hai già proposto un brano per questa settimana. Il reset avviene il Lunedì alle 00:00 UTC.';
  end if;

  return new;
end;
$$ language plpgsql;

create trigger enforce_weekly_proposal_limit
  before insert on public.proposals
  for each row execute procedure check_weekly_proposal_limit();


-- 3. VOTI (public.votes)
create table public.votes (
  id uuid default gen_random_uuid() primary key,
  proposal_id uuid references public.proposals(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(proposal_id, user_id)
);

-- Abilita RLS su votes
alter table public.votes enable row level security;

create policy "Voti leggibili da tutti" on public.votes
  for select using (true);

create policy "Gli utenti inseriscono il proprio voto" on public.votes
  for insert with check (auth.uid() = user_id);

create policy "Gli utenti rimuovono il proprio voto" on public.votes
  for delete using (auth.uid() = user_id);


-- 4. SEGNALAZIONI ACUSTICHE (public.reports)
create table public.reports (
  id uuid default gen_random_uuid() primary key,
  proposal_id uuid references public.proposals(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(proposal_id, user_id)
);

-- Abilita RLS su reports
alter table public.reports enable row level security;

create policy "Segnalazioni leggibili da tutti" on public.reports
  for select using (true);

create policy "Gli utenti segnalano un brano" on public.reports
  for insert with check (auth.uid() = user_id);


-- Trigger: Incremento segnalazioni e messa sotto revisione a quota 3
create or replace function public.handle_report_submission()
returns trigger as $$
begin
  update public.proposals
  set 
    review_count = review_count + 1,
    under_review = case when (review_count + 1) >= 3 then true else under_review end
  where id = new.proposal_id;
  return new;
end;
$$ language plpgsql;

create trigger on_report_submitted
  after insert on public.reports
  for each row execute procedure public.handle_report_submission();
