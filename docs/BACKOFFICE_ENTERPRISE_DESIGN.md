# ออกแบบระบบหลังบ้าน (Backoffice CMS + Procurement Management Platform) ระดับ Enterprise

เอกสารนี้อธิบายสถาปัตยกรรมและโมดูลของระบบระดับองค์กรใหญ่ สำหรับโรงพยาบาล/หน่วยงานรัฐ — ระบบจัดซื้อจัดจ้างครบวงจร + เว็บประชาสัมพันธ์ + Portal บริษัท

---

## 1. ภาพรวมสถาปัตยกรรมระบบ

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        จุดเข้าใช้งานหลัก (หน้าแรก /)                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  Public Website (Frontend)  │  Vendor Portal  │  Backoffice (Admin System)   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Public Website (Frontend)
- ข่าว / ประกาศ / TOR / ผู้ชนะ
- ค้นหาโครงการ
- ตรวจสอบสถานะบริษัท
- ดาวน์โหลดเอกสาร

### Vendor Portal
- สมัครบริษัท
- ส่งเอกสาร
- ติดตามสถานะ
- แจ้งเตือน
- ดาวน์โหลด PO / สัญญา

### Backoffice (Admin System)
- **CMS** จัดการหน้าเว็บ
- **Workflow** จัดซื้อจัดจ้าง
- **การเงิน / ทักท้วง**
- **สัญญา / หลาย PO / หลายงวด**
- **Dashboard** วิเคราะห์
- **Audit / Log**
- **RBAC** สิทธิ์การใช้งาน

---

## 2. โมดูลระบบหลังบ้าน (ครบทุกมิติ)

### A. CMS Website Builder (ระดับ Enterprise)

| ฟีเจอร์ | รายละเอียด |
|--------|-------------|
| Page Builder | Drag & Drop, Layout Section / Container / Column |
| Component Library | Hero, Banner, Card, Table, Timeline |
| Dynamic Data Binding | ผูกกับฐานข้อมูลโครงการ |
| Version Control | หน้าเว็บ Draft / Publish Workflow |
| SEO Tools | Meta Tag, OG Image, Sitemap Auto |
| Multi-language | รองรับหลายภาษา |
| Media Library | จัดการไฟล์สื่อ |
| Permission | แก้ไขเฉพาะบางหน้า |

### B. Procurement Core Workflow

Flow ครบวงจร:

```
ร่างเรื่อง → เสนอขออนุมัติ → อนุมัติหลักการ → ประกาศ TOR → รับซอง → เปิดซอง
→ ประกาศผู้ชนะ → เห็นชอบจัดซื้อ → ออก PO → ส่งมอบ → ตรวจรับ → ส่งการเงิน
→ การเงินทักท้วง (ถ้ามี) → จ่ายเงิน → ปิดโครงการ
```

### C. Contract Management

- 1 เรื่อง → หลายสัญญา
- 1 สัญญา → หลาย PO
- 1 PO → หลาย Invoice / หลายงวดจ่าย

### D. Finance Objection System

- เปิดทักท้วง, แนบเอกสาร, ระบุประเภทปัญหา
- Tracking Status, SLA Tracking, Escalation

### E. Analytics Dashboard

- งบประมาณรวม, แยกตามประเภทสัญญา/หน่วยงาน/บริษัท
- ระยะเวลาเฉลี่ยแต่ละขั้นตอน
- วงเงินใช้จริง vs วงเงินอนุมัติ, KPI การเงิน

---

## 3. UI Backoffice (ระดับองค์กรใหญ่)

### A. Layout โครงสร้างหลัก

```
┌─────────────────────────────────────────────────┐
│ TOP BAR: Logo | Search | Notification | User    │
├──────────────┬──────────────────────────────────┤
│ Sidebar      │ Main Panel (Dynamic Page)        │
│ Menu Tree    │                                  │
└──────────────┴──────────────────────────────────┘
```

### B. Dashboard หน้าหลัก

