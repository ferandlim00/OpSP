package services

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"

	"backend/models"

	"gorm.io/gorm"
)

type CustomerService struct {
	db *gorm.DB
}

func NewCustomerService(db *gorm.DB) *CustomerService {
	return &CustomerService{db: db}
}

type CustomerInput struct {
	Name    string `json:"name"`
	Phone   string `json:"phone"`
	Email   string `json:"email"`
	Address string `json:"address"`
	Note    string `json:"note"`
}

func (s *CustomerService) GetAll(search string) ([]models.Customer, error) {
	var customers []models.Customer
	query := s.db.Model(&models.Customer{})
	if search != "" {
		q := "%" + search + "%"
		query = query.Where("name LIKE ? OR phone LIKE ? OR customer_code LIKE ?", q, q, q)
	}
	err := query.Order("id DESC").Find(&customers).Error
	return customers, err
}

func (s *CustomerService) Create(input CustomerInput) (*models.Customer, error) {
	if input.Name == "" || input.Phone == "" {
		return nil, errors.New("nama dan nomor HP wajib diisi")
	}

	customer := models.Customer{
		Name:    input.Name,
		Phone:   input.Phone,
		Email:   input.Email,
		Address: input.Address,
		Note:    input.Note,
	}

	// Kode pelanggan diturunkan dari ID auto-increment, BUKAN dari COUNT(*).
	// COUNT(*) tidak menghitung baris soft-delete, padahal unique index tetap
	// berlaku untuk baris tersebut → kode lama terpakai lagi → Error 1062.
	// ID auto-increment selalu unik, tidak pernah dipakai ulang, dan aman
	// walau ada 2 request bersamaan.
	err := s.db.Transaction(func(tx *gorm.DB) error {
		// Kode sementara yang unik agar lolos constraint NOT NULL + UNIQUE
		tmp, err := tempCode()
		if err != nil {
			return err
		}
		customer.CustomerCode = tmp
		if err := tx.Create(&customer).Error; err != nil {
			return err
		}

		customer.CustomerCode = fmt.Sprintf("CUST-%03d", customer.ID)
		return tx.Model(&customer).Update("customer_code", customer.CustomerCode).Error
	})
	if err != nil {
		return nil, err
	}
	return &customer, nil
}

// tempCode menghasilkan placeholder acak, mis. "TMP-9f3a1c0b7e2d4a65"
func tempCode() (string, error) {
	b := make([]byte, 8)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return "TMP-" + hex.EncodeToString(b), nil
}

func (s *CustomerService) Update(id uint, input CustomerInput) (*models.Customer, error) {
	var customer models.Customer
	if err := s.db.First(&customer, id).Error; err != nil {
		return nil, errors.New("pelanggan tidak ditemukan")
	}

	customer.Name = input.Name
	customer.Phone = input.Phone
	customer.Email = input.Email
	customer.Address = input.Address
	customer.Note = input.Note

	if err := s.db.Save(&customer).Error; err != nil {
		return nil, err
	}
	return &customer, nil
}

func (s *CustomerService) Delete(id uint) error {
	var txCount int64
	s.db.Unscoped().Model(&models.Transaction{}).Where("customer_id = ?", id).Count(&txCount)
	if txCount > 0 {
		return errors.New("pelanggan tidak bisa dihapus karena memiliki riwayat transaksi")
	}
	res := s.db.Unscoped().Delete(&models.Customer{}, id)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return errors.New("pelanggan tidak ditemukan")
	}
	return nil
}
