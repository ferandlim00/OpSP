package config

import (
	"log"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	AppName      string
	AppPort      string
	AppEnv       string // "development" atau "production"
	EnforceHTTPS bool

	// Database
	DBHost string
	DBPort string
	DBUser string
	DBPass string
	DBName string

	// JWT & Security
	JWTSecret      string
	JWTExpire      string
	RefreshExpire  string
	AllowedOrigins string

	// Geolocation
	StoreLatitude  float64
	StoreLongitude float64
	StoreRadius    float64 // meter
}

// Load membaca file .env, memvalidasi keamanan variabel environment, dan mengisi Config
func Load() *Config {
	_ = godotenv.Load()

	appEnv := strings.ToLower(strings.TrimSpace(os.Getenv("APP_ENV")))
	if appEnv == "" {
		appEnv = "development"
	}
	isProd := appEnv == "production"

	enforceHTTPS := strings.EqualFold(strings.TrimSpace(os.Getenv("ENFORCE_HTTPS")), "true") || isProd

	port := strings.TrimSpace(os.Getenv("APP_PORT"))
	if port == "" {
		port = "8080"
	}

	jwtSecret := strings.TrimSpace(os.Getenv("JWT_SECRET"))
	if isProd && len(jwtSecret) < 32 {
		log.Fatal("❌ [SECURITY FATAL] Di mode production (APP_ENV=production), JWT_SECRET wajib diisi minimal 32 karakter acak!")
	}
	if len(jwtSecret) < 16 {
		if jwtSecret == "" {
			jwtSecret = "propertierp-dev-only-secret-key-do-not-use-in-prod-2026"
		}
	}

	allowedOrigins := strings.TrimSpace(os.Getenv("CORS_ALLOWED_ORIGINS"))
	if allowedOrigins == "" {
		if isProd {
			log.Println("⚠️ [SECURITY WARNING] CORS_ALLOWED_ORIGINS belum diatur di .env, membatasi ke localhost.")
		}
		allowedOrigins = "http://localhost:3000,http://127.0.0.1:3000"
	}

	lat, _ := strconv.ParseFloat(os.Getenv("STORE_LATITUDE"), 64)
	lng, _ := strconv.ParseFloat(os.Getenv("STORE_LONGITUDE"), 64)
	radius, _ := strconv.ParseFloat(os.Getenv("STORE_RADIUS_METERS"), 64)

	dbHost := strings.TrimSpace(os.Getenv("DB_HOST"))
	if dbHost == "" {
		dbHost = "127.0.0.1"
	}
	dbPort := strings.TrimSpace(os.Getenv("DB_PORT"))
	if dbPort == "" {
		dbPort = "3306"
	}

	return &Config{
		AppName:        os.Getenv("APP_NAME"),
		AppPort:        port,
		AppEnv:         appEnv,
		EnforceHTTPS:   enforceHTTPS,
		DBHost:         dbHost,
		DBPort:         dbPort,
		DBUser:         os.Getenv("DB_USER"),
		DBPass:         os.Getenv("DB_PASS"),
		DBName:         os.Getenv("DB_NAME"),
		JWTSecret:      jwtSecret,
		JWTExpire:      os.Getenv("JWT_EXPIRE"),
		RefreshExpire:  os.Getenv("REFRESH_EXPIRE"),
		AllowedOrigins: allowedOrigins,
		StoreLatitude:  lat,
		StoreLongitude: lng,
		StoreRadius:    radius,
	}
}
