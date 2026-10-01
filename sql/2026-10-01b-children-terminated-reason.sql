-- 대상자 종결 사유 입력란.
-- Supabase 대시보드 > SQL Editor 에서 이 스크립트를 1회 실행하세요.

alter table children add column if not exists terminated_reason text;
