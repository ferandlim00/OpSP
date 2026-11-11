package handlers

import (
	"strconv"
	"strings"

	"backend/models"
	"backend/services"
	"backend/utils"

	"github.com/gofiber/fiber/v2"
)

const attendancePhotoFolder = "attendances"

type AttendanceHandler struct {
	service *services.AttendanceService
	storage services.Storage
}

func NewAttendanceHandler(service *services.AttendanceService, storage services.Storage) *AttendanceHandler {
	return &AttendanceHandler{service: service, storage: storage}
}

func (h *AttendanceHandler) GetAll(c *fiber.Ctx) error {
	claims, ok := c.Locals("user").(*utils.JWTClaims)
	if !ok || claims == nil || claims.UserID == 0 {
		return utils.ErrorResponse(c, fiber.StatusUnauthorized, "Sesi tidak valid atau kedaluwarsa", nil)
	}

	data, err := h.service.GetAll(claims.Role, claims.UserID)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "Gagal mengambil data presensi", err.Error())
	}
	return utils.SuccessResponse(c, fiber.StatusOK, "Data presensi berhasil diambil", data)
}

func (h *AttendanceHandler) Record(c *fiber.Ctx) error {
	claims, ok := c.Locals("user").(*utils.JWTClaims)
	if !ok || claims == nil || claims.UserID == 0 {
		return utils.ErrorResponse(c, fiber.StatusUnauthorized, "Sesi tidak valid atau kedaluwarsa", nil)
	}
	userID := claims.UserID

	var in services.RecordAttendanceInput
	contentType := strings.ToLower(c.Get("Content-Type"))

	if strings.HasPrefix(contentType, "multipart/form-data") {
		in.Type = models.AttendanceType(strings.TrimSpace(c.FormValue("type")))
		in.Latitude, _ = strconv.ParseFloat(c.FormValue("latitude"), 64)
		in.Longitude, _ = strconv.ParseFloat(c.FormValue("longitude"), 64)
		in.Accuracy, _ = strconv.ParseFloat(c.FormValue("accuracy"), 64)
		in.DeviceInfo = strings.TrimSpace(c.FormValue("device_info"))

		fileHeader, err := c.FormFile("photo")
		if err == nil && fileHeader != nil && h.storage != nil {
			if err := services.ValidateImage(fileHeader); err != nil {
				return utils.ErrorResponse(c, fiber.StatusBadRequest, err.Error(), nil)
			}
			savedURL, err := h.storage.Save(c, fileHeader, attendancePhotoFolder)
			if err != nil {
				return utils.ErrorResponse(c, fiber.StatusInternalServerError, "Gagal menyimpan foto bukti presensi", err.Error())
			}
			in.PhotoURL = savedURL
		}
	} else {
		if err := c.BodyParser(&in); err != nil {
			return utils.ErrorResponse(c, fiber.StatusBadRequest, "Format input tidak valid", err.Error())
		}
	}

	if in.DeviceInfo == "" {
		in.DeviceInfo = c.Get("User-Agent")
	}

	data, err := h.service.Record(userID, in)
	if err != nil {
		if in.PhotoURL != "" && h.storage != nil {
			_ = h.storage.Delete(in.PhotoURL)
		}
		return utils.ErrorResponse(c, fiber.StatusBadRequest, err.Error(), nil)
	}
	return utils.SuccessResponse(c, fiber.StatusCreated, "Presensi & foto kehadiran berhasil dicatat", data)
}
