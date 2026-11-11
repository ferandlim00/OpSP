package services

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"backend/models"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type TransactionService struct {
	db *gorm.DB
}

func NewTransactionService(db *gorm.DB) *TransactionService {
	return &TransactionService{db: db}
}

type CreateTransactionItemInput struct {
	ProductID uint     `json:"product_id"`
	Qty       int      `json:"qty"`
	Price     *float64 `json:"price"` // Harga deal/negosiasi yang diinput di kasir
	Discount  float64  `json:"discount"`
}

type CreateTransactionInput struct {
	CustomerID      uint                         `json:"customer_id"`
	Discount        float64                      `json:"discount"`
	Note            string                       `json:"note"`
	PaymentMethod   models.PaymentMethod         `json:"payment_method"`
	PaymentType     models.PaymentType           `json:"payment_type"`
	AmountPaid      *float64                     `json:"amount_paid"`
	PaymentProofURL string                       `json:"payment_proof_url"`
	Items           []CreateTransactionItemInput `json:"items"`
}

type AddPaymentInput struct {
	Amount      float64              `json:"amount"`
	Method      models.PaymentMethod `json:"method"`
	PaymentType models.PaymentType   `json:"payment_type"`
	ProofURL    string               `json:"proof_url"`
	Note        string               `json:"note"`
}

type ReturnExchangeItemInput struct {
	ProductID uint `json:"product_id"`
	Qty       int  `json:"qty"`
}

type ReturnExchangeInput struct {
	Action        string                    `json:"action"`         // "EXCHANGE" (Tukar Barang Baru) atau "RETURN" (Kembalikan Barang & Koreksi Nota)
	ItemCondition string                    `json:"item_condition"` // "GOOD" (Layak jual kembali -> masuk stok) atau "DAMAGED" (Rusak/cacat -> tidak masuk stok jual)
	Reason        string                    `json:"reason"`
	Items         []ReturnExchangeItemInput `json:"items"`
}

func (s *TransactionService) GetAll() ([]models.Transaction, error) {
	var list []models.Transaction
	includeDeleted := func(db *gorm.DB) *gorm.DB { return db.Unscoped() }
	err := s.db.
		Preload("Customer", includeDeleted).
		Preload("Items").
		Preload("Items.Product", includeDeleted).
		Preload("Payments").
		Order("created_at DESC").
		Find(&list).Error
	return list, err
}

func (s *TransactionService) GetByID(id uint) (*models.Transaction, error) {
	var trx models.Transaction
	includeDeleted := func(db *gorm.DB) *gorm.DB { return db.Unscoped() }
	err := s.db.
		Preload("Customer", includeDeleted).
		Preload("Items").
		Preload("Items.Product", includeDeleted).
		Preload("Payments").
		First(&trx, id).Error
	if err != nil {
		return nil, errors.New("transaksi tidak ditemukan")
	}
	return &trx, nil
}

