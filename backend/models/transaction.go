package models

import "gorm.io/gorm"

type TransactionType string
type TransactionStatus string
type PaymentStatus string

const (
	TransactionSale   TransactionType = "SALE"
	TransactionReturn TransactionType = "RETURN"
	TransactionCancel TransactionType = "CANCEL"

	StatusPending    TransactionStatus = "PENDING"
	StatusProcessing TransactionStatus = "PROCESSING"
	StatusCompleted  TransactionStatus = "COMPLETED"
	StatusCancelled  TransactionStatus = "CANCELLED"

	PaymentUnpaid  PaymentStatus = "UNPAID"
	PaymentPartial PaymentStatus = "PARTIAL"
	PaymentPaid    PaymentStatus = "PAID"
)

type Transaction struct {
	gorm.Model
	TransactionNo string            `gorm:"size:50;uniqueIndex;not null" json:"transaction_no"`
	CustomerID    uint              `gorm:"not null" json:"customer_id"`
	Type          TransactionType   `gorm:"type:enum('SALE','RETURN','CANCEL');default:'SALE'" json:"type"`
	Status        TransactionStatus `gorm:"type:enum('PENDING','PROCESSING','COMPLETED','CANCELLED');default:'PENDING'" json:"status"`
	PaymentStatus PaymentStatus     `gorm:"type:enum('UNPAID','PARTIAL','PAID');default:'UNPAID'" json:"payment_status"`
	Total         float64           `gorm:"not null" json:"total"`
	Discount      float64           `gorm:"default:0" json:"discount"`
	Note          string            `gorm:"type:text" json:"note"`

	// Relasi
	Customer   Customer          `gorm:"foreignKey:CustomerID" json:"customer,omitempty"`
	Items      []TransactionItem `gorm:"foreignKey:TransactionID" json:"items,omitempty"`
	Payments   []Payment         `gorm:"foreignKey:TransactionID" json:"payments,omitempty"`
	Deliveries []Delivery        `gorm:"foreignKey:TransactionID" json:"deliveries,omitempty"`
}

type TransactionItem struct {
	gorm.Model
	TransactionID uint    `gorm:"not null" json:"transaction_id"`
	ProductID     uint    `gorm:"not null" json:"product_id"`
	Qty           int     `gorm:"not null" json:"qty"`
	DeliveredQty  int     `gorm:"default:0" json:"delivered_qty"`
	ReturnedQty   int     `gorm:"default:0" json:"returned_qty"`
	Price         float64 `gorm:"not null" json:"price"`
	Discount      float64 `gorm:"default:0" json:"discount"`
	Subtotal      float64 `gorm:"not null" json:"subtotal"`

	// Relasi
	Product Product `gorm:"foreignKey:ProductID" json:"product,omitempty"`
}
