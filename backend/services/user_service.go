package services

import (
	"errors"
	"fmt"

	"backend/models"
	"backend/utils"

	"gorm.io/gorm"
)

type UserService struct {
	db *gorm.DB
}

func NewUserService(db *gorm.DB) *UserService {
	return &UserService{db: db}
}

// Input untuk membuat User baru
type CreateUserInput struct {
	Name       string  `json:"name"`
	Username   string  `json:"username"`
	Password   string  `json:"password"`
	Email      string  `json:"email"`
	RoleID     uint    `json:"role_id"`
	Phone      string  `json:"phone"`       // Khusus jika role = EMPLOYEE
	Address    string  `json:"address"`     // Khusus jika role = EMPLOYEE
	BaseSalary float64 `json:"base_salary"` // Gaji pokok jika role = EMPLOYEE
}

// Input untuk update User
type UpdateUserInput struct {
	Name       string  `json:"name"`
	Email      string  `json:"email"`
	RoleID     uint    `json:"role_id"`
	Password   string  `json:"password"` // Opsional, hanya jika ingin ganti password
	IsActive   *bool   `json:"is_active"`
	Phone      string  `json:"phone"`
	Address    string  `json:"address"`
	BaseSalary float64 `json:"base_salary"`
}

// 1. Ambil semua User
func (s *UserService) GetAllUsers() ([]models.User, error) {
	var users []models.User
	// Preload relasi Role agar nama rolenya ikut terambil
	err := s.db.Preload("Role").Find(&users).Error
	return users, err
}

// 2. Ambil daftar Role untuk dropdown
func (s *UserService) GetRoles() ([]models.Role, error) {
	var roles []models.Role
	err := s.db.Find(&roles).Error
	return roles, err
}

// 3. Buat User Baru (+ Otomatis buat Employee jika rolenya Employee)
func (s *UserService) CreateUser(input CreateUserInput) (*models.User, error) {
	// Cek apakah username sudah dipakai
	var count int64
	s.db.Model(&models.User{}).Where("username = ?", input.Username).Count(&count)
	if count > 0 {
		return nil, errors.New("username sudah digunakan, pilih username lain")
	}

	// Hash password dengan Argon2id
	hashedPassword, err := utils.HashPassword(input.Password)
	if err != nil {
		return nil, errors.New("gagal mengenkripsi password")
	}

	// Ambil data role untuk cek apakah rolenya EMPLOYEE
	var role models.Role
	if err := s.db.First(&role, input.RoleID).Error; err != nil {
		return nil, errors.New("role tidak ditemukan")
	}

	var createdUser models.User

	// Gunakan Database Transaction agar pembuatan User & Employee terjadi bersamaan
	err = s.db.Transaction(func(tx *gorm.DB) error {
		createdUser = models.User{
			RoleID:   input.RoleID,
			Name:     input.Name,
			Username: input.Username,
			Password: hashedPassword,
			Email:    input.Email,
			IsActive: true,
		}

		if err := tx.Create(&createdUser).Error; err != nil {
			return err
		}

		// Jika rolenya EMPLOYEE, otomatis buatkan profil di tabel employees
		if role.Name == models.RoleEmployee {
			// Generate kode karyawan otomatis, contoh: EMP-001
			var empCount int64
			tx.Model(&models.Employee{}).Count(&empCount)
			empCode := fmt.Sprintf("EMP-%03d", empCount+1)

			employee := models.Employee{
				UserID:       createdUser.ID,
				EmployeeCode: empCode,
				Name:         input.Name,
				Phone:        input.Phone,
				Address:      input.Address,
				BaseSalary:   input.BaseSalary,
			}

			if err := tx.Create(&employee).Error; err != nil {
				return err
			}
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	// Muat data role ke objek user sebelum dikembalikan
	s.db.Preload("Role").First(&createdUser, createdUser.ID)
	return &createdUser, nil
}

// 4. Update User
func (s *UserService) UpdateUser(id uint, input UpdateUserInput) (*models.User, error) {
	var user models.User
	if err := s.db.First(&user, id).Error; err != nil {
		return nil, errors.New("user tidak ditemukan")
	}

	if input.RoleID == 0 {
		return nil, errors.New("role_id tidak valid")
	}

	user.Name = input.Name
	user.Email = input.Email
	user.RoleID = input.RoleID
	if input.IsActive != nil {
		user.IsActive = *input.IsActive
	}

	// Jika admin mengisi password baru, hash ulang
	if input.Password != "" {
		hashed, err := utils.HashPassword(input.Password)
		if err != nil {
			return nil, errors.New("gagal mengenkripsi password baru")
		}
		user.Password = hashed
	}

	err := s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Save(&user).Error; err != nil {
			return err
		}

		// Update juga data di tabel employee jika ada
		var emp models.Employee
		if err := tx.Where("user_id = ?", user.ID).First(&emp).Error; err == nil {
			emp.Name = input.Name
			emp.Phone = input.Phone
			emp.Address = input.Address
			emp.BaseSalary = input.BaseSalary
			if err := tx.Save(&emp).Error; err != nil {
				return err
			}
		}
		return nil
	})

	if err != nil {
		return nil, err
	}

	s.db.Preload("Role").First(&user, user.ID)
	return &user, nil
}

// 5. Hapus User
func (s *UserService) DeleteUser(id uint) error {
	// Cek apakah user ada sebelum dihapus
	var user models.User
	if err := s.db.First(&user, id).Error; err != nil {
		return errors.New("user tidak ditemukan")
	}

	return s.db.Transaction(func(tx *gorm.DB) error {
		// Hapus data employee terkait (jika ada), tangkap error jika gagal
		if err := tx.Where("user_id = ?", id).Delete(&models.Employee{}).Error; err != nil {
			return err
		}
		// Hapus data user
		return tx.Delete(&models.User{}, id).Error
	})
}
