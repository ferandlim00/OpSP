package services

import (
	"backend/config"
	"backend/models"
	"fmt"

	"gorm.io/gorm"
)

type SettingService struct {
	db  *gorm.DB
	cfg *config.Config
}

func NewSettingService(db *gorm.DB, cfg *config.Config) *SettingService {
	return &SettingService{db: db, cfg: cfg}
}

func (s *SettingService) GetAll() (map[string]string, error) {
	defaults := map[string]string{
		"store_name":                "PropertiERP",
		"store_address":             "Jl. Raya Operasional No. 1",
		"store_phone":               "0812-0000-0000",
		"store_email":               "admin@propertierp.com",
		"store_logo_url":            "",
		"store_latitude":            fmt.Sprintf("%.6f", s.cfg.StoreLatitude),
		"store_longitude":           fmt.Sprintf("%.6f", s.cfg.StoreLongitude),
		"store_radius_meters":       fmt.Sprintf("%.0f", s.cfg.StoreRadius),
		"attendance_enabled":        "true",
		"attendance_gps_enabled":    "true",
		"payroll_enabled":           "true",
		"delivery_schedule_enabled": "true",
		"shipping_cost_enabled":     "true",
		"default_shipping_cost":     "50000",
		"default_daily_salary":      "150000",
		"default_monthly_salary":    "3500000",
		"work_start_time":           "08:00",
		"work_end_time":             "17:00",
		"payment_system_info":       "Tunai, Transfer Bank BCA, QRIS",
		"absence_deduction_amount":  "50000",
	}

	var list []models.Setting
	if err := s.db.Find(&list).Error; err != nil {
		return defaults, err
	}

	for _, item := range list {
		defaults[item.Key] = item.Value
	}
	return defaults, nil
}

func (s *SettingService) SaveAll(input map[string]string) (map[string]string, error) {
	err := s.db.Transaction(func(tx *gorm.DB) error {
		for k, v := range input {
			if k == "" {
				continue
			}
			var existing models.Setting
			if err := tx.Unscoped().Where("`key` = ?", k).First(&existing).Error; err == nil {
				existing.Value = v
				existing.DeletedAt = gorm.DeletedAt{}
				if err := tx.Unscoped().Save(&existing).Error; err != nil {
					return err
				}
			} else {
				newSetting := models.Setting{Key: k, Value: v}
				if err := tx.Create(&newSetting).Error; err != nil {
					return err
				}
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return s.GetAll()
}
