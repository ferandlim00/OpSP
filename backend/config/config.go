package config

import (
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	AppName string
	AppPort string

	// Database
	DBHost string
	DBPort string
	DBUser string
	DBPass string
	DBName string

	// JWT
	JWTSecret     string
	JWTExpire     string
	RefreshExpire string

	// Geolocation
	StoreLatitude  float64
	StoreLongitude float64
	StoreRadius    float64 // meter
}

// Load membaca file .env dan mengisi Config
func Load() *Config {
	// Baca file .env — seperti Dotenv di Laravel
	godotenv.Load()
	lat, _ := strconv.ParseFloat(os.Getenv("STORE_LATITUDE"), 64)
	lng, _ := strconv.ParseFloat(os.Getenv("STORE_LONGITUDE"), 64)
	radius, _ := strconv.ParseFloat(os.Getenv("STORE_RADIUS_METERS"), 64)
	return &Config{
		AppName:        os.Getenv("APP_NAME"),
		AppPort:        os.Getenv("APP_PORT"),
		DBHost:         os.Getenv("DB_HOST"),
		DBPort:         os.Getenv("DB_PORT"),
		DBUser:         os.Getenv("DB_USER"),
		DBPass:         os.Getenv("DB_PASS"),
		DBName:         os.Getenv("DB_NAME"),
		JWTSecret:      os.Getenv("JWT_SECRET"),
		JWTExpire:      os.Getenv("JWT_EXPIRE"),
		RefreshExpire:  os.Getenv("REFRESH_EXPIRE"),
		StoreLatitude:  lat,
		StoreLongitude: lng,
		StoreRadius:    radius,
	}
}
