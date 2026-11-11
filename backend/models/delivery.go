package models

import (
	"time"

	"gorm.io/gorm"
)

type DeliveryStatus string

const (
	DeliveryScheduled  DeliveryStatus = "SCHEDULED"
	DeliveryPreparing  DeliveryStatus = "PREPARING"
	DeliveryInDelivery DeliveryStatus = "IN_DELIVERY"
	DeliveryCompleted  DeliveryStatus = "COMPLETED"
	DeliveryCancelled  DeliveryStatus = "CANCELLED"
)

type Delivery struct {
	gorm.Model
	DeliveryNo    string         `gorm:"size:50;uniqueIndex;not null" json:"delivery_no"`
	TransactionID uint           `gorm:"not null" json:"transaction_id"`
	DriverID      uint           `gorm:"not null" json:"driver_id"` // Ditugaskan ke User (Admin/Employee)
	Address       string         `gorm:"type:text;not null" json:"address"`
	ScheduledDate *time.Time     `json:"scheduled_date"`
	ShippingCost  float64        `gorm:"default:0" json:"shipping_cost"`
	Status        DeliveryStatus `gorm:"size:25;default:'SCHEDULED'" json:"status"`
	Note          string         `gorm:"type:text" json:"note"`

	// Relasi
	Transaction Transaction    `gorm:"foreignKey:TransactionID" json:"transaction,omitempty"`
	Driver      User           `gorm:"foreignKey:DriverID" json:"driver,omitempty"`
	Items       []DeliveryItem `gorm:"foreignKey:DeliveryID" json:"items,omitempty"`
	Proof       *DeliveryProof `gorm:"foreignKey:DeliveryID" json:"proof,omitempty"`
}

type DeliveryItem struct {
	gorm.Model
	DeliveryID   uint    `gorm:"not null" json:"delivery_id"`
	ProductID    uint    `gorm:"not null" json:"product_id"`
	Qty          int     `gorm:"not null" json:"qty"`           // Kuantitas barang yang dibawa / dijadwalkan di surat jalan ini
	DeliveredQty int     `gorm:"default:0" json:"delivered_qty"` // Kuantitas aktual yang benar-benar diterima pelanggan saat POD
	Product      Product `gorm:"foreignKey:ProductID" json:"product,omitempty"`
}

const (
	ProofStagePickup  = "PICKUP"  // Foto bukti saat persiapan / muat barang sebelum berangkat
	ProofStageDropoff = "DROPOFF" // Foto bukti saat barang tiba & diserahkan ke pelanggan
)

// Bukti pengantaran: foto persiapan/muat (PICKUP) + foto serah terima (DROPOFF)
type DeliveryProof struct {
	gorm.Model
	DeliveryID   uint                 `gorm:"uniqueIndex;not null" json:"delivery_id"`
	ReceiverName string               `gorm:"size:120" json:"receiver_name"` // Nama penerima barang (seperti GrabCargo POD)
	PickupNote   string               `gorm:"type:text" json:"pickup_note"`  // Catatan kondisi barang saat dimuat ke armada
	PickupAt     *time.Time           `json:"pickup_at"`                     // Waktu barang selesai dimuat & berangkat
	DeliveredAt  *time.Time           `json:"delivered_at"`                  // Waktu serah terima barang di lokasi tujuan
	Note         string               `gorm:"type:text" json:"note"`         // Catatan serah terima di lokasi tujuan
	Photos       []DeliveryProofPhoto `gorm:"foreignKey:ProofID" json:"photos,omitempty"`
}

type DeliveryProofPhoto struct {
	gorm.Model
	ProofID  uint   `gorm:"not null" json:"proof_id"`
	Stage    string `gorm:"size:20;default:'DROPOFF'" json:"stage"` // PICKUP atau DROPOFF
	PhotoURL string `gorm:"not null" json:"photo_url"`
}
