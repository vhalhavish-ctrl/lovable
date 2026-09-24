create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table if not exists public.menu_tiers (
  code text primary key,
  name_th text not null,
  name_en text not null,
  price_thb integer not null check (price_thb > 0),
  eggs integer not null check (eggs between 1 and 12),
  toppings_allowed integer not null default 5 check (toppings_allowed = 5),
  rice_g integer not null default 250 check (rice_g = 250),
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.toppings (
  code text primary key,
  category text not null check (category in ('protein','veg','extra')),
  name_th text not null,
  name_en text not null,
  allergen_note text,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.member_applications (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  phone text not null check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  nickname text not null check (char_length(nickname) between 1 and 80),
  bio text not null default '' check (char_length(bio) <= 500),
  status text not null default 'pending' check (status in ('pending','approved','rejected','suspended')),
  admin_note text,
  decided_at timestamptz,
  decided_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists member_applications_one_pending_phone
  on public.member_applications(phone) where status = 'pending';

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  phone text not null unique check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  email text not null,
  nickname text not null check (char_length(nickname) between 1 and 80),
  bio text not null default '' check (char_length(bio) <= 500),
  membership_status text not null default 'approved' check (membership_status in ('pending','approved','rejected','suspended')),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  sync_version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_no bigint generated always as identity unique,
  member_id uuid not null references auth.users(id) on delete restrict,
  menu_code text not null references public.menu_tiers(code),
  price_thb integer not null,
  eggs integer not null,
  rice_g integer not null check (rice_g = 250),
  topping_count integer not null check (topping_count = 5),
  status text not null default 'SUBMITTED' check (status in ('SUBMITTED','ACCEPTED','COOKING','READY','COMPLETED','CANCELLED')),
  channel text not null default 'WEB',
  notes text not null default '' check (char_length(notes) <= 500),
  total_thb integer not null,
  sync_version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists orders_member_created_idx on public.orders(member_id,created_at desc);
create index if not exists orders_status_created_idx on public.orders(status,created_at desc);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  topping_code text not null references public.toppings(code),
  qty integer not null default 1 check (qty = 1),
  created_at timestamptz not null default now(),
  unique(order_id,topping_code)
);
create index if not exists order_items_order_idx on public.order_items(order_id);

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id),
  action text not null,
  entity text not null,
  entity_id text not null,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.sync_log (
  id uuid primary key default gen_random_uuid(),
  direction text not null check (direction in ('DB_TO_SHEET','SHEET_TO_DB')),
  entity text not null,
  entity_id text not null,
  source_version bigint,
  target_version bigint,
  status text not null,
  error_message text,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at = now();
  if tg_table_name in ('profiles','orders') then
    new.sync_version = coalesce(old.sync_version,0) + 1;
  end if;
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists set_orders_updated_at on public.orders;
create trigger set_orders_updated_at before update on public.orders for each row execute function public.set_updated_at();
drop trigger if exists set_applications_updated_at on public.member_applications;
create trigger set_applications_updated_at before update on public.member_applications for each row execute function public.set_updated_at();

alter table public.menu_tiers enable row level security;
alter table public.toppings enable row level security;
alter table public.member_applications enable row level security;
alter table public.profiles enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.audit_log enable row level security;
alter table public.sync_log enable row level security;

create policy "public can read active menu" on public.menu_tiers for select to anon, authenticated
using (active or (select auth.jwt()->'app_metadata'->>'role')='admin');
create policy "public can read active toppings" on public.toppings for select to anon, authenticated
using (active or (select auth.jwt()->'app_metadata'->>'role')='admin');
create policy "admin updates topping availability" on public.toppings for update to authenticated
using ((select auth.jwt()->'app_metadata'->>'role')='admin')
with check ((select auth.jwt()->'app_metadata'->>'role')='admin');

create policy "admin reads applications" on public.member_applications for select to authenticated
using ((select auth.jwt()->'app_metadata'->>'role')='admin');

create policy "member reads own profile" on public.profiles for select to authenticated
using ((select auth.uid())=user_id or (select auth.jwt()->'app_metadata'->>'role')='admin');
create policy "member updates own approved profile" on public.profiles for update to authenticated
using (((select auth.uid())=user_id and membership_status='approved') or (select auth.jwt()->'app_metadata'->>'role')='admin')
with check (((select auth.uid())=user_id and membership_status='approved') or (select auth.jwt()->'app_metadata'->>'role')='admin');

create policy "member reads own orders" on public.orders for select to authenticated
using ((select auth.uid())=member_id or (select auth.jwt()->'app_metadata'->>'role')='admin');
create policy "admin updates order status" on public.orders for update to authenticated
using ((select auth.jwt()->'app_metadata'->>'role')='admin')
with check ((select auth.jwt()->'app_metadata'->>'role')='admin');

create policy "member reads own order items" on public.order_items for select to authenticated
using (exists(
  select 1 from public.orders o
  where o.id=order_id and (o.member_id=(select auth.uid()) or (select auth.jwt()->'app_metadata'->>'role')='admin')
));

create policy "admin reads audit" on public.audit_log for select to authenticated
using ((select auth.jwt()->'app_metadata'->>'role')='admin');
create policy "admin reads sync log" on public.sync_log for select to authenticated
using ((select auth.jwt()->'app_metadata'->>'role')='admin');

revoke all on public.member_applications from anon, authenticated;
grant select on public.member_applications to authenticated;

grant select on public.menu_tiers, public.toppings to anon, authenticated;
grant update (active) on public.toppings to authenticated;

grant select on public.profiles to authenticated;
grant update (nickname,bio) on public.profiles to authenticated;

grant select on public.orders, public.order_items to authenticated;
grant update (status,notes) on public.orders to authenticated;

grant select on public.audit_log, public.sync_log to authenticated;

create or replace function private.create_order_impl(p_user uuid, p_menu_code text, p_topping_codes text[])
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tier public.menu_tiers%rowtype;
  v_order_id uuid;
  v_order_no bigint;
  v_count integer;
begin
  if p_user is null or p_user <> (select auth.uid()) then raise exception 'AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.profiles p where p.user_id=p_user and p.membership_status='approved') then
    raise exception 'MEMBER_NOT_APPROVED';
  end if;
  if coalesce(array_length(p_topping_codes,1),0) <> 5 then raise exception 'EXACTLY_5_TOPPINGS_REQUIRED'; end if;
  select count(distinct x) into v_count from unnest(p_topping_codes) x;
  if v_count <> 5 then raise exception 'TOPPINGS_MUST_BE_UNIQUE'; end if;

  select * into v_tier from public.menu_tiers where code=p_menu_code and active=true;
  if not found then raise exception 'INVALID_MENU_TIER'; end if;

  select count(*) into v_count from public.toppings where code=any(p_topping_codes) and active=true;
  if v_count <> 5 then raise exception 'TOPPING_UNAVAILABLE'; end if;

  insert into public.orders(member_id,menu_code,price_thb,eggs,rice_g,topping_count,total_thb)
  values (p_user,v_tier.code,v_tier.price_thb,v_tier.eggs,v_tier.rice_g,5,v_tier.price_thb)
  returning id,order_no into v_order_id,v_order_no;

  insert into public.order_items(order_id,topping_code)
  select v_order_id,x from unnest(p_topping_codes) x;

  return v_order_no;
end;
$$;
revoke all on function private.create_order_impl(uuid,text,text[]) from public, anon;
grant execute on function private.create_order_impl(uuid,text,text[]) to authenticated;

create or replace function public.create_order(p_menu_code text, p_topping_codes text[])
returns bigint
language sql
security invoker
set search_path = ''
as $$
  select private.create_order_impl((select auth.uid()), p_menu_code, p_topping_codes);
$$;
revoke all on function public.create_order(text,text[]) from public, anon;
grant execute on function public.create_order(text,text[]) to authenticated;

insert into public.menu_tiers(code,name_th,name_en,price_thb,eggs,toppings_allowed,rice_g,active) values
('NORMAL','นอร์มอล','Normal',70,2,5,250,true),
('PLUS','พลัส','Plus',80,3,5,250,true),
('PRO','โปร','Pro',90,4,5,250,true),
('ULTRA','อัลตร้า','Ultra',100,5,5,250,true)
on conflict (code) do update set name_th=excluded.name_th,name_en=excluded.name_en,price_thb=excluded.price_thb,
eggs=excluded.eggs,toppings_allowed=excluded.toppings_allowed,rice_g=excluded.rice_g,active=excluded.active,updated_at=now();

insert into public.toppings(code,category,name_th,name_en,allergen_note,active) values
('TOP-001','protein','หมูสับ','Minced pork',null,true),('TOP-002','protein','ไก่สับ','Minced chicken',null,true),
('TOP-003','protein','กุ้งสด','Fresh shrimp','Shellfish',true),('TOP-004','protein','ปลาหมึก','Squid','Seafood',true),
('TOP-005','protein','ปูอัด','Crab stick','Fish/Gluten possible',true),('TOP-006','protein','ไส้กรอกแดง','Red sausage',null,true),
('TOP-007','protein','ฮอตดอก','Hot dog',null,true),('TOP-008','protein','โบโลน่า','Bologna',null,true),
('TOP-009','protein','ลูกชิ้นหมู','Pork meatball',null,true),('TOP-010','protein','ลูกชิ้นไก่','Chicken meatball',null,true),
('TOP-011','protein','แฮม','Ham',null,true),('TOP-012','protein','เบคอน','Bacon',null,true),
('TOP-013','protein','กุนเชียง','Chinese sausage',null,true),('TOP-014','protein','แหนม','Fermented pork',null,true),
('TOP-015','protein','หมูยอ','Vietnamese pork sausage',null,true),('TOP-016','protein','ไก่ยอ','Vietnamese chicken sausage',null,true),
('TOP-017','protein','เต้าหู้ปลา','Fish tofu','Fish',true),('TOP-018','protein','ทูน่า','Tuna','Fish',true),
('TOP-019','protein','ไก่ฉีก','Shredded chicken',null,true),('TOP-020','protein','หมูเด้ง','Seasoned bouncy pork',null,true),
('TOP-021','veg','ชะอม','Cha-om / acacia shoots',null,true),('TOP-022','veg','กะเพรา','Holy basil',null,true),
('TOP-023','veg','โหระพา','Thai sweet basil',null,true),('TOP-024','veg','ต้นหอม','Spring onion',null,true),
('TOP-025','veg','ผักชี','Coriander',null,true),('TOP-026','veg','ขึ้นฉ่าย','Celery',null,true),
('TOP-027','veg','หอมหัวใหญ่','Onion',null,true),('TOP-028','veg','หอมแดง','Shallot',null,true),
('TOP-029','veg','กระเทียม','Garlic',null,true),('TOP-030','veg','พริกสด','Fresh chilli',null,true),
('TOP-031','veg','พริกไทยดำบดหยาบ','Coarse black pepper',null,true),('TOP-032','veg','แครอต','Carrot',null,true),
('TOP-033','veg','ข้าวโพดหวาน','Sweet corn',null,true),('TOP-034','veg','มะเขือเทศ','Tomato',null,true),
('TOP-035','veg','เห็ดฟาง','Straw mushroom',null,true),('TOP-036','veg','เห็ดเข็มทอง','Enoki mushroom',null,true),
('TOP-037','veg','เห็ดนางรม','Oyster mushroom',null,true),('TOP-038','veg','กะหล่ำปลี','Cabbage',null,true),
('TOP-039','veg','คะน้า','Chinese kale',null,true),('TOP-040','veg','ผักโขม','Spinach',null,true),
('TOP-041','veg','ถั่วฝักยาว','Long bean',null,true),('TOP-042','veg','ถั่วลันเตา','Green peas',null,true),
('TOP-043','veg','พริกหวาน','Bell pepper',null,true),('TOP-044','veg','ใบมะกรูดซอย','Sliced kaffir lime leaf',null,true),
('TOP-045','veg','ตะไคร้ซอย','Sliced lemongrass',null,true),('TOP-046','extra','ชีสเชดดาร์','Cheddar cheese','Milk',true),
('TOP-047','extra','มอสซาเรลลาชีส','Mozzarella cheese','Milk',true),('TOP-048','extra','สาหร่าย','Seaweed',null,true),
('TOP-049','extra','กระเทียมเจียว','Crispy fried garlic',null,true),('TOP-050','extra','หอมเจียว','Crispy fried shallot',null,true)
on conflict (code) do update set category=excluded.category,name_th=excluded.name_th,name_en=excluded.name_en,
allergen_note=excluded.allergen_note,active=excluded.active,updated_at=now();
