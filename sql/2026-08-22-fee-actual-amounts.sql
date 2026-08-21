-- 추가금/본인부담금 실제 납부액(수정 가능한 금액) 저장을 위한 마이그레이션
-- Supabase 대시보드 > SQL Editor 에서 이 스크립트를 1회 실행하세요.

alter table monthly_fees add column if not exists additional_amount numeric;
alter table monthly_fees add column if not exists copay_amount numeric;