**KPI Cards**

| KPI | ค่า |
|-----|-----|
| โครงการทั้งหมด | 1,248 |
| รอดำเนินการ | 85 |
| วงเงินปีนี้ | 480 ล้านบาท |
| ทักท้วงค้าง | 12 เรื่อง |

**กราฟวิเคราะห์**
- งบประมาณรายเดือน
- ระยะเวลาเฉลี่ยต่อ Workflow
- Top 10 บริษัท
- แยกตามประเภทสัญญา

### C. หน้า Case Detail (Enterprise UI)

**Header:** Case No | ชื่อเรื่อง | สถานะ | วงเงิน | ประเภทสัญญา

**Tab Menu:** Overview | Workflow | PO | Invoice | Finance | Documents | Audit

- **Tab Workflow:** Timeline Graphical, วันที่, ผู้ดำเนินการ, ปุ่ม Change Status (ผ่าน Validation)
- **Tab PO:** ตาราง PO, % ใช้วงเงิน, งวดที่จ่ายแล้ว
- **Tab Finance:** รายการทักท้วง, สถานะ, SLA

---

## 4. Vendor Portal UI

- หน้าแรกบริษัท: สถานะโครงการทั้งหมด, แจ้งเตือน, ดาวน์โหลดเอกสาร
- หน้า Track Status: กรอกเลขที่โครงการ/เลข PO → แสดง Timeline, เอกสารที่เกี่ยวข้อง

---

## 5. RBAC สิทธิ์ระดับองค์กร

| Role | สิทธิ์ |
|------|--------|
| Admin | ทุกอย่าง |
| Procurement | จัดซื้อ |
| Finance | การเงิน |
| Director | เห็นชอบ |
| Vendor | ดูเฉพาะของตน |

---

## 6. ตารางฐานข้อมูลที่ควรมี

- `cases`, `case_status_logs`, `workflow_statuses`, `workflow_transitions`
- `contract_types`, `contracts`, `purchase_orders`, `invoices`, `invoice_installments`
- `finance_objections`, `objection_messages`, `audit_logs`
- `media_files`, `page_contents`, `page_versions`, `seo_settings`
- `vendor_accounts`, `vendor_documents`, `notifications`

---

## 7. ฟีเจอร์ระดับ Enterprise ที่ต้องเพิ่ม

- **SLA Monitor** — แจ้งเตือนถ้าเกินเวลามาตรฐาน
- **Auto Reminder** — ส่ง Email / LINE
- **e-Signature Integration** — รองรับการเซ็นดิจิทัล
- **Budget Control Engine** — คุมงบตามสัญญาแบบ Real-time
- **Risk Scoring** — ประเมินความเสี่ยงโครงการ
- **Document Version Control** — ควบคุมเวอร์ชันเอกสาร

---

## 8. Dashboard วิเคราะห์ขั้นสูง

- Cost per Department
- Cycle Time per Workflow Stage
- Average Finance Objection Duration
- Procurement Lead Time
- Budget Burn Rate

---

## 9. จุดที่เพิ่มเข้ามาให้ครบระดับ Enterprise

- **Case Budget Ledger** — เก็บ movement ของงบทุกครั้ง
- **Multi-Year Budget** — รองรับโครงการข้ามปี
- **Performance KPI Vendor** — วัด performance บริษัท
- **Procurement Calendar** — ปฏิทินจัดซื้อ
- **Internal Chat per Case** — คุยภายในเรื่องเดียวกัน

---

## 10. ภาพรวมระดับองค์กรใหญ่

ระบบนี้จะเป็น:

- **CMS + ERP Procurement**
- **Workflow Engine**
- **Finance Objection Engine**
- **Contract Control System**
- **Vendor Portal**
- **Analytics BI**
- **Audit & Compliance Ready**

ระดับเดียวกับระบบ ERP โรงพยาบาลเอกชนขนาดใหญ่ และระบบ e-GP ที่ปรับแต่งเฉพาะองค์กร
