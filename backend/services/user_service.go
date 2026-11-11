package services

import (
	"errors"
	"fmt"
	"strings"

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

type CreateUserInput struct {
	Name       string  `json:"name"`
	Username   string  `json:"username"`
	Password   string  `json:"password"`
	Email      string  `json:"email"`
	RoleID     uint    `json:"role_id"`
	Phone      string  `json:"phone"`
	Address    string  `json:"address"`
	BaseSalary float64 `json:"base_salary"`
}

type UpdateUserInput struct {
	Name       string  `json:"name"`
	Email      string  `json:"email"`
	RoleID     uint    `json:"role_id"`
	Password   string  `json:"password"`
	IsActive   *bool   `json:"is_active"`
	Phone      string  `json:"phone"`
	Address    string  `json:"address"`
	BaseSalary float64 `json:"base_salary"`
}

func (s *UserService) GetAllUsers() ([]models.User, error) {
	var users []models.User
	err := s.db.Preload("Role").Find(&users).Error
	return users, err
}

func (s *UserService) GetRoles() ([]models.Role, error) {
	var roles []models.Role
	err := s.db.Find(&roles).Error
	return roles, err
}

func (s *UserService) CreateUser(input CreateUserInput) (*models.User, error) {
	cleanUsername := strings.ToLower(utils.SanitizeString(input.Username))
	cleanName := utils.SanitizeString(input.Name)
	if len(cleanUsername) < 3 {
		return nil, errors.New("username minimal 3 karakter")
	}
	if len(strings.TrimSpace(input.Password)) < 6 {
		return nil, errors.New("password minimal 6 karakter demi keamanan akun")
	}

	var count int64
	s.db.Model(&models.User{}).Where("username = ?", cleanUsername).Count(&count)
	if count > 0 {
		return nil, errors.New("username sudah digunakan, pilih username lain")
	}

	hashedPassword, err := utils.HashPassword(input.Password)
	if err != nil {
		return nil, errors.New("gagal mengenkripsi password")
	}

	var role models.Role
	if err := s.db.First(&role, input.RoleID).Error; err != nil {
		return nil, errors.New("role tidak ditemukan")
	}

	var createdUser models.User
	err = s.db.Transaction(func(tx *gorm.DB) error {
		createdUser = models.User{
			RoleID:   input.RoleID,
			Name:     cleanName,
			Username: cleanUsername,
			Password: hashedPassword,
			Email:    strings.TrimSpace(input.Email),
			IsActive: true,
		}

		if err := tx.Create(&createdUser).Error; err != nil {
			return err
		}

		if role.Name == models.RoleEmployee {
			var empCount int64
			tx.Model(&models.Employee{}).Count(&empCount)
			empCode := fmt.Sprintf("EMP-%03d", empCount+1)

			employee := models.Employee{
				UserID:       createdUser.ID,
				EmployeeCode: empCode,
				Name:         cleanName,
				Phone:        utils.SanitizeString(input.Phone),
				Address:      utils.SanitizeString(input.Address),
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

	s.db.Preload("Role").First(&createdUser, createdUser.ID)
	return &createdUser, nil
}

func (s *UserService) UpdateUser(id uint, input UpdateUserInput) (*models.User, error) {
	var user models.User
	if err := s.db.First(&user, id).Error; err != nil {
		return nil, errors.New("user tidak ditemukan")
	}

	if input.RoleID == 0 {
		return nil, errors.New("role_id tidak valid")
	}

	cleanName := utils.SanitizeString(input.Name)
	user.Name = cleanName
	user.Email = strings.TrimSpace(input.Email)
	user.RoleID = input.RoleID
	if input.IsActive != nil {
		user.IsActive = *input.IsActive
	}

	if input.Password != "" {
		if len(strings.TrimSpace(input.Password)) < 6 {
			return nil, errors.New("password baru minimal 6 karakter")
		}
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

		var emp models.Employee
		if err := tx.Where("user_id = ?", user.ID).First(&emp).Error; err == nil {
			emp.Name = cleanName
			emp.Phone = utils.SanitizeString(input.Phone)
			emp.Address = utils.SanitizeString(input.Address)
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

func (s *UserService) DeleteUser(id uint) error {
	var user models.User
	if err := s.db.First(&user, id).Error; err != nil {
		return errors.New("user tidak ditemukan")
	}

	return s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Unscoped().Where("user_id = ?", id).Delete(&models.Employee{}).Error; err != nil {
			return err
		}
		return tx.Unscoped().Delete(&models.User{}, id).Error
	})
}
