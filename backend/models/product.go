package models

import "gorm.io/gorm"

type Product struct {
	gorm.Model
	SKU         string   `gorm:"uniqueIndex;not null" json:"sku"`
	Name        string   `gorm:"not null" json:"name"`
	CategoryID  uint     `gorm:"not null" json:"category_id"`
	Description string   `gorm:"type:text" json:"description"`
	PriceBuy    *float64 `json:"price_buy"` // nullable — harga modal opsional
	PriceSell   float64  `gorm:"not null" json:"price_sell"`
	Stock       int      `gorm:"default:0" json:"stock"`
	MinStock    int      `gorm:"default:0" json:"min_stock"`
	IsActive    bool     `gorm:"default:true" json:"is_active"`

	// Relasi
	Category Category       `gorm:"foreignKey:CategoryID" json:"category,omitempty"`
	Images   []ProductImage `gorm:"foreignKey:ProductID" json:"images,omitempty"`
}
