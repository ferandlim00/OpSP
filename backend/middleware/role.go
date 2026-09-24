package middleware

import (
	"backend/utils"

	"github.com/gofiber/fiber/v2"
)

// RequireRole membatasi akses hanya untuk role tertentu
func RequireRole(allowedRoles ...string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Ambil data user yang tadi disimpan oleh middleware Protected
		userClaims, ok := c.Locals("user").(*utils.JWTClaims)
		if !ok {
			return utils.ErrorResponse(c, fiber.StatusUnauthorized, "Tidak terautentikasi", nil)
		}

		// Cek apakah role user ada di dalam daftar role yang diizinkan
		for _, role := range allowedRoles {
			if userClaims.Role == role {
				return c.Next() // Boleh lewat!
			}
		}

		// Jika role tidak cocok, tolak dengan 403 Forbidden
		return utils.ErrorResponse(c, fiber.StatusForbidden, "Akses ditolak: Role Anda tidak memiliki izin untuk fitur ini", nil)
	}
}
