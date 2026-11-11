package middleware

import (
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"backend/utils"

	"github.com/gofiber/fiber/v2"
)

// SecurityEvent merepresentasikan satu catatan insiden / aktivitas mencurigakan
type SecurityEvent struct {
	Timestamp string `json:"timestamp"`
	EventType string `json:"event_type"`
	IP        string `json:"ip"`
	Method    string `json:"method"`
	Path      string `json:"path"`
	UserID    uint   `json:"user_id,omitempty"`
	UserAgent string `json:"user_agent"`
	Detail    string `json:"detail"`
}

const maxAuditEvents = 200

var (
	auditMu     sync.Mutex
	auditEvents []SecurityEvent
)

// RecordSecurityEvent mencatat aktivitas mencurigakan ke memori & file logs/security.log
func RecordSecurityEvent(c *fiber.Ctx, eventType, detail string) {
	var uid uint
	if claims, ok := c.Locals("user").(*utils.JWTClaims); ok && claims != nil {
		uid = claims.UserID
	}

	ev := SecurityEvent{
		Timestamp: time.Now().Format(time.RFC3339),
		EventType: eventType,
		IP:        c.IP(),
		Method:    c.Method(),
		Path:      c.OriginalURL(),
		UserID:    uid,
		UserAgent: c.Get("User-Agent"),
		Detail:    detail,
	}

	auditMu.Lock()
	auditEvents = append(auditEvents, ev)
	if len(auditEvents) > maxAuditEvents {
		auditEvents = auditEvents[len(auditEvents)-maxAuditEvents:]
	}
	auditMu.Unlock()

	// Tulis secara persisten ke file logs/security.log dengan izin ketat (0600)
	_ = os.MkdirAll("./logs", 0750)
	if f, err := os.OpenFile(filepath.Join("./logs", "security.log"), os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0600); err == nil {
		if line, err := json.Marshal(ev); err == nil {
			_, _ = f.Write(append(line, '\n'))
		}
		_ = f.Close()
	}
}

// GetSecurityAuditLogs mengembalikan daftar aktivitas mencurigakan terbaru (terbalik dari paling baru)
func GetSecurityAuditLogs() []SecurityEvent {
	auditMu.Lock()
	defer auditMu.Unlock()

	res := make([]SecurityEvent, len(auditEvents))
	for i := range auditEvents {
		res[len(auditEvents)-1-i] = auditEvents[i]
	}
	return res
}

// SecurityHeaders menambahkan HTTP security headers standar produksi & penegakan HTTPS (HSTS)
func SecurityHeaders(enforceHTTPS bool) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if enforceHTTPS {
			proto := strings.ToLower(strings.TrimSpace(c.Get("X-Forwarded-Proto")))
			if proto == "http" {
				target := fmt.Sprintf("https://%s%s", c.Hostname(), c.OriginalURL())
				return c.Redirect(target, fiber.StatusMovedPermanently)
			}
		}

		c.Set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload")
		c.Set("X-Content-Type-Options", "nosniff")
		c.Set("X-Frame-Options", "DENY")
		c.Set("X-XSS-Protection", "1; mode=block")
		c.Set("Referrer-Policy", "strict-origin-when-cross-origin")
		c.Set("Permissions-Policy", "geolocation=(self), camera=(self), microphone=()")
		c.Set("Content-Security-Policy", "default-src 'self'; frame-ancestors 'none'; base-uri 'self'")
		return c.Next()
	}
}

// BlockSensitivePaths memblokir akses ke file tersembunyi (.env, .git, backup SQL, path traversal)
func BlockSensitivePaths() fiber.Handler {
	forbiddenPatterns := []string{
		"..", "/.env", "/.git", "/.docker", "/.vscode",
		"/wp-admin", "/phpmyadmin", ".sql", ".bak", ".key", ".pem",
	}
	return func(c *fiber.Ctx) error {
		rawPath := strings.ToLower(c.OriginalURL())
		decodedPath, _ := url.QueryUnescape(rawPath)

		for _, pat := range forbiddenPatterns {
			if strings.Contains(rawPath, pat) || strings.Contains(decodedPath, pat) {
				RecordSecurityEvent(c, "SENSITIVE_FILE_PROBE", "Upaya akses path terlarang: "+c.OriginalURL())
				return utils.ErrorResponse(c, fiber.StatusForbidden, "Akses ke resource sistem ini dilarang", nil)
			}
		}
		return c.Next()
	}
}

