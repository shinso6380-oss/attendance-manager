-- 오늘 출석에서 아이별로 그날의 서비스 제공내용/특이사항을 적을 수 있게 하는 마이그레이션.
-- "개별 일지" 탭에서 아이별로 모아서 볼 때 사용.
-- Supabase 대시보드 > SQL Editor 에서 이 스크립트를 1회 실행하세요.

alter table attendance add column if not exists note text;
