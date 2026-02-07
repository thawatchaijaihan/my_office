# โครงสร้าง NextAdmin (nextjs-admin-dashboard) และแนวทางประยุกต์ใช้

อ้างอิงจาก: https://github.com/NextAdminHQ/nextjs-admin-dashboard

---

## 1. โครงสร้างโฟลเดอร์หลัก (NextAdmin)

```
src/
├── app/                    # Next.js App Router
│   ├── (home)/             # Route group - หน้าแรก/แดชบอร์ด
│   │   ├── _components/    # components เฉพาะของ (home)
│   │   ├── fetch.ts        # ดึงข้อมูลสำหรับแดชบอร์ด (API/loading)
│   │   └── page.tsx        # หน้าแดชบอร์ดหลัก
│   ├── auth/               # ล็อกอิน / auth
│   ├── calendar/           # หน้าปฏิทิน
│   ├── charts/             # หน้าตัวอย่างกราฟ
│   ├── forms/              # ฟอร์ม
│   ├── pages/              # หน้าอื่นๆ
│   ├── profile/            # โปรไฟล์
│   ├── tables/             # หน้าตาราง
│   ├── ui-elements/        # องค์ประกอบ UI
│   ├── layout.tsx          # Root layout (Sidebar + Header + children)
│   └── providers.tsx       # Theme/context providers
├── assets/
├── components/
│   ├── Auth/
│   ├── Breadcrumbs/
│   ├── CalenderBox/
│   ├── Charts/             # กราฟ (ApexCharts)
│   ├── FormElements/
│   ├── Layouts/            # Sidebar, Header
│   │   ├── sidebar/        # sidebar + menu data + icons
│   │   └── header/
│   ├── Tables/
│   ├── ui/                 # ปุ่ม, dropdown, card ฯลฯ
│   ├── ui-elements/
│   ├── logo.tsx
│   └── period-picker.tsx
├── css/                    # Satoshi font, style.css
├── fonts/
├── hooks/
├── js/
├── lib/                    # utils (cn, etc.)
├── services/               # API calls
├── types/
└── utils/
```

---

## 2. สิ่งที่ NextAdmin ใช้ (เทียบกับโปรเจกต์เรา)