// CSRFProtection mencegah serangan Cross-Site Request Forgery (CSRF) dengan memvalidasi Origin/Referer pada request mutasi
func CSRFProtection(allowedOrigins string) fiber.Handler {
	originsMap := make(map[string]bool)
	for _, o := range strings.Split(allowedOrigins, ",") {
		trimmed := strings.ToLower(strings.TrimRight(strings.TrimSpace(o), "/"))
		if trimmed != "" {
			originsMap[trimmed] = true
		}
	}

	return func(c *fiber.Ctx) error {
		method := c.Method()
		if method == fiber.MethodGet || method == fiber.MethodHead || method == fiber.MethodOptions {
			return c.Next()
		}

		origin := strings.ToLower(strings.TrimRight(strings.TrimSpace(c.Get("Origin")), "/"))
		if origin != "" && !originsMap["*"] {
			hostOriginHTTP := "http://" + strings.ToLower(c.Hostname())
			hostOriginHTTPS := "https://" + strings.ToLower(c.Hostname())
			if !originsMap[origin] && origin != hostOriginHTTP && origin != hostOriginHTTPS {
				RecordSecurityEvent(c, "CSRF_BLOCKED", "Mutasi lintas origin ditolak dari Origin: "+origin)
				return utils.ErrorResponse(c, fiber.StatusForbidden, "Akses ditolak oleh proteksi CSRF: Origin tidak diizinkan", nil)
			}
		}

		return c.Next()
	}
}

// WAFGuard memeriksa query parameter dan body dari serangan XSS dan SQL Injection
func WAFGuard() fiber.Handler {
	return func(c *fiber.Ctx) error {
		rawQuery := c.Context().QueryArgs().String()
		decodedQuery, _ := url.QueryUnescape(rawQuery)

		if utils.ContainsXSS(rawQuery) || utils.ContainsXSS(decodedQuery) {
			RecordSecurityEvent(c, "WAF_XSS_BLOCKED", "Payload XSS terdeteksi pada query parameter")
			return utils.ErrorResponse(c, fiber.StatusBadRequest, "Input ditolak: terdeteksi tag atau script berbahaya (XSS Protection)", nil)
		}
		if utils.ContainsSQLi(rawQuery) || utils.ContainsSQLi(decodedQuery) {
			RecordSecurityEvent(c, "WAF_SQLI_BLOCKED", "Payload SQLi terdeteksi pada query parameter")
			return utils.ErrorResponse(c, fiber.StatusBadRequest, "Input ditolak: terdeteksi pola injeksi query tidak valid", nil)
		}

		contentType := strings.ToLower(c.Get("Content-Type"))
		if strings.HasPrefix(contentType, "application/json") || strings.HasPrefix(contentType, "application/x-www-form-urlencoded") {
			bodyStr := string(c.Body())
			if utils.ContainsXSS(bodyStr) {
				RecordSecurityEvent(c, "WAF_XSS_BLOCKED", "Payload XSS terdeteksi pada request body")
				return utils.ErrorResponse(c, fiber.StatusBadRequest, "Input form ditolak: tidak boleh mengandung script atau tag HTML berbahaya (XSS Protection)", nil)
			}
			if utils.ContainsSQLi(bodyStr) {
				RecordSecurityEvent(c, "WAF_SQLI_BLOCKED", "Payload SQLi terdeteksi pada request body")
				return utils.ErrorResponse(c, fiber.StatusBadRequest, "Input form ditolak: terdeteksi pola injeksi SQL terlarang", nil)
			}
		} else if strings.HasPrefix(contentType, "multipart/form-data") {
			if form, err := c.MultipartForm(); err == nil && form != nil {
				for field, vals := range form.Value {
					for _, v := range vals {
						if utils.ContainsXSS(v) {
							RecordSecurityEvent(c, "WAF_XSS_BLOCKED", "Payload XSS pada field multipart: "+field)
							return utils.ErrorResponse(c, fiber.StatusBadRequest, "Input form ditolak: tidak boleh mengandung script atau tag HTML berbahaya (XSS Protection)", nil)
						}
						if utils.ContainsSQLi(v) {
							RecordSecurityEvent(c, "WAF_SQLI_BLOCKED", "Payload SQLi pada field multipart: "+field)
							return utils.ErrorResponse(c, fiber.StatusBadRequest, "Input form ditolak: terdeteksi pola injeksi SQL terlarang", nil)
						}
					}
				}
			}
		}

		return c.Next()
	}
}

