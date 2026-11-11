package handlers

import (
	"encoding/json"
	"strconv"
	"strings"
	"sync"
	"time"

	"backend/models"
	"backend/services"
	"backend/utils"

	"github.com/gofiber/fiber/v2"
)

const paymentProofFolder = "payments"
const idempotencyTTL = 120 * time.Second

type TransactionHandler struct {
	service          *services.TransactionService
	storage          services.Storage
	idempotencyMu    sync.Mutex
	idempotencyCache map[string]time.Time
}

func NewTransactionHandler(service *services.TransactionService, storage services.Storage) *TransactionHandler {
	return &TransactionHandler{
		service:          service,
		storage:          storage,
		idempotencyCache: make(map[string]time.Time),
	}
}

func (h *TransactionHandler) checkAndLockIdempotencyKey(key string) bool {
	if key == "" {
		return true
	}
	now := time.Now()
	h.idempotencyMu.Lock()
	defer h.idempotencyMu.Unlock()

	for k, exp := range h.idempotencyCache {
		if now.After(exp) {
			delete(h.idempotencyCache, k)
		}
	}
	if exp, exists := h.idempotencyCache[key]; exists && now.Before(exp) {
		return false
	}
	h.idempotencyCache[key] = now.Add(idempotencyTTL)
	return true
}

func (h *TransactionHandler) releaseIdempotencyKey(key string) {
	if key == "" {
		return
	}
	h.idempotencyMu.Lock()
	defer h.idempotencyMu.Unlock()
	delete(h.idempotencyCache, key)
}

// GET /api/transactions
func (h *TransactionHandler) GetAll(c *fiber.Ctx) error {
	data, err := h.service.GetAll()
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "Gagal mengambil data transaksi", err.Error())
	}
	return utils.SuccessResponse(c, fiber.StatusOK, "Data transaksi berhasil diambil", data)
}

// GET /api/transactions/:id
func (h *TransactionHandler) GetByID(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil || id == 0 {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "ID transaksi tidak valid", nil)
	}
	data, err := h.service.GetByID(uint(id))
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusNotFound, err.Error(), nil)
	}
	return utils.SuccessResponse(c, fiber.StatusOK, "Detail transaksi berhasil diambil", data)
}

// POST /api/transactions (mendukung JSON maupun multipart/form-data dengan proof_photo)
func (h *TransactionHandler) Create(c *fiber.Ctx) error {
	claims, ok := c.Locals("user").(*utils.JWTClaims)
	if !ok || claims == nil || claims.UserID == 0 {
		return utils.ErrorResponse(c, fiber.StatusUnauthorized, "Sesi tidak valid atau kedaluwarsa", nil)
	}
	userID := claims.UserID

	idemKey := strings.TrimSpace(c.Get("X-Idempotency-Key"))
	if !h.checkAndLockIdempotencyKey(idemKey) {
		return utils.ErrorResponse(c, fiber.StatusConflict, "Transaksi sedang diproses atau sudah dikirim (mencegah klik ganda)", nil)
	}

	var in services.CreateTransactionInput
	contentType := strings.ToLower(c.Get("Content-Type"))

	if strings.HasPrefix(contentType, "multipart/form-data") {
		custID, _ := strconv.ParseUint(c.FormValue("customer_id"), 10, 32)
		disc, _ := strconv.ParseFloat(c.FormValue("discount"), 64)
		in.CustomerID = uint(custID)
		in.Discount = disc
		in.Note = strings.TrimSpace(c.FormValue("note"))
		in.PaymentMethod = models.PaymentMethod(strings.TrimSpace(c.FormValue("payment_method")))
		in.PaymentType = models.PaymentType(strings.TrimSpace(c.FormValue("payment_type")))

		if rawAmt := strings.TrimSpace(c.FormValue("amount_paid")); rawAmt != "" {
			if amt, err := strconv.ParseFloat(rawAmt, 64); err == nil {
				in.AmountPaid = &amt
			}
		}

		if rawItems := strings.TrimSpace(c.FormValue("items")); rawItems != "" {
			if err := json.Unmarshal([]byte(rawItems), &in.Items); err != nil {
				h.releaseIdempotencyKey(idemKey)
				return utils.ErrorResponse(c, fiber.StatusBadRequest, "Format daftar barang tidak valid", err.Error())
			}
		}

		fileHeader, err := c.FormFile("proof_photo")
		if err == nil && fileHeader != nil && h.storage != nil {
			if err := services.ValidateImage(fileHeader); err != nil {
				h.releaseIdempotencyKey(idemKey)
				return utils.ErrorResponse(c, fiber.StatusBadRequest, err.Error(), nil)
			}
			savedURL, err := h.storage.Save(c, fileHeader, paymentProofFolder)
			if err != nil {
				h.releaseIdempotencyKey(idemKey)
				return utils.ErrorResponse(c, fiber.StatusInternalServerError, "Gagal menyimpan bukti pembayaran", err.Error())
			}
			in.PaymentProofURL = savedURL
		}
	} else {
		if err := c.BodyParser(&in); err != nil {
			h.releaseIdempotencyKey(idemKey)
			return utils.ErrorResponse(c, fiber.StatusBadRequest, "Format input transaksi tidak valid", err.Error())
		}
	}

	data, err := h.service.Create(userID, in)
	if err != nil {
		h.releaseIdempotencyKey(idemKey)
		if in.PaymentProofURL != "" && h.storage != nil {
			_ = h.storage.Delete(in.PaymentProofURL)
		}
		return utils.ErrorResponse(c, fiber.StatusBadRequest, err.Error(), nil)
	}
	return utils.SuccessResponse(c, fiber.StatusCreated, "Transaksi & bukti pembayaran berhasil disimpan!", data)
}

