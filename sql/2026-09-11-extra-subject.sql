-- 담당 과목 외에 다른 과목도 함께 결제해야 하는 대상자를 위한 마이그레이션.
-- children.needs_extra_subject: 이 아이가 다과목 결제 대상인지 여부 (등록/수정 화면에서 체크)
-- monthly_fees.extra_session_count: 그 달 추가 과목 수업 횟수 (자동 계산 없이 매달 직접 입력)
-- Supabase 대시보드 > SQL Editor 에서 이 스크립트를 1회 실행하세요.

alter table children add column if not exists needs_extra_subject boolean not null default false;
alter table monthly_fees add column if not exists extra_session_count numeric not null default 0;