// SuspiciousActivityMonitor memantau response status untuk mendeteksi gagal login, pelanggaran RBAC, atau upload berlebihan
func SuspiciousActivityMonitor() fiber.Handler {
	return func(c *fiber.Ctx) error {
		err := c.Next()
		status := c.Response().StatusCode()

		if status == fiber.StatusUnauthorized {
			if strings.HasSuffix(c.Path(), "/auth/login") {
				RecordSecurityEvent(c, "LOGIN_FAILED", "Percobaan login gagal pada "+c.Path())
			} else {
				RecordSecurityEvent(c, "UNAUTHORIZED_ACCESS", "Akses tanpa token valid ke "+c.Path())
			}
		} else if status == fiber.StatusForbidden {
			RecordSecurityEvent(c, "FORBIDDEN_ACCESS", "Pelanggaran otorisasi role (403) pada "+c.Path())
		} else if status == fiber.StatusRequestEntityTooLarge {
			RecordSecurityEvent(c, "PAYLOAD_TOO_LARGE", "Upaya upload file melebihi batas maksimum server")
		}

		return err
	}
}

type rateBucket struct {
	count     int
	resetTime time.Time
}

type ipRateLimiter struct {
	mu      sync.Mutex
	buckets map[string]*rateBucket
	max     int
	window  time.Duration
}

func newIPRateLimiter(max int, window time.Duration) *ipRateLimiter {
	return &ipRateLimiter{
		buckets: make(map[string]*rateBucket),
		max:     max,
		window:  window,
	}
}

func (rl *ipRateLimiter) allow(ip string) (bool, int) {
	now := time.Now()
	rl.mu.Lock()
	defer rl.mu.Unlock()

	if len(rl.buckets) > 5000 {
		for k, b := range rl.buckets {
			if now.After(b.resetTime) {
				delete(rl.buckets, k)
			}
		}
	}

	b, exists := rl.buckets[ip]
	if !exists || now.After(b.resetTime) {
		rl.buckets[ip] = &rateBucket{
			count:     1,
			resetTime: now.Add(rl.window),
		}
		return true, 0
	}

	if b.count >= rl.max {
		retryAfter := int(time.Until(b.resetTime).Seconds())
		if retryAfter < 1 {
			retryAfter = 1
		}
		return false, retryAfter
	}

	b.count++
	return true, 0
}

// LoginRateLimiter membatasi percobaan login maksimal 10 kali per menit per IP (Brute-Force Protection)
func LoginRateLimiter() fiber.Handler {
	limiter := newIPRateLimiter(10, 1*time.Minute)
	return func(c *fiber.Ctx) error {
		ip := c.IP()
		if ok, retryAfter := limiter.allow(ip); !ok {
			c.Set("Retry-After", strconv.Itoa(retryAfter))
			RecordSecurityEvent(c, "BRUTE_FORCE_BLOCKED", "Rate limit login terlampaui dari IP "+ip)
			return utils.ErrorResponse(c, fiber.StatusTooManyRequests, "Terlalu banyak percobaan login. Silakan tunggu 1 menit sebelum mencoba kembali.", nil)
		}
		return c.Next()
	}
}

// APIRateLimiter membatasi request API umum maksimal 240 request per menit per IP
func APIRateLimiter() fiber.Handler {
	limiter := newIPRateLimiter(240, 1*time.Minute)
	return func(c *fiber.Ctx) error {
		ip := c.IP()
		if ok, _ := limiter.allow(ip); !ok {
			RecordSecurityEvent(c, "API_RATE_LIMIT_BLOCKED", "Rate limit API umum terlampaui dari IP "+ip)
			return utils.ErrorResponse(c, fiber.StatusTooManyRequests, "Batas frekuensi permintaan terlampaui, harap tunggu sesaat.", nil)
		}
		return c.Next()
	}
}
