package models

import "gorm.io/gorm"

const (
	MovementInbound    = "INBOUND"
	MovementPending    = "PENDING"
	MovementOutbound   = "OUTBOUND"
	MovementAdjustment = "ADJUSTMENT"
)

type InventoryMovement struct {
	gorm.Model
	ProductID uint   `gorm:"not null;index" json:"product_id"`
	UserID    uint   `gorm:"not null;index" json:"user_id"`
	Type      string `gorm:"size:20;not null" json:"type"`
	Quantity  int    `gorm:"not null" json:"quantity"`
	Notes     string `gorm:"type:text" json:"notes"`
	PhotoURL  string `gorm:"size:255" json:"photo_url"`

	Product Product `gorm:"foreignKey:ProductID" json:"product,omitempty"`
	User    User    `gorm:"foreignKey:UserID" json:"user,omitempty"`
}
