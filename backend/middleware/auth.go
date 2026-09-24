package middleware

import (
	"strings"

	"backend/config"
	"backend/utils"

	"github.com/gofiber/fiber/v2"
)

// Protected adalah satpam pemeriksa token JWT
func Protected(cfg *config.Config) fiber.Handler {
	return func(c *fiber.Ctx) error {
		// 1. Ambil header Authorization (contoh: "Bearer eyJhbGciOi...")
		authHeader := c.Get("Authorization")
		if authHeader == "" {
			return utils.ErrorResponse(c, fiber.StatusUnauthorized, "Akses ditolak: Token tidak ditemukan", nil)
		}

		// 2. Pisahkan kata "Bearer " dengan token string aslinya
		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			return utils.ErrorResponse(c, fiber.StatusUnauthorized, "Format token harus: Bearer <token>", nil)
		}

		tokenString := parts[1]

		// 3. Validasi keaslian token
		claims, err := utils.ValidateToken(tokenString, cfg.JWTSecret)
		if err != nil {
			return utils.ErrorResponse(c, fiber.StatusUnauthorized, "Token tidak valid atau sudah kedaluwarsa", nil)
		}

		// 4. Simpan identitas user ke context agar bisa dibaca di handler berikutnya
		c.Locals("user", claims)

		// 5. Silakan lewat ke pintu berikutnya!
		return c.Next()
	}
}
