# GitHub Pages + Firebase (MTC-Game) — แผน Spark (ฟรี)

เกมเว็บที่: `https://m1n-w.github.io/MTC-Game/`

โปรเจกต์นี้ตั้งใจให้ใช้ **Firebase Spark (ฟรี)** โดยไม่ใช้ **Cloud Functions** (Functions ต้องใช้แผน Blaze + ผูกบิลลิ่ง)

## สิ่งที่ใช้ได้บน Spark

- Authentication (รวม Anonymous + Google)
- Cloud Firestore (มีโควต้าอ่าน/เขียนตาม [Pricing](https://firebase.google.com/pricing))
- Analytics, Remote Config
- Hosting (ถ้าต้องการใช้แยกจาก GitHub Pages)

## 1. Authorized domains (Google Sign-In)

1. **Authentication** → **Settings**
2. **Authorized domains** → เพิ่ม **`m1n-w.github.io`** (ไม่ใส่ path `/MTC-Game`)

## 2. Leaderboard บน Spark (ไม่มี Functions)

- คะแนนถูกเขียนลง Firestore จากเบราว์เซอร์
- ความปลอดภัยอยู่ที่ **Firestore Security Rules** (`firestore.rules`): บังคับลง Google, ขอบเขตคะแนนเทียบ `wave`, และอัปเดตได้เฉพาะเมื่อคะแนนใหม่ **ไม่ต่ำกว่า** ของเดิม
- **ข้อจำกัด:** ยังโกงได้จาก client ถ้าคะแนนปลอมอยู่ในขอบเขตที่ rules อนุญาต — การกันบอทแบบเต็มต้องใช้ Blaze + Cloud Functions (หรือเซิร์ฟเวอร์ของคุณเอง)

## 3. Deploy กฎ Firestore

```bash
firebase login
firebase use mtc-game-d6c4e
firebase deploy --only firestore:rules
```

(ไม่ต้อง `firebase deploy --only functions` ถ้าใช้ Spark แบบนี้)

## 4. หลัง push ไป GitHub

- รอ GitHub Pages build / refresh เกม
- ถ้าใช้ Service Worker อาจต้อง hard refresh หลังอัปเดต `sw.js`

## 5. โฟลเดอร์ `functions/`

เป็นโค้ดตัวอย่าง/สำรองสำหรับอนาคตถ้าอัปเกรด Blaze — **ไม่จำเป็นต้อง deploy** บน Spark
