package handlers

import (
	"strconv"

	"backend/services"
	"backend/utils"

	"github.com/gofiber/fiber/v2"
)

type CategoryHandler struct {
	service *services.CategoryService
}

func NewCategoryHandler(service *services.CategoryService) *CategoryHandler {
	return &CategoryHandler{service: service}
}

func (h *CategoryHandler) GetAll(c *fiber.Ctx) error {
	data, err := h.service.GetAll()
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "Gagal mengambil data", err.Error())
	}
	return utils.SuccessResponse(c, fiber.StatusOK, "Sukses", data)
}

func (h *CategoryHandler) Create(c *fiber.Ctx) error {
	var input services.CategoryInput
	if err := c.BodyParser(&input); err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "Format JSON tidak valid", err.Error())
	}
	data, err := h.service.Create(input)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, err.Error(), nil)
	}
	return utils.SuccessResponse(c, fiber.StatusCreated, "Kategori berhasil ditambahkan!", data)
}

func (h *CategoryHandler) Update(c *fiber.Ctx) error {
	id, _ := strconv.ParseUint(c.Params("id"), 10, 32)
	var input services.CategoryInput
	if err := c.BodyParser(&input); err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "Format JSON tidak valid", err.Error())
	}
	data, err := h.service.Update(uint(id), input)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, err.Error(), nil)
	}
	return utils.SuccessResponse(c, fiber.StatusOK, "Kategori berhasil diperbarui!", data)
}

func (h *CategoryHandler) Delete(c *fiber.Ctx) error {
	id, _ := strconv.ParseUint(c.Params("id"), 10, 32)
	if err := h.service.Delete(uint(id)); err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, err.Error(), nil)
	}
	return utils.SuccessResponse(c, fiber.StatusOK, "Kategori berhasil dihapus!", nil)
}
