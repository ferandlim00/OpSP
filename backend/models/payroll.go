package models

import "gorm.io/gorm"

type DeductionType string

const (
	DeductionAbsence DeductionType = "ABSENCE"
	DeductionManual  DeductionType = "MANUAL"
)

type Payroll struct {
	gorm.Model
	EmployeeID     uint    `gorm:"not null" json:"employee_id"`
	Month          int     `gorm:"not null" json:"month"`
	Year           int     `gorm:"not null" json:"year"`
	BaseSalary     float64 `gorm:"not null" json:"base_salary"`
	TotalDeduction float64 `gorm:"default:0" json:"total_deduction"`
	NetSalary      float64 `gorm:"not null" json:"net_salary"`
	Note           string  `gorm:"type:text" json:"note"`

	// Relasi
	Employee   Employee           `gorm:"foreignKey:EmployeeID" json:"employee,omitempty"`
	Deductions []PayrollDeduction `gorm:"foreignKey:PayrollID" json:"deductions,omitempty"`
}

type PayrollDeduction struct {
	gorm.Model
	PayrollID uint          `gorm:"not null" json:"payroll_id"`
	Type      DeductionType `gorm:"type:enum('ABSENCE','MANUAL');not null" json:"type"`
	Amount    float64       `gorm:"not null" json:"amount"`
	Reason    string        `gorm:"not null" json:"reason"`
}
