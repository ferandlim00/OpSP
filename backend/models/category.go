package models

import "gorm.io/gorm"

type Category struct {
	gorm.Model
	Name     string    `gorm:"not null;uniqueIndex" json:"name"`
	Products []Product `gorm:"foreignKey:CategoryID" json:"-"`
}
