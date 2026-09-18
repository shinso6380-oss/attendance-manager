-- 본인부담금 입금내역 업로드 · 자동 매칭 · 미납자 명단 기능을 위한 마이그레이션
-- Supabase 대시보드 > SQL Editor 에서 이 스크립트를 1회 실행하세요.

alter table children add column if not exists depositor_names jsonb not null default '[]';

create table if not exists deposits (
  id bigint generated always as identity primary key,
  source_key text not null unique,
  txn_date date not null,
  txn_datetime timestamptz,
  depositor_raw text not null,
  amount numeric not null,
  bank_note text,
  status text not null default 'unmatched',
  matched_child_id uuid references children(id),
  matched_month_key text,
  uploaded_by text,
  created_at timestamptz not null default now()
);

alter table deposits enable row level security;

drop policy if exists "allow all - deposits" on deposits;
create policy "allow all - deposits" on deposits for all using (true) with check (true);
