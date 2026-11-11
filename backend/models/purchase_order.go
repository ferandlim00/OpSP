package models

import (
	"time"

	"gorm.io/gorm"
)

type POStatus string

const (
	POPending   POStatus = "PENDING"
	POOrdered   POStatus = "ORDERED"
	POReceived  POStatus = "RECEIVED"
	POCancelled POStatus = "CANCELLED"
)

type PurchaseOrder struct {
	gorm.Model
	PONumber   string     `gorm:"size:50;uniqueIndex;not null" json:"po_number"`
	SupplierID uint       `gorm:"not null" json:"supplier_id"`
	Date       time.Time  `gorm:"not null" json:"date"`
	Status     POStatus   `gorm:"size:20;default:'ORDERED'" json:"status"`
	ReceivedAt *time.Time `json:"received_at"`
	Total      float64    `gorm:"default:0" json:"total"`
	Note       string     `gorm:"type:text" json:"note"`

	// Relasi
	Supplier Supplier            `gorm:"foreignKey:SupplierID" json:"supplier,omitempty"`
	Items    []PurchaseOrderItem `gorm:"foreignKey:POOrderID" json:"items,omitempty"`
}

type PurchaseOrderItem struct {
	gorm.Model
	POOrderID   uint     `gorm:"not null" json:"po_order_id"`
	ProductID   uint     `gorm:"not null" json:"product_id"`
	Qty         int      `gorm:"not null" json:"qty"`
	ReceivedQty int      `gorm:"default:0" json:"received_qty"`
	PriceModal  *float64 `json:"price_modal"` // nullable — opsional

	// Relasi
	Product Product `gorm:"foreignKey:ProductID" json:"product,omitempty"`
}
