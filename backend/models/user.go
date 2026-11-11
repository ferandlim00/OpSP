package models

import (
	"gorm.io/gorm"
)

type User struct {
	gorm.Model
	RoleID   uint   `gorm:"not null" json:"role_id"`
	Name     string `gorm:"size:100;not null" json:"name"`
	Username string `gorm:"size:50;uniqueIndex;not null" json:"username"`
	Password string `gorm:"not null" json:"-"` // json:"-" artinya tidak ikut tampil di response
	Email    string `gorm:"size:100;uniqueIndex" json:"email"`
	IsActive bool   `gorm:"default:true" json:"is_active"`
	// Relasi
	Role Role `gorm:"foreignKey:RoleID" json:"role,omitempty"`
}
