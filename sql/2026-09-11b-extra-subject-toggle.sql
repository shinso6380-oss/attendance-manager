-- 다과목 결제 여부를 대상자 등록이 아니라 월 수업료 산정 화면에서 매달 직접 켜고 끌 수 있도록 변경.
-- (앞서 추가한 children.needs_extra_subject 칼럼은 더 이상 쓰지 않습니다. 그대로 두어도 무해합니다.)
-- Supabase 대시보드 > SQL Editor 에서 이 스크립트를 1회 실행하세요.

alter table monthly_fees add column if not exists extra_subject_enabled boolean not null default false;
