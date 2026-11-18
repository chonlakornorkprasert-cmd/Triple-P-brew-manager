# Backend

- `server.js` — Express API และตัวให้บริการ frontend
- `config/database.js` — PostgreSQL connection pool
- `database/schema.sql` — โครงสร้างตารางและ views
- `database/seed.sql` — ข้อมูลตั้งต้น
- `scripts/init-db.js` — สร้าง schema และ seed

Local PostgreSQL ใช้:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/triple_p_brew
```

Google Cloud SQL ใช้:

```env
INSTANCE_UNIX_SOCKET=/cloudsql/PROJECT_ID:REGION:INSTANCE
DB_USER=triple_p_app
DB_PASSWORD=secret
DB_NAME=triple_p_brew
DB_POOL_MAX=5
```
