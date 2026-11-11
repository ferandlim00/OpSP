package handlers

import (
	"strconv"
	"strings"

	"backend/models"
	"backend/services"
	"backend/utils"

	"github.com/gofiber/fiber/v2"
)

const inventoryProofFolder = "inventory"

type InventoryHandler struct {
	service services.InventoryService
	storage services.Storage
}

func NewInventoryHandler(service services.InventoryService, storage services.Storage) *InventoryHandler {
	return &InventoryHandler{service: service, storage: storage}
}

func (h *InventoryHandler) GetMovements(c *fiber.Ctx) error {
	movements, err := h.service.GetMovements()
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "Gagal mengambil data pergerakan inventori", err.Error())
	}
	return utils.SuccessResponse(c, fiber.StatusOK, "Data pergerakan inventori berhasil diambil", movements)
}

func (h *InventoryHandler) RecordMovement(c *fiber.Ctx) error {
	var movement models.InventoryMovement
	contentType := strings.ToLower(c.Get("Content-Type"))

	if strings.HasPrefix(contentType, "multipart/form-data") {
		pid, _ := strconv.ParseUint(c.FormValue("product_id"), 10, 32)
		qty, _ := strconv.Atoi(c.FormValue("quantity"))
		movement.ProductID = uint(pid)
		movement.Type = strings.TrimSpace(c.FormValue("type"))
		movement.Quantity = qty
		movement.Notes = strings.TrimSpace(c.FormValue("notes"))

		fileHeader, err := c.FormFile("photo")
		if err == nil && fileHeader != nil && h.storage != nil {
			if err := services.ValidateImage(fileHeader); err != nil {
				return utils.ErrorResponse(c, fiber.StatusBadRequest, err.Error(), nil)
			}
			savedURL, err := h.storage.Save(c, fileHeader, inventoryProofFolder)
			if err != nil {
				return utils.ErrorResponse(c, fiber.StatusInternalServerError, "Gagal menyimpan foto bukti mutasi", err.Error())
			}
			movement.PhotoURL = savedURL
		}
	} else {
		if err := c.BodyParser(&movement); err != nil {
			return utils.ErrorResponse(c, fiber.StatusBadRequest, "Format input tidak valid", err.Error())
		}
	}

	if movement.ProductID == 0 || movement.Quantity == 0 {
		if movement.PhotoURL != "" && h.storage != nil {
			_ = h.storage.Delete(movement.PhotoURL)
		}
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "Produk dan kuantitas wajib diisi", nil)
	}

	if strings.ToUpper(strings.TrimSpace(movement.Type)) == models.MovementInbound && strings.TrimSpace(movement.PhotoURL) == "" {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "Setiap Barang Masuk (INBOUND) wajib melampirkan foto bukti barang masuk", nil)
	}

	claims, ok := c.Locals("user").(*utils.JWTClaims)
	if !ok || claims == nil || claims.UserID == 0 {
		if movement.PhotoURL != "" && h.storage != nil {
			_ = h.storage.Delete(movement.PhotoURL)
		}
		return utils.ErrorResponse(c, fiber.StatusUnauthorized, "Sesi tidak valid atau kedaluwarsa", nil)
	}
	movement.UserID = claims.UserID

	if err := h.service.RecordMovement(&movement); err != nil {
		if movement.PhotoURL != "" && h.storage != nil {
			_ = h.storage.Delete(movement.PhotoURL)
		}
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "Gagal merekam pergerakan inventori", err.Error())
	}

	return utils.SuccessResponse(c, fiber.StatusCreated, "Pergerakan inventori berhasil direkam", movement)
}
