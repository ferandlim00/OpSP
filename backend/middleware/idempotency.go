package middleware

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"
	"sync"
	"time"

	"backend/utils"

	"github.com/gofiber/fiber/v2"
)

type cachedIdempotentResponse struct {
	inFlight    bool
	statusCode  int
	contentType string
	body        []byte
	expiresAt   time.Time
}

type idempotencyStore struct {
	mu      sync.Mutex
	entries map[string]*cachedIdempotentResponse
}

var globalIdempotencyStore = &idempotencyStore{
	entries: make(map[string]*cachedIdempotentResponse),
}

const (
	explicitKeyTTL     = 120 * time.Second
	autoFingerprintTTL = 3 * time.Second
)

// Idempotency mencegah duplikasi eksekusi request mutasi (POST/PUT/PATCH/DELETE)
// baik melalui header eksplisit X-Idempotency-Key maupun deteksi klik ganda otomatis (fingerprint).
func Idempotency() fiber.Handler {
	return func(c *fiber.Ctx) error {
		method := c.Method()
		if method == fiber.MethodGet || method == fiber.MethodHead || method == fiber.MethodOptions {
			return c.Next()
		}

		// Jangan terapkan idempotency pada endpoint login
		if strings.HasSuffix(c.Path(), "/auth/login") {
			return c.Next()
		}

		var userID uint
		if claims, ok := c.Locals("user").(*utils.JWTClaims); ok && claims != nil {
			userID = claims.UserID
		}

		rawHeaderKey := strings.TrimSpace(c.Get("X-Idempotency-Key"))
		var storeKey string
		var ttl time.Duration

		if rawHeaderKey != "" {
			if len(rawHeaderKey) > 128 {
				return utils.ErrorResponse(c, fiber.StatusBadRequest, "X-Idempotency-Key terlalu panjang (maks 128 karakter)", nil)
			}
			storeKey = fmt.Sprintf("idem:u%d:%s:%s:%s", userID, method, c.Path(), rawHeaderKey)
			ttl = explicitKeyTTL
		} else {
			// Fallback anti-double-click otomatis berbasis fingerprint payload
			contentType := strings.ToLower(c.Get("Content-Type"))
			h := sha256.New()
			_, _ = fmt.Fprintf(h, "u%d:%s:%s:", userID, method, c.Path())
			if strings.HasPrefix(contentType, "multipart/form-data") {
				_, _ = fmt.Fprintf(h, "mp:%d:%s", c.Request().Header.ContentLength(), contentType)
			} else {
				h.Write(c.Body())
			}
			storeKey = "fp:" + hex.EncodeToString(h.Sum(nil))
			ttl = autoFingerprintTTL
		}

		now := time.Now()
		globalIdempotencyStore.mu.Lock()
		for k, v := range globalIdempotencyStore.entries {
			if now.After(v.expiresAt) {
				delete(globalIdempotencyStore.entries, k)
			}
		}

		if existing, exists := globalIdempotencyStore.entries[storeKey]; exists && now.Before(existing.expiresAt) {
			if existing.inFlight {
				globalIdempotencyStore.mu.Unlock()
				return utils.ErrorResponse(c, fiber.StatusConflict, "Permintaan yang sama sedang diproses, harap tunggu beberapa saat", nil)
			}
			if rawHeaderKey != "" && len(existing.body) > 0 {
				status := existing.statusCode
				ct := existing.contentType
				bodyCopy := append([]byte(nil), existing.body...)
				globalIdempotencyStore.mu.Unlock()

				if ct != "" {
					c.Set("Content-Type", ct)
				}
				c.Set("X-Idempotent-Replay", "true")
				return c.Status(status).Send(bodyCopy)
			}
			globalIdempotencyStore.mu.Unlock()
			return utils.ErrorResponse(c, fiber.StatusConflict, "Permintaan duplikat terdeteksi (mencegah klik ganda)", nil)
		}

		entry := &cachedIdempotentResponse{
			inFlight:  true,
			expiresAt: now.Add(ttl),
		}
		globalIdempotencyStore.entries[storeKey] = entry
		globalIdempotencyStore.mu.Unlock()

		err := c.Next()

		statusCode := c.Response().StatusCode()
		globalIdempotencyStore.mu.Lock()
		if err != nil || statusCode >= 400 {
			// Jika gagal validasi atau error bisnis, lepaskan lock agar user bisa memperbaiki input & mencoba lagi
			delete(globalIdempotencyStore.entries, storeKey)
		} else {
			entry.inFlight = false
			entry.statusCode = statusCode
			entry.contentType = string(c.Response().Header.ContentType())
			entry.body = append([]byte(nil), c.Response().Body()...)
			entry.expiresAt = time.Now().Add(ttl)
		}
		globalIdempotencyStore.mu.Unlock()

		return err
	}
}
