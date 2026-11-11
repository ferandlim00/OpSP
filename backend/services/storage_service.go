package services

import (
	"bytes"
	"errors"
	"fmt"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"backend/utils"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// Storage adalah "kontrak" penyimpanan file.
type Storage interface {
	Save(c *fiber.Ctx, file *multipart.FileHeader, folder string) (string, error)
	Delete(fileURL string) error
}

const (
	MaxImageSize  = 5 * 1024 * 1024 // Maksimal 5 MB per foto
	MinImageSize  = 64              // Minimal 64 byte
	MaxImageDimPx = 8192            // Maksimal resolusi 8192x8192 px (mencegah decompression bomb)
)

var allowedImageExt = map[string]bool{".jpg": true, ".jpeg": true, ".png": true, ".webp": true}
var allowedImageMime = map[string]bool{
	"image/jpeg": true,
	"image/png":  true,
	"image/webp": true,
}

// ValidateImage memastikan file adalah gambar asli (cek nama file, ekstensi tunggal, ukuran, magic bytes MIME, dan dimensi struktur gambar)
func ValidateImage(file *multipart.FileHeader) error {
	if file == nil {
		return errors.New("file foto tidak ditemukan")
	}

	cleanName := filepath.Base(strings.TrimSpace(file.Filename))
	if strings.Contains(file.Filename, "..") || strings.Contains(file.Filename, "\x00") {
		return errors.New("nama file mengandung karakter terlarang")
	}
	if utils.HasDangerousDoubleExtension(cleanName) {
		return fmt.Errorf("file %s ditolak karena memiliki ekstensi ganda yang mencurigakan", cleanName)
	}

	ext := strings.ToLower(filepath.Ext(cleanName))
	if !allowedImageExt[ext] {
		return fmt.Errorf("file %s bukan gambar yang didukung (hanya jpg, jpeg, png, webp)", cleanName)
	}
	if file.Size < MinImageSize {
		return fmt.Errorf("file %s terlalu kecil atau rusak", cleanName)
	}
	if file.Size > MaxImageSize {
		return fmt.Errorf("ukuran file %s (%.2f MB) melebihi batas maksimal 5 MB per foto", cleanName, float64(file.Size)/(1024*1024))
	}

	f, err := file.Open()
	if err != nil {
		return fmt.Errorf("gagal membuka file %s untuk verifikasi keamanan", cleanName)
	}
	defer f.Close()

	// Baca hingga 64 KB pertama untuk pemeriksaan Magic Bytes + DecodeConfig dimensi gambar
	headerBuf := make([]byte, 65536)
	n, err := f.Read(headerBuf)
	if err != nil && !errors.Is(err, io.EOF) {
		return fmt.Errorf("gagal membaca header file %s", cleanName)
	}
	headerSlice := headerBuf[:n]

	detectedMime := http.DetectContentType(headerSlice)
	if !allowedImageMime[detectedMime] {
		return fmt.Errorf("konten file %s ditolak (terdeteksi sebagai %s, wajib gambar asli jpg/png/webp)", cleanName, detectedMime)
	}

	// Untuk JPEG dan PNG, verifikasi struktur header dimensi agar mencegah file polyglot / image bomb
	if detectedMime == "image/jpeg" || detectedMime == "image/png" {
		if _, err := f.Seek(0, io.SeekStart); err == nil {
			cfg, _, decErr := image.DecodeConfig(f)
			if decErr != nil {
				return fmt.Errorf("struktur gambar %s rusak atau tidak valid", cleanName)
			}
			if cfg.Width <= 0 || cfg.Height <= 0 || cfg.Width > MaxImageDimPx || cfg.Height > MaxImageDimPx {
				return fmt.Errorf("dimensi gambar %s (%dx%d px) melebihi batas aman (%dx%d px)", cleanName, cfg.Width, cfg.Height, MaxImageDimPx, MaxImageDimPx)
			}
		} else {
			cfg, _, decErr := image.DecodeConfig(bytes.NewReader(headerSlice))
			if decErr == nil && (cfg.Width > MaxImageDimPx || cfg.Height > MaxImageDimPx) {
				return fmt.Errorf("dimensi gambar %s melebihi batas aman", cleanName)
			}
		}
	} else if detectedMime == "image/webp" {
		// Pastikan signature RIFF....WEBP valid
		if len(headerSlice) < 12 || string(headerSlice[0:4]) != "RIFF" || string(headerSlice[8:12]) != "WEBP" {
			return fmt.Errorf("struktur header WebP pada file %s tidak valid", cleanName)
		}
	}

	return nil
}

// ─────────────────────────────────────────────
// LocalStorage — simpan file di disk server dengan izin ketat
// ─────────────────────────────────────────────
type LocalStorage struct {
	BaseDir   string // contoh: "./uploads"
	PublicURL string // contoh: "/uploads"
}

func NewLocalStorage(baseDir, publicURL string) *LocalStorage {
	return &LocalStorage{BaseDir: baseDir, PublicURL: publicURL}
}

func (s *LocalStorage) Save(c *fiber.Ctx, file *multipart.FileHeader, folder string) (string, error) {
	if err := ValidateImage(file); err != nil {
		return "", err
	}

	// Pastikan folder tidak mengandung path traversal
	cleanFolder := filepath.Clean(folder)
	if strings.Contains(cleanFolder, "..") || strings.HasPrefix(cleanFolder, "/") || strings.HasPrefix(cleanFolder, "\\") {
		return "", errors.New("nama folder penyimpanan tidak valid")
	}

	dir := filepath.Join(s.BaseDir, cleanFolder)
	if err := os.MkdirAll(dir, 0750); err != nil {
		return "", errors.New("gagal menyiapkan folder upload")
	}

	// Nama file acak penuh berbasis UUID (tidak pernah menggunakan nama file asli dari user)
	ext := strings.ToLower(filepath.Ext(file.Filename))
	name := fmt.Sprintf("%s-%s%s", time.Now().Format("20060102"), uuid.NewString(), ext)
	fullPath := filepath.Join(dir, name)

	if err := c.SaveFile(file, fullPath); err != nil {
		return "", errors.New("gagal menyimpan file")
	}
	// Set permission non-executable (0640)
	_ = os.Chmod(fullPath, 0640)

	return fmt.Sprintf("%s/%s/%s", s.PublicURL, cleanFolder, name), nil
}

func (s *LocalStorage) Delete(fileURL string) error {
	if !strings.HasPrefix(fileURL, s.PublicURL+"/") {
		return nil
	}
	rel := strings.TrimPrefix(fileURL, s.PublicURL+"/")
	if strings.Contains(rel, "..") || strings.Contains(rel, "\x00") {
		return errors.New("path file tidak valid")
	}
	err := os.Remove(filepath.Join(s.BaseDir, filepath.FromSlash(rel)))
	if err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}