| หัวข้อ | NextAdmin | โปรเจกต์เรา (jaihan-assistant-linebot) |
|--------|-----------|----------------------------------------|
| Framework | Next.js 16, React 19 | Next.js 14, React 18 |
| กราฟ | ApexCharts (apexcharts, react-apexcharts) | Recharts |
| สไตล์ | Tailwind + css/style.css | Tailwind |
| Layout | Sidebar + Header ใน layout.tsx | Sidebar (DashboardNav) ใน dashboard/layout.tsx |
| โครงสร้าง app | Route groups: (home), auth, charts, tables… | app/dashboard/*, app/api/* |
| Theme | next-themes (dark/light) | ไม่มี (ใช้สีคงที่) |
| Utils | class-variance-authority, clsx, tailwind-merge (cn) | - |

---

## 3. ไฟล์สำคัญที่นำมาประยุกต์ได้

### 3.1 Layout แบบ Sidebar + Main
- **NextAdmin:** `src/app/layout.tsx` ใช้ `<Sidebar />` + `<Header />` + `{children}` (มี Providers, NextTopLoader)
- **เรา:** `app/dashboard/layout.tsx` มี sidebar + main อยู่แล้ว โครงคล้ายกัน

### 3.2 Sidebar / เมนู
- **NextAdmin:** `src/components/Layouts/sidebar/`  
  - `index.tsx` – Sidebar component  
  - `data.ts` (หรือเทียบเท่า) – NAV_DATA สำหรับเมนู  
  - `menu-item.tsx` – รายการเมนู (รองรับ submenu, active state)  
  - `sidebar-context` – state เปิด/ปิด (mobile)
- **เรา:** `app/dashboard/DashboardNav.tsx` ทำหน้าที่เดียวกัน  
  **ประยุกต์:** ดูโครง `NAV_DATA` และการทำ active state / submenu จาก NextAdmin แล้วปรับ DashboardNav ให้รองรับกลุ่มเมนูหรือไอคอนแบบเดียวกันได้

### 3.3 การดึงข้อมูลแดชบอร์ด
- **NextAdmin:** `src/app/(home)/fetch.ts` – รวมฟังก์ชัน fetch สำหรับ charts/tables แล้วใช้ใน page
- **เรา:** ใช้ `app/api/dashboard/route.ts` + fetch ใน `app/dashboard/page.tsx`  
  **ประยุกต์:** ถ้าต้องการ loading skeleton แบบ NextAdmin สามารถเพิ่ม state loading ใน page แล้วใช้โครงจาก (home)/_components เป็นแนวทาง

### 3.4 กราฟ
- **NextAdmin:** ใช้ ApexCharts ผ่าน `src/components/Charts/` และหน้า `src/app/charts/`
- **เรา:** ใช้ Recharts ใน `app/dashboard/DashboardCharts.tsx`  
  **ประยุกต์:** ไม่ต้องเปลี่ยน library แค่ดูการจัด layout การ์ด/กราฟและชื่อหัวข้อจาก NextAdmin แล้วปรับ CSS/โครงหน้าเราให้สอดคล้อง

### 3.5 UI ย่อย (ปุ่ม, การ์ด, dropdown)
- **NextAdmin:** `src/components/ui/` – ปุ่ม, การ์ด, dropdown ฯลฯ
- **เรา:** ใช้ Tailwind ตรงๆ  
  **ประยุกต์:** ถ้าต้องการให้การ์ดหรือปุ่มมีสไตล์เดียวกับ NextAdmin สามารถคัดเฉพาะ component ที่ต้องการ (เช่น Card, Button) มาใส่ใน `components/ui/` ของเรา แล้วใช้ Tailwind + cn (ถ้าเพิ่ม clsx/tailwind-merge)

---

## 4. แนวทางประยุกต์ใช้กับโปรเจกต์เรา (สรุป)

### ระดับ 1 – โครงสร้าง (ไม่ต้องเปลี่ยน library)
- **Route group:** ถ้าต้องการแยก “กลุ่มหน้าแดชบอร์ด” ชัดเจน สามารถสร้าง `app/dashboard/(main)/` แล้วย้าย page ปัจจุบันเข้าไป (เลือกได้).
- **โฟลเดอร์ components:** แยก component ใหญ่ๆ ออกเป็นโฟลเดอร์ได้ เช่น  
  `app/dashboard/components/`  
  - `Charts/` – DashboardCharts และกราฟย่อย  
  - `Layouts/` – ส่วนที่เกี่ยวกับ layout แดชบอร์ด (ถ้ามี)

### ระดับ 2 – Sidebar / เมนู
- ดู `Layouts/sidebar/` ของ NextAdmin (โดยเฉพาะโครง NAV_DATA และ menu-item).
- ปรับ `DashboardNav.tsx` ให้:
  - ใช้โครงข้อมูลเมนูเป็น array of sections (เหมือน NAV_DATA).
  - รองรับ submenu (ถ้าต้องการ) และไฮไลต์ path ปัจจุบันให้ชัดเหมือน NextAdmin.

### ระดับ 3 – การ์ดและกราฟ
- ดูหน้า `(home)/page.tsx` ว่าเขาจัด grid การ์ด KPI และบล็อกกราฟอย่างไร.
- ปรับคลาสใน `DashboardCharts.tsx` (grid, gap, rounded, shadow) ให้ใกล้เคียง NextAdmin โดยยังใช้ Recharts อยู่.

### ระดับ 4 – Loading / UX
- ดู `(home)/fetch.ts` และการแสดง loading ใน (home)/_components.
- เพิ่ม loading state ใน `app/dashboard/page.tsx` และใช้ skeleton หรือ spinner ตอนดึงจาก `/api/dashboard`.

### ระดับ 5 – Theme (ถ้าต้องการ)
- NextAdmin ใช้ `next-themes`.
- ถ้าอยากได้ dark mode: ติดตั้ง `next-themes` แล้วห่อ layout ด้วย `<ThemeProvider>` และใช้ class dark: ใน Tailwind ตามที่ NextAdmin ทำ.

---

## 5. สิ่งที่ไม่จำเป็นต้องเปลี่ยน

- **ไม่ต้องเปลี่ยนจาก Recharts เป็น ApexCharts** – โปรเจกต์เราใช้ Recharts อยู่แล้ว แค่จัด layout และสไตล์ให้สอดคล้อง.
- **ไม่ต้องเปลี่ยนโครง API** – เราใช้ `/api/dashboard` และ route อื่นๆ ได้ตามเดิม.
- **ไม่ต้องใช้ Next.js 16 / React 19** – ค่อยอัปเกรดเมื่อพร้อม โครงสร้างจาก NextAdmin ใช้กับ Next 14 ได้.

---

## 6. ลิงก์ไฟล์ NextAdmin ที่ควรเปิดดู

- Layout + Sidebar + Header:  
  https://github.com/NextAdminHQ/nextjs-admin-dashboard/tree/main/src/app  
  https://github.com/NextAdminHQ/nextjs-admin-dashboard/tree/main/src/components/Layouts
- หน้าแดชบอร์ดหลัก + fetch:  
  https://github.com/NextAdminHQ/nextjs-admin-dashboard/tree/main/src/app/(home)
- กราฟและ UI:  
  https://github.com/NextAdminHQ/nextjs-admin-dashboard/tree/main/src/components/Charts  
  https://github.com/NextAdminHQ/nextjs-admin-dashboard/tree/main/src/components/ui

---

ถ้าต้องการให้ช่วยลงมือปรับไฟล์ใดเป็นอันดับแรก (เช่น DashboardNav, layout, หรือการ์ด KPI) บอกได้เลยว่าจะเริ่มจากส่วนไหน
