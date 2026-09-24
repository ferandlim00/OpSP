package models

import "gorm.io/gorm"

type Employee struct {
	gorm.Model
	UserID       uint    `gorm:"uniqueIndex;not null" json:"user_id"`
	EmployeeCode string  `gorm:"uniqueIndex;not null" json:"employee_code"`
	Name         string  `gorm:"not null" json:"name"`
	Phone        string  `json:"phone"`
	Address      string  `gorm:"type:text" json:"address"`
	BaseSalary   float64 `gorm:"default:0" json:"base_salary"` // Untuk keperluan penggajian

	// Relasi
	User        User         `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Attendances []Attendance `gorm:"foreignKey:EmployeeID" json:"-"`
}
