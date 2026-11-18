# Deploy Triple P Brew Manager บน Google Cloud

สถาปัตยกรรมที่ใช้:

- **Cloud Run** สำหรับเว็บแอป Node.js
- **Cloud SQL for PostgreSQL** สำหรับฐานข้อมูล
- **Artifact Registry** สำหรับ Docker image
- **Secret Manager** สำหรับรหัสผ่านฐานข้อมูล
- **Cloud Run Job** สำหรับสร้าง schema และข้อมูลตั้งต้น

> Cloud SQL ไม่อยู่ใน Always Free tier แบบไม่มีค่าใช้จ่ายถาวร แต่สามารถใช้เครดิต Free Trial ได้ ตรวจราคาและ Budget Alert ก่อนสร้างทรัพยากร

## สิ่งที่ต้องมี

1. Google Cloud project ที่เปิด Billing แล้ว
2. ติดตั้ง [Google Cloud CLI](https://cloud.google.com/sdk/docs/install) หรือใช้ Cloud Shell
3. ล็อกอินและตั้งค่า Application Default Credentials:

```powershell
gcloud auth login
gcloud auth application-default login
```

## Deploy อัตโนมัติจาก Windows PowerShell

รันจากโฟลเดอร์โปรเจกต์:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\deploy-gcp.ps1 -ProjectId "YOUR_PROJECT_ID"
```

ค่าเริ่มต้นจะ deploy Cloud Run แบบ **private** ผู้ใช้ต้องมีสิทธิ์ Cloud Run Invoker หากตั้งใจให้เข้าจากอินเทอร์เน็ตโดยไม่ล็อกอิน ใช้:

```powershell
.\scripts\deploy-gcp.ps1 -ProjectId "YOUR_PROJECT_ID" -PublicAccess
```

แอปเวอร์ชันปัจจุบันยังไม่มีระบบล็อกอิน จึงไม่แนะนำ `-PublicAccess` สำหรับข้อมูลร้านจริง

ค่าตั้งต้น:

- Region: `asia-southeast1` (สิงคโปร์)
- Cloud Run: `triple-p-brew-manager`
- Cloud SQL: `triple-p-db`
- Database: `triple_p_brew`
- Database user: `triple_p_app`

สคริปต์จะถามรหัสผ่าน PostgreSQL โดยไม่บันทึกลง `.env` จากนั้นจะ:

1. เปิด API ที่จำเป็น
2. สร้าง Cloud SQL PostgreSQL
3. สร้างฐานข้อมูลและผู้ใช้
4. เก็บรหัสผ่านใน Secret Manager
5. Build Docker image
6. รัน migration/seed ผ่าน Cloud Run Job
7. Deploy แอปไป Cloud Run
8. แสดง URL ของระบบ

## อัปเดตแอปครั้งต่อไป

รันสคริปต์เดิมซ้ำได้:

```powershell
.\scripts\deploy-gcp.ps1 -ProjectId "YOUR_PROJECT_ID"
```

Schema และ seed ใช้คำสั่งแบบ idempotent จึงรันซ้ำได้ อย่างไรก็ตามควรสำรองฐานข้อมูลก่อนการเปลี่ยน schema ครั้งใหญ่

## ตรวจสอบระบบ

```powershell
gcloud run services describe triple-p-brew-manager --region asia-southeast1
gcloud run services logs read triple-p-brew-manager --region asia-southeast1 --limit 100
gcloud sql instances describe triple-p-db
```

Health check:

```text
https://YOUR_CLOUD_RUN_URL/api/health
```

## สำรองฐานข้อมูล

เปิด Automated backups และ Point-in-time recovery ในหน้า Cloud SQL ก่อนใช้งานจริง และตั้ง Budget Alert ใน Billing เพื่อควบคุมค่าใช้จ่าย
