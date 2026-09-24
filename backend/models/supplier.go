package models

import "gorm.io/gorm"

type Supplier struct {
	gorm.Model
	Code    string          `gorm:"uniqueIndex;not null" json:"code"`
	Name    string          `gorm:"not null" json:"name"`
	Phone   string          `json:"phone"`
	Email   string          `json:"email"`
	Address string          `gorm:"type:text" json:"address"`
	Note    string          `gorm:"type:text" json:"note"`
	Orders  []PurchaseOrder `gorm:"foreignKey:SupplierID" json:"-"`
}
