-- 결제 구분 "초기 상담"(상담비 5만원, 1회성)의 상담일을 저장하기 위한 칼럼.
-- Supabase 대시보드 > SQL Editor 에서 이 스크립트를 1회 실행하세요.

alter table children add column if not exists initial_consult_date date;
