package config

import (
	"fmt"
	"log"

	"backend/models"
	"backend/utils"

	"gorm.io/gorm"
)

// SeedDatabase mengisi data wajib jika database masih kosong
func SeedDatabase(db *gorm.DB) {
	// ==========================================
	// 1. SEED ROLES
	// ==========================================
	var roleCount int64
	// SELECT COUNT(*) FROM roles;
	db.Model(&models.Role{}).Count(&roleCount)

	// Hanya isi kalau tabel roles benar-benar masih 0
	if roleCount == 0 {
		roles := []models.Role{
			{Name: models.RoleOwner, Description: "Pemilik Toko - Akses Penuh Sistem & Pengaturan"},
			{Name: models.RoleAdmin, Description: "Admin Operasional - Penjualan, Produk, Pengantaran, Stok"},
			{Name: models.RoleEmployee, Description: "Karyawan - Absensi Harian, Pengantaran, Slip Gaji"},
		}

		if err := db.Create(&roles).Error; err != nil {
			log.Println("❌ Gagal seed roles:", err)
		} else {
			fmt.Println("🌱 Berhasil seed 3 Role (OWNER, ADMIN, EMPLOYEE)")
		}
	}

	// ==========================================
	// 2. SEED DEFAULT USER OWNER
	// ==========================================
	var ownerRole models.Role
	// Cari data role OWNER untuk mengambil ID-nya
	if err := db.Where("name = ?", models.RoleOwner).First(&ownerRole).Error; err == nil {
		var userCount int64
		// Cek apakah sudah ada user yang punya RoleID owner ini
		db.Model(&models.User{}).Where("role_id = ?", ownerRole.ID).Count(&userCount)

		if userCount == 0 {
			// Hash password default "password123" dengan Argon2id
			hashedPassword, err := utils.HashPassword("kelinciputih7788")
			if err != nil {
				log.Println("❌ Gagal hash password owner:", err)
				return
			}

			// Siapkan data user Owner pertama
			ownerUser := models.User{
				RoleID:   ownerRole.ID,
				Name:     "IT",
				Username: "Index",
				Password: hashedPassword,
				Email:    "Wwaawwuu5@gmail.com",
				IsActive: true,
			}

			// Simpan ke database: INSERT INTO users ...
			if err := db.Create(&ownerUser).Error; err != nil {
				log.Println("❌ Gagal seed user owner:", err)
			} else {
				fmt.Println("🌱 Berhasil seed User default:")
				fmt.Println("   👉 Username: Index")
				fmt.Println("   👉 Password: kelinciputih7788")
			}
		}
	}
}
