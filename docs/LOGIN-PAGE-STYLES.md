# ตัวอย่างหน้า Login จากแหล่ง Dev ฟรี

เปิดลิงก์ด้านล่างเพื่อดูตัวอย่างจริง แล้วบอกหมายเลขหรือชื่อที่ชอบ จะได้นำแนวทางมาปรับให้หน้าเข้าสู่ระบบของเรา

---

## 1. shadcn/ui Blocks (React/Next.js + Tailwind — ฟรี คัดลอกโค้ดได้)

**ลิงก์:** https://ui.shadcn.com/blocks/login

| แบบ | ลิงก์ดูตัวอย่าง | ลักษณะ |
|-----|------------------|--------|
| **login-01** | [เปิดตัวอย่าง](https://ui.shadcn.com/view/new-york-v4/login-01) | ฟอร์มเดียวกลางจอ สะอาด มินิมอล |
| **login-02** | [เปิดตัวอย่าง](https://ui.shadcn.com/view/new-york-v4/login-02) | สองคอลัมน์: ซ้ายฟอร์ม ขวารูป/ภาพ (Split) |
| **login-03** | [เปิดตัวอย่าง](https://ui.shadcn.com/view/new-york-v4/login-03) | พื้นหลังสี muted ฟอร์มกลางจอ |
| **login-04** | [เปิดตัวอย่าง](https://ui.shadcn.com/view/new-york-v4/login-04) | ฟอร์ม + รูป ใน layout กว้าง |
| **login-05** | [เปิดตัวอย่าง](https://ui.shadcn.com/view/new-york-v4/login-05) | อีเมลอย่างเดียว กล่องเล็กกลางจอ |

ติดตั้งแบบที่ชอบ: `npx shadcn add login-01` (เปลี่ยนเลขตามที่เลือก)

---

## 2. TailAdmin (Dashboard + หน้า Login ฟรี, มี Next.js)

**ลิงก์:** https://tailadmin.com  
**Demo Login:** https://demo.tailadmin.com/ (แล้วไปที่ Sign In / Auth)

- Template แดชบอร์ดฟรี มีหน้า login/signin
- รองรับ Next.js, React, Vue, HTML
- โหลดฟรีจาก GitHub: [tailadmin-free-tailwind-dashboard-template](https://github.com/TailAdmin/tailadmin-free-tailwind-dashboard-template)

---

## 3. PrebuiltUI – Login Forms (Tailwind ฟรี)

**ลิงก์:** https://prebuiltui.com/component/login-form

- หลายแบบ: Modern Login, Simple Login, Login with Social Auth
- คัดลอก HTML/JSX ได้
- ใช้ Tailwind CSS

---

## 4. Windy Toolbox – Login Templates (Tailwind ฟรี)

**ลิงก์:** https://windytoolbox.com/starter-templates/login

- Template หน้า login ฟรี
- มีแบบง่ายและแบบมีรูป
- GitHub link ในหน้า

---

## 5. Catalyst UI (Tailwind) – Sign In Demo

**ลิงก์:** https://catalyst.tailwindui.com/demos/auth/login

- หน้า Sign In จาก Catalyst UI Kit
- โทนเรียบ ใช้ร่วมกับ Tailwind ได้

---

## สรุปเลือกได้

| # | แหล่ง | แนะนำสำหรับ |
|---|--------|----------------|
| **1** | **shadcn login-01 ~ 05** | อยากได้แบบสำเร็จรูป React/Next + Tailwind มีหลาย layout |
| **2** | **TailAdmin** | อยากได้ทั้งแดชบอร์ด + login แบบชุดเดียวกัน |
| **3** | **PrebuiltUI** | อยากเลือกหลายแบบ login แล้วคัดลอกโค้ด |
| **4** | **Windy Toolbox** | อยากได้ template สั้นๆ ฟรี |
| **5** | **Catalyst** | ชอบสไตล์ Tailwind ทางการ |

**วิธีตอบ:**  
เช่น “เลือก shadcn login-02” หรือ “อยากได้แบบ TailAdmin” หรือ “แบบที่ 3 PrebuiltUI”  
แล้วจะปรับหน้า `DashboardLogin.tsx` ให้ใกล้เคียงแบบที่คุณเลือก (ยังใช้ Firebase Auth เหมือนเดิม)
