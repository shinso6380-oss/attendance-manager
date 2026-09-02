-- 요일별로 다른 수업 시간을 설정할 수 있도록 하는 마이그레이션
-- Supabase 대시보드 > SQL Editor 에서 이 스크립트를 1회 실행하세요.

alter table children add column if not exists day_times jsonb;

-- 기존 아이들의 days(integer[]) + class_time(단일 시간)을 요일별 시간으로 변환
update children
set day_times = (
  select jsonb_object_agg(d::text, class_time)
  from unnest(days) as d
)
where day_times is null and days is not null and array_length(days, 1) > 0;
