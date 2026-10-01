-- 대상자 종결 처리일: 이 날짜부터 시간표에 더 이상 표시되지 않는다.
-- Supabase 대시보드 > SQL Editor 에서 이 스크립트를 1회 실행하세요.

alter table children add column if not exists terminated_at date;
