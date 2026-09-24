package models

import "gorm.io/gorm"

type RoleName string

const (
	RoleOwner    RoleName = "OWNER"
	RoleAdmin    RoleName = "ADMIN"
	RoleEmployee RoleName = "EMPLOYEE"
)

type Role struct {
	gorm.Model
	Name        RoleName `gorm:"type:varchar(50);uniqueIndex;not null" json:"name"`
	Description string   `json:"description"`
	Users       []User   `gorm:"foreignKey:RoleID" json:"-"`
}
