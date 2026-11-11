package handlers

import (
	"backend/services"
	"backend/utils"

	"github.com/gofiber/fiber/v2"
)

type SettingHandler struct {
	service *services.SettingService
}

func NewSettingHandler(service *services.SettingService) *SettingHandler {
	return &SettingHandler{service: service}
}

func (h *SettingHandler) GetAll(c *fiber.Ctx) error {
	data, err := h.service.GetAll()
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "Gagal mengambil pengaturan", err.Error())
	}
	return utils.SuccessResponse(c, fiber.StatusOK, "Pengaturan berhasil diambil", data)
}

func (h *SettingHandler) SaveAll(c *fiber.Ctx) error {
	var in map[string]string
	if err := c.BodyParser(&in); err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "Format pengaturan tidak valid", err.Error())
	}
	data, err := h.service.SaveAll(in)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "Gagal menyimpan pengaturan", err.Error())
	}
	return utils.SuccessResponse(c, fiber.StatusOK, "Pengaturan berhasil disimpan", data)
}
