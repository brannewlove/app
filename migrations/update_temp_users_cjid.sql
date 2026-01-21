-- 임시 사용자 시스템 개선을 위한 데이터베이스 마이그레이션
-- 실행일: 2026-01-21

-- 기존에 cj_id가 NULL인 임시 사용자에게 고유한 임시 ID 부여
UPDATE users
SET
    cj_id = CONCAT('TEMP_LEGACY_', user_id)
WHERE
    is_temporary = TRUE
    AND cj_id IS NULL;

-- 참고사항:
-- - 새로 생성되는 임시 사용자는 TEMP_[TIMESTAMP]_[RANDOM] 형식의 ID를 받습니다
-- - 기존 임시 사용자는 TEMP_LEGACY_[user_id] 형식으로 마이그레이션됩니다
-- - 정식 전환 시 실제 cj_id로 변경 가능합니다