package config

import (
	"fmt"
	"log"

	"backend/models"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func ConnectDatabase(cfg *Config) {
	// Format koneksi MySQL — seperti DB_* di .env Laravel
	dsn := fmt.Sprintf(
		"%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		cfg.DBUser,
		cfg.DBPass,
		cfg.DBHost,
		cfg.DBPort,
		cfg.DBName,
	)

	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info), // tampilkan query di terminal
	})

	if err != nil {
		log.Fatal("❌ Gagal konek ke database:", err)
	}

	// AutoMigrate — otomatis buat tabel kalau belum ada
	// seperti `php artisan migrate` di Laravel
	err = db.AutoMigrate(
		&models.Role{},
		&models.User{},
		&models.Employee{},
		&models.Attendance{},
		&models.Category{},
		&models.Product{},
		&models.ProductImage{},
		&models.Supplier{},
		&models.PurchaseOrder{},
		&models.PurchaseOrderItem{},
		&models.InventoryMovement{},
		&models.Customer{},
		&models.Transaction{},
		&models.TransactionItem{},
		&models.Payment{},
		&models.Delivery{},
		&models.DeliveryItem{},
		&models.DeliveryProof{},
		&models.DeliveryProofPhoto{},
		&models.Payroll{},
		&models.PayrollDeduction{},
		&models.Setting{},
	)
	if err != nil {
		log.Fatal("❌ Gagal migrate database:", err)
	}
	SeedDatabase(db)

	fmt.Println("✅ Database terhubung dan tabel siap!")
	DB = db
}
