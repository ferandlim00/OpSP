package services

import (
	"backend/models"
	"errors"
	"gorm.io/gorm"
)

type SupplierService interface {
	GetAll() ([]models.Supplier, error)
	GetByID(id uint) (*models.Supplier, error)
	Create(supplier *models.Supplier) error
	Update(supplier *models.Supplier) error
	Delete(id uint) error
}

type supplierService struct {
	db *gorm.DB
}

func NewSupplierService(db *gorm.DB) SupplierService {
	return &supplierService{db: db}
}

func (s *supplierService) GetAll() ([]models.Supplier, error) {
	var suppliers []models.Supplier
	err := s.db.Find(&suppliers).Error
	return suppliers, err
}

func (s *supplierService) GetByID(id uint) (*models.Supplier, error) {
	var supplier models.Supplier
	err := s.db.First(&supplier, id).Error
	return &supplier, err
}

func (s *supplierService) Create(supplier *models.Supplier) error {
	return s.db.Create(supplier).Error
}

func (s *supplierService) Update(supplier *models.Supplier) error {
	return s.db.Save(supplier).Error
}

func (s *supplierService) Delete(id uint) error {
	var poCount int64
	s.db.Unscoped().Model(&models.PurchaseOrder{}).Where("supplier_id = ?", id).Count(&poCount)
	if poCount > 0 {
		return errors.New("supplier tidak bisa dihapus karena memiliki riwayat purchase order")
	}
	res := s.db.Unscoped().Delete(&models.Supplier{}, id)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return errors.New("supplier tidak ditemukan")
	}
	return nil
}
