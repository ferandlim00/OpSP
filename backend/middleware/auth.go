package middleware

import (
	"strings"

	"backend/config"
	"backend/models"
	"backend/utils"

	"github.com/gofiber/fiber/v2"
)

// Protected adalah satpam pemeriksa token JWT sekaligus memverifikasi status aktif user secara real-time
func Protected(cfg *config.Config) fiber.Handler {
	return func(c *fiber.Ctx) error {
		authHeader := c.Get("Authorization")
		if authHeader == "" {
			return utils.ErrorResponse(c, fiber.StatusUnauthorized, "Akses ditolak: Token tidak ditemukan", nil)
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			return utils.ErrorResponse(c, fiber.StatusUnauthorized, "Format token harus: Bearer <token>", nil)
		}

		tokenString := strings.TrimSpace(parts[1])
		claims, err := utils.ValidateToken(tokenString, cfg.JWTSecret)
		if err != nil || claims == nil || claims.UserID == 0 {
			return utils.ErrorResponse(c, fiber.StatusUnauthorized, "Token tidak valid atau sudah kedaluwarsa", nil)
		}

		// Verifikasi akun masih aktif di database & sinkronkan role terbaru (mencegah akses dari akun yang baru dinonaktifkan/dihapus)
		if config.DB != nil {
			var user models.User
			if err := config.DB.Preload("Role").First(&user, claims.UserID).Error; err != nil || !user.IsActive {
				return utils.ErrorResponse(c, fiber.StatusUnauthorized, "Akun tidak ditemukan atau telah dinonaktifkan oleh Owner", nil)
			}
			if user.Role.Name != "" {
				claims.Role = string(user.Role.Name)
			}
		}

		c.Locals("user", claims)
		return c.Next()
	}
}
