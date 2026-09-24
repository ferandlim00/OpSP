package handlers

import (
	"backend/services"
	"backend/utils"

	"github.com/gofiber/fiber/v2"
)

type AuthHandler struct {
	authService *services.AuthService
}

func NewAuthHandler(authService *services.AuthService) *AuthHandler {
	return &AuthHandler{authService: authService}
}

// Login menangani POST /api/auth/login
func (h *AuthHandler) Login(c *fiber.Ctx) error {
	var input services.LoginInput

	// Baca body JSON yang dikirim client
	if err := c.BodyParser(&input); err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "Format JSON tidak valid", err.Error())
	}

	// Validasi sederhana: tidak boleh kosong
	if input.Username == "" || input.Password == "" {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "Username dan password wajib diisi", nil)
	}

	// Panggil logika bisnis di AuthService
	response, err := h.authService.Login(input)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusUnauthorized, err.Error(), nil)
	}

	return utils.SuccessResponse(c, fiber.StatusOK, "Login berhasil!", response)
}
