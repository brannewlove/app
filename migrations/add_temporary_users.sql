-- 임시 사용자 관리 기능을 위한 데이터베이스 마이그레이션
-- 실행일: 2026-01-21

-- 1. is_temporary 컬럼 추가
ALTER TABLE users
ADD COLUMN is_temporary BOOLEAN DEFAULT FALSE COMMENT '임시 사용자 여부';

-- 2. cj_id를 NULL 허용으로 변경 (임시 사용자용)
ALTER TABLE users MODIFY COLUMN cj_id VARCHAR(50) NULL;

-- 3. 기존 데이터 확인 (모든 기존 사용자는 is_temporary = FALSE)
-- UPDATE users SET is_temporary = FALSE WHERE is_temporary IS NULL;

-- 참고사항:
-- - 임시 사용자: is_temporary = TRUE, cj_id = NULL
-- - 정식 사용자: is_temporary = FALSE, cj_id NOT NULL
-- - name은 모든 사용자에게 필수
-- - part는 NULL 허용 (임시 사용자는 부서 미정)