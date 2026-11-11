package services

import (
	"errors"

	"backend/models"

	"gorm.io/gorm"
)

type PayrollService struct {
	db *gorm.DB
}

func NewPayrollService(db *gorm.DB) *PayrollService {
	return &PayrollService{db: db}
}

type DeductionInput struct {
	Type   models.DeductionType `json:"type"`
	Amount float64              `json:"amount"`
	Reason string               `json:"reason"`
}

type CreatePayrollInput struct {
	EmployeeID uint             `json:"employee_id"`
	UserID     uint             `json:"user_id"` // Alternatif jika memilih dari daftar User
	Month      int              `json:"month"`
	Year       int              `json:"year"`
	BaseSalary float64          `json:"base_salary"`
	Note       string           `json:"note"`
	Deductions []DeductionInput `json:"deductions"`
}

func (s *PayrollService) GetAll() ([]models.Payroll, error) {
	var list []models.Payroll
	err := s.db.
		Preload("Employee").
		Preload("Employee.User").
		Preload("Deductions").
		Order("year DESC, month DESC, created_at DESC").
		Find(&list).Error
	return list, err
}

func (s *PayrollService) GetEmployees() ([]models.Employee, error) {
	var list []models.Employee
	err := s.db.Preload("User").Find(&list).Error
	return list, err
}

func (s *PayrollService) Create(in CreatePayrollInput) (*models.Payroll, error) {
	if in.Month < 1 || in.Month > 12 {
		return nil, errors.New("bulan harus antara 1 sampai 12")
	}
	if in.Year < 2020 {
		return nil, errors.New("tahun tidak valid")
	}

	var emp models.Employee
	if in.EmployeeID > 0 {
		if err := s.db.First(&emp, in.EmployeeID).Error; err != nil {
			return nil, errors.New("karyawan tidak ditemukan")
		}
	} else if in.UserID > 0 {
		if err := s.db.Where("user_id = ?", in.UserID).First(&emp).Error; err != nil {
			var u models.User
			if err := s.db.First(&u, in.UserID).Error; err != nil {
				return nil, errors.New("user tidak ditemukan")
			}
			emp = models.Employee{
				UserID:       u.ID,
				EmployeeCode: "EMP-" + u.Username,
				Name:         u.Name,
				BaseSalary:   in.BaseSalary,
			}
			s.db.Create(&emp)
		}
	} else {
		return nil, errors.New("karyawan wajib dipilih")
	}

	baseSalary := in.BaseSalary
	if baseSalary <= 0 {
		baseSalary = emp.BaseSalary
	}

	var totalDeduction float64
	var deds []models.PayrollDeduction
	for _, d := range in.Deductions {
		if d.Amount <= 0 {
			continue
		}
		dtype := d.Type
		if dtype == "" {
			dtype = models.DeductionManual
		}
		totalDeduction += d.Amount
		deds = append(deds, models.PayrollDeduction{
			Type:   dtype,
			Amount: d.Amount,
			Reason: d.Reason,
		})
	}

	netSalary := baseSalary - totalDeduction
	if netSalary < 0 {
		netSalary = 0
	}

	payroll := models.Payroll{
		EmployeeID:     emp.ID,
		Month:          in.Month,
		Year:           in.Year,
		BaseSalary:     baseSalary,
		TotalDeduction: totalDeduction,
		NetSalary:      netSalary,
		Note:           in.Note,
		Deductions:     deds,
	}

	err := s.db.Transaction(func(tx *gorm.DB) error {
		var existingCount int64
		tx.Model(&models.Payroll{}).
			Where("employee_id = ? AND month = ? AND year = ?", emp.ID, in.Month, in.Year).
			Count(&existingCount)
		if existingCount > 0 {
			return errors.New("slip gaji untuk karyawan ini pada bulan dan tahun tersebut sudah pernah diterbitkan")
		}
		return tx.Create(&payroll).Error
	})
	if err != nil {
		return nil, err
	}

	s.db.Preload("Employee").Preload("Deductions").First(&payroll, payroll.ID)
	return &payroll, nil
}

func (s *PayrollService) Delete(id uint) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		tx.Where("payroll_id = ?", id).Delete(&models.PayrollDeduction{})
		return tx.Delete(&models.Payroll{}, id).Error
	})
}
