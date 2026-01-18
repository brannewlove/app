-- Database Schema Dump
-- Generated on 2026. 1. 18. 오후 8:15:36

SET FOREIGN_KEY_CHECKS = 0;

-- Table structure for table `assets`
DROP TABLE IF EXISTS `assets`;
CREATE TABLE `assets` (
  `asset_id` int NOT NULL AUTO_INCREMENT,
  `category` varchar(20) DEFAULT NULL,
  `model` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `serial_number` varchar(50) DEFAULT NULL,
  `asset_number` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `day_of_start` date DEFAULT NULL,
  `day_of_end` date DEFAULT NULL,
  `unit_price` int DEFAULT NULL,
  `contract_month` int GENERATED ALWAYS AS ((timestampdiff(MONTH,`day_of_start`,`day_of_end`) + 1)) VIRTUAL,
  `in_user` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `state` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT 'wait',
  PRIMARY KEY (`asset_id`),
  UNIQUE KEY `asset_number` (`asset_number`) USING BTREE,
  KEY `FK_users` (`in_user`) USING BTREE,
  CONSTRAINT `assets_ibfk_1` FOREIGN KEY (`in_user`) REFERENCES `users` (`cj_id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB AUTO_INCREMENT=2396 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Table structure for table `confirmed_assets`
DROP TABLE IF EXISTS `confirmed_assets`;
CREATE TABLE `confirmed_assets` (
  `id` int NOT NULL AUTO_INCREMENT,
  `asset_number` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cj_id` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '사원ID(확인 시점의 사용자)',
  `confirmed_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '확인 시간',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_asset_user` (`asset_number`,`cj_id`),
  KEY `idx_asset_id` (`asset_number`),
  KEY `idx_cj_id` (`cj_id`)
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='사용자 변경 확인 테이블';

-- Table structure for table `returned_assets`
DROP TABLE IF EXISTS `returned_assets`;
CREATE TABLE `returned_assets` (
  `return_id` int NOT NULL AUTO_INCREMENT,
  `asset_number` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '자산번호',
  `return_reason` tinytext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '반납사유',
  `model` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '모델명',
  `serial_number` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '시리얼번호',
  `return_type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '반납유형',
  `end_date` date DEFAULT NULL COMMENT '자산 사용 종료일',
  `user_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '반납 사용자 ID',
  `user_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '반납 사용자명',
  `department` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '반납 사용자 부서',
  `handover_date` date DEFAULT NULL COMMENT '인계일',
  `release_status` tinyint(1) DEFAULT '0' COMMENT '출고여부',
  `it_room_stock` tinyint(1) DEFAULT '0' COMMENT '전산실입고',
  `low_format` tinyint(1) DEFAULT '0' COMMENT '로우포맷',
  `it_return` tinyint(1) DEFAULT '0' COMMENT '전산반납',
  `mail_return` tinyint(1) DEFAULT '0' COMMENT '메일반납',
  `actual_return` tinyint(1) DEFAULT '0' COMMENT '실재반납',
  `complete` tinyint(1) DEFAULT '0' COMMENT '완료',
  `remarks` tinytext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '비고',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '생성일',
  PRIMARY KEY (`return_id`),
  UNIQUE KEY `UQ_returned_assets_asset_number` (`asset_number`),
  KEY `idx_returned_asset_number` (`asset_number`),
  KEY `idx_returned_user_id` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=39 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='반납 자산 테이블';

-- Table structure for table `trde`
DROP TABLE IF EXISTS `trde`;
CREATE TABLE `trde` (
  `trade_id` int NOT NULL AUTO_INCREMENT,
  `timestamp` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `work_type` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `asset_number` varchar(20) DEFAULT NULL,
  `cj_id` varchar(20) NOT NULL,
  `memo` tinytext,
  `ex_user` varchar(20) DEFAULT NULL,
  PRIMARY KEY (`trade_id`),
  KEY `asset_id` (`asset_number`) USING BTREE,
  KEY `cj_id` (`cj_id`) USING BTREE,
  CONSTRAINT `trde_ibfk_1` FOREIGN KEY (`cj_id`) REFERENCES `users` (`cj_id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `trde_ibfk_2` FOREIGN KEY (`asset_number`) REFERENCES `assets` (`asset_number`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB AUTO_INCREMENT=100 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Table structure for table `users`
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `user_id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `part` varchar(50) DEFAULT NULL,
  `cj_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `google_id` varchar(20) DEFAULT NULL,
  `state` varchar(20) DEFAULT 'work',
  `sec_level` int DEFAULT '1',
  `password` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `FK_cj_id` (`cj_id`) USING BTREE,
  UNIQUE KEY `login` (`google_id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=1803 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

SET FOREIGN_KEY_CHECKS = 1;
