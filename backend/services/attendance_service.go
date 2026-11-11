package services

import (
	"errors"
	"fmt"
	"math"
	"strconv"
	"time"

	"backend/config"
	"backend/models"

	"gorm.io/gorm"
)

type AttendanceService struct {
	db  *gorm.DB
	cfg *config.Config
}

func NewAttendanceService(db *gorm.DB, cfg *config.Config) *AttendanceService {
	return &AttendanceService{db: db, cfg: cfg}
}

type RecordAttendanceInput struct {
	Type       models.AttendanceType `json:"type"`
	PhotoURL   string                `json:"photo_url"`
	Latitude   float64               `json:"latitude"`
	Longitude  float64               `json:"longitude"`
	Accuracy   float64               `json:"accuracy"`
	DeviceInfo string                `json:"device_info"`
}

func haversineMeters(lat1, lon1, lat2, lon2 float64) float64 {
	const R = 6371000 // Radius bumi dalam meter
	dLat := (lat2 - lat1) * math.Pi / 180.0
	dLon := (lon2 - lon1) * math.Pi / 180.0
	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1*math.Pi/180.0)*math.Cos(lat2*math.Pi/180.0)*
			math.Sin(dLon/2)*math.Sin(dLon/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
	return R * c
}

func (s *AttendanceService) getSettingFloat(key string, fallback float64) float64 {
	var st models.Setting
	if err := s.db.Where("`key` = ?", key).First(&st).Error; err == nil {
		if val, err := strconv.ParseFloat(st.Value, 64); err == nil {
			return val
		}
	}
	return fallback
}

func (s *AttendanceService) getSettingBool(key string, fallback bool) bool {
	var st models.Setting
	if err := s.db.Where("`key` = ?", key).First(&st).Error; err == nil {
		if st.Value == "false" || st.Value == "0" {
			return false
		}
		if st.Value == "true" || st.Value == "1" {
			return true
		}
	}
	return fallback
}

func (s *AttendanceService) GetAll(role string, userID uint) ([]models.Attendance, error) {
	var list []models.Attendance
	q := s.db.Preload("Employee").Preload("Employee.User").Preload("Employee.User.Role").Order("timestamp DESC")

	if role == "EMPLOYEE" {
		var emp models.Employee
		if err := s.db.Where("user_id = ?", userID).First(&emp).Error; err == nil {
			q = q.Where("employee_id = ?", emp.ID)
		} else {
			return []models.Attendance{}, nil
		}
	}

	err := q.Find(&list).Error
	return list, err
}

func (s *AttendanceService) Record(userID uint, in RecordAttendanceInput) (*models.Attendance, error) {
	if !s.getSettingBool("attendance_enabled", true) {
		return nil, errors.New("sistem presensi sedang dinonaktifkan oleh Owner di Pengaturan")
	}

	if in.Type != models.CheckIn && in.Type != models.CheckOut {
		return nil, errors.New("tipe presensi harus CHECK_IN atau CHECK_OUT")
	}
	if in.PhotoURL == "" {
		return nil, errors.New("wajib melampirkan foto bukti kehadiran (selfie/kamera) saat melakukan presensi")
	}

	// Pastikan profil Employee ada untuk User ini (auto-create jika belum ada)
	var emp models.Employee
	if err := s.db.Where("user_id = ?", userID).First(&emp).Error; err != nil {
		var user models.User
		if err := s.db.First(&user, userID).Error; err != nil {
			return nil, errors.New("pengguna tidak ditemukan")
		}
		var count int64
		s.db.Model(&models.Employee{}).Count(&count)
		emp = models.Employee{
			UserID:       user.ID,
			EmployeeCode: fmt.Sprintf("EMP-%03d", count+1),
			Name:         user.Name,
		}
		if err := s.db.Create(&emp).Error; err != nil {
			return nil, errors.New("gagal membuat profil karyawan otomatis")
		}
	}

	gpsRequired := s.getSettingBool("attendance_gps_enabled", true)
	storeLat := s.getSettingFloat("store_latitude", s.cfg.StoreLatitude)
	storeLng := s.getSettingFloat("store_longitude", s.cfg.StoreLongitude)
	maxRadius := s.getSettingFloat("store_radius_meters", s.cfg.StoreRadius)

	if gpsRequired && maxRadius > 0 {
		if in.Latitude == 0 && in.Longitude == 0 {
			return nil, errors.New("presensi wajib menyertakan titik lokasi GPS perangkat yang aktif")
		}
		dist := haversineMeters(storeLat, storeLng, in.Latitude, in.Longitude)
		if dist > maxRadius {
			return nil, fmt.Errorf("lokasi Anda berada di luar radius toko (jarak Anda: %.0f meter, batas maksimal: %.0f meter)", dist, maxRadius)
		}
	}

	att := models.Attendance{
		EmployeeID: emp.ID,
		Type:       in.Type,
		PhotoURL:   in.PhotoURL,
		Latitude:   in.Latitude,
		Longitude:  in.Longitude,
		Accuracy:   in.Accuracy,
		DeviceInfo: in.DeviceInfo,
		Timestamp:  time.Now(),
	}

	if err := s.db.Create(&att).Error; err != nil {
		return nil, err
	}

	s.db.Preload("Employee").Preload("Employee.User").Preload("Employee.User.Role").First(&att, att.ID)
	return &att, nil
}
