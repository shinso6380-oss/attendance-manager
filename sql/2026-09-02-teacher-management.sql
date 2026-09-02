-- 선생님 관리(추가/삭제, 관리자 권한)를 사이트에서 직접 할 수 있도록 하는 마이그레이션
-- Supabase 대시보드 > SQL Editor 에서 이 스크립트를 1회 실행하세요.

-- 1. 관리자 여부 컬럼 추가
alter table teacher_passwords add column if not exists is_admin boolean not null default false;

-- 2. 신승오를 관리자로 지정 (이미 관리자로 설정돼 있다면 아무 변화 없음)
update teacher_passwords set is_admin = true where teacher = '신승오';

-- 3. 이희웅 선생님 퇴사로 삭제
--    담당했던 대상자/출석/수업료 기록은 그대로 남고, 더 이상 로그인만 안 됩니다.
--    (이후에는 '선생님 관리' 탭에서 직접 추가/삭제할 수 있습니다.)
delete from teacher_passwords where teacher = '이희웅';
