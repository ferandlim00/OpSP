package models

import "gorm.io/gorm"

type PaymentMethod string
type PaymentType string

const (
	MethodCash     PaymentMethod = "CASH"
	MethodTransfer PaymentMethod = "TRANSFER"
	MethodQRIS     PaymentMethod = "QRIS"
	MethodDebit    PaymentMethod = "DEBIT"
	MethodOther    PaymentMethod = "OTHER"

	TypeDP   PaymentType = "DP"
	TypeFull PaymentType = "FULL"
)

type Payment struct {
	gorm.Model
	TransactionID uint          `gorm:"not null" json:"transaction_id"`
	Amount        float64       `gorm:"not null" json:"amount"`
	Method        PaymentMethod `gorm:"type:enum('CASH','TRANSFER','QRIS','DEBIT','OTHER');not null" json:"method"`
	PaymentType   PaymentType   `gorm:"type:enum('DP','FULL');not null" json:"payment_type"`
	ProofURL      string        `json:"proof_url"` // Foto bukti transfer / struk pembayaran
	Note          string        `gorm:"type:text" json:"note"`
}
