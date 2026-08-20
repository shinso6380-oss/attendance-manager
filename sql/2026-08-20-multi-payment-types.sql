-- 바우처(결제 구분) 중복 선택 지원을 위한 마이그레이션
-- Supabase 대시보드 > SQL Editor 에서 이 스크립트를 1회 실행하세요.
-- 기존 payment_type / voucher_sub 컬럼은 그대로 남겨두므로 되돌릴 필요가 생기면 참고할 수 있습니다.

-- 1. 새 컬럼 추가
alter table children add column if not exists payment_types jsonb not null default '[]'::jsonb;
alter table children add column if not exists developmental_sub text;
alter table children add column if not exists infant_sub text;

-- 2. 기존 단일 값 데이터를 새 컬럼으로 자동 변환
update children set
  payment_types = case
    when payment_type is null or payment_type = 'none' then '[]'::jsonb
    else jsonb_build_array(payment_type)
  end,
  developmental_sub = case when payment_type = 'developmental' then voucher_sub else null end,
  infant_sub = case when payment_type = 'infant' then voucher_sub else null end;

-- 3. (선택) 데이터 이관을 확인한 뒤, 더 이상 쓰지 않는 옛 컬럼을 정리하려면 아래를 실행하세요.
-- alter table children drop column payment_type;
-- alter table children drop column voucher_sub;
