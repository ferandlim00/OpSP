package models

import "gorm.io/gorm"

type MovementType string

const (
	MovementIn  MovementType = "IN"
	MovementOut MovementType = "OUT"
)

type InventoryMovement struct {
	gorm.Model
	ProductID     uint         `gorm:"not null" json:"product_id"`
	Type          MovementType `gorm:"type:enum('IN','OUT');not null" json:"type"`
	Quantity      int          `gorm:"not null" json:"quantity"`
	ReferenceType string       `json:"reference_type"` // "DELIVERY", "PURCHASE_ORDER", "MANUAL"
	ReferenceID   uint         `json:"reference_id"`
	Note          string       `gorm:"type:text" json:"note"`

	// Relasi
	Product Product `gorm:"foreignKey:ProductID" json:"product,omitempty"`
}
