package services

import (
	"errors"
	"strings"

	"backend/models"

	"gorm.io/gorm"
)

type CategoryService struct {
	db *gorm.DB
}

func NewCategoryService(db *gorm.DB) *CategoryService {
	return &CategoryService{db: db}
}

type CategoryInput struct {
	Name string `json:"name"`
}

// 1. Ambil Semua Kategori
func (s *CategoryService) GetAll() ([]models.Category, error) {
	var categories []models.Category
	err := s.db.Order("name ASC").Find(&categories).Error
	return categories, err
}

// 2. Tambah Kategori Baru
func (s *CategoryService) Create(input CategoryInput) (*models.Category, error) {
	input.Name = strings.TrimSpace(input.Name)
	if input.Name == "" {
		return nil, errors.New("nama kategori wajib diisi")
	}

	// Bersihkan baris sisa soft-delete (jika ada) dengan nama yang sama
	s.db.Unscoped().Where("name = ? AND deleted_at IS NOT NULL", input.Name).Delete(&models.Category{})

	// Cek apakah nama sudah ada
	var count int64
	s.db.Model(&models.Category{}).Where("name = ?", input.Name).Count(&count)
	if count > 0 {
		return nil, errors.New("kategori dengan nama ini sudah ada")
	}

	category := models.Category{Name: input.Name}
	if err := s.db.Create(&category).Error; err != nil {
		return nil, err
	}
	return &category, nil
}

// 3. Update Kategori
func (s *CategoryService) Update(id uint, input CategoryInput) (*models.Category, error) {
	input.Name = strings.TrimSpace(input.Name)
	if input.Name == "" {
		return nil, errors.New("nama kategori wajib diisi")
	}

	var category models.Category
	if err := s.db.First(&category, id).Error; err != nil {
		return nil, errors.New("kategori tidak ditemukan")
	}

	category.Name = input.Name
	if err := s.db.Save(&category).Error; err != nil {
		return nil, err
	}
	return &category, nil
}

// 4. Hapus Kategori (Hard Delete dari MySQL)
func (s *CategoryService) Delete(id uint) error {
	// Cek apakah ada produk yang masih menggunakan kategori ini
	var productCount int64
	s.db.Unscoped().Model(&models.Product{}).Where("category_id = ?", id).Count(&productCount)
	if productCount > 0 {
		return errors.New("kategori tidak bisa dihapus karena masih ada produk di dalamnya")
	}

	res := s.db.Unscoped().Delete(&models.Category{}, id)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return errors.New("kategori tidak ditemukan")
	}
	return nil
}
