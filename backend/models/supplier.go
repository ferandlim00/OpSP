package models

import "gorm.io/gorm"

type Supplier struct {
	gorm.Model
	Code     string          `gorm:"size:50;uniqueIndex;not null" json:"code"`
	Name     string          `gorm:"size:150;not null" json:"name"`
	Phone   string          `json:"phone"`
	Email   string          `json:"email"`
	Address string          `gorm:"type:text" json:"address"`
	PIC     string          `json:"pic"`
	IsActive bool           `gorm:"default:true" json:"is_active"`
	Note    string          `gorm:"type:text" json:"note"`
	Orders  []PurchaseOrder `gorm:"foreignKey:SupplierID" json:"-"`
}
