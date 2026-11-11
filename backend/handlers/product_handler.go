package handlers

import (
	"fmt"
	"strconv"
	"strings"

	"backend/services"
	"backend/utils"

	"github.com/gofiber/fiber/v2"
)

type ProductHandler struct {
	service *services.ProductService
	storage services.Storage
}

func NewProductHandler(service *services.ProductService, storage services.Storage) *ProductHandler {
	return &ProductHandler{service: service, storage: storage}
}

const productImageFolder = "products"

// ─────────────────────────────────────────────
// Helper: baca field form (multipart) → ProductInput
// ─────────────────────────────────────────────
func parseProductForm(c *fiber.Ctx) (services.ProductInput, error) {
	var in services.ProductInput
	in.SKU = c.FormValue("sku")
	in.Name = c.FormValue("name")
	in.RoomType = c.FormValue("room_type")
	in.Description = c.FormValue("description")

	catID, err := strconv.ParseUint(c.FormValue("category_id"), 10, 32)
	if err != nil {
		return in, fmt.Errorf("kategori wajib dipilih")
	}
	in.CategoryID = uint(catID)

	// (Harga Jual Opsional)
	priceStr := strings.TrimSpace(c.FormValue("price_sell"))
	if priceStr != "" && priceStr != "undefined" && priceStr != "null" {
		clean := strings.ReplaceAll(priceStr, "Rp", "")
		clean = strings.ReplaceAll(clean, "rp", "")
		clean = strings.ReplaceAll(clean, " ", "")
		clean = strings.ReplaceAll(clean, ",", ".")
		if parsed, err := strconv.ParseFloat(clean, 64); err == nil {
			in.PriceSell = parsed
		} else {
			return in, fmt.Errorf("format harga jual tidak valid")
		}
	} else {
		in.PriceSell = 0 // Jika dikosongkan, otomatis simpan sebagai 0
	}
	if v := strings.TrimSpace(c.FormValue("price_buy")); v != "" {
		pb, err := strconv.ParseFloat(v, 64)
		if err != nil {
			return in, fmt.Errorf("harga modal tidak valid")
		}
		in.PriceBuy = &pb
	}
	if v := c.FormValue("stock"); v != "" {
		if in.Stock, err = strconv.Atoi(v); err != nil {
			return in, fmt.Errorf("stok tidak valid")
		}
	}
	if v := c.FormValue("min_stock"); v != "" {
		if in.MinStock, err = strconv.Atoi(v); err != nil {
			return in, fmt.Errorf("stok minimum tidak valid")
		}
	}
	if v := c.FormValue("is_active"); v != "" {
		b := v == "true" || v == "1"
		in.IsActive = &b
	}
	return in, nil
}

// saveImages menyimpan semua file di field "images".
// Jika satu gagal, file yang sudah tersimpan dihapus lagi (rollback manual).
func (h *ProductHandler) saveImages(c *fiber.Ctx, maxAllowed int) ([]string, error) {
	form, err := c.MultipartForm()
	if err != nil || form == nil {
		return nil, nil // tidak ada file → bukan error
	}
	files := form.File["images"]
	if len(files) == 0 {
		return nil, nil
	}
	if len(files) > maxAllowed {
		return nil, fmt.Errorf("hanya bisa upload %d foto lagi (maksimal %d foto per produk)", maxAllowed, services.MaxImagesPerProduct)
	}
	// Validasi semua dulu sebelum menyimpan apa pun
	for _, f := range files {
		if err := services.ValidateImage(f); err != nil {
			return nil, err
		}
	}
	var urls []string
	for _, f := range files {
		url, err := h.storage.Save(c, f, productImageFolder)
		if err != nil {
			h.cleanup(urls)
			return nil, err
		}
		urls = append(urls, url)
	}
	return urls, nil
}

func (h *ProductHandler) cleanup(urls []string) {
	for _, u := range urls {
		_ = h.storage.Delete(u)
	}
}

func parseID(c *fiber.Ctx, key string) (uint, error) {
	id, err := strconv.ParseUint(c.Params(key), 10, 32)
	if err != nil || id == 0 {
		return 0, fmt.Errorf("ID tidak valid")
	}
	return uint(id), nil
}

// ─────────────────────────────────────────────
// GET /api/products?search=&category_id=&room_type=&status=&stock=&page=&limit=
// ─────────────────────────────────────────────
func (h *ProductHandler) GetAll(c *fiber.Ctx) error {
	claims, _ := c.Locals("user").(*utils.JWTClaims)
	isOwner := claims != nil && claims.Role == "OWNER"

	catID, _ := strconv.ParseUint(c.Query("category_id"), 10, 32)
	f := services.ProductFilter{
		Search:     strings.TrimSpace(c.Query("search")),
		CategoryID: uint(catID),
		RoomType:   strings.ToUpper(c.Query("room_type")),
		Status:     c.Query("status"),
		Stock:      c.Query("stock"),
		Page:       c.QueryInt("page", 1),
		Limit:      c.QueryInt("limit", 12),
	}
	data, err := h.service.GetAll(f)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "Gagal mengambil data produk", err.Error())
	}
	// Sesuai PLAN.md Baris 28: Harga modal produk hanya terlihat oleh Owner
	if !isOwner && data != nil {
		for i := range data.Items {
			data.Items[i].PriceBuy = nil
		}
	}
	return utils.SuccessResponse(c, fiber.StatusOK, "Sukses", data)
}

