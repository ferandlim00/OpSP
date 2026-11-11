package models

import "gorm.io/gorm"

// RoomType = peruntukan ruangan produk furniture
const (
	RoomLiving  = "LIVING"  // Ruang Tamu
	RoomBedroom = "BEDROOM" // Kamar Tidur
	RoomDining  = "DINING"  // Ruang Makan
	RoomOffice  = "OFFICE"  // Ruang Kerja
	RoomOther   = "OTHER"   // Serbaguna
)

// ValidRoomTypes dipakai untuk validasi input
var ValidRoomTypes = map[string]bool{
	RoomLiving: true, RoomBedroom: true, RoomDining: true, RoomOffice: true, RoomOther: true,
}

type Product struct {
	gorm.Model
	SKU         string   `gorm:"size:50;uniqueIndex;not null" json:"sku"`
	Name        string   `gorm:"size:150;not null" json:"name"`
	CategoryID  uint     `gorm:"not null;index" json:"category_id"`
	RoomType    string   `gorm:"size:20;default:OTHER;index" json:"room_type"`
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
