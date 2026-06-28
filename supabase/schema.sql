-- =====================================================
-- レシート家計簿アプリ Supabaseスキーマ定義
-- Supabaseダッシュボードの SQL Editor で実行してください
-- =====================================================

-- レシートテーブル
create table if not exists receipts (
  id           uuid        default gen_random_uuid() primary key,
  user_id      uuid        references auth.users(id) on delete cascade not null,
  user_email   text        not null,
  date         text,
  store        text,
  items        jsonb       not null default '[]',
  total        numeric     not null default 0,
  created_at   timestamptz default now()
);

-- RLSを有効化
alter table receipts enable row level security;

-- 一般ユーザーは自分のレシートのみ参照できる
create policy "ユーザーは自分のレシートのみ参照" on receipts
  for select using (auth.uid() = user_id);

-- 一般ユーザーは自分のレシートのみ登録できる
create policy "ユーザーは自分のレシートのみ登録" on receipts
  for insert with check (auth.uid() = user_id);

-- 一般ユーザーは自分のレシートのみ削除できる
create policy "ユーザーは自分のレシートのみ削除" on receipts
  for delete using (auth.uid() = user_id);

-- =====================================================
-- ユーザーロールテーブル（管理者管理用）
-- =====================================================

create table if not exists user_roles (
  user_id    uuid references auth.users(id) on delete cascade primary key,
  role       text        not null default 'user', -- 'user' | 'admin'
  created_at timestamptz default now()
);

-- RLSを有効化
alter table user_roles enable row level security;

-- ユーザーは自分のロールのみ参照できる
create policy "ユーザーは自分のロールを参照" on user_roles
  for select using (auth.uid() = user_id);

-- =====================================================
-- 管理者用ポリシー（service_role_keyを使うサーバーがRLSを迂回するため不要だが
-- 将来的にクライアント直接アクセスを想定する場合は有効化する）
-- =====================================================

-- 管理者ロールを付与する場合はSupabase SQL Editorから手動で実行：
-- insert into user_roles (user_id, role) values ('<対象ユーザーのuuid>', 'admin');
