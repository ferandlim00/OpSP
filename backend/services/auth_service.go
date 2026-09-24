package services

import (
	"errors"

	"backend/config"
	"backend/models"
	"backend/utils"

	"gorm.io/gorm"
)

type AuthService struct {
	db  *gorm.DB
	cfg *config.Config
}

func NewAuthService(db *gorm.DB, cfg *config.Config) *AuthService {
	return &AuthService{db: db, cfg: cfg}
}

// LoginInput adalah format data yang dikirim user saat login
type LoginInput struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// LoginResponse adalah data yang kita kembalikan jika login sukses
type LoginResponse struct {
	Token string      `json:"token"`
	User  models.User `json:"user"`
}

func (s *AuthService) Login(input LoginInput) (*LoginResponse, error) {
	var user models.User

	// 1. Cari user di database beserta relasi Role-nya
	err := s.db.Preload("Role").Where("username = ?", input.Username).First(&user).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("username atau password salah")
		}
		return nil, err
	}

	// 2. Cek status aktif
	if !user.IsActive {
		return nil, errors.New("akun ini dinonaktifkan, hubungi Owner")
	}

	// 3. Verifikasi password dengan Argon2id
	match, err := utils.CheckPasswordHash(input.Password, user.Password)
	if err != nil || !match {
		return nil, errors.New("username atau password salah")
	}

	// 4. Buat token JWT (berlaku 24 jam)
	token, err := utils.GenerateToken(
		user.ID,
		user.Username,
		string(user.Role.Name),
		s.cfg.JWTSecret,
		24, // 24 jam
	)
	if err != nil {
		return nil, errors.New("gagal membuat token login")
	}

	return &LoginResponse{
		Token: token,
		User:  user,
	}, nil
}
