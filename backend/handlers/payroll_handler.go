package handlers

import (
	"strconv"

	"backend/services"
	"backend/utils"

	"github.com/gofiber/fiber/v2"
)

type PayrollHandler struct {
	service *services.PayrollService
}

func NewPayrollHandler(service *services.PayrollService) *PayrollHandler {
	return &PayrollHandler{service: service}
}

func (h *PayrollHandler) GetAll(c *fiber.Ctx) error {
	data, err := h.service.GetAll()
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "Gagal mengambil data penggajian", err.Error())
	}
	return utils.SuccessResponse(c, fiber.StatusOK, "Data penggajian berhasil diambil", data)
}

func (h *PayrollHandler) GetEmployees(c *fiber.Ctx) error {
	data, err := h.service.GetEmployees()
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "Gagal mengambil daftar karyawan", err.Error())
	}
	return utils.SuccessResponse(c, fiber.StatusOK, "Daftar karyawan berhasil diambil", data)
}

func (h *PayrollHandler) Create(c *fiber.Ctx) error {
	var in services.CreatePayrollInput
	if err := c.BodyParser(&in); err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "Format input tidak valid", err.Error())
	}

	data, err := h.service.Create(in)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, err.Error(), nil)
	}
	return utils.SuccessResponse(c, fiber.StatusCreated, "Slip gaji berhasil diterbitkan", data)
}

func (h *PayrollHandler) Delete(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil || id == 0 {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "ID slip gaji tidak valid", nil)
	}
	if err := h.service.Delete(uint(id)); err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "Gagal menghapus slip gaji", err.Error())
	}
	return utils.SuccessResponse(c, fiber.StatusOK, "Slip gaji berhasil dihapus", nil)
}
