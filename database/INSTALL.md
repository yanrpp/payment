# 📦 คู่มือติดตั้งฐานข้อมูลระบบจัดซื้อจัดจ้าง

## 🎯 เป้าหมาย

สร้างฐานข้อมูล `procurement_db` บน MySQL Server `192.168.238.211` พร้อมตารางและข้อมูลตัวอย่าง

## 📋 ขั้นตอนการติดตั้ง

### ขั้นตอนที่ 1: ตรวจสอบการเชื่อมต่อ

```bash
# ทดสอบการเชื่อมต่อ MySQL
mysql -h 192.168.238.211 -u root -p
# ใส่ password: rpp14641
```

### ขั้นตอนที่ 2: สร้างฐานข้อมูลและตาราง

#### วิธีที่ 1: ใช้ MySQL Command Line

```bash
# 1. เชื่อมต่อ MySQL
mysql -h 192.168.238.211 -u root -p

# 2. รัน SQL script
source database/create_tables.sql

# 3. ตรวจสอบว่าตารางถูกสร้างแล้ว
USE procurement_db;
SHOW TABLES;
```

#### วิธีที่ 2: ใช้ phpMyAdmin

1. เปิด phpMyAdmin: `http://192.168.238.211/phpmyadmin`
2. Login ด้วย username: `root`, password: `rpp14641`
3. สร้าง Database ใหม่:
   - คลิก "New" (สร้างใหม่)
   - ตั้งชื่อ: `procurement_db`
   - Collation: `utf8mb4_unicode_ci`
   - คลิก "Create"
4. Import SQL Script:
   - เลือก database `procurement_db`
   - ไปที่แท็บ "Import"
   - เลือกไฟล์ `database/create_tables.sql`
   - คลิก "Go"

### ขั้นตอนที่ 3: ใส่ข้อมูลตัวอย่าง

#### วิธีที่ 1: ใช้ MySQL Command Line

```bash
mysql -h 192.168.238.211 -u root -p procurement_db < database/seed_data.sql
```

#### วิธีที่ 2: ใช้ phpMyAdmin

1. เลือก database `procurement_db`
2. ไปที่แท็บ "Import"
3. เลือกไฟล์ `database/seed_data.sql`
4. คลิก "Go"

### ขั้นตอนที่ 4: ตรวจสอบข้อมูล

```sql
USE procurement_db;

-- ตรวจสอบตาราง
SHOW TABLES;

-- ตรวจสอบข้อมูล
SELECT COUNT(*) as total_cases FROM proc_cases;
SELECT COUNT(*) as total_depts FROM departments;
SELECT COUNT(*) as total_users FROM users;
SELECT COUNT(*) as total_vendors FROM vendors;

-- ดูเรื่องที่ 15
SELECT * FROM proc_cases WHERE case_no = 15;
```

### ขั้นตอนที่ 5: ทดสอบ API

```bash
# รัน Next.js dev server
npm run dev

# เปิดเบราว์เซอร์
# ทดสอบ API: http://localhost:3000/api/db/test-mysql
# ควรเห็นข้อมูล:
# {
#   "success": true,
#   "message": "เชื่อมต่อ MySQL สำเร็จ",
#   "tables": { "total": 15, ... },
#   "data": { "cases": 1, "departments": 8, ... }
# }
```

## ✅ Checklist

- [ ] เชื่อมต่อ MySQL Server ได้ (`192.168.238.211`)
- [ ] สร้าง Database `procurement_db` แล้ว
- [ ] รัน `create_tables.sql` สำเร็จ (มี 15 ตาราง)
- [ ] รัน `seed_data.sql` สำเร็จ (มีข้อมูลตัวอย่าง)
- [ ] ทดสอบ API `/api/db/test-mysql` สำเร็จ
- [ ] ทดสอบ API `/api/cases` ได้ข้อมูล

## 🔧 Troubleshooting

### ปัญหา: ไม่สามารถเชื่อมต่อ MySQL

**แก้ไข:**

1. ตรวจสอบว่า MySQL Server ทำงานอยู่
2. ตรวจสอบ Firewall ว่าอนุญาต port 3306 หรือไม่
3. ตรวจสอบ username/password ใน `.env.local`

### ปัญหา: Error "Table already exists"

**แก้ไข:**

```sql
DROP DATABASE IF EXISTS procurement_db;
CREATE DATABASE procurement_db;
-- แล้วรัน create_tables.sql ใหม่
```

### ปัญหา: Error "Foreign key constraint fails"

**แก้ไข:**

- ตรวจสอบว่ามีข้อมูลในตาราง Master Data ก่อน (departments, users, vendors)
- รัน `seed_data.sql` ตามลำดับ

### ปัญหา: API ยังได้ 404

**แก้ไข:**

1. Restart Next.js dev server
2. ตรวจสอบว่าไฟล์ `pages/api/cases/route.ts` มีอยู่
3. ตรวจสอบ console สำหรับ error messages

## 📊 ข้อมูลที่ควรมีหลังติดตั้ง

### Master Data

- ✅ 8 หน่วยงาน (departments)
- ✅ 7 บทบาท (roles)
- ✅ 7 ผู้ใช้งาน (users)
- ✅ 3 ผู้ขาย (vendors)

### Procurement Data

- ✅ 1 เรื่อง (case_no = 15)
- ✅ 1 กันเงิน (budget_reservation)
- ✅ 1 milestone
- ✅ 1 สัญญา/PO
- ✅ 1 ตรวจรับ
- ✅ 1 ใบแจ้งหนี้
- ✅ 8 workflow steps (timeline)

## (ตัวเลือก) ตารางสไลด์ Kiosk

ถ้าต้องการใช้ฟีเจอร์สไลด์อัตโนมัติบนหน้าแรก Kiosk ให้รัน:

```sql
SOURCE database/kiosk_slides.sql;
SOURCE database/kiosk_settings.sql;
```

หรือ Import ไฟล์ `database/kiosk_slides.sql` และ `database/kiosk_settings.sql` ผ่าน phpMyAdmin ในฐานข้อมูลที่ใช้กับระบบ  
ตาราง `kiosk_settings` ใช้เก็บหน่วงเวลาสไลด์ (วินาที) ที่ Admin กำหนดจากหน้า ตั้งค่า → เนื้อหา Kiosk

## 🎉 เสร็จสิ้น!

หลังจากติดตั้งเสร็จ ระบบควรจะ:

- ✅ เชื่อมต่อฐานข้อมูลได้
- ✅ แสดงสถิติในหน้าแรกได้
- ✅ แสดงรายการเรื่องได้
- ✅ แสดงรายละเอียดเรื่องได้
