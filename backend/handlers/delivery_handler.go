package handlers

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	"backend/services"
	"backend/utils"

	"github.com/gofiber/fiber/v2"
)

const deliveryProofFolder = "deliveries"
const maxProofPhotos = 5

type DeliveryHandler struct {
	service *services.DeliveryService
	storage services.Storage
}

func NewDeliveryHandler(service *services.DeliveryService, storage services.Storage) *DeliveryHandler {
	return &DeliveryHandler{service: service, storage: storage}
}

func (h *DeliveryHandler) saveUploadedPhotos(c *fiber.Ctx) ([]string, error) {
	form, err := c.MultipartForm()
	if err != nil || form == nil {
		return nil, fmt.Errorf("form upload foto tidak valid")
	}

	files := form.File["photos"]
	if len(files) == 0 {
		return nil, fmt.Errorf("wajib mengunggah minimal 1 foto bukti")
	}
	if len(files) > maxProofPhotos {
		return nil, fmt.Errorf("maksimal %d foto bukti", maxProofPhotos)
	}

	for _, f := range files {
		if err := services.ValidateImage(f); err != nil {
			return nil, err
		}
	}

	var urls []string
	for _, f := range files {
		u, err := h.storage.Save(c, f, deliveryProofFolder)
		if err != nil {
			for _, old := range urls {
				_ = h.storage.Delete(old)
			}
			return nil, err
		}
		urls = append(urls, u)
	}
	return urls, nil
}

func (h *DeliveryHandler) GetAll(c *fiber.Ctx) error {
	claims, ok := c.Locals("user").(*utils.JWTClaims)
	if !ok || claims == nil || claims.UserID == 0 {
		return utils.ErrorResponse(c, fiber.StatusUnauthorized, "Sesi tidak valid atau kedaluwarsa", nil)
	}

	data, err := h.service.GetAll(claims.Role, claims.UserID)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "Gagal mengambil data pengiriman", err.Error())
	}
	return utils.SuccessResponse(c, fiber.StatusOK, "Data pengiriman berhasil diambil", data)
}

func (h *DeliveryHandler) Create(c *fiber.Ctx) error {
	var in services.CreateDeliveryInput
	if err := c.BodyParser(&in); err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "Format input tidak valid", err.Error())
	}

	data, err := h.service.Create(in)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, err.Error(), nil)
	}
	return utils.SuccessResponse(c, fiber.StatusCreated, "Jadwal pengiriman berhasil dibuat", data)
}

func (h *DeliveryHandler) UpdateStatus(c *fiber.Ctx) error {
	claims, ok := c.Locals("user").(*utils.JWTClaims)
	if !ok || claims == nil || claims.UserID == 0 {
		return utils.ErrorResponse(c, fiber.StatusUnauthorized, "Sesi tidak valid atau kedaluwarsa", nil)
	}

	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil || id == 0 {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "ID pengiriman tidak valid", nil)
	}

	var in services.UpdateDeliveryStatusInput
	if err := c.BodyParser(&in); err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "Format input tidak valid", err.Error())
	}

	data, err := h.service.UpdateStatus(uint(id), claims.UserID, claims.Role, in)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, err.Error(), nil)
	}
	return utils.SuccessResponse(c, fiber.StatusOK, "Status pengiriman diperbarui", data)
}

// POST /api/deliveries/:id/start (multipart/form-data: photos, pickup_note)
func (h *DeliveryHandler) StartWithProof(c *fiber.Ctx) error {
	claims, ok := c.Locals("user").(*utils.JWTClaims)
	if !ok || claims == nil || claims.UserID == 0 {
		return utils.ErrorResponse(c, fiber.StatusUnauthorized, "Sesi tidak valid atau kedaluwarsa", nil)
	}

	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil || id == 0 {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "ID pengiriman tidak valid", nil)
	}

	pickupNote := strings.TrimSpace(c.FormValue("pickup_note"))
	urls, err := h.saveUploadedPhotos(c)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, err.Error(), nil)
	}

	data, err := h.service.StartDeliveryWithProof(uint(id), claims.UserID, claims.Role, services.StartDeliveryInput{
		PickupNote: pickupNote,
		PhotoURLs:  urls,
	})
	if err != nil {
		for _, old := range urls {
			_ = h.storage.Delete(old)
		}
		return utils.ErrorResponse(c, fiber.StatusBadRequest, err.Error(), nil)
	}

	return utils.SuccessResponse(c, fiber.StatusOK, "Foto persiapan barang tersimpan, status berubah menjadi Dalam Perjalanan!", data)
}

// POST /api/deliveries/:id/complete (multipart/form-data: photos, receiver_name, note)
func (h *DeliveryHandler) CompleteWithProof(c *fiber.Ctx) error {
	claims, ok := c.Locals("user").(*utils.JWTClaims)
	if !ok || claims == nil || claims.UserID == 0 {
		return utils.ErrorResponse(c, fiber.StatusUnauthorized, "Sesi tidak valid atau kedaluwarsa", nil)
	}

	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil || id == 0 {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "ID pengiriman tidak valid", nil)
	}

	receiverName := strings.TrimSpace(c.FormValue("receiver_name"))
	if receiverName == "" {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "Nama penerima barang wajib diisi", nil)
	}
	note := strings.TrimSpace(c.FormValue("note"))

	var deliveredItems []services.DeliveredItemQtyInput
	if rawItems := strings.TrimSpace(c.FormValue("delivered_items")); rawItems != "" {
		_ = json.Unmarshal([]byte(rawItems), &deliveredItems)
	}

	urls, err := h.saveUploadedPhotos(c)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, err.Error(), nil)
	}

	data, err := h.service.CompleteWithProof(uint(id), claims.UserID, claims.Role, services.CompleteDeliveryInput{
		ReceiverName:   receiverName,
		Note:           note,
		PhotoURLs:      urls,
		DeliveredItems: deliveredItems,
	})
	if err != nil {
		for _, old := range urls {
			_ = h.storage.Delete(old)
		}
		return utils.ErrorResponse(c, fiber.StatusBadRequest, err.Error(), nil)
	}

	return utils.SuccessResponse(c, fiber.StatusOK, "Pengantaran selesai, bukti foto tersimpan & stok produk telah dipotong!", data)
}
