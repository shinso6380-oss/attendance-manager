-- 보강(정규 요일이 아닌 날 추가된 대상자)의 수업 시간을 따로 지정할 수 있도록 하는 마이그레이션
-- Supabase 대시보드 > SQL Editor 에서 이 스크립트를 1회 실행하세요.

alter table attendance add column if not exists makeup_time text;
