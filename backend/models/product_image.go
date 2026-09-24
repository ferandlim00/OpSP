package models

import "gorm.io/gorm"

type ProductImage struct {
	gorm.Model
	ProductID uint   `gorm:"not null" json:"product_id"`
	ImageURL  string `gorm:"not null" json:"image_url"`
	IsPrimary bool   `gorm:"default:false" json:"is_primary"`
	SortOrder int    `gorm:"default:0" json:"sort_order"`
}
