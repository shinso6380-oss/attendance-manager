-- 출석 1회당 급여를 받는 시스템을 지원하기 위해, 하루 출석을 1회가 아닌 다른 값(2회, 0.5회 등)으로도
-- 기록할 수 있게 하는 마이그레이션. 하루 두 번 온 경우 2, 20분씩 나눠서 한 경우 0.5처럼 사용.
-- Supabase 대시보드 > SQL Editor 에서 이 스크립트를 1회 실행하세요.

alter table attendance add column if not exists count numeric not null default 1;
