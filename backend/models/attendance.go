package models

import (
	"time"

	"gorm.io/gorm"
)

type AttendanceType string

const (
	CheckIn  AttendanceType = "CHECK_IN"
	CheckOut AttendanceType = "CHECK_OUT"
)

type Attendance struct {
	gorm.Model
	EmployeeID uint           `gorm:"not null" json:"employee_id"`
	Type       AttendanceType `gorm:"type:enum('CHECK_IN','CHECK_OUT');not null" json:"type"`
	PhotoURL   string         `json:"photo_url"`
	Latitude   float64        `gorm:"not null" json:"latitude"`
	Longitude  float64        `gorm:"not null" json:"longitude"`
	Accuracy   float64        `json:"accuracy"`
	DeviceInfo string         `json:"device_info"`
	Timestamp  time.Time      `gorm:"not null" json:"timestamp"`

	// Relasi
	Employee Employee `gorm:"foreignKey:EmployeeID" json:"employee,omitempty"`
}
