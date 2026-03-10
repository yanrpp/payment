# SQL Scripts ในโฟลเดอร์ database/

สคริปต์ในโฟลเดอร์นี้ใช้สำหรับสร้าง/อัปเดตตารางและข้อมูลใน MySQL

## ลำดับการรัน (ถ้ามีหลายสคริปต์)

1. **rbac_tables.sql** — สร้างตารางสิทธิ์/บทบาท (RBAC) รันก่อนถ้าต้องการระบบสิทธิ์
2. **kiosk_slides.sql** — สร้างตารางสไลด์ Kiosk
3. **kiosk_settings.sql** — สร้างตารางตั้งค่า Kiosk (หน่วงเวลาสไลด์ ฯลฯ) รันหลัง `kiosk_slides.sql` ถ้ามีการอ้างอิงกัน
4. **master_contract_types.sql** — สร้างตารางประเภทสัญญา (SINGLE, MULTI_DELIVERY, SERVICE, MULTI_YEAR, FRAMEWORK, CONSTRUCTION) และเพิ่มคอลัมน์ `contract_type_id` ใน proc_cases/contracts และ `contract_id` ใน purchase_orders (รันได้หลายครั้ง — idempotent)

รายละเอียดการติดตั้งฐานข้อมูลทั้งหมดดูที่ [INSTALL.md](./INSTALL.md)
