# โครงสร้างโฟลเดอร์และไฟล์ – การทบทวนและข้อเสนอแนะ

เอกสารนี้สรุปผลการทบทวนโครงสร้างโปรเจกต์เทียบกับสถาปัตยกรรมมาตรฐานของ **Next.js 15 (Pages Router)** และข้อเสนอแนะในการจัดระเบียบโดยไม่เปลี่ยนพฤติกรรมระบบหรือเพิ่มความซับซ้อน

---

## 1. โครงสร้างปัจจุบันที่สอดคล้องกับมาตรฐาน

| โฟลเดอร์/ไฟล์ | สถานะ | หมายเหตุ |
|----------------|--------|----------|
| `pages/` | ✅ มาตรฐาน | ใช้ Pages Router ถูกต้อง (`_app.tsx`, `_document.tsx`, `pages/api/`) |
| `pages/api/` | ✅ มาตรฐาน | API routes อยู่ใต้ `pages/api/` ตามที่ Next.js กำหนด |
| `components/` | ✅ รับได้ | Component อยู่ที่ root; มีการแบ่ง domain (cases, layout, procurement, evidence) |
| `lib/` | ✅ มาตรฐาน | Utilities, auth, db, workflow อยู่ใต้ `lib/` |
| `config/` | ✅ รับได้ | ค่า config (database, fonts, site) แยกจากโค้ด |
| `types/` | ✅ มาตรฐาน | TypeScript types อยู่ที่ root |
| `styles/` | ✅ มาตรฐาน | มี `globals.css` |
| `public/` | ✅ มาตรฐาน | Static assets |
| `tsconfig.json` paths `@/*` → `./*` | ✅ มาตรฐาน | Alias ชี้ที่ root ใช้ได้สม่ำเสมอ |

---

## 2. ข้อเสนอแนะที่ไม่มีผลต่อการทำงาน

### 2.1 โฟลเดอร์ `src/auth/` (App Router style)

- **สถานะ:** โปรเจกต์ใช้ **Pages Router** เท่านั้น (ไม่มีโฟลเดอร์ `app/`)
- **เนื้อหา:** มี `src/auth/login/route.ts`, `src/auth/logout/route.ts`, `src/auth/debug-role/route.ts` แบบ App Router (export `POST`, ใช้ `NextRequest`/`NextResponse`)
- **ความจริง:** การเรียก login/logout ไปที่ `pages/api/auth/login.ts` และ `logout.ts` ไม่ได้ใช้ `src/auth/`
- **ข้อเสนอแนะ:**
  - เพิ่ม README ใน `src/` หรือ `src/auth/` อธิบายว่าโฟลเดอร์นี้เป็นโค้ดแบบ App Router (หรือ legacy) และปัจจุบัน API จริงอยู่ที่ `pages/api/auth/`
  - หรือในระยะยาว ถ้าตัดสินใจไม่ใช้ App Router เลย อาจย้าย logic ที่ยังใช้อยู่ไปรวมที่ `pages/api/auth/` แล้วพิจารณาลบ `src/auth/` (ทำเมื่อพร้อมเท่านั้น และต้องไม่กระทบการล็อกอิน/ล็อกเอาท์ปัจจุบัน)

### 2.2 ไฟล์ที่ root: `hero.ts`

- **สถานะ:** export การตั้งค่า theme ของ Heroui
- **ข้อเสนอแนะ:** เพื่อให้สอดคล้องกับ `config/` อาจพิจารณาย้ายเป็น `config/theme.ts` (หรือ `config/heroui.ts`) และอัปเดต import ใน `_app.tsx` / ที่อ้างอิงเท่านั้น — **ถ้าทำต้องแก้ทุกที่ที่ import จาก `@/hero`** และทดสอบ theme ให้เหมือนเดิม

### 2.3 โฟลเดอร์ `database/`

- **สถานะ:** เก็บ SQL scripts (`rbac_tables.sql`, `kiosk_slides.sql`, ฯลฯ)
- **ข้อเสนอแนะ:** โครงสร้างปัจจุบันชัดเจนแล้ว ไม่จำเป็นต้องย้าย อาจเพิ่ม README สั้นๆ ใน `database/` ระบุว่าควรรันสคริปต์ไหนตามลำดับ (ถ้ามี) เพื่อให้คนใหม่เข้าใจ