// GET /api/products/:id
func (h *ProductHandler) GetByID(c *fiber.Ctx) error {
	claims, _ := c.Locals("user").(*utils.JWTClaims)
	isOwner := claims != nil && claims.Role == "OWNER"

	id, err := parseID(c, "id")
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, err.Error(), nil)
	}
	data, err := h.service.GetByID(id)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusNotFound, err.Error(), nil)
	}
	if !isOwner && data != nil {
		data.PriceBuy = nil
	}
	return utils.SuccessResponse(c, fiber.StatusOK, "Sukses", data)
}

// POST /api/products  (multipart/form-data, field foto: "images" bisa banyak)
func (h *ProductHandler) Create(c *fiber.Ctx) error {
	claims, _ := c.Locals("user").(*utils.JWTClaims)
	isOwner := claims != nil && claims.Role == "OWNER"

	in, err := parseProductForm(c)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, err.Error(), nil)
	}
	if !isOwner {
		in.PriceBuy = nil
	}
	urls, err := h.saveImages(c, services.MaxImagesPerProduct)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, err.Error(), nil)
	}
	if len(urls) == 0 {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "Wajib mengunggah minimal 1 foto produk sesuai aturan bisnis", nil)
	}
	data, err := h.service.Create(in, urls)
	if err != nil {
		h.cleanup(urls) // DB gagal → hapus file yang terlanjur diupload
		return utils.ErrorResponse(c, fiber.StatusBadRequest, err.Error(), nil)
	}
	if !isOwner && data != nil {
		data.PriceBuy = nil
	}
	return utils.SuccessResponse(c, fiber.StatusCreated, "Produk berhasil ditambahkan!", data)
}

// PUT /api/products/:id  (multipart/form-data, tanpa foto — foto dikelola endpoint terpisah)
func (h *ProductHandler) Update(c *fiber.Ctx) error {
	claims, _ := c.Locals("user").(*utils.JWTClaims)
	isOwner := claims != nil && claims.Role == "OWNER"

	id, err := parseID(c, "id")
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, err.Error(), nil)
	}
	in, err := parseProductForm(c)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, err.Error(), nil)
	}
	if !isOwner {
		in.PriceBuy = nil
	}
	data, err := h.service.Update(id, in)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, err.Error(), nil)
	}
	if !isOwner && data != nil {
		data.PriceBuy = nil
	}
	return utils.SuccessResponse(c, fiber.StatusOK, "Produk berhasil diperbarui!", data)
}

// DELETE /api/products/:id
func (h *ProductHandler) Delete(c *fiber.Ctx) error {
	id, err := parseID(c, "id")
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, err.Error(), nil)
	}
	urls, err := h.service.Delete(id)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, err.Error(), nil)
	}
	h.cleanup(urls)
	return utils.SuccessResponse(c, fiber.StatusOK, "Produk berhasil dihapus permanen dari database!", nil)
}

// POST /api/products/:id/images  (field: "images")
func (h *ProductHandler) AddImages(c *fiber.Ctx) error {
	id, err := parseID(c, "id")
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, err.Error(), nil)
	}
	remaining := services.MaxImagesPerProduct - int(h.service.CountImages(id))
	if remaining <= 0 {
		return utils.ErrorResponse(c, fiber.StatusBadRequest,
			fmt.Sprintf("produk sudah memiliki %d foto (maksimal)", services.MaxImagesPerProduct), nil)
	}
	urls, err := h.saveImages(c, remaining)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, err.Error(), nil)
	}
	if len(urls) == 0 {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "pilih minimal 1 foto", nil)
	}
	data, err := h.service.AddImages(id, urls)
	if err != nil {
		h.cleanup(urls)
		return utils.ErrorResponse(c, fiber.StatusBadRequest, err.Error(), nil)
	}
	return utils.SuccessResponse(c, fiber.StatusCreated, "Foto berhasil ditambahkan!", data)
}

// DELETE /api/products/:id/images/:imageId
func (h *ProductHandler) DeleteImage(c *fiber.Ctx) error {
	id, err := parseID(c, "id")
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, err.Error(), nil)
	}
	imgID, err := parseID(c, "imageId")
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, err.Error(), nil)
	}
	url, err := h.service.DeleteImage(id, imgID)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, err.Error(), nil)
	}
	_ = h.storage.Delete(url)
	return utils.SuccessResponse(c, fiber.StatusOK, "Foto berhasil dihapus!", nil)
}

// PUT /api/products/:id/images/:imageId/primary
func (h *ProductHandler) SetPrimaryImage(c *fiber.Ctx) error {
	id, err := parseID(c, "id")
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, err.Error(), nil)
	}
	imgID, err := parseID(c, "imageId")
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, err.Error(), nil)
	}
	if err := h.service.SetPrimaryImage(id, imgID); err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, err.Error(), nil)
	}
	return utils.SuccessResponse(c, fiber.StatusOK, "Foto utama diperbarui!", nil)
}
