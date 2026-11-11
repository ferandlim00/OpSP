package services

import (
	"backend/models"
	"errors"
	"gorm.io/gorm"
)

type InventoryService interface {
	GetMovements() ([]models.InventoryMovement, error)
	RecordMovement(movement *models.InventoryMovement) error
}

type inventoryService struct {
	db *gorm.DB
}

func NewInventoryService(db *gorm.DB) InventoryService {
	return &inventoryService{db: db}
}

func (s *inventoryService) GetMovements() ([]models.InventoryMovement, error) {
	var movements []models.InventoryMovement
	// Unscoped pada Preload: riwayat stok tetap menampilkan nama & SKU produk
	// walaupun produknya sudah dihapus (soft delete / deleted_at terisi).
	includeDeleted := func(db *gorm.DB) *gorm.DB { return db.Unscoped() }
	err := s.db.
		Preload("Product", includeDeleted).
		Preload("User", includeDeleted).
		Order("created_at desc").
		Find(&movements).Error
	return movements, err
}

func (s *inventoryService) RecordMovement(movement *models.InventoryMovement) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		var product models.Product
		if err := tx.First(&product, movement.ProductID).Error; err != nil {
			return errors.New("product not found")
		}

		if movement.Type == models.MovementInbound {
			if err := tx.Model(&models.Product{}).
				Where("id = ?", movement.ProductID).
				Update("stock", gorm.Expr("stock + ?", movement.Quantity)).Error; err != nil {
				return err
			}
		} else if movement.Type == models.MovementOutbound {
			res := tx.Model(&models.Product{}).
				Where("id = ? AND stock >= ?", movement.ProductID, movement.Quantity).
				Update("stock", gorm.Expr("stock - ?", movement.Quantity))
			if res.Error != nil {
				return res.Error
			}
			if res.RowsAffected == 0 {
				return errors.New("Stok produk " + product.Name + " tidak mencukupi atau telah berubah")
			}
		} else if movement.Type == models.MovementAdjustment {
			if err := tx.Model(&models.Product{}).
				Where("id = ?", movement.ProductID).
				Update("stock", gorm.Expr("stock + ?", movement.Quantity)).Error; err != nil {
				return err
			}
		} else {
			return errors.New("invalid movement type")
		}

		if err := tx.Create(movement).Error; err != nil {
			return err
		}

		return nil
	})
}
