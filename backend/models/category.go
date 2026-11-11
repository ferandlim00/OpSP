package models

import "gorm.io/gorm"

type Category struct {
	gorm.Model
	Name     string    `gorm:"size:100;not null;uniqueIndex" json:"name"`
	Products []Product `gorm:"foreignKey:CategoryID" json:"-"`
}
