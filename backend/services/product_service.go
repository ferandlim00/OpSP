package services

import (
	"errors"
	"fmt"
	"math/rand"
	"strings"
	"time"

	"backend/models"

	"gorm.io/gorm"
)

type ProductService struct {
	db *gorm.DB
}

func NewProductService(db *gorm.DB) *ProductService {
	return &ProductService{db: db}
}

// ProductInput = data yang dikirim dari form frontend
type ProductInput struct {
	SKU         string
	Name        string
	CategoryID  uint
	RoomType    string
	Description string
	PriceBuy    *float64 // boleh kosong
	PriceSell   float64
	Stock       int
	MinStock    int
	IsActive    *bool
}

// ProductFilter = query string dari GET /api/products
type ProductFilter struct {
	Search     string // cari di nama / SKU
	CategoryID uint
	RoomType   string
	Status     string // "active" | "inactive" | "" (semua)
	Stock      string // "low" | "out" | "" (semua)
	Page       int
	Limit      int
}

type PaginatedProducts struct {
	Items []models.Product `json:"items"`
	Meta  PaginationMeta   `json:"meta"`
}

type PaginationMeta struct {
	Page       int   `json:"page"`
	Limit      int   `json:"limit"`
	Total      int64 `json:"total"`
	TotalPages int   `json:"total_pages"`
}

// preloadImages: foto utama selalu di urutan pertama
func preloadImages(db *gorm.DB) *gorm.DB {
	return db.Order("is_primary DESC, sort_order ASC, id ASC")
}

// ─────────────────────────────────────────────
// 1. LIST + FILTER + PAGINATION
// ─────────────────────────────────────────────
func (s *ProductService) GetAll(f ProductFilter) (*PaginatedProducts, error) {
	if f.Page < 1 {
		f.Page = 1
	}
	if f.Limit < 1 || f.Limit > 100 {
		f.Limit = 12
	}

	q := s.db.Model(&models.Product{})

	if f.Search != "" {
		like := "%" + f.Search + "%"
		q = q.Where("name LIKE ? OR sku LIKE ?", like, like)
	}
	if f.CategoryID > 0 {
		q = q.Where("category_id = ?", f.CategoryID)
	}
	if f.RoomType != "" {
		q = q.Where("room_type = ?", f.RoomType)
	}
	switch f.Status {
	case "active":
		q = q.Where("is_active = ?", true)
	case "inactive":
		q = q.Where("is_active = ?", false)
	}
	switch f.Stock {
	case "low":
		q = q.Where("stock > 0 AND stock <= min_stock")
	case "out":
		q = q.Where("stock = 0")
	}

	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, err
	}

	var items []models.Product
	err := q.Preload("Category").
		Preload("Images", preloadImages).
		Order("created_at DESC").
		Offset((f.Page - 1) * f.Limit).
		Limit(f.Limit).
		Find(&items).Error
	if err != nil {
		return nil, err
	}

	totalPages := int((total + int64(f.Limit) - 1) / int64(f.Limit))
	return &PaginatedProducts{
		Items: items,
		Meta:  PaginationMeta{Page: f.Page, Limit: f.Limit, Total: total, TotalPages: totalPages},
	}, nil
}

// ─────────────────────────────────────────────
// 2. DETAIL
// ─────────────────────────────────────────────
func (s *ProductService) GetByID(id uint) (*models.Product, error) {
	var p models.Product
	err := s.db.Preload("Category").Preload("Images", preloadImages).First(&p, id).Error
	if err != nil {
		return nil, errors.New("produk tidak ditemukan")
	}
	return &p, nil
}

// ─────────────────────────────────────────────
// Validasi bersama (create & update)
// ─────────────────────────────────────────────
func (s *ProductService) validate(in *ProductInput, excludeID uint) error {
	in.Name = strings.TrimSpace(in.Name)
	in.SKU = strings.ToUpper(strings.TrimSpace(in.SKU))
	in.RoomType = strings.ToUpper(strings.TrimSpace(in.RoomType))

	if in.Name == "" {
		return errors.New("nama produk wajib diisi")
	}
	if in.CategoryID == 0 {
		return errors.New("kategori wajib dipilih")
	}
	var catCount int64
	s.db.Model(&models.Category{}).Where("id = ?", in.CategoryID).Count(&catCount)
	if catCount == 0 {
		return errors.New("kategori tidak ditemukan")
	}
	if in.RoomType == "" {
		in.RoomType = models.RoomOther
	}
	if !models.ValidRoomTypes[in.RoomType] {
		return errors.New("jenis ruangan tidak valid")
	}
	if in.PriceSell < 0 {
		return errors.New("harga jual tidak boleh negatif")
	}
	if in.PriceBuy != nil && *in.PriceBuy < 0 {
		return errors.New("harga modal tidak boleh negatif")
	}
	if in.Stock < 0 || in.MinStock < 0 {
		return errors.New("stok tidak boleh negatif")
	}

	if in.SKU != "" {
		var count int64
		// Unscoped: ikut cek produk yang sudah di-soft-delete (index unik tetap berlaku)
		s.db.Unscoped().Model(&models.Product{}).
			Where("sku = ? AND id <> ?", in.SKU, excludeID).Count(&count)
		if count > 0 {
			return errors.New("SKU sudah dipakai produk lain (termasuk produk yang pernah dihapus)")
		}
	}
	return nil
}

