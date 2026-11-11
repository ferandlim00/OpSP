package handlers

import (
	"strconv"

	"backend/services"
	"backend/utils"

	"github.com/gofiber/fiber/v2"
)

type PurchaseOrderHandler struct {
	service *services.PurchaseOrderService
}

func NewPurchaseOrderHandler(service *services.PurchaseOrderService) *PurchaseOrderHandler {
	return &PurchaseOrderHandler{service: service}
}

func (h *PurchaseOrderHandler) GetAll(c *fiber.Ctx) error {
	status := c.Query("status", "")
	data, err := h.service.GetAll(status)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "Gagal mengambil daftar Purchase Order", err.Error())
	}
	return utils.SuccessResponse(c, fiber.StatusOK, "Daftar Purchase Order berhasil diambil", data)
}

func (h *PurchaseOrderHandler) GetByID(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil || id == 0 {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "ID Purchase Order tidak valid", nil)
	}
	data, err := h.service.GetByID(uint(id))
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusNotFound, err.Error(), nil)
	}
	return utils.SuccessResponse(c, fiber.StatusOK, "Detail Purchase Order berhasil diambil", data)
}

func (h *PurchaseOrderHandler) Create(c *fiber.Ctx) error {
	claims, ok := c.Locals("user").(*utils.JWTClaims)
	if !ok || claims == nil || claims.UserID == 0 {
		return utils.ErrorResponse(c, fiber.StatusUnauthorized, "Sesi tidak valid atau kedaluwarsa", nil)
	}

	var in services.CreatePOInput
	if err := c.BodyParser(&in); err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "Format input Purchase Order tidak valid", err.Error())
	}

	data, err := h.service.Create(in)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, err.Error(), nil)
	}
	return utils.SuccessResponse(c, fiber.StatusCreated, "Purchase Order berhasil dibuat!", data)
}

func (h *PurchaseOrderHandler) UpdateStatus(c *fiber.Ctx) error {
	claims, ok := c.Locals("user").(*utils.JWTClaims)
	if !ok || claims == nil || claims.UserID == 0 {
		return utils.ErrorResponse(c, fiber.StatusUnauthorized, "Sesi tidak valid atau kedaluwarsa", nil)
	}

	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil || id == 0 {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "ID Purchase Order tidak valid", nil)
	}

	var body struct {
		Status string `json:"status"`
	}
	if err := c.BodyParser(&body); err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "Format status tidak valid", err.Error())
	}

	data, err := h.service.UpdateStatus(uint(id), claims.UserID, body.Status)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, err.Error(), nil)
	}
	return utils.SuccessResponse(c, fiber.StatusOK, "Status Purchase Order berhasil diperbarui!", data)
}

func (h *PurchaseOrderHandler) Receive(c *fiber.Ctx) error {
	claims, ok := c.Locals("user").(*utils.JWTClaims)
	if !ok || claims == nil || claims.UserID == 0 {
		return utils.ErrorResponse(c, fiber.StatusUnauthorized, "Sesi tidak valid atau kedaluwarsa", nil)
	}

	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil || id == 0 {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "ID Purchase Order tidak valid", nil)
	}

	var in services.ReceivePOInput
	_ = c.BodyParser(&in)

	data, err := h.service.ReceiveItems(uint(id), claims.UserID, in)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, err.Error(), nil)
	}
	return utils.SuccessResponse(c, fiber.StatusOK, "Barang PO berhasil diterima dan stok gudang telah ditambahkan otomatis!", data)
}
