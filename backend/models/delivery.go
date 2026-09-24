package models

import (
	"time"

	"gorm.io/gorm"
)

type DeliveryStatus string

const (
	DeliveryScheduled  DeliveryStatus = "SCHEDULED"
	DeliveryInDelivery DeliveryStatus = "IN_DELIVERY"
	DeliveryCompleted  DeliveryStatus = "COMPLETED"
	DeliveryCancelled  DeliveryStatus = "CANCELLED"
)

type Delivery struct {
	gorm.Model
	DeliveryNo    string         `gorm:"uniqueIndex;not null" json:"delivery_no"`
	TransactionID uint           `gorm:"not null" json:"transaction_id"`
	DriverID      uint           `gorm:"not null" json:"driver_id"` // Ditugaskan ke User (Admin/Employee)
	Address       string         `gorm:"type:text;not null" json:"address"`
	ScheduledDate *time.Time     `json:"scheduled_date"`
	Status        DeliveryStatus `gorm:"type:enum('SCHEDULED','IN_DELIVERY','COMPLETED','CANCELLED');default:'SCHEDULED'" json:"status"`
	Note          string         `gorm:"type:text" json:"note"`

	// Relasi
	Transaction Transaction    `gorm:"foreignKey:TransactionID" json:"transaction,omitempty"`
	Driver      User           `gorm:"foreignKey:DriverID" json:"driver,omitempty"`
	Items       []DeliveryItem `gorm:"foreignKey:DeliveryID" json:"items,omitempty"`
	Proof       *DeliveryProof `gorm:"foreignKey:DeliveryID" json:"proof,omitempty"`
}

type DeliveryItem struct {
	gorm.Model
	DeliveryID uint    `gorm:"not null" json:"delivery_id"`
	ProductID  uint    `gorm:"not null" json:"product_id"`
	Qty        int     `gorm:"not null" json:"qty"`
	Product    Product `gorm:"foreignKey:ProductID" json:"product,omitempty"`
}

// Bukti pengantaran: waktu + foto barang (bisa lebih dari 1) + catatan
type DeliveryProof struct {
	gorm.Model
	DeliveryID  uint                 `gorm:"uniqueIndex;not null" json:"delivery_id"`
	DeliveredAt time.Time            `gorm:"not null" json:"delivered_at"` // Waktu serah terima barang
	Note        string               `gorm:"type:text" json:"note"`
	Photos      []DeliveryProofPhoto `gorm:"foreignKey:ProofID" json:"photos,omitempty"` // Multi foto barang
}

type DeliveryProofPhoto struct {
	gorm.Model
	ProofID  uint   `gorm:"not null" json:"proof_id"`
	PhotoURL string `gorm:"not null" json:"photo_url"`
}
