-- trade 테이블에 취소 관련 컬럼 추가 마이그레이션
ALTER TABLE `trade` 
  ADD COLUMN `is_cancelled` TINYINT(1) DEFAULT 0 COMMENT '취소 여부 (0: 정상, 1: 취소됨)',
  ADD COLUMN `cancelled_at` TIMESTAMP NULL DEFAULT NULL COMMENT '취소 처리 시간';
