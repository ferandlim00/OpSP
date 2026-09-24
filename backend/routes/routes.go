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
	categoryService := services.NewCategoryService(db) // <-- Tambah

	// Handlers
	authHandler := handlers.NewAuthHandler(authService)
	userHandler := handlers.NewUserHandler(userService)
	customerHandler := handlers.NewCustomerHandler(customerService)
	categoryHandler := handlers.NewCategoryHandler(categoryService) // <-- Tambah

	// Base API
	api := app.Group("/api")

	// Public
	api.Post("/auth/login", authHandler.Login)

	// Protected
	protected := api.Group("/", middleware.Protected(cfg))
	protected.Get("auth/me", func(c *fiber.Ctx) error {
		claims := c.Locals("user").(*utils.JWTClaims)
		return utils.SuccessResponse(c, fiber.StatusOK, "Profil terverifikasi", claims)
	})

	// Owner Only
	ownerOnly := protected.Group("/", middleware.RequireRole("OWNER"))
	ownerOnly.Get("roles", userHandler.GetRoles)
	ownerOnly.Get("users", userHandler.GetAllUsers)
	ownerOnly.Post("users", userHandler.CreateUser)
	ownerOnly.Put("users/:id", userHandler.UpdateUser)
	ownerOnly.Delete("users/:id", userHandler.DeleteUser)

	// Operasional Toko (Owner & Admin)
	staffOnly := protected.Group("/", middleware.RequireRole("OWNER", "ADMIN"))

	// Customers
	staffOnly.Get("customers", customerHandler.GetAll)
	staffOnly.Post("customers", customerHandler.Create)
	staffOnly.Put("customers/:id", customerHandler.Update)
	staffOnly.Delete("customers/:id", customerHandler.Delete)

	// Categories (Kategori Produk)
	staffOnly.Get("categories", categoryHandler.GetAll)
	staffOnly.Post("categories", categoryHandler.Create)
	staffOnly.Put("categories/:id", categoryHandler.Update)
	staffOnly.Delete("categories/:id", categoryHandler.Delete)
}
