package config

import (
	"fmt"
	"log"
	"regexp"
	"strings"
	"time"

	"backend/models"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

var validTableNameRegex = regexp.MustCompile(`^[a-zA-Z0-9_]+$`)

func ConnectDatabase(cfg *Config) {
	dsn := fmt.Sprintf(
		"%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		cfg.DBUser,
		cfg.DBPass,
		cfg.DBHost,
		cfg.DBPort,
		cfg.DBName,
	)

	// Matikan debug SQL query log saat production agar query & parameter sensitif tidak bocor ke stdout
	gormLogLevel := logger.Info
	if strings.EqualFold(cfg.AppEnv, "production") {
		gormLogLevel = logger.Error
	}

	db, err := gorm.Open(mysql.New(mysql.Config{
		DSN:               dsn,
		DefaultStringSize: 191,
	}), &gorm.Config{
		Logger:                                   logger.Default.LogMode(gormLogLevel),
		DisableForeignKeyConstraintWhenMigrating: true,
		PrepareStmt:                              true, // Gunakan Prepared Statements untuk performa & keamanan SQLi ekstra
	})

	if err != nil {
		log.Fatal("❌ Gagal konek ke database:", err)
	}

	// Konfigurasi Connection Pool untuk mencegah kehabisan koneksi (Database DoS Protection)
	if sqlDB, err := db.DB(); err == nil {
		sqlDB.SetMaxOpenConns(25)
		sqlDB.SetMaxIdleConns(10)
		sqlDB.SetConnMaxLifetime(15 * time.Minute)
		sqlDB.SetConnMaxIdleTime(5 * time.Minute)
	}

	// Paksa algoritma ALTER menggunakan COPY saat AutoMigrate (mencegah bug MariaDB 10.4 Error 1467)
	db.Exec("SET SESSION alter_algorithm='COPY'")
	db.Exec("SET FOREIGN_KEY_CHECKS=0")

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

	repairCorruptedAutoIncrement(db, cfg.DBName)
	db.Exec("SET FOREIGN_KEY_CHECKS=1")

	SeedDatabase(db)

	fmt.Println("✅ Database terhubung dan tabel siap!")
	DB = db
}

func repairCorruptedAutoIncrement(db *gorm.DB, dbName string) {
	type tableStatus struct {
		TableName string `gorm:"column:TABLE_NAME"`
	}
	var tables []tableStatus
	db.Raw(`
		SELECT TABLE_NAME 
		FROM information_schema.TABLES 
		WHERE TABLE_SCHEMA = ? AND ENGINE = 'InnoDB'
	`, dbName).Scan(&tables)

	db.Exec("SET SESSION alter_algorithm='COPY'")
	for _, t := range tables {
		if validTableNameRegex.MatchString(t.TableName) {
			db.Exec(fmt.Sprintf("ALTER TABLE `%s` ENGINE=InnoDB", t.TableName))
		}
	}
}