// generateSKU → contoh: PRD-261005-K7QZ
func (s *ProductService) generateSKU() string {
	const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	r := rand.New(rand.NewSource(time.Now().UnixNano()))
	for {
		b := make([]byte, 4)
		for i := range b {
			b[i] = chars[r.Intn(len(chars))]
		}
		sku := fmt.Sprintf("PRD-%s-%s", time.Now().Format("060102"), string(b))
		var count int64
		s.db.Unscoped().Model(&models.Product{}).Where("sku = ?", sku).Count(&count)
		if count == 0 {
			return sku
		}
	}
}

// ─────────────────────────────────────────────
// 3. CREATE (+ foto + stok awal tercatat)
// ─────────────────────────────────────────────
func (s *ProductService) Create(in ProductInput, imageURLs []string) (*models.Product, error) {
	if err := s.validate(&in, 0); err != nil {
		return nil, err
	}
	if in.SKU == "" {
		in.SKU = s.generateSKU()
	}
	isActive := true
	if in.IsActive != nil {
		isActive = *in.IsActive
	}

	product := models.Product{
		SKU: in.SKU, Name: in.Name, CategoryID: in.CategoryID, RoomType: in.RoomType,
		Description: in.Description, PriceBuy: in.PriceBuy, PriceSell: in.PriceSell,
		Stock: in.Stock, MinStock: in.MinStock, IsActive: isActive,
	}

	// DB Transaction: produk, foto, dan riwayat stok harus tersimpan bersamaan
	err := s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&product).Error; err != nil {
			return err
		}
		// GORM tidak menyimpan bool false jika ada default:true → set eksplisit
		if !isActive {
			if err := tx.Model(&product).Update("is_active", false).Error; err != nil {
				return err
			}
		}
		for i, url := range imageURLs {
			img := models.ProductImage{ProductID: product.ID, ImageURL: url, IsPrimary: i == 0, SortOrder: i}
			if err := tx.Create(&img).Error; err != nil {
				return err
			}
		}
		if in.Stock > 0 {
			mv := models.InventoryMovement{
				ProductID: product.ID, UserID: 1, Type: models.MovementInbound, Quantity: in.Stock,
				Notes: "Stok awal produk",
			}
			if err := tx.Create(&mv).Error; err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return s.GetByID(product.ID)
}