// POST /api/transactions/:id/payments (mendukung JSON maupun multipart/form-data dengan proof_photo)
func (h *TransactionHandler) AddPayment(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil || id == 0 {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "ID transaksi tidak valid", nil)
	}

	var in services.AddPaymentInput
	contentType := strings.ToLower(c.Get("Content-Type"))

	if strings.HasPrefix(contentType, "multipart/form-data") {
		amt, _ := strconv.ParseFloat(c.FormValue("amount"), 64)
		in.Amount = amt
		in.Method = models.PaymentMethod(strings.TrimSpace(c.FormValue("method")))
		in.PaymentType = models.PaymentType(strings.TrimSpace(c.FormValue("payment_type")))
		in.Note = strings.TrimSpace(c.FormValue("note"))

		fileHeader, err := c.FormFile("proof_photo")
		if err == nil && fileHeader != nil && h.storage != nil {
			if err := services.ValidateImage(fileHeader); err != nil {
				return utils.ErrorResponse(c, fiber.StatusBadRequest, err.Error(), nil)
			}
			savedURL, err := h.storage.Save(c, fileHeader, paymentProofFolder)
			if err != nil {
				return utils.ErrorResponse(c, fiber.StatusInternalServerError, "Gagal menyimpan foto bukti pembayaran", err.Error())
			}
			in.ProofURL = savedURL
		}
	} else {
		if err := c.BodyParser(&in); err != nil {
			return utils.ErrorResponse(c, fiber.StatusBadRequest, "Format input pembayaran tidak valid", err.Error())
		}
	}

	data, err := h.service.AddPayment(uint(id), in)
	if err != nil {
		if in.ProofURL != "" && h.storage != nil {
			_ = h.storage.Delete(in.ProofURL)
		}
		return utils.ErrorResponse(c, fiber.StatusBadRequest, err.Error(), nil)
	}
	return utils.SuccessResponse(c, fiber.StatusCreated, "Pembayaran & bukti bayar berhasil dicatat!", data)
}

// POST /api/transactions/:id/return-exchange
func (h *TransactionHandler) ReturnOrExchange(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil || id == 0 {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "ID transaksi tidak valid", nil)
	}

	var in services.ReturnExchangeInput
	if err := c.BodyParser(&in); err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "Format input retur/tukar tidak valid", err.Error())
	}

	claims, ok := c.Locals("user").(*utils.JWTClaims)
	if !ok || claims == nil || claims.UserID == 0 {
		return utils.ErrorResponse(c, fiber.StatusUnauthorized, "Sesi tidak valid atau kedaluwarsa", nil)
	}
	userID := claims.UserID

	data, err := h.service.ProcessReturnOrExchange(uint(id), userID, in)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, err.Error(), nil)
	}
	return utils.SuccessResponse(c, fiber.StatusOK, "Proses retur / tukar barang berhasil dicatat!", data)
}
