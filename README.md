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
2. ใน Firebase Console (โปรเจกต์ jaihan-assistant) → App Hosting
3. เชื่อม GitHub repository
4. ตั้งค่า Environment variables ตาม `.env.example`
5. Deploy

## สิ่งที่จำเป็น

- Node.js 20+
- LINE Messaging API channel
- Google Gemini API Key
