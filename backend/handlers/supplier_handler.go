package handlers

import (
	"strconv"
	"strings"

	"backend/models"
	"backend/services"
	"backend/utils"

	"github.com/gofiber/fiber/v2"
)

type SupplierHandler struct {
	service services.SupplierService
}

type SupplierInputDTO struct {
	Name    string `json:"name"`
	Phone   string `json:"phone"`
	Email   string `json:"email"`
	Address string `json:"address"`
}

func NewSupplierHandler(service services.SupplierService) *SupplierHandler {
	return &SupplierHandler{service: service}
}

func (h *SupplierHandler) GetAll(c *fiber.Ctx) error {
	suppliers, err := h.service.GetAll()
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "Gagal mengambil data supplier", err.Error())
	}
	return utils.SuccessResponse(c, fiber.StatusOK, "Data supplier berhasil diambil", suppliers)
}

func (h *SupplierHandler) GetByID(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil || id == 0 {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "ID tidak valid", nil)
	}

	supplier, err := h.service.GetByID(uint(id))
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusNotFound, "Supplier tidak ditemukan", err.Error())
	}

	return utils.SuccessResponse(c, fiber.StatusOK, "Data supplier berhasil diambil", supplier)
}

func (h *SupplierHandler) Create(c *fiber.Ctx) error {
	var in SupplierInputDTO
	if err := c.BodyParser(&in); err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "Format input tidak valid", err.Error())
	}

	name := utils.SanitizeString(in.Name)
	if name == "" {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "Nama supplier wajib diisi", nil)
	}

	supplier := models.Supplier{
		Name:    name,
		Phone:   utils.SanitizeString(in.Phone),
		Email:   strings.TrimSpace(in.Email),
		Address: utils.SanitizeString(in.Address),
	}

	if err := h.service.Create(&supplier); err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "Gagal membuat supplier", err.Error())
	}

	return utils.SuccessResponse(c, fiber.StatusCreated, "Supplier berhasil dibuat", supplier)
}

func (h *SupplierHandler) Update(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil || id == 0 {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "ID tidak valid", nil)
	}

	existing, err := h.service.GetByID(uint(id))
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusNotFound, "Supplier tidak ditemukan", err.Error())
	}

	var in SupplierInputDTO
	if err := c.BodyParser(&in); err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "Format input tidak valid", err.Error())
	}

	name := utils.SanitizeString(in.Name)
	if name == "" {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "Nama supplier wajib diisi", nil)
	}

	existing.ID = uint(id)
	existing.Name = name
	existing.Phone = utils.SanitizeString(in.Phone)
	existing.Email = strings.TrimSpace(in.Email)
	existing.Address = utils.SanitizeString(in.Address)

	if err := h.service.Update(existing); err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "Gagal mengupdate supplier", err.Error())
	}

	return utils.SuccessResponse(c, fiber.StatusOK, "Supplier berhasil diupdate", existing)
}

func (h *SupplierHandler) Delete(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil || id == 0 {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "ID tidak valid", nil)
	}

	if err := h.service.Delete(uint(id)); err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, err.Error(), nil)
	}

	return utils.SuccessResponse(c, fiber.StatusOK, "Supplier berhasil dihapus permanen dari database!", nil)
}
