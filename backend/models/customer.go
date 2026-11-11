package models

import "gorm.io/gorm"

type Customer struct {
	gorm.Model
	CustomerCode string        `gorm:"size:30;uniqueIndex;not null" json:"customer_code"`
	Name         string        `gorm:"not null" json:"name"`
	Phone        string        `json:"phone"`
	Email        string        `json:"email"`
	Address      string        `gorm:"type:text" json:"address"`
	Note         string        `gorm:"type:text" json:"note"`
	Transactions []Transaction `gorm:"foreignKey:CustomerID" json:"-"`
}
