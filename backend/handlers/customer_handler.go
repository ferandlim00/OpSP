package handlers

import (
	"strconv"

	"backend/services"
	"backend/utils"

	"github.com/gofiber/fiber/v2"
)

type CustomerHandler struct {
	service *services.CustomerService
}

func NewCustomerHandler(service *services.CustomerService) *CustomerHandler {
	return &CustomerHandler{service: service}
}

func (h *CustomerHandler) GetAll(c *fiber.Ctx) error {
	search := c.Query("search", "")
	data, err := h.service.GetAll(search)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "Gagal mengambil data", err.Error())
	}
	return utils.SuccessResponse(c, fiber.StatusOK, "Sukses", data)
}

func (h *CustomerHandler) Create(c *fiber.Ctx) error {
	var input services.CustomerInput
	if err := c.BodyParser(&input); err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "Format JSON tidak valid", err.Error())
	}
	data, err := h.service.Create(input)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, err.Error(), nil)
	}
	return utils.SuccessResponse(c, fiber.StatusCreated, "Pelanggan berhasil ditambahkan!", data)
}

func (h *CustomerHandler) Update(c *fiber.Ctx) error {
	id, _ := strconv.ParseUint(c.Params("id"), 10, 32)
	var input services.CustomerInput
	if err := c.BodyParser(&input); err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "Format JSON tidak valid", err.Error())
	}
	data, err := h.service.Update(uint(id), input)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, err.Error(), nil)
	}
	return utils.SuccessResponse(c, fiber.StatusOK, "Pelanggan berhasil diperbarui!", data)
}

func (h *CustomerHandler) Delete(c *fiber.Ctx) error {
	id, _ := strconv.ParseUint(c.Params("id"), 10, 32)
	if err := h.service.Delete(uint(id)); err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, err.Error(), nil)
	}
	return utils.SuccessResponse(c, fiber.StatusOK, "Pelanggan berhasil dihapus permanen dari database!", nil)
}
