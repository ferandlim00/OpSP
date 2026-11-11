package main

import (
	"fmt"
	"strings"
	"time"

	"backend/config"
	"backend/middleware"
	"backend/routes"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/recover"
)

func main() {
	// 1. Load & validasi config dari .env
	cfg := config.Load()
	isProd := strings.EqualFold(cfg.AppEnv, "production")

	// 2. Konek ke database + migrate + seeder
	config.ConnectDatabase(cfg)

	// 3. Buat aplikasi Fiber dengan timeout & batas ukuran body (25MB)
	app := fiber.New(fiber.Config{
		AppName:               cfg.AppName,
		BodyLimit:             25 * 1024 * 1024, // Maks 25MB per request (5 foto @5MB)
		ReadTimeout:           30 * time.Second,
		WriteTimeout:          30 * time.Second,
		IdleTimeout:           60 * time.Second,
		DisableStartupMessage: isProd, // Hilangkan banner debug di production
		ServerHeader:          "",     // Jangan bocorkan identitas server
	})

	// 4. Panic Recovery, Blokir File Sensitif (.env/.git), Security Headers (HSTS), & Monitor Aktivitas Mencurigakan
	app.Use(recover.New())
	app.Use(middleware.BlockSensitivePaths())
	app.Use(middleware.SecurityHeaders(cfg.EnforceHTTPS))
	app.Use(middleware.SuspiciousActivityMonitor())

	// 5. Aktifkan CORS Ketat & Proteksi CSRF
	allowOrigins := strings.TrimSpace(cfg.AllowedOrigins)
	if allowOrigins == "" {
		allowOrigins = "http://localhost:3000,http://127.0.0.1:3000"
	}
	app.Use(cors.New(cors.Config{
		AllowOrigins: allowOrigins,
		AllowMethods: "GET,POST,PUT,DELETE,OPTIONS",
		AllowHeaders: "Origin, Content-Type, Accept, Authorization, X-Idempotency-Key, X-Requested-With",
		MaxAge:       3600,
	}))
	app.Use(middleware.CSRFProtection(allowOrigins))

	// 6. WAF Guard (Anti-XSS & Anti-SQLi pada semua input)
	app.Use(middleware.WAFGuard())

	// 7. Sajikan file upload dengan proteksi anti-eksekusi script (CSP sandbox & nosniff)
	app.Use("/uploads", func(c *fiber.Ctx) error {
		c.Set("X-Content-Type-Options", "nosniff")
		c.Set("Content-Security-Policy", "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox")
		c.Set("X-Frame-Options", "DENY")
		return c.Next()
	})
	app.Static("/uploads", "./uploads", fiber.Static{
		Browse: false, // Matikan directory listing!
	})

	// 8. Daftarkan semua route
	routes.SetupRoutes(app, config.DB, cfg)

	// 9. Jalankan server
	fmt.Printf("🚀 Server jalan di port :%s (mode: %s)\n", cfg.AppPort, cfg.AppEnv)
	app.Listen(":" + cfg.AppPort)
}
