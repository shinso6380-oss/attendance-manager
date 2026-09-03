-- 이월 금액 차감(추가납부액에서만 반영, 본인부담금엔 영향 없음)을 위한 마이그레이션
-- Supabase 대시보드 > SQL Editor 에서 이 스크립트를 1회 실행하세요.

alter table monthly_fees add column if not exists carryover_amount numeric not null default 0;
