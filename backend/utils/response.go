package utils

import "github.com/gofiber/fiber/v2"

// SuccessResponse mengirim format JSON sukses yang rapi
func SuccessResponse(c *fiber.Ctx, statusCode int, message string, data interface{}) error {
	return c.Status(statusCode).JSON(fiber.Map{
		"success": true,
		"message": message,
		"data":    data,
	})
}

// ErrorResponse mengirim format JSON gagal
func ErrorResponse(c *fiber.Ctx, statusCode int, message string, errors interface{}) error {
	return c.Status(statusCode).JSON(fiber.Map{
		"success": false,
		"message": message,
		"errors":  errors,
	})
}