### 2.4 ชื่อไฟล์ใน `components/`

- **สถานะ:** มีทั้งแบบ kebab-case ที่ root (`navbar.tsx`, `theme-switch.tsx`) และ PascalCase ในโฟลเดอร์ (`layout/Sidebar.tsx`, `procurement/CaseTimeline.tsx`)
- **ข้อเสนอแนะ:** ใช้แนวทางเดียวกับที่ทีมชอบ เช่น ใช้ PascalCase สำหรับ component เสมอ (`Navbar.tsx`, `ThemeSwitch.tsx`) แล้วค่อย refactor ทีละไฟล์เมื่อมีการแก้ไฟล์นั้น — ไม่จำเป็นต้องย้ายหรือเปลี่ยนชื่อครั้งเดียวทั้งหมด

### 2.5 API routes ที่มีทั้ง `index.ts` และ `route.ts`

- **ตัวอย่าง:** `pages/api/cases/[id]/acceptance/` มีทั้ง `index.ts` และ `route.ts`
- **สถานะ:** ใน Pages Router ไฟล์ที่ export default handler จะถูกใช้เป็น route นั้น
- **ข้อเสนอแนะ:** ตรวจสอบในโค้ดว่า route ที่เรียกจริงใช้ไฟล์ไหน (เช่น `index.ts` หรือ `route.ts`) แล้วใส่ comment ในโฟลเดอร์หรือในไฟล์ที่ไม่ได้ใช้ว่าอยู่เพื่ออะไร (legacy / อ้างอิง) เพื่อไม่ให้สับสนในอนาคต

### 2.6 โฟลเดอร์ `layouts/` ที่ root

- **สถานะ:** ใช้จาก `_app.tsx` สำหรับ layout หลัก (เช่น ProcurementLayout)
- **ข้อเสนอแนะ:** โครงสร้างนี้ใช้ได้กับ Next.js Pages Router ไม่จำเป็นต้องย้ายไป `components/layouts` เว้นแต่ทีมต้องการรวม layout ไว้กับ component อื่นใน `components/` (การย้ายต้องแก้ import เท่านั้น ไม่เปลี่ยน logic)

---

## 3. สิ่งที่ไม่แนะนำให้เปลี่ยน (เพื่อไม่กระทบพฤติกรรม)

- **ไม่ย้าย** `pages/` หรือ `pages/api/` ไปใต้ `src/` — Next.js Pages Router ใช้ path นี้โดยตรง
- **ไม่สร้าง** โฟลเดอร์ `app/` หรือย้าย route ไป App Router โดยไม่มีการตัดสินใจและ migration plan ชัดเจน
- **ไม่รวม** `lib/workflow.ts` กับ `lib/workflow/database.ts` เป็นไฟล์เดียว โดยไม่ตรวจสอบว่าโค้ดทั้งหมดยังทำงานเหมือนเดิม
- **ไม่เปลี่ยน** ชื่อหรือ path ของ API ที่ frontend หรือระบบภายนอกเรียกใช้

---

## 4. สรุปแนวทางที่แนะนำ

1. **คงโครงสร้างหลัก:** `pages/`, `components/`, `lib/`, `config/`, `types/`, `styles/`, `public/` ไว้ตามเดิม
2. **จัดทำเอกสาร/comment:** อธิบายบทบาทของ `src/auth/` และโฟลเดอร์ API ที่มีทั้ง `index.ts` และ `route.ts`
3. **ตั้งกฎชื่อไฟล์:** ตกลงกันในทีม (เช่น PascalCase สำหรับ component) แล้วค่อยใช้เมื่อแก้ไฟล์
4. **พิจารณาเฉพาะจุด:** ย้าย `hero.ts` → `config/theme.ts` และการลบหรือรวม `src/auth/` ทำเมื่อพร้อมและมี test / การทดสอบการล็อกอินแล้ว

การปรับตามข้อเสนอแนะข้างต้นเป็นแบบค่อยเป็นค่อยไป และไม่บังคับให้เปลี่ยนพฤติกรรมระบบหรือเพิ่มความซับซ้อนของโครงสร้างใหม่