func (s *TransactionService) Create(userID uint, in CreateTransactionInput) (*models.Transaction, error) {
	if in.CustomerID == 0 {
		return nil, errors.New("pelanggan wajib dipilih")
	}
	if len(in.Items) == 0 {
		return nil, errors.New("keranjang belanja masih kosong")
	}
	if in.Discount < 0 {
		return nil, errors.New("diskon nota tidak boleh negatif")
	}

	var customer models.Customer
	if err := s.db.First(&customer, in.CustomerID).Error; err != nil {
		return nil, errors.New("pelanggan tidak ditemukan")
	}

	if userID == 0 {
		return nil, errors.New("identitas user tidak valid")
	}

	var createdID uint
	err := s.db.Transaction(func(tx *gorm.DB) error {
		tmpNo, err := tempCode()
		if err != nil {
			return err
		}

		trx := models.Transaction{
			TransactionNo: tmpNo,
			CustomerID:    in.CustomerID,
			Type:          models.TransactionSale,
			Status:        models.StatusPending, // Pending: Stok belum dipotong sampai pengantaran selesai
			PaymentStatus: models.PaymentPaid,
			Discount:      in.Discount,
			Note:          in.Note,
		}
		if err := tx.Create(&trx).Error; err != nil {
			return err
		}

		trxNo := fmt.Sprintf("INV-%s-%04d", time.Now().Format("060102"), trx.ID)
		var grossTotal float64

		for _, itemIn := range in.Items {
			if itemIn.Qty <= 0 {
				return errors.New("kuantitas produk minimal 1")
			}
			if itemIn.Discount < 0 {
				return errors.New("diskon item tidak boleh negatif")
			}

			var product models.Product
			if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&product, itemIn.ProductID).Error; err != nil {
				return fmt.Errorf("produk #%d tidak ditemukan", itemIn.ProductID)
			}
			if product.Stock < itemIn.Qty {
				return fmt.Errorf("Stok produk %s tidak mencukupi atau telah berubah (tersedia: %d, diminta: %d)", product.Name, product.Stock, itemIn.Qty)
			}

			unitPrice := product.PriceSell
			if itemIn.Price != nil {
				unitPrice = *itemIn.Price
			}
			if unitPrice <= 0 {
				return fmt.Errorf("harga deal untuk produk %q wajib diisi di kasir (lebih dari Rp 0)", product.Name)
			}

			subtotal := (unitPrice * float64(itemIn.Qty)) - itemIn.Discount
			if subtotal < 0 {
				subtotal = 0
			}
			grossTotal += subtotal

			trxItem := models.TransactionItem{
				TransactionID: trx.ID,
				ProductID:     product.ID,
				Qty:           itemIn.Qty,
				DeliveredQty:  0,
				ReturnedQty:   0,
				Price:         unitPrice,
				Discount:      itemIn.Discount,
				Subtotal:      subtotal,
			}
			if err := tx.Create(&trxItem).Error; err != nil {
				return err
			}

			// Catat status PENDING (Stok Ditahan) di riwayat inventori sesuai PLAN.md
			pendingMv := models.InventoryMovement{
				ProductID: product.ID,
				UserID:    userID,
				Type:      models.MovementPending,
				Quantity:  itemIn.Qty,
				Notes:     fmt.Sprintf("Stok ditahan (Pending) untuk pesanan %s — akan dipotong saat pengiriman selesai", trxNo),
			}
			if err := tx.Create(&pendingMv).Error; err != nil {
				return err
			}
		}

		finalTotal := grossTotal - in.Discount
		if finalTotal < 0 {
			finalTotal = 0
		}

		method := in.PaymentMethod
		if method == "" {
			method = models.MethodCash
		}
		ptype := in.PaymentType
		if ptype == "" {
			ptype = models.TypeFull
		}
		paidAmt := finalTotal
		if in.AmountPaid != nil {
			paidAmt = *in.AmountPaid
		}

		payStatus := models.PaymentPaid
		if paidAmt <= 0 {
			payStatus = models.PaymentUnpaid
		} else if paidAmt < finalTotal {
			payStatus = models.PaymentPartial
		}

		if paidAmt > 0 {
			payment := models.Payment{
				TransactionID: trx.ID,
				Amount:        paidAmt,
				Method:        method,
				PaymentType:   ptype,
				ProofURL:      in.PaymentProofURL,
				Note:          "Pembayaran awal transaksi",
			}
			if err := tx.Create(&payment).Error; err != nil {
				return err
			}
		}

		if err := tx.Model(&trx).Updates(map[string]interface{}{
			"transaction_no": trxNo,
			"total":          finalTotal,
			"payment_status": payStatus,
		}).Error; err != nil {
			return err
		}

		createdID = trx.ID
		return nil
	})
	if err != nil {
		return nil, err
	}

	return s.GetByID(createdID)
}

