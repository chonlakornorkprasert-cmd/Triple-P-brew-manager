# Project structure

```text
triple-p-brew-manager/
├─ frontend/
│  ├─ index.html
│  ├─ style.css
│  ├─ forms.css
│  └─ app.js
├─ backend/
│  ├─ server.js
│  ├─ config/
│  │  └─ database.js
│  ├─ database/
│  │  ├─ schema.sql
│  │  └─ seed.sql
│  └─ scripts/
│     └─ init-db.js
├─ scripts/
│  └─ deploy-gcp.ps1
├─ Dockerfile
├─ compose.yaml
└─ package.json
```

## การไหลของข้อมูล

```text
Browser / frontend
       │  /api/*
       ▼
Express / backend/server.js
       │
       ▼
PostgreSQL Pool / backend/config/database.js
       │
       ├─ Local: DATABASE_URL
       └─ Cloud SQL: INSTANCE_UNIX_SOCKET
```

## คำสั่งหลัก

```powershell
npm.cmd run db:init
npm.cmd run dev
```
