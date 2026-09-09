-- 两人小账：在新项目 SQL Editor 一次性运行。只创建本应用对象。
begin;
create table public.lr_books (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null unique references auth.users(id),
 invite uuid not null unique default gen_random_uuid(),
 data jsonb not null check (jsonb_typeof(data)='object'),
 revision bigint not null default 1,
 updated_at timestamptz not null default now()
);
create table public.lr_members (
 user_id uuid primary key references auth.users(id),
 book_id uuid not null references public.lr_books(id)
);
create table public.lr_versions (
 book_id uuid not null references public.lr_books(id),
 revision bigint not null,
 data jsonb not null,
 saved_by uuid not null references auth.users(id),
 saved_at timestamptz not null default now(),
 primary key(book_id,revision)
);
alter table public.lr_books enable row level security;
alter table public.lr_members enable row level security;
alter table public.lr_versions enable row level security;
-- Tables are private, including for logged-in clients. Access only through
-- the membership-checked functions below. Anonymous callers get no access.
revoke all on public.lr_books, public.lr_members, public.lr_versions from anon, authenticated;

create function public.lr_read() returns jsonb
language plpgsql security definer set search_path='' as $$
declare b public.lr_books; u uuid := auth.uid();
begin
 if u is null then raise exception '请先登录'; end if;
 select k.* into b from public.lr_books k join public.lr_members m on m.book_id=k.id where m.user_id=u;
 if not found then return null; end if;
 return jsonb_build_object('id',b.id,'data',b.data,'revision',b.revision,'updatedAt',b.updated_at,
 'invite',case when b.owner_id=u then b.invite else null end);
end $$;

create function public.lr_create(payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare bid uuid; u uuid := auth.uid();
begin
 if u is null then raise exception '请先登录'; end if;
 if payload is null or jsonb_typeof(payload)<>'object' or octet_length(payload::text)>15000000 then raise exception '账本格式或大小无效'; end if;
 if exists(select 1 from public.lr_members where user_id=u) then raise exception '已经加入账本'; end if;
 insert into public.lr_books(owner_id,data) values(u,payload) returning id into bid;
 insert into public.lr_members(user_id,book_id) values(u,bid);
 insert into public.lr_versions(book_id,revision,data,saved_by) values(bid,1,payload,u);
 return public.lr_read();
end $$;

create function public.lr_join(code uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare bid uuid; u uuid := auth.uid();
begin
 if u is null then raise exception '请先登录'; end if;
 if exists(select 1 from public.lr_members where user_id=u) then raise exception '已经加入账本，不能覆盖现有账本'; end if;
 select id into bid from public.lr_books where invite=code for update;
 if not found then raise exception '邀请码无效'; end if;
 if (select count(*) from public.lr_members where book_id=bid)>=2 then raise exception '这本账已满两人'; end if;
 insert into public.lr_members(user_id,book_id) values(u,bid);
 return public.lr_read();
end $$;

create function public.lr_save(expected_revision bigint,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare b public.lr_books; u uuid := auth.uid();
begin
 if u is null then raise exception '请先登录'; end if;
 if payload is null or jsonb_typeof(payload)<>'object' or octet_length(payload::text)>15000000 then raise exception '账本格式或大小无效'; end if;
 select k.* into b from public.lr_books k join public.lr_members m on m.book_id=k.id where m.user_id=u for update of k;
 if not found then raise exception '尚未加入账本'; end if;
 if expected_revision is distinct from b.revision then
 return jsonb_build_object('conflict',true,'snapshot',public.lr_read()); end if;
 update public.lr_books set data=payload,revision=revision+1,updated_at=now() where id=b.id;
 insert into public.lr_versions(book_id,revision,data,saved_by) values(b.id,b.revision+1,payload,u);
 return jsonb_build_object('conflict',false,'snapshot',public.lr_read());
end $$;

revoke all on function public.lr_read() from public, anon;
revoke all on function public.lr_create(jsonb) from public, anon;
revoke all on function public.lr_join(uuid) from public, anon;
revoke all on function public.lr_save(bigint,jsonb) from public, anon;
grant execute on function public.lr_read() to authenticated;
grant execute on function public.lr_create(jsonb) to authenticated;
grant execute on function public.lr_join(uuid) to authenticated;
grant execute on function public.lr_save(bigint,jsonb) to authenticated;
commit;