// ─────────────────────────────────────────────
// 4. UPDATE (perubahan stok dicatat sebagai penyesuaian)
// ─────────────────────────────────────────────
func (s *ProductService) Update(id uint, in ProductInput) (*models.Product, error) {
	var p models.Product
	if err := s.db.First(&p, id).Error; err != nil {
		return nil, errors.New("produk tidak ditemukan")
	}
	if err := s.validate(&in, id); err != nil {
		return nil, err
	}
	if in.SKU == "" {
		in.SKU = p.SKU
	}
	oldStock := p.Stock

	err := s.db.Transaction(func(tx *gorm.DB) error {
		updates := map[string]interface{}{
			"sku": in.SKU, "name": in.Name, "category_id": in.CategoryID, "room_type": in.RoomType,
			"description": in.Description, "price_buy": in.PriceBuy, "price_sell": in.PriceSell,
			"stock": in.Stock, "min_stock": in.MinStock,
		}
		if in.IsActive != nil {
			updates["is_active"] = *in.IsActive
		}
		if err := tx.Model(&p).Updates(updates).Error; err != nil {
			return err
		}

		if diff := in.Stock - oldStock; diff != 0 {
			mvType, qty := models.MovementInbound, diff
			if diff < 0 {
				mvType, qty = models.MovementOutbound, -diff
			}
			mv := models.InventoryMovement{
				ProductID: id, UserID: 1, Type: mvType, Quantity: qty,
				Notes: fmt.Sprintf("Penyesuaian stok via edit produk (%d → %d)", oldStock, in.Stock),
			}
			if err := tx.Create(&mv).Error; err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return s.GetByID(id)
}

// ─────────────────────────────────────────────
// 5. DELETE (hard delete dari MySQL beserta foto & mutasi stok)
// ─────────────────────────────────────────────
func (s *ProductService) Delete(id uint) ([]string, error) {
	var p models.Product
	if err := s.db.Unscoped().First(&p, id).Error; err != nil {
		return nil, errors.New("produk tidak ditemukan")
	}

	// Cek apakah produk sudah dipakai di transaksi / PO / pengiriman
	var txCount, poCount, delivCount int64
	s.db.Unscoped().Model(&models.TransactionItem{}).Where("product_id = ?", id).Count(&txCount)
	s.db.Unscoped().Model(&models.PurchaseOrderItem{}).Where("product_id = ?", id).Count(&poCount)
	s.db.Unscoped().Model(&models.DeliveryItem{}).Where("product_id = ?", id).Count(&delivCount)
	if txCount > 0 || poCount > 0 || delivCount > 0 {
		return nil, errors.New("produk tidak bisa dihapus karena sudah tercatat pada riwayat transaksi/PO/pengiriman")
	}

	var imgs []models.ProductImage
	s.db.Unscoped().Where("product_id = ?", id).Find(&imgs)
	urls := make([]string, 0, len(imgs))
	for _, img := range imgs {
		urls = append(urls, img.ImageURL)
	}

	err := s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Unscoped().Where("product_id = ?", id).Delete(&models.ProductImage{}).Error; err != nil {
			return err
		}
		if err := tx.Unscoped().Where("product_id = ?", id).Delete(&models.InventoryMovement{}).Error; err != nil {
			return err
		}
		if err := tx.Unscoped().Delete(&models.Product{}, id).Error; err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return urls, nil
}

// ─────────────────────────────────────────────
// 6. FOTO: tambah, hapus, jadikan utama
// ─────────────────────────────────────────────
const MaxImagesPerProduct = 8

func (s *ProductService) CountImages(productID uint) int64 {
	var n int64
	s.db.Model(&models.ProductImage{}).Where("product_id = ?", productID).Count(&n)
	return n
}

func (s *ProductService) AddImages(productID uint, urls []string) ([]models.ProductImage, error) {
	if _, err := s.GetByID(productID); err != nil {
		return nil, err
	}
	var result []models.ProductImage
	err := s.db.Transaction(func(tx *gorm.DB) error {
		var maxOrder int
		tx.Model(&models.ProductImage{}).Where("product_id = ?", productID).
			Select("COALESCE(MAX(sort_order), -1)").Scan(&maxOrder)

		var primaryCount int64
		tx.Model(&models.ProductImage{}).Where("product_id = ? AND is_primary = ?", productID, true).Count(&primaryCount)

		for i, url := range urls {
			img := models.ProductImage{
				ProductID: productID, ImageURL: url, SortOrder: maxOrder + 1 + i,
				IsPrimary: primaryCount == 0 && i == 0, // jika belum ada foto utama
			}
			if err := tx.Create(&img).Error; err != nil {
				return err
			}
			result = append(result, img)
		}
		return nil
	})
	return result, err
}

// DeleteImage mengembalikan URL file supaya handler bisa menghapus file fisiknya
func (s *ProductService) DeleteImage(productID, imageID uint) (string, error) {
	var img models.ProductImage
	if err := s.db.Where("id = ? AND product_id = ?", imageID, productID).First(&img).Error; err != nil {
		return "", errors.New("foto tidak ditemukan")
	}
	err := s.db.Transaction(func(tx *gorm.DB) error {
		// Hard delete: baris foto tidak perlu disimpan
		if err := tx.Unscoped().Delete(&img).Error; err != nil {
			return err
		}
		// Jika foto utama dihapus → foto berikutnya otomatis jadi utama
		if img.IsPrimary {
			var next models.ProductImage
			if err := tx.Where("product_id = ?", productID).Order("sort_order ASC, id ASC").First(&next).Error; err == nil {
				return tx.Model(&next).Update("is_primary", true).Error
			}
		}
		return nil
	})
	return img.ImageURL, err
}

func (s *ProductService) SetPrimaryImage(productID, imageID uint) error {
	var img models.ProductImage
	if err := s.db.Where("id = ? AND product_id = ?", imageID, productID).First(&img).Error; err != nil {
		return errors.New("foto tidak ditemukan")
	}
	return s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&models.ProductImage{}).Where("product_id = ?", productID).
			Update("is_primary", false).Error; err != nil {
			return err
		}
		return tx.Model(&img).Update("is_primary", true).Error
	})
}
