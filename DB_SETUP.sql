-- ============================================
-- assetdb 데이터베이스 생성 및 테이블 스키마
-- 새 PC 환경 설정용
-- ============================================

-- 데이터베이스 생성
CREATE DATABASE IF NOT EXISTS assetdb;
USE assetdb;

-- ============================================
-- 1. users 테이블 - 사용자 정보
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  cj_id VARCHAR(50) UNIQUE NOT NULL COMMENT '사원ID',
  password VARCHAR(255) NOT NULL COMMENT '비밀번호',
  name VARCHAR(100) NOT NULL COMMENT '사용자명',
  part VARCHAR(100) COMMENT '부서',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '생성일',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정일',
  INDEX idx_cj_id (cj_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='사용자 테이블';

-- ============================================
-- 2. assets 테이블 - 자산 정보
-- ============================================
CREATE TABLE IF NOT EXISTS assets (
  asset_id INT AUTO_INCREMENT PRIMARY KEY,
  asset_number VARCHAR(100) UNIQUE NOT NULL COMMENT '자산번호',
  model VARCHAR(255) COMMENT '모델명',
  category VARCHAR(100) COMMENT '카테고리',
  in_user VARCHAR(50) COMMENT '현재 사용자(cj_id)',
  status VARCHAR(50) COMMENT '상태',
  memo TEXT COMMENT '메모',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '생성일',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정일',
  INDEX idx_asset_number (asset_number),
  INDEX idx_in_user (in_user),
  FOREIGN KEY (in_user) REFERENCES users(cj_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='자산 테이블';

-- ============================================
-- 3. trde 테이블 - 거래/작업 기록
-- ============================================
CREATE TABLE IF NOT EXISTS trde (
  trade_id INT AUTO_INCREMENT PRIMARY KEY,
  asset_id VARCHAR(100) NOT NULL COMMENT '자산번호(assets.asset_number)',
  work_type VARCHAR(50) COMMENT '작업 유형 (배치, 회수, 대여, 대여반납, 수리, 수리반납 등)',
  cj_id VARCHAR(50) COMMENT '사원ID',
  asset_state VARCHAR(50) COMMENT '자산 상태',
  asset_in_user VARCHAR(50) COMMENT '자산 소유자',
  memo TEXT COMMENT '메모',
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '거래 시간',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '생성일',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정일',
  INDEX idx_trade_id (trade_id),
  INDEX idx_asset_id (asset_id),
  INDEX idx_cj_id (cj_id),
  INDEX idx_timestamp (timestamp),
  FOREIGN KEY (asset_id) REFERENCES assets(asset_number) ON DELETE CASCADE,
  FOREIGN KEY (cj_id) REFERENCES users(cj_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='거래/작업 기록 테이블';

-- ============================================
-- 4. assetLogs 테이블 (선택사항 - 감시용)
-- ============================================
CREATE TABLE IF NOT EXISTS assetLogs (
  log_id INT AUTO_INCREMENT PRIMARY KEY,
  asset_id VARCHAR(100) COMMENT '자산번호',
  work_type VARCHAR(50) COMMENT '작업 유형',
  cj_id VARCHAR(50) COMMENT '사원ID',
  user_name VARCHAR(100) COMMENT '사용자명',
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '작업 시간',
  memo TEXT COMMENT '메모',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '생성일',
  INDEX idx_asset_id (asset_id),
  INDEX idx_timestamp (timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='자산 작업 로그 테이블';

-- ============================================
-- 5. confirmed_assets 테이블 - 확인된 자산 목록
-- ============================================
CREATE TABLE IF NOT EXISTS confirmed_assets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  asset_id VARCHAR(100) NOT NULL COMMENT '자산ID',
  cj_id VARCHAR(50) NOT NULL COMMENT '사원ID(확인 시점의 사용자)',
  confirmed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '확인 시간',
  UNIQUE KEY unique_asset_user (asset_id, cj_id),
  INDEX idx_asset_id (asset_id),
  INDEX idx_cj_id (cj_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='사용자 변경 확인 테이블';

-- ============================================
-- 6. returned_assets 테이블 - 반납 자산 정보
-- ============================================
CREATE TABLE IF NOT EXISTS returned_assets (
  return_id INT AUTO_INCREMENT PRIMARY KEY,
  asset_number VARCHAR(100) NOT NULL COMMENT '자산번호',
  model VARCHAR(255) COMMENT '모델명',
  serial_number VARCHAR(255) COMMENT '시리얼번호',
  return_type VARCHAR(100) COMMENT '반납유형',
  end_date DATE COMMENT '자산 사용 종료일',
  user_id VARCHAR(50) COMMENT '반납 사용자 ID',
  user_name VARCHAR(100) COMMENT '반납 사용자명',
  department VARCHAR(100) COMMENT '반납 사용자 부서',
  handover_date DATE COMMENT '인계일',
  release_status BOOLEAN DEFAULT FALSE COMMENT '출고여부',
  it_room_stock BOOLEAN DEFAULT FALSE COMMENT '전산실입고',
  low_format BOOLEAN DEFAULT FALSE COMMENT '로우포맷',
  it_return BOOLEAN DEFAULT FALSE COMMENT '전산반납',
  mail_return BOOLEAN DEFAULT FALSE COMMENT '메일반납',
  actual_return BOOLEAN DEFAULT FALSE COMMENT '실재반납',
  complete BOOLEAN DEFAULT FALSE COMMENT '완료',
  remarks TEXT COMMENT '비고',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '생성일',
  INDEX idx_returned_asset_number (asset_number),
  INDEX idx_returned_user_id (user_id),
  FOREIGN KEY (asset_number) REFERENCES assets(asset_number) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(cj_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='반납 자산 테이블';

-- ============================================
-- 테스트용 샘플 데이터 (선택사항)
-- ============================================
-- INSERT INTO users (cj_id, password, name, part) VALUES 
-- ('rokmcssh', 'password123', '홍길동', '개발팀'),
-- ('testuser', 'password456', '김영희', '영업팀');
