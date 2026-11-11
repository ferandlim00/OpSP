package handlers

import (
	"backend/services"
	"backend/utils"

	"github.com/gofiber/fiber/v2"
)

type DashboardHandler struct {
	service *services.DashboardService
}

func NewDashboardHandler(service *services.DashboardService) *DashboardHandler {
	return &DashboardHandler{service: service}
}

func (h *DashboardHandler) GetSummary(c *fiber.Ctx) error {
	claims, ok := c.Locals("user").(*utils.JWTClaims)
	if !ok || claims == nil || claims.UserID == 0 {
		return utils.ErrorResponse(c, fiber.StatusUnauthorized, "Sesi tidak valid atau kedaluwarsa", nil)
	}

	data, err := h.service.GetSummary(claims.Role, claims.UserID)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "Gagal mengambil ringkasan dashboard", err.Error())
	}
	return utils.SuccessResponse(c, fiber.StatusOK, "Ringkasan dashboard berhasil diambil", data)
}
