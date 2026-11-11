package routes

import (
	"backend/config"
	"backend/handlers"
	"backend/middleware"
	"backend/services"
	"backend/utils"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

func SetupRoutes(app *fiber.App, db *gorm.DB, cfg *config.Config) {
	// Services
	authService := services.NewAuthService(db, cfg)
	userService := services.NewUserService(db)
	customerService := services.NewCustomerService(db)
	categoryService := services.NewCategoryService(db)
	productService := services.NewProductService(db)
	supplierService := services.NewSupplierService(db)
	inventoryService := services.NewInventoryService(db)
	transactionService := services.NewTransactionService(db)
	deliveryService := services.NewDeliveryService(db)
	attendanceService := services.NewAttendanceService(db, cfg)
	payrollService := services.NewPayrollService(db)
	settingService := services.NewSettingService(db, cfg)
	dashboardService := services.NewDashboardService(db)
	purchaseOrderService := services.NewPurchaseOrderService(db)

	// Penyimpanan file: lokal dulu (./uploads). Ganti ke R2Storage nanti.
	storage := services.NewLocalStorage("./uploads", "/uploads")

	// Handlers
	authHandler := handlers.NewAuthHandler(authService)
	userHandler := handlers.NewUserHandler(userService)
	customerHandler := handlers.NewCustomerHandler(customerService)
	categoryHandler := handlers.NewCategoryHandler(categoryService)
	productHandler := handlers.NewProductHandler(productService, storage)
	supplierHandler := handlers.NewSupplierHandler(supplierService)
	inventoryHandler := handlers.NewInventoryHandler(inventoryService, storage)
	transactionHandler := handlers.NewTransactionHandler(transactionService, storage)
	deliveryHandler := handlers.NewDeliveryHandler(deliveryService, storage)
	attendanceHandler := handlers.NewAttendanceHandler(attendanceService, storage)
	payrollHandler := handlers.NewPayrollHandler(payrollService)
	settingHandler := handlers.NewSettingHandler(settingService)
	dashboardHandler := handlers.NewDashboardHandler(dashboardService)
	purchaseOrderHandler := handlers.NewPurchaseOrderHandler(purchaseOrderService)

	// Base API dengan Rate Limiter umum
	api := app.Group("/api", middleware.APIRateLimiter())

	// Endpoint Healthcheck API
	api.Get("/health", func(c *fiber.Ctx) error {
		return c.Status(fiber.StatusOK).JSON(fiber.Map{
			"status":  "ok",
			"service": cfg.AppName,
		})
	})

	// Public (dilindungi LoginRateLimiter anti brute-force)
	api.Post("/auth/login", middleware.LoginRateLimiter(), authHandler.Login)

	// Protected (Semua Role: OWNER, ADMIN, EMPLOYEE sesuai PLAN.md + Proteksi Idempotency Global)
	protected := api.Group("/", middleware.Protected(cfg), middleware.Idempotency())
	protected.Get("auth/me", func(c *fiber.Ctx) error {
		claims := c.Locals("user").(*utils.JWTClaims)
		return utils.SuccessResponse(c, fiber.StatusOK, "Profil terverifikasi", claims)
	})
	protected.Get("dashboard/summary", dashboardHandler.GetSummary)
	// Employee memiliki akses Read (R) pada Produk & Stok sesuai PLAN.md Baris 8
	protected.Get("categories", categoryHandler.GetAll)
	protected.Get("products", productHandler.GetAll)
	protected.Get("products/:id", productHandler.GetByID)
	protected.Get("inventory/movements", inventoryHandler.GetMovements)
	// Employee memiliki akses Read/Update (RU) pada Pengiriman & tagih DP saat pengantaran selesai (Baris 8 & 24)
	protected.Get("deliveries", deliveryHandler.GetAll)
	protected.Put("deliveries/:id/status", deliveryHandler.UpdateStatus)
	protected.Post("deliveries/:id/start", deliveryHandler.StartWithProof)
	protected.Post("deliveries/:id/complete", deliveryHandler.CompleteWithProof)
	protected.Post("transactions/:id/payments", transactionHandler.AddPayment)
	// Presensi Kehadiran (CR)
	protected.Get("attendances", attendanceHandler.GetAll)
	protected.Post("attendances", attendanceHandler.Record)
	protected.Get("settings", settingHandler.GetAll)

	// Owner Only (Hak eksklusif Owner sesuai PLAN.md Baris 6)
	ownerOnly := protected.Group("/", middleware.RequireRole("OWNER"))
	ownerOnly.Get("roles", userHandler.GetRoles)
	ownerOnly.Get("users", userHandler.GetAllUsers)
	ownerOnly.Post("users", userHandler.CreateUser)
	ownerOnly.Put("users/:id", userHandler.UpdateUser)
	ownerOnly.Delete("users/:id", userHandler.DeleteUser)
	ownerOnly.Get("payrolls", payrollHandler.GetAll)
	ownerOnly.Get("payrolls/employees", payrollHandler.GetEmployees)
	ownerOnly.Post("payrolls", payrollHandler.Create)
	ownerOnly.Delete("payrolls/:id", payrollHandler.Delete)
	ownerOnly.Put("settings", settingHandler.SaveAll)
	ownerOnly.Get("security/audit-logs", func(c *fiber.Ctx) error {
		return utils.SuccessResponse(c, fiber.StatusOK, "Log audit keamanan berhasil diambil", middleware.GetSecurityAuditLogs())
	})
	// Sesuai PLAN.md Baris 6-7: Admin hanya CRU Produk (tidak boleh Delete) dan RU Supplier (tidak boleh Create/Delete)
	ownerOnly.Delete("products/:id", productHandler.Delete)
	ownerOnly.Post("suppliers", supplierHandler.Create)
	ownerOnly.Delete("suppliers/:id", supplierHandler.Delete)

	// Operasional Toko (Owner & Admin sesuai PLAN.md Baris 6-7)
	staffOnly := protected.Group("/", middleware.RequireRole("OWNER", "ADMIN"))
	staffOnly.Get("drivers", userHandler.GetAllUsers)

	// Customers: Owner (CRUD), Admin (CRUD)
	staffOnly.Get("customers", customerHandler.GetAll)
	staffOnly.Post("customers", customerHandler.Create)
	staffOnly.Put("customers/:id", customerHandler.Update)
	staffOnly.Delete("customers/:id", customerHandler.Delete)

	// Categories
	staffOnly.Post("categories", categoryHandler.Create)
	staffOnly.Put("categories/:id", categoryHandler.Update)
	staffOnly.Delete("categories/:id", categoryHandler.Delete)

	// Products: Admin (CRU), Owner (CRUD)
	staffOnly.Post("products", productHandler.Create)
	staffOnly.Put("products/:id", productHandler.Update)
	staffOnly.Post("products/:id/images", productHandler.AddImages)
	staffOnly.Delete("products/:id/images/:imageId", productHandler.DeleteImage)
	staffOnly.Put("products/:id/images/:imageId/primary", productHandler.SetPrimaryImage)

	// Suppliers: Admin (RU), Owner (CRUD)
	staffOnly.Get("suppliers", supplierHandler.GetAll)
	staffOnly.Get("suppliers/:id", supplierHandler.GetByID)
	staffOnly.Put("suppliers/:id", supplierHandler.Update)

	// Inventory: Admin (CRU), Owner (CRUD)
	staffOnly.Post("inventory/movements", inventoryHandler.RecordMovement)

	// Purchase Orders (PO Pengadaan Barang ke Supplier)
	staffOnly.Get("purchase-orders", purchaseOrderHandler.GetAll)
	staffOnly.Get("purchase-orders/:id", purchaseOrderHandler.GetByID)
	staffOnly.Post("purchase-orders", purchaseOrderHandler.Create)
	staffOnly.Put("purchase-orders/:id/status", purchaseOrderHandler.UpdateStatus)
	staffOnly.Post("purchase-orders/:id/receive", purchaseOrderHandler.Receive)

	// Transactions (Kasir / POS)
	staffOnly.Get("transactions", transactionHandler.GetAll)
	staffOnly.Get("transactions/:id", transactionHandler.GetByID)
	staffOnly.Post("transactions", transactionHandler.Create)
	staffOnly.Post("transactions/:id/payments", transactionHandler.AddPayment)
	staffOnly.Post("transactions/:id/return-exchange", transactionHandler.ReturnOrExchange)

	// Deliveries (Penjadwalan Pengiriman)
	staffOnly.Post("deliveries", deliveryHandler.Create)
}
