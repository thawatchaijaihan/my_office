# Jaihan Assistant – LINE Bot AI

LINE Bot ที่ใช้ Google Gemini เป็น AI ตอบคำถาม รองรับการ deploy บน Firebase App Hosting

## โครงสร้างโปรเจกต์

```
jaihan-assistant-linebot/
├── app/
│   ├── api/webhook/route.ts   # LINE Webhook endpoint
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── lib/
│   ├── config.ts              # Environment config
│   ├── line.ts                # LINE SDK client
│   └── gemini.ts              # Gemini AI
├── .env.example
├── package.json
└── README.md
```

## การติดตั้ง

```bash
npm install
```

## การตั้งค่า

1. คัดลอก `.env.example` เป็น `.env.local`
2. กรอกค่าตามที่ได้รับจาก:
   - **LINE Developers Console** → Channel Secret, Channel Access Token
   - **Google AI Studio** → API Key

```bash
cp .env.example .env.local
```

## รันในเครื่อง

```bash
npm run dev
```

เปิด http://localhost:3000

## Webhook

LINE จะส่งเหตุการณ์มายัง:

```
POST https://<your-domain>/api/webhook
```

ใช้ URL นี้ตั้งค่า Webhook URL ใน LINE Developers Console

## Deploy บน Firebase App Hosting

1. Push โค้ดขึ้น GitHub
2. ใน Firebase Console → **Build → App Hosting** → Create backend
3. เชื่อม GitHub repository (root directory = `/`, live branch = `main`)
4. ตั้งค่า secrets ใน App Hosting (Cloud Secret Manager) ให้ตรงกับ `apphosting.yaml`:
   - `lineChannelSecret` → LINE Channel Secret
   - `lineChannelAccessToken` → LINE Channel Access Token (long-lived)
   - `geminiApiKey` → Google Gemini API key

สามารถตั้ง secrets ได้ด้วย Firebase CLI (ต้อง login และเลือกโปรเจกต์ให้ถูกต้อง):

```bash
firebase login
firebase use <PROJECT_ID>

firebase apphosting:secrets:set lineChannelSecret
firebase apphosting:secrets:set lineChannelAccessToken
firebase apphosting:secrets:set geminiApiKey
```

5. Trigger rollout โดย push เข้า `main` (หรือกด Deploy/rollout ใน Firebase Console)

## สิ่งที่จำเป็น

- Node.js 20+
- LINE Messaging API channel
- Google Gemini API Key
