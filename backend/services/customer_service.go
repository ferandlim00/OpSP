package services

import (
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

	var count int64
	s.db.Model(&models.Customer{}).Count(&count)
	code := fmt.Sprintf("CUST-%03d", count+1)

	customer := models.Customer{
		CustomerCode: code,
		Name:         input.Name,
		Phone:        input.Phone,
		Email:        input.Email,
		Address:      input.Address,
		Note:         input.Note,
	}

	if err := s.db.Create(&customer).Error; err != nil {
		return nil, err
	}
	return &customer, nil
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
	return s.db.Delete(&models.Customer{}, id).Error
}