func (s *TransactionService) AddPayment(trxID uint, in AddPaymentInput) (*models.Transaction, error) {
	if in.Amount <= 0 {
		return nil, errors.New("nominal pembayaran harus lebih dari Rp 0")
	}

	err := s.db.Transaction(func(tx *gorm.DB) error {
		var trx models.Transaction
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Preload("Payments").First(&trx, trxID).Error; err != nil {
			return errors.New("transaksi tidak ditemukan")
		}

		method := in.Method
		if method == "" {
			method = models.MethodCash
		}
		ptype := in.PaymentType
		if ptype == "" {
			ptype = models.TypeFull
		}

		pay := models.Payment{
			TransactionID: trx.ID,
			Amount:        in.Amount,
			Method:        method,
			PaymentType:   ptype,
			ProofURL:      in.ProofURL,
			Note:          in.Note,
		}
		if err := tx.Create(&pay).Error; err != nil {
			return err
		}

		var totalPaid float64 = in.Amount
		for _, p := range trx.Payments {
			totalPaid += p.Amount
		}

		newStatus := models.PaymentPartial
		if totalPaid >= trx.Total {
			newStatus = models.PaymentPaid
		}
		return tx.Model(&trx).Update("payment_status", newStatus).Error
	})
	if err != nil {
		return nil, err
	}

	return s.GetByID(trxID)
}

