-- 월 수업료: 납부 확인 체크와 추가금 결제 수단(현금/카드/울산페이) 추가
-- Supabase 대시보드 > SQL Editor 에서 이 스크립트를 1회 실행하세요.

alter table monthly_fees add column if not exists additional_paid boolean not null default false;
alter table monthly_fees add column if not exists additional_payment_method text;
alter table monthly_fees add column if not exists copay_paid boolean not null default false;
