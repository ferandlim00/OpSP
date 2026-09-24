package main

import (
	"fmt"

	"backend/config"
	"backend/routes"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
)

func main() {
	// 1. Load config dari .env
	cfg := config.Load()

	// 2. Konek ke database + migrate + seeder
	config.ConnectDatabase(cfg)

	// 3. Buat aplikasi Fiber
	app := fiber.New(fiber.Config{
		AppName: cfg.AppName,
	})

	// 4. Aktifkan CORS (supaya Next.js frontend nanti bisa akses API)
	app.Use(cors.New())

	// 5. Daftarkan semua route
	routes.SetupRoutes(app, config.DB, cfg)

	// 6. Jalankan server
	fmt.Printf("🚀 Server jalan di http://localhost:%s\n", cfg.AppPort)
	app.Listen(":" + cfg.AppPort)
}
