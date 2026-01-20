-- Database Schema Dump
-- Generated on 2026. 1. 20. 오후 2:49:52

SET FOREIGN_KEY_CHECKS = 0;

-- Table structure for table `assetlogs`
DROP TABLE IF EXISTS `assetlogs`;

CREATE TABLE `assetlogs` (
    `log_id` int NOT NULL AUTO_INCREMENT,
    `asset_id` varchar(200) DEFAULT NULL COMMENT '자산번호',
    `work_type` varchar(200) DEFAULT NULL COMMENT '작업 유형',
    `cj_id` varchar(200) DEFAULT NULL COMMENT '사원ID',
    `user_name` varchar(200) DEFAULT NULL COMMENT '사용자명',
    `timestamp` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '작업 시간',
    `memo` text COMMENT '메모',
    `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '생성일',
    PRIMARY KEY (`log_id`),
    KEY `idx_asset_id` (`asset_id`),
    KEY `idx_timestamp` (`timestamp`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '자산 작업 로그 테이블';

-- Table structure for table `assets`
DROP TABLE IF EXISTS `assets`;

CREATE TABLE `assets` (
    `asset_id` int NOT NULL AUTO_INCREMENT,
    `category` varchar(200) DEFAULT NULL,
    `model` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
    `serial_number` varchar(200) DEFAULT NULL,
    `asset_number` varchar(200) NOT NULL,
    `day_of_start` date DEFAULT NULL,
    `day_of_end` date DEFAULT NULL,
    `unit_price` int DEFAULT NULL,
    `contract_month` int GENERATED ALWAYS AS (
        (
            timestampdiff(
                MONTH,
                `day_of_start`,
                `day_of_end`
            ) + 1
        )
    ) VIRTUAL,
    `in_user` varchar(200) DEFAULT NULL,
    `state` varchar(200) DEFAULT 'wait',
    `replacement` varchar(200) DEFAULT NULL,
    PRIMARY KEY (`asset_id`),
    UNIQUE KEY `asset_number` (`asset_number`) USING BTREE,
    KEY `FK_users` (`in_user`) USING BTREE,
    CONSTRAINT `users_in` FOREIGN KEY (`in_user`) REFERENCES `users` (`cj_id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 2429 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- Table structure for table `confirmed_assets`
DROP TABLE IF EXISTS `confirmed_assets`;

CREATE TABLE `confirmed_assets` (
    `id` int NOT NULL AUTO_INCREMENT,
    `asset_number` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
    `cj_id` varchar(200) NOT NULL COMMENT '사원ID(확인 시점의 사용자)',
    `confirmed_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '확인 시간',
    PRIMARY KEY (`id`),
    UNIQUE KEY `unique_asset_user` (`asset_number`, `cj_id`),
    KEY `idx_asset_id` (`asset_number`),
    KEY `idx_cj_id` (`cj_id`)
) ENGINE = InnoDB AUTO_INCREMENT = 72 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '사용자 변경 확인 테이블';

-- Table structure for table `confirmed_replacements`
DROP TABLE IF EXISTS `confirmed_replacements`;

CREATE TABLE `confirmed_replacements` (
    `id` int NOT NULL AUTO_INCREMENT,
    `asset_number` varchar(200) NOT NULL,
    `confirmed_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `unique_replacement_confirm` (`asset_number`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- Table structure for table `returned_assets`
DROP TABLE IF EXISTS `returned_assets`;

CREATE TABLE `returned_assets` (
    `return_id` int NOT NULL AUTO_INCREMENT,
    `asset_number` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '자산번호',
    `return_reason` tinytext CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci COMMENT '반납사유',
    `model` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '모델명',
    `serial_number` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '시리얼번호',
    `return_type` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '반납유형',
    `end_date` date DEFAULT NULL COMMENT '자산 사용 종료일',
    `user_id` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '반납 사용자 ID',
    `user_name` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '반납 사용자명',
    `department` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT '반납 사용자 부서',
    `handover_date` date DEFAULT NULL COMMENT '인계일',
    `release_status` tinyint(1) DEFAULT '0' COMMENT '출고여부',
    `it_room_stock` tinyint(1) DEFAULT '0' COMMENT '전산실입고',
    `low_format` tinyint(1) DEFAULT '0' COMMENT '로우포맷',
    `it_return` tinyint(1) DEFAULT '0' COMMENT '전산반납',
    `mail_return` tinyint(1) DEFAULT '0' COMMENT '메일반납',
    `actual_return` tinyint(1) DEFAULT '0' COMMENT '실재반납',
    `complete` tinyint(1) DEFAULT '0' COMMENT '완료',
    `remarks` tinytext CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci COMMENT '비고',
    `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '생성일',
    PRIMARY KEY (`return_id`),
    UNIQUE KEY `UQ_returned_assets_asset_number` (`asset_number`),
    KEY `idx_returned_asset_number` (`asset_number`),
    KEY `idx_returned_user_id` (`user_id`)
) ENGINE = InnoDB AUTO_INCREMENT = 75 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '반납 자산 테이블';

-- Table structure for table `settings`
DROP TABLE IF EXISTS `settings`;

CREATE TABLE `settings` (
    `s_key` varchar(200) NOT NULL,
    `s_value` varchar(200) NOT NULL,
    `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`s_key`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- Table structure for table `trade`
DROP TABLE IF EXISTS `trade`;

CREATE TABLE `trade` (
    `trade_id` int NOT NULL AUTO_INCREMENT,
    `asset_number` varchar(200) NOT NULL COMMENT '자산번호(assets.asset_number)',
    `work_type` varchar(200) DEFAULT NULL COMMENT '작업 유형 (배치, 회수, 대여, 대여반납, 수리, 수리반납 등)',
    `cj_id` varchar(200) DEFAULT NULL COMMENT '사원ID',
    `asset_state` varchar(200) DEFAULT NULL COMMENT '자산 상태',
    `asset_in_user` varchar(200) DEFAULT NULL COMMENT '자산 소유자',
    `memo` text COMMENT '메모',
    `timestamp` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '거래 시간',
    `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '생성일',
    `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정일',
    `ex_user` varchar(200) DEFAULT NULL,
    PRIMARY KEY (`trade_id`),
    KEY `idx_trade_id` (`trade_id`),
    KEY `idx_asset_number` (`asset_number`),
    KEY `idx_cj_id` (`cj_id`),
    KEY `idx_timestamp` (`timestamp`)
) ENGINE = InnoDB AUTO_INCREMENT = 32 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '거래/작업 기록 테이블';

-- Table structure for table `users`
DROP TABLE IF EXISTS `users`;

CREATE TABLE `users` (
    `user_id` int NOT NULL AUTO_INCREMENT,
    `name` varchar(200) NOT NULL,
    `part` varchar(200) DEFAULT NULL,
    `cj_id` varchar(200) NOT NULL,
    `google_id` varchar(200) DEFAULT NULL,
    `state` varchar(200) DEFAULT 'work',
    `sec_level` int DEFAULT '1',
    `password` varchar(255) DEFAULT NULL,
    PRIMARY KEY (`user_id`),
    UNIQUE KEY `FK_cj_id` (`cj_id`) USING BTREE,
    UNIQUE KEY `login` (`google_id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 4784 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

SET FOREIGN_KEY_CHECKS = 1;