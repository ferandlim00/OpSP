package utils

import (
	"os"
	"strings"

	"github.com/gofiber/fiber/v2"
)

// SuccessResponse mengirim format JSON sukses yang rapi
func SuccessResponse(c *fiber.Ctx, statusCode int, message string, data interface{}) error {
	return c.Status(statusCode).JSON(fiber.Map{
		"success": true,
		"message": message,
		"data":    data,
	})
}

// ErrorResponse mengirim format JSON gagal dan menyembunyikan detail error internal di mode production
func ErrorResponse(c *fiber.Ctx, statusCode int, message string, errors interface{}) error {
	isProd := strings.EqualFold(strings.TrimSpace(os.Getenv("APP_ENV")), "production")
	if isProd && statusCode >= fiber.StatusInternalServerError {
		// Jangan bocorkan pesan error database / stack internal ke publik saat production
		errors = nil
	}
	return c.Status(statusCode).JSON(fiber.Map{
		"success": false,
		"message": message,
		"errors":  errors,
	})
}
