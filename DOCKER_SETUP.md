# 🚀 Menjalankan PropertyERP dengan Docker (seperti XAMPP)

Proyek Anda adalah aplikasi full-stack dengan backend Go + Fiber, frontend Next.js, dan MySQL database. Docker Compose membuat semuanya berjalan dalam satu perintah — seperti XAMPP yang mengintegrasikan Apache, PHP, dan MySQL.

## 📋 Prasyarat

- Docker Desktop terinstal ([unduh di sini](https://www.docker.com/products/docker-desktop))
- Docker Compose (sudah termasuk dalam Docker Desktop)

**Verifikasi:**
```bash
docker --version
docker compose --version
```

## 🎯 Quick Start (Cukup 1 Perintah!)

```bash
docker compose up --pull always
```

Tunggu hingga muncul pesan:
```
✅ erp-frontend  | ready - started server on 0.0.0.0:3000
✅ erp-backend   | Server running at :8080
```

Kemudian buka:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8080
- **Database**: localhost:3306

---

## 🛑 Menghentikan Layanan

```bash
# Hentikan semua container
docker compose down

# Hentikan dan hapus semua data (termasuk database)
docker compose down -v
```

---

## 📊 Arsitektur

```
┌─────────────────┐
│  Frontend Next  │ (Port 3000)
│  (React UI)     │
└────────┬────────┘
         │
         │ API Call
         ▼
┌─────────────────┐
│  Backend Go     │ (Port 8080)
│  (Fiber API)    │
└────────┬────────┘
         │
         │ SQL Query
         ▼
┌─────────────────┐
│  MySQL 8.0      │ (Port 3306)
│  (Database)     │
└─────────────────┘
```

---

## 🔧 Konfigurasi Default

| Service | Host | Port | User | Password |
|---------|------|------|------|----------|
| Frontend | localhost | 3000 | — | — |
| Backend API | localhost | 8080 | — | — |
| MySQL | localhost | 3306 | erp_user | erp_password |
| MySQL Root | localhost | 3306 | root | root |

**Database:** `erp_db`

---

## 📝 Perintah Umum

### Jalankan dengan log realtime
```bash
docker compose up
```

### Jalankan di background
```bash
docker compose up -d
```

### Lihat log semua service
```bash
docker compose logs -f
```

### Lihat log service tertentu
```bash
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f mysql
```

### Restart service tertentu
```bash
docker compose restart backend
docker compose restart frontend
```

### Rebuild image (setelah mengubah kode)
```bash
docker compose up --build
```

---

## 🐛 Troubleshooting

### Error: "Port 3000 already in use"
Ganti port di `docker-compose.yml`:
```yaml
ports:
  - "3001:3000"  # gunakan port 3001
```

### Error: "Cannot connect to Docker daemon"
Pastikan Docker Desktop sudah berjalan.

### Database error
Hapus volume lama dan rebuild:
```bash
docker compose down -v
docker compose up --build
```

### Melihat status container
```bash
docker ps
```

---

## 🔑 Environment Variables

Konfigurasi di `docker-compose.yml`:

**Backend:**
- `APP_PORT`: 8080
- `DB_HOST`: mysql (nama service dalam Docker)
- `DB_USER`: erp_user
- `DB_PASS`: erp_password
- `DB_NAME`: erp_db
- `JWT_SECRET`: Ganti di production!

**Frontend:**
- `NEXT_PUBLIC_API_URL`: http://localhost:8080

---

## 📦 Apa yang Docker Compose Lakukan?

1. **MySQL 8.0** — Database container dengan auto-init
2. **Backend (Go)** — Fiber API server yang terhubung ke MySQL
3. **Frontend (Next.js)** — React UI yang memanggil backend API

Semua berkomunikasi via internal Docker network (`erp-network`), tanpa perlu konfigurasi manual.

---

## 🚀 Next Steps

1. Buka http://localhost:3000 di browser
2. Backend API siap di http://localhost:8080
3. Database sudah auto-migrate dan seedable via `SeedDatabase()`
4. Untuk production, ganti `JWT_SECRET` dan konfigurasi environment di `.env`

---

**Butuh bantuan?** Jalankan `docker compose logs -f` untuk debugging real-time!