// ProcessReturnOrExchange menangani Tukar Barang Baru (EXCHANGE) maupun Pengembalian Barang / Koreksi Nota (RETURN / REFUND).
func (s *TransactionService) ProcessReturnOrExchange(trxID uint, userID uint, in ReturnExchangeInput) (*models.Transaction, error) {
	action := strings.ToUpper(strings.TrimSpace(in.Action))
	if action == "REFUND" {
		action = "RETURN"
	}
	if action != "EXCHANGE" && action != "RETURN" {
		return nil, errors.New("mode harus dipilih: EXCHANGE (Tukar Barang) atau RETURN / REFUND (Pengembalian Barang)")
	}
	cond := strings.ToUpper(strings.TrimSpace(in.ItemCondition))
	if cond == "" {
		cond = "GOOD"
	}
	if len(in.Items) == 0 {
		return nil, errors.New("pilih minimal 1 barang yang akan ditukar/dikembalikan")
	}
	if userID == 0 {
		return nil, errors.New("identitas user tidak valid")
	}

	err := s.db.Transaction(func(tx *gorm.DB) error {
		var trx models.Transaction
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Preload("Items").Preload("Payments").First(&trx, trxID).Error; err != nil {
			return errors.New("transaksi tidak ditemukan")
		}

		itemByProduct := make(map[uint]*models.TransactionItem)
		for i := range trx.Items {
			itemByProduct[trx.Items[i].ProductID] = &trx.Items[i]
		}

		processed := 0
		for _, reqIt := range in.Items {
			if reqIt.Qty <= 0 {
				continue
			}
			ti, ok := itemByProduct[reqIt.ProductID]
			if !ok {
				return fmt.Errorf("produk #%d tidak ditemukan pada nota ini", reqIt.ProductID)
			}
			if reqIt.Qty > ti.DeliveredQty {
				return fmt.Errorf("jumlah tukar/retur (%d) melebihi jumlah barang yang sudah diterima pelanggan (%d)", reqIt.Qty, ti.DeliveredQty)
			}

			var product models.Product
			if err := tx.First(&product, reqIt.ProductID).Error; err != nil {
				return fmt.Errorf("produk #%d tidak ditemukan di gudang", reqIt.ProductID)
			}

			reasonText := strings.TrimSpace(in.Reason)
			if reasonText == "" {
				reasonText = "Tanpa keterangan tambahan"
			}

			// 1. Perlakuan Stok Gudang & Kartu Stok berdasarkan kondisi fisik barang yang ditarik
			if cond == "GOOD" {
				if err := tx.Model(&models.Product{}).
					Where("id = ?", product.ID).
					Update("stock", gorm.Expr("stock + ?", reqIt.Qty)).Error; err != nil {
					return err
				}
				mv := models.InventoryMovement{
					ProductID: product.ID,
					UserID:    userID,
					Type:      models.MovementInbound,
					Quantity:  reqIt.Qty,
					Notes:     fmt.Sprintf("[%s - LAYAK JUAL] Barang masuk kembali ke stok dari Nota %s (%s)", action, trx.TransactionNo, reasonText),
				}
				if err := tx.Create(&mv).Error; err != nil {
					return err
				}
			} else {
				// Barang rusak/cacat: tidak menambah stok siap jual, namun tercatat di riwayat Kartu Stok sebagai ADJUSTMENT
				mv := models.InventoryMovement{
					ProductID: product.ID,
					UserID:    userID,
					Type:      models.MovementAdjustment,
					Quantity:  0,
					Notes:     fmt.Sprintf("[%s - RUSAK/CACAT %d unit] Ditarik dari Nota %s, tidak masuk stok siap jual (%s)", action, reqIt.Qty, trx.TransactionNo, reasonText),
				}
				if err := tx.Create(&mv).Error; err != nil {
					return err
				}
			}

			// 2. Perlakuan terhadap Nota Transaksi & Kebutuhan Pengiriman
			if action == "EXCHANGE" {
				// Tukar Barang Baru: Qty pembelian tetap, DeliveredQty dikurangi agar terbuka kembali untuk pengiriman pengganti
				ti.DeliveredQty -= reqIt.Qty
				ti.ReturnedQty += reqIt.Qty
				if err := tx.Save(ti).Error; err != nil {
					return err
				}
			} else {
				// Pengembalian Barang (RETURN): Qty pembelian & DeliveredQty dikurangi, Subtotal dihitung ulang
				ti.Qty -= reqIt.Qty
				ti.DeliveredQty -= reqIt.Qty
				ti.ReturnedQty += reqIt.Qty
				newSub := (ti.Price * float64(ti.Qty)) - ti.Discount
				if newSub < 0 || ti.Qty == 0 {
					newSub = 0
				}
				ti.Subtotal = newSub
				if err := tx.Save(ti).Error; err != nil {
					return err
				}
			}
			processed++
		}

		if processed == 0 {
			return errors.New("kuantitas barang yang ditukar/diretur minimal 1 unit")
		}

		// 3. Evaluasi ulang Total Nota & Status Transaksi
		var updatedItems []models.TransactionItem
		if err := tx.Where("transaction_id = ?", trx.ID).Find(&updatedItems).Error; err != nil {
			return err
		}

		var newGross float64
		totalRemainingQty := 0
		allDelivered := true
		for _, ui := range updatedItems {
			newGross += ui.Subtotal
			totalRemainingQty += ui.Qty
			if ui.DeliveredQty < ui.Qty {
				allDelivered = false
			}
		}

		newTotal := newGross - trx.Discount
		if newTotal < 0 || totalRemainingQty == 0 {
			newTotal = 0
		}

		newStatus := trx.Status
		if action == "EXCHANGE" {
			// Buka kembali status menjadi PROCESSING agar Admin bisa langsung membuat Jadwal Pengiriman Pengganti
			newStatus = models.StatusProcessing
		} else {
			if totalRemainingQty == 0 {
				newStatus = models.StatusCancelled
			} else if allDelivered {
				newStatus = models.StatusCompleted
			} else {
				newStatus = models.StatusProcessing
			}
		}

		var totalPaid float64
		for _, p := range trx.Payments {
			totalPaid += p.Amount
		}
		payStatus := trx.PaymentStatus
		if newTotal == 0 {
			payStatus = models.PaymentPaid
		} else if totalPaid >= newTotal {
			payStatus = models.PaymentPaid
		} else if totalPaid > 0 {
			payStatus = models.PaymentPartial
		}

		noteAppend := fmt.Sprintf("[%s %s: %s]", action, time.Now().Format("02/01 15:04"), strings.TrimSpace(in.Reason))
		updatedNote := strings.TrimSpace(trx.Note + " " + noteAppend)

		return tx.Model(&trx).Updates(map[string]interface{}{
			"total":          newTotal,
			"status":         newStatus,
			"payment_status": payStatus,
			"note":           updatedNote,
		}).Error
	})
	if err != nil {
		return nil, err
	}

	return s.GetByID(trxID)
}
