package models

import "gorm.io/gorm"

type Setting struct {
	gorm.Model
	Key   string `gorm:"size:100;uniqueIndex;not null" json:"key"`
	Value string `gorm:"type:text;not null" json:"value"`
}
