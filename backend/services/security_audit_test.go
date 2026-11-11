package services

import (
	"bytes"
	"image"
	"image/color"
	"image/png"
	"io"
	"mime/multipart"
	"net/http/httptest"
	"strings"
	"testing"

	"backend/config"
	"backend/middleware"
	"backend/utils"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

// 1. Test Argon2id Password Hashing & Constant-Time Verification
func TestPasswordHashingArgon2id(t *testing.T) {
	rawPass := "RahasiaKuat#2026!"
	hash1, err := utils.HashPassword(rawPass)
	if err != nil {
		t.Fatalf("HashPassword gagal: %v", err)
	}
	hash2, err := utils.HashPassword(rawPass)
	if err != nil {
		t.Fatalf("HashPassword kedua gagal: %v", err)
	}
	if hash1 == hash2 {
		t.Fatalf("Salt Argon2id tidak unik: kedua hash identik")
	}
	if !strings.HasPrefix(hash1, "$argon2id$") {
		t.Fatalf("Format hash bukan Argon2id: %s", hash1)
	}

	ok, err := utils.CheckPasswordHash(rawPass, hash1)
	if err != nil || !ok {
		t.Fatalf("Verifikasi password benar gagal: %v", err)
	}

	okWrong, _ := utils.CheckPasswordHash("PasswordSalah123", hash1)
	if okWrong {
		t.Fatalf("Password salah seharusnya ditolak")
	}
}

// 2. Test JWT Security & Algorithm Confusion (alg: none) Rejection
func TestJWTSecurityAndAlgNoneRejection(t *testing.T) {
	secret := "super-secret-jwt-key-minimal-32-bytes-long-2026"
	tok, err := utils.GenerateToken(7, "owner_test", "OWNER", secret, 24)
	if err != nil {
		t.Fatalf("Gagal membuat token: %v", err)
	}

	claims, err := utils.ValidateToken(tok, secret)
	if err != nil || claims == nil || claims.UserID != 7 || claims.Role != "OWNER" {
		t.Fatalf("Token valid gagal diverifikasi: %v", err)
	}

	// Serangan 1: Gunakan secret palsu
	if _, err := utils.ValidateToken(tok, "wrong-secret-key-attacker"); err == nil {
		t.Fatalf("Token dengan secret salah seharusnya ditolak")
	}

	// Serangan 2: JWT Algorithm Confusion (alg: none)
	unsignedToken := jwt.NewWithClaims(jwt.SigningMethodNone, utils.JWTClaims{
		UserID:   1,
		Username: "hacker",
		Role:     "OWNER",
	})
	unsignedStr, _ := unsignedToken.SignedString(jwt.UnsafeAllowNoneSignatureType)
	if _, err := utils.ValidateToken(unsignedStr, secret); err == nil {
		t.Fatalf("Token dengan alg:none seharusnya ditolak keras!")
	}
}

// 3. Test WAF (Anti-XSS & Anti-SQL Injection) + Sensitive File Blocker + HTTPS Enforcement
func TestWAFAndSensitiveFileProtection(t *testing.T) {
	app := fiber.New()
	app.Use(middleware.BlockSensitivePaths())
	app.Use(middleware.SecurityHeaders(true))
	app.Use(middleware.WAFGuard())

	app.Post("/api/customers", func(c *fiber.Ctx) error {
		return c.SendStatus(fiber.StatusOK)
	})
	app.Get("/api/products", func(c *fiber.Ctx) error {
		return c.SendStatus(fiber.StatusOK)
	})

	// A. Uji HTTPS Redirect saat X-Forwarded-Proto = http
	reqHTTP := httptest.NewRequest(fiber.MethodGet, "http://erp.toko.com/api/products", nil)
	reqHTTP.Header.Set("X-Forwarded-Proto", "http")
	respHTTP, err := app.Test(reqHTTP)
	if err != nil || respHTTP.StatusCode != fiber.StatusMovedPermanently {
		t.Fatalf("Seharusnya redirect 301 ke HTTPS, dapat status: %d", respHTTP.StatusCode)
	}

	// B. Uji akses ke file sensitif /.env dan /.git
	for _, path := range []string{"/.env", "/.git/config", "/uploads/../../.env", "/backup.sql"} {
		req := httptest.NewRequest(fiber.MethodGet, path, nil)
		req.Header.Set("X-Forwarded-Proto", "https")
		resp, _ := app.Test(req)
		if resp.StatusCode != fiber.StatusForbidden {
			t.Fatalf("Path sensitif %s seharusnya diblokir 403, dapat: %d", path, resp.StatusCode)
		}
	}

	// C. Uji serangan XSS pada body JSON
	xssBody := `{"name": "<script>alert(document.cookie)</script>", "phone": "08123"}`
	reqXSS := httptest.NewRequest(fiber.MethodPost, "/api/customers", strings.NewReader(xssBody))
	reqXSS.Header.Set("Content-Type", "application/json")
	reqXSS.Header.Set("X-Forwarded-Proto", "https")
	respXSS, _ := app.Test(reqXSS)
	if respXSS.StatusCode != fiber.StatusBadRequest {
		t.Fatalf("Payload XSS seharusnya diblokir 400 oleh WAFGuard, dapat: %d", respXSS.StatusCode)
	}

	// D. Uji serangan SQL Injection pada query parameter
	reqSQLi := httptest.NewRequest(fiber.MethodGet, "/api/products?search=kursi%27%20UNION%20SELECT%20username,password%20FROM%20users--", nil)
	reqSQLi.Header.Set("X-Forwarded-Proto", "https")
	respSQLi, _ := app.Test(reqSQLi)
	if respSQLi.StatusCode != fiber.StatusBadRequest {
		t.Fatalf("Payload SQLi seharusnya diblokir 400 oleh WAFGuard, dapat: %d", respSQLi.StatusCode)
	}
}

// 4. Test CSRF Protection & Strict Origin Validation
func TestCSRFProtection(t *testing.T) {
	app := fiber.New()
	app.Use(middleware.CSRFProtection("https://erp.domainanda.com,http://localhost:3000"))
	app.Post("/api/transactions", func(c *fiber.Ctx) error {
		return c.SendStatus(fiber.StatusCreated)
	})

	// Origin tidak dikenal (serangan CSRF lintas domain)
	badReq := httptest.NewRequest(fiber.MethodPost, "/api/transactions", strings.NewReader(`{}`))
	badReq.Header.Set("Origin", "https://situs-jahat-phishing.com")
	badResp, _ := app.Test(badReq)
	if badResp.StatusCode != fiber.StatusForbidden {
		t.Fatalf("Serangan CSRF dari origin asing seharusnya ditolak 403, dapat: %d", badResp.StatusCode)
	}

	// Origin resmi yang diizinkan
	goodReq := httptest.NewRequest(fiber.MethodPost, "/api/transactions", strings.NewReader(`{}`))
	goodReq.Header.Set("Origin", "https://erp.domainanda.com")
	goodResp, _ := app.Test(goodReq)
	if goodResp.StatusCode != fiber.StatusCreated {
		t.Fatalf("Origin resmi seharusnya diizinkan (201), dapat: %d", goodResp.StatusCode)
	}
}

// 5. Test Brute-Force Login Rate Limiter (Max 10 per menit)
func TestLoginBruteForceRateLimiter(t *testing.T) {
	app := fiber.New()
	app.Post("/api/auth/login", middleware.LoginRateLimiter(), func(c *fiber.Ctx) error {
		return c.SendStatus(fiber.StatusUnauthorized)
	})

	for i := 1; i <= 10; i++ {
		req := httptest.NewRequest(fiber.MethodPost, "/api/auth/login", nil)
		resp, _ := app.Test(req)
		if resp.StatusCode != fiber.StatusUnauthorized {
			t.Fatalf("Percobaan ke-%d seharusnya 401, dapat: %d", i, resp.StatusCode)
		}
	}

	// Percobaan ke-11 wajib diblokir dengan 429 Too Many Requests
	req11 := httptest.NewRequest(fiber.MethodPost, "/api/auth/login", nil)
	resp11, _ := app.Test(req11)
	if resp11.StatusCode != fiber.StatusTooManyRequests {
		t.Fatalf("Percobaan login ke-11 seharusnya diblokir 429 (Rate Limit), dapat: %d", resp11.StatusCode)
	}
}

// 6. Test Global Idempotency Middleware (Replay & Anti-Double-Click)
func TestGlobalIdempotencyMiddleware(t *testing.T) {
	app := fiber.New()
	execCount := 0
	app.Use(middleware.Idempotency())
	app.Post("/api/payments", func(c *fiber.Ctx) error {
		execCount++
		return c.Status(fiber.StatusCreated).JSON(fiber.Map{"ok": true, "run": execCount})
	})

	body := `{"amount": 500000}`
	req1 := httptest.NewRequest(fiber.MethodPost, "/api/payments", strings.NewReader(body))
	req1.Header.Set("Content-Type", "application/json")
	req1.Header.Set("X-Idempotency-Key", "idem-test-key-001")
	resp1, _ := app.Test(req1)
	if resp1.StatusCode != fiber.StatusCreated || execCount != 1 {
		t.Fatalf("Request pertama seharusnya dieksekusi (201), status=%d, execCount=%d", resp1.StatusCode, execCount)
	}

	// Kirim ulang dengan X-Idempotency-Key yang sama: harus mengembalikan cached response tanpa mengeksekusi ulang handler
	req2 := httptest.NewRequest(fiber.MethodPost, "/api/payments", strings.NewReader(body))
	req2.Header.Set("Content-Type", "application/json")
	req2.Header.Set("X-Idempotency-Key", "idem-test-key-001")
	resp2, _ := app.Test(req2)
	if resp2.StatusCode != fiber.StatusCreated || resp2.Header.Get("X-Idempotent-Replay") != "true" || execCount != 1 {
		t.Fatalf("Request idempotent kedua seharusnya replay tanpa eksekusi ulang! status=%d, replay=%s, execCount=%d",
			resp2.StatusCode, resp2.Header.Get("X-Idempotent-Replay"), execCount)
	}
}

// 7. Test Strict Image Upload Validation (Anti-Malware / Fake Extension / Double Extension / Oversized)
func createMultipartFileHeader(t *testing.T, filename string, content []byte) *multipart.FileHeader {
	t.Helper()
	var b bytes.Buffer
	w := multipart.NewWriter(&b)
	part, err := w.CreateFormFile("photo", filename)
	if err != nil {
		t.Fatalf("Gagal membuat form file: %v", err)
	}
	_, _ = io.Copy(part, bytes.NewReader(content))
	_ = w.Close()

	r := multipart.NewReader(&b, w.Boundary())
	form, err := r.ReadForm(10 * 1024 * 1024)
	if err != nil {
		t.Fatalf("Gagal membaca multipart form: %v", err)
	}
	return form.File["photo"][0]
}

func TestStrictFileUploadSecurity(t *testing.T) {
	// Buat gambar PNG 10x10 valid di memori
	var pngBuf bytes.Buffer
	img := image.NewRGBA(image.Rect(0, 0, 10, 10))
	img.Set(1, 1, color.RGBA{R: 255, G: 0, B: 0, A: 255})
	_ = png.Encode(&pngBuf, img)
	// Tambahkan padding komentar agar ukuran >= 64 byte
	validPNGBytes := pngBuf.Bytes()

	// A. Gambar PNG asli harus lulus
	validFH := createMultipartFileHeader(t, "bukti_transfer.png", validPNGBytes)
	if err := ValidateImage(validFH); err != nil {
		t.Fatalf("Gambar PNG valid seharusnya diterima, error: %v", err)
	}

	// B. File PHP backdoor yang menyamar dengan ekstensi .jpg harus ditolak
	fakePHP := []byte("<?php system($_GET['cmd']); /* padding bytes supaya lebih dari 64 karakter untuk tes */ ?>")
	fakeFH := createMultipartFileHeader(t, "backdoor.jpg", fakePHP)
	if err := ValidateImage(fakeFH); err == nil {
		t.Fatalf("File PHP yang menyamar sebagai .jpg seharusnya ditolak oleh cek Magic Bytes!")
	}

	// C. File dengan ekstensi ganda berbahaya (shell.php.png) harus ditolak
	doubleExtFH := createMultipartFileHeader(t, "shell.php.png", validPNGBytes)
	if err := ValidateImage(doubleExtFH); err == nil {
		t.Fatalf("File dengan ekstensi ganda shell.php.png seharusnya ditolak!")
	}

	// D. File gambar yang melebihi 5MB harus ditolak
	oversizedBytes := make([]byte, MaxImageSize+1024)
	copy(oversizedBytes, validPNGBytes)
	oversizedFH := createMultipartFileHeader(t, "foto_raksasa.png", oversizedBytes)
	if err := ValidateImage(oversizedFH); err == nil {
		t.Fatalf("File melebihi 5MB seharusnya ditolak!")
	}
}

// 8. Test RBAC Lockdown (Employee & Admin Route Restrictions)
func TestRBACRouteLockdown(t *testing.T) {
	cfg := &config.Config{JWTSecret: "rbac-test-secret-key-minimum-32-characters-long"}
	app := fiber.New()
	protected := app.Group("/api", middleware.Protected(cfg))
	ownerOnly := protected.Group("/owner", middleware.RequireRole("OWNER"))
	ownerOnly.Delete("/products/:id", func(c *fiber.Ctx) error {
		return c.SendStatus(fiber.StatusOK)
	})

	empToken, _ := utils.GenerateToken(3, "kurir1", "EMPLOYEE", cfg.JWTSecret, 1)
	adminToken, _ := utils.GenerateToken(2, "admin1", "ADMIN", cfg.JWTSecret, 1)
	ownerToken, _ := utils.GenerateToken(1, "owner1", "OWNER", cfg.JWTSecret, 1)

	// EMPLOYEE mencoba hapus produk -> wajib 403 Forbidden
	reqEmp := httptest.NewRequest(fiber.MethodDelete, "/api/owner/products/1", nil)
	reqEmp.Header.Set("Authorization", "Bearer "+empToken)
	respEmp, _ := app.Test(reqEmp)
	if respEmp.StatusCode != fiber.StatusForbidden {
		t.Fatalf("EMPLOYEE seharusnya ditolak 403 saat mengakses route OWNER, dapat: %d", respEmp.StatusCode)
	}

	// ADMIN mencoba hapus produk (khusus OWNER) -> wajib 403 Forbidden
	reqAdm := httptest.NewRequest(fiber.MethodDelete, "/api/owner/products/1", nil)
	reqAdm.Header.Set("Authorization", "Bearer "+adminToken)
	respAdm, _ := app.Test(reqAdm)
	if respAdm.StatusCode != fiber.StatusForbidden {
		t.Fatalf("ADMIN seharusnya ditolak 403 saat menghapus produk (khusus OWNER), dapat: %d", respAdm.StatusCode)
	}

	// OWNER menghapus produk -> wajib 200 OK
	reqOwn := httptest.NewRequest(fiber.MethodDelete, "/api/owner/products/1", nil)
	reqOwn.Header.Set("Authorization", "Bearer "+ownerToken)
	respOwn, _ := app.Test(reqOwn)
	if respOwn.StatusCode != fiber.StatusOK {
		t.Fatalf("OWNER seharusnya diizinkan 200 OK, dapat: %d", respOwn.StatusCode)
	}

	// Pastikan insiden pelanggaran 403 tercatat di Audit Log
	logs := middleware.GetSecurityAuditLogs()
	if len(logs) == 0 {
		t.Fatalf("Log audit keamanan seharusnya mencatat aktivitas mencurigakan")
	}
}
