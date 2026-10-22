-- 자동 이월금을 그 달에 적용하지 않기로 한 경우(현금 환급 등) 체크 해제를 저장하기 위한 칼럼.
-- Supabase 대시보드 > SQL Editor 에서 이 스크립트를 1회 실행하세요.

alter table monthly_fees add column if not exists auto_carryover_disabled boolean not null default false;
