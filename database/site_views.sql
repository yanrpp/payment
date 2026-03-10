-- ตารางบันทึกการเข้าชมเว็บไซต์ (ระดับ business)
-- ใช้สำหรับวิเคราะห์: จำนวนการดูแต่ละหน้า, การเปิดดูแต่ละรายการ (แผน/TOR/ผู้ชนะ)
-- รันได้หลายครั้ง (IF NOT EXISTS)

CREATE TABLE IF NOT EXISTS site_views (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  path VARCHAR(512) NOT NULL COMMENT ' path หน้าที่เข้าชม เช่น /, /plan, /tor, /winners',
  content_type VARCHAR(64) NULL COMMENT ' ประเภทเนื้อหาที่เปิดดู: plan | tor | winner | news',
  content_key VARCHAR(512) NULL COMMENT ' รหัส/ชื่อรายการ เช่น title หรือ index',
  content_title VARCHAR(512) NULL COMMENT ' ชื่อเรื่องสำหรับแสดงในรายงาน',
  viewed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  session_id VARCHAR(128) NULL COMMENT ' session/cookie เพื่อประมาณ unique visitor (ไม่เก็บ IP)',
  PRIMARY KEY (id),
  KEY idx_site_views_path (path(255)),
  KEY idx_site_views_viewed_at (viewed_at),
  KEY idx_site_views_content (content_type(32), content_key(255)),
  KEY idx_site_views_path_date (path(255), viewed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='บันทึกการเข้าชมเว็บไซต์และรายการเนื้อหา';
