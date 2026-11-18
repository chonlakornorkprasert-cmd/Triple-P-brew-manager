# Triple P Brew Manager

## Development without Docker Desktop

The default development database is PGlite: PostgreSQL compiled to WebAssembly
and persisted in `.data/pglite`. It does not require Docker Desktop or a local
PostgreSQL service.

```powershell
npm.cmd install
npm.cmd run db:init
npm.cmd run dev
```

Copy `.env.example` to `.env` if needed. Keep `DB_DRIVER=pglite` for local
development. Production can continue to use PostgreSQL/Cloud SQL by setting
`DB_DRIVER=postgres` and the existing connection variables.

MVP เว็บแอปบริหารสูตร ต้นทุน และสต็อก สำหรับ Triple P Brew

## ฟังก์ชันที่มีแล้ว
- ฐานข้อมูลวัตถุดิบและต้นทุนต่อหน่วย
- สูตรเครื่องดื่มแบบหลายวัตถุดิบ
- คำนวณต้นทุนสูตร กำไร และ Food Cost อัตโนมัติ
- รับเข้า เบิกใช้ ปรับยอด และของเสีย
- ประวัติการเคลื่อนไหวสต็อก พร้อมตัวกรองวัตถุดิบและประเภท
- ตรวจนับสต็อกปิดวัน เปรียบเทียบยอดตามระบบกับยอดจริง และบันทึกส่วนต่าง
- Owner Control Dashboard: ยอดขาย จำนวนอาหาร/เครื่องดื่ม ต้นทุนตามสูตร ของเสีย และรายการต้องสั่งซื้อ
- แจ้งเตือนวัตถุดิบต่ำกว่าจุดสั่งซื้อ
- Seed สูตรชาไทย 20 oz: Gold 50% / Ceylon 25% / Red 25%
- โครงสร้างรองรับเมล็ดกาแฟ ไซรัป ซอส และบรรจุภัณฑ์ในอนาคต

## วิธีติดตั้ง
1. สร้างฐานข้อมูล PostgreSQL ชื่อ `triple_p_brew`
2. คัดลอก `.env.example` เป็น `.env` และแก้ `DATABASE_URL`
3. รัน:
   ```bash
   npm install
   npm run db:init
   npm run dev
   ```
4. เปิด `http://localhost:3000`

## สูตรชาไทยที่ Seed มาให้
- ชาตรามือ Gold 9 g
- ช้างทองซีลอน 4.5 g
- ชาตรามือแดง 4.5 g
- นมสด 80 ml
- นมข้นหวานประมาณ 39 g
- นมข้นจืดประมาณ 31 g
- แก้ว/ฝา หลอด น้ำแข็ง

ราคาวัตถุดิบตั้งต้นมาจากข้อมูลที่ผู้ใช้ให้ และแก้ไขได้ผ่าน API/ฐานข้อมูล

## ขั้นต่อไปที่เหมาะสำหรับ Production
- หน้าจอเพิ่ม/แก้ไขสูตรและวัตถุดิบ
- Login + Role (Owner/Barista/Stock)
- ตัดสต็อกอัตโนมัติเมื่อบันทึกยอดขาย
- Purchase Order และ Supplier
- Lot/วันหมดอายุ
- รายงานกำไรตามวัน/เดือน และนำเข้า Excel
