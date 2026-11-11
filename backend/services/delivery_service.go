package services

import (
	"errors"
	"fmt"
	"time"

	"backend/models"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type DeliveryService struct {
	db *gorm.DB
}

func NewDeliveryService(db *gorm.DB) *DeliveryService {
	return &DeliveryService{db: db}
}

type CreateDeliveryItemInput struct {
	ProductID uint `json:"product_id"`
	Qty       int  `json:"qty"`
}

type CreateDeliveryInput struct {
	TransactionID uint                      `json:"transaction_id"`
	DriverID      uint                      `json:"driver_id"`
	Address       string                    `json:"address"`
	ScheduledDate string                    `json:"scheduled_date"`
	ShippingCost  float64                   `json:"shipping_cost"`
	Note          string                    `json:"note"`
	Items         []CreateDeliveryItemInput `json:"items"`
}

type UpdateDeliveryStatusInput struct {
	Status models.DeliveryStatus `json:"status"`
	Note   string                `json:"note"`
}

type StartDeliveryInput struct {
	PickupNote string
	PhotoURLs  []string
}

type DeliveredItemQtyInput struct {
	ProductID    uint `json:"product_id"`
	DeliveredQty int  `json:"delivered_qty"`
}

type CompleteDeliveryInput struct {
	ReceiverName   string
	Note           string
	PhotoURLs      []string
	DeliveredItems []DeliveredItemQtyInput
}

func (s *DeliveryService) GetAll(role string, userID uint) ([]models.Delivery, error) {
	var list []models.Delivery
	includeDeleted := func(db *gorm.DB) *gorm.DB { return db.Unscoped() }
	q := s.db.
		Preload("Transaction").
		Preload("Transaction.Customer", includeDeleted).
		Preload("Transaction.Payments").
		Preload("Driver", includeDeleted).
		Preload("Items").
		Preload("Items.Product", includeDeleted).
		Preload("Proof").
		Preload("Proof.Photos").
		Order("created_at DESC")

	if role == "EMPLOYEE" {
		q = q.Where("driver_id = ?", userID)
	}

	err := q.Find(&list).Error
	return list, err
}

func (s *DeliveryService) Create(in CreateDeliveryInput) (*models.Delivery, error) {
	if in.TransactionID == 0 {
		return nil, errors.New("transaksi wajib dipilih")
	}
	if in.DriverID == 0 {
		return nil, errors.New("driver / kurir wajib dipilih")
	}
	if in.Address == "" {
		return nil, errors.New("alamat pengiriman wajib diisi")
	}

	var trx models.Transaction
	if err := s.db.Preload("Items").First(&trx, in.TransactionID).Error; err != nil {
		return nil, errors.New("transaksi tidak ditemukan")
	}

	var schedTime *time.Time
	if in.ScheduledDate != "" {
		t, err := time.Parse("2006-01-02", in.ScheduledDate)
		if err == nil {
			schedTime = &t
		}
	}

	var created models.Delivery
	err := s.db.Transaction(func(tx *gorm.DB) error {
		tmpNo, err := tempCode()
		if err != nil {
			return err
		}

		deliv := models.Delivery{
			DeliveryNo:    tmpNo,
			TransactionID: in.TransactionID,
			DriverID:      in.DriverID,
			Address:       in.Address,
			ScheduledDate: schedTime,
			ShippingCost:  in.ShippingCost,
			Status:        models.DeliveryScheduled,
			Note:          in.Note,
		}
		if err := tx.Create(&deliv).Error; err != nil {
			return err
		}

		delivNo := fmt.Sprintf("SJ-%s-%04d", time.Now().Format("060102"), deliv.ID)
		if err := tx.Model(&deliv).Update("delivery_no", delivNo).Error; err != nil {
			return err
		}

		if trx.Status == models.StatusPending {
			if err := tx.Model(&trx).Update("status", models.StatusProcessing).Error; err != nil {
				return err
			}
		}

		itemsToInsert := in.Items
		if len(itemsToInsert) == 0 {
			for _, ti := range trx.Items {
				remaining := ti.Qty - ti.DeliveredQty
				if remaining > 0 {
					itemsToInsert = append(itemsToInsert, CreateDeliveryItemInput{
						ProductID: ti.ProductID,
						Qty:       remaining,
					})
				}
			}
		}

		insertedCount := 0
		for _, it := range itemsToInsert {
			if it.Qty <= 0 {
				continue
			}
			di := models.DeliveryItem{
				DeliveryID:   deliv.ID,
				ProductID:    it.ProductID,
				Qty:          it.Qty,
				DeliveredQty: 0,
			}
			if err := tx.Create(&di).Error; err != nil {
				return err
			}
			insertedCount++
		}

		if insertedCount == 0 {
			return errors.New("seluruh barang pada nota ini sudah terkirim atau kuantitas kirim 0")
		}

		created = deliv
		return nil
	})
	if err != nil {
		return nil, err
	}

	var result models.Delivery
	s.db.Preload("Transaction").Preload("Transaction.Customer").Preload("Transaction.Payments").Preload("Driver").Preload("Items.Product").First(&result, created.ID)
	return &result, nil
}

// UpdateStatus hanya untuk SCHEDULED -> PREPARING atau pembatalan (CANCELLED).
// Untuk berangkat (IN_DELIVERY) dan selesai (COMPLETED), wajib lewat endpoint foto bukti.
func (s *DeliveryService) UpdateStatus(id uint, userID uint, role string, in UpdateDeliveryStatusInput) (*models.Delivery, error) {
	if in.Status == models.DeliveryInDelivery {
		return nil, errors.New("untuk mulai berangkat pengantaran wajib mengunggah foto bukti persiapan/muat barang")
	}
	if in.Status == models.DeliveryCompleted {
		return nil, errors.New("untuk menyelesaikan pengantaran wajib mengunggah foto bukti serah terima (POD)")
	}
	if role == "EMPLOYEE" && in.Status == models.DeliveryCancelled {
		return nil, errors.New("hanya Owner atau Admin yang dapat membatalkan jadwal pengiriman")
	}

	var deliv models.Delivery
	if err := s.db.First(&deliv, id).Error; err != nil {
		return nil, errors.New("pengiriman tidak ditemukan")
	}
	if role == "EMPLOYEE" && deliv.DriverID != userID {
		return nil, errors.New("akses ditolak: Anda hanya dapat memperbarui surat jalan yang ditugaskan kepada Anda")
	}

	if deliv.Status == models.DeliveryCompleted || deliv.Status == models.DeliveryCancelled {
		return nil, errors.New("pengiriman ini sudah selesai atau dibatalkan")
	}

	if in.Status == models.DeliveryPreparing && deliv.Status != models.DeliveryScheduled {
		return nil, fmt.Errorf("tahapan tidak valid: hanya bisa mulai persiapan dari status Terjadwal")
	}

	err := s.db.Transaction(func(tx *gorm.DB) error {
		deliv.Status = in.Status
		if in.Note != "" {
			deliv.Note = in.Note
		}
		if err := tx.Save(&deliv).Error; err != nil {
			return err
		}

		if in.Status == models.DeliveryCancelled && deliv.TransactionID > 0 {
			var trxItems []models.TransactionItem
			tx.Where("transaction_id = ?", deliv.TransactionID).Find(&trxItems)
			anyDelivered := false
			for _, ti := range trxItems {
				if ti.DeliveredQty > 0 {
					anyDelivered = true
					break
				}
			}
			if !anyDelivered {
				tx.Model(&models.Transaction{}).
					Where("id = ?", deliv.TransactionID).
					Update("status", models.StatusPending)
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	return &deliv, nil
}

// StartDeliveryWithProof mengubah status dari PREPARING -> IN_DELIVERY
// dengan WAJIB mengunggah foto bukti barang siap/dimuat di armada (Stage: PICKUP).
func (s *DeliveryService) StartDeliveryWithProof(id uint, userID uint, role string, in StartDeliveryInput) (*models.Delivery, error) {
	if len(in.PhotoURLs) == 0 {
		return nil, errors.New("wajib mengunggah minimal 1 foto bukti persiapan/muat barang sebelum berangkat")
	}

	var deliv models.Delivery
	if err := s.db.First(&deliv, id).Error; err != nil {
		return nil, errors.New("pengiriman tidak ditemukan")
	}
	if role == "EMPLOYEE" && deliv.DriverID != userID {
		return nil, errors.New("akses ditolak: Anda hanya dapat memulai pengiriman yang ditugaskan kepada Anda")
	}

	if deliv.Status != models.DeliveryPreparing {
		return nil, errors.New("pengiriman harus berada pada tahap 'Persiapan / Muat Barang' sebelum berangkat")
	}

	now := time.Now()
	err := s.db.Transaction(func(tx *gorm.DB) error {
		var lockedDeliv models.Delivery
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&lockedDeliv, id).Error; err != nil {
			return errors.New("pengiriman tidak ditemukan")
		}
		if lockedDeliv.Status != models.DeliveryPreparing {
			return errors.New("pengiriman sudah diproses atau tidak berada pada tahap persiapan")
		}
		deliv = lockedDeliv
		deliv.Status = models.DeliveryInDelivery
		if err := tx.Save(&deliv).Error; err != nil {
			return err
		}

		var proof models.DeliveryProof
		if err := tx.Where("delivery_id = ?", deliv.ID).First(&proof).Error; err != nil {
			proof = models.DeliveryProof{
				DeliveryID: deliv.ID,
				PickupNote: in.PickupNote,
				PickupAt:   &now,
			}
			if err := tx.Create(&proof).Error; err != nil {
				return err
			}
		} else {
			proof.PickupNote = in.PickupNote
			proof.PickupAt = &now
			if err := tx.Save(&proof).Error; err != nil {
				return err
			}
		}

		for _, url := range in.PhotoURLs {
			photo := models.DeliveryProofPhoto{
				ProofID:  proof.ID,
				Stage:    models.ProofStagePickup,
				PhotoURL: url,
			}
			if err := tx.Create(&photo).Error; err != nil {
				return err
			}
		}

		return nil
	})
	if err != nil {
		return nil, err
	}

	var result models.Delivery
	s.db.
		Preload("Transaction").
		Preload("Transaction.Customer").
		Preload("Transaction.Payments").
		Preload("Driver").
		Preload("Items.Product").
		Preload("Proof").
		Preload("Proof.Photos").
		First(&result, deliv.ID)
	return &result, nil
}

// CompleteWithProof menyelesaikan pengantaran dengan WAJIB foto bukti serah terima (Stage: DROPOFF)
// sekaligus memotong stok fisik produk sesuai Qty Aktual Diterima & mencatat mutasi OUTBOUND di Kartu Stok.
// Mendukung pengantaran sebagian (barang tidak lengkap / kurang kirim).
func (s *DeliveryService) CompleteWithProof(id uint, userID uint, role string, in CompleteDeliveryInput) (*models.Delivery, error) {
	if len(in.PhotoURLs) == 0 {
		return nil, errors.New("wajib mengunggah minimal 1 foto bukti serah terima barang")
	}
	if userID == 0 {
		return nil, errors.New("identitas user tidak valid")
	}

	actualMap := make(map[uint]int)
	for _, di := range in.DeliveredItems {
		actualMap[di.ProductID] = di.DeliveredQty
	}

	var deliv models.Delivery
	now := time.Now()
	err := s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Preload("Items").
			Preload("Transaction").
			Preload("Transaction.Customer").
			First(&deliv, id).Error; err != nil {
			return errors.New("pengiriman tidak ditemukan")
		}

		if role == "EMPLOYEE" && deliv.DriverID != userID {
			return errors.New("akses ditolak: Anda hanya dapat menyelesaikan pengiriman yang ditugaskan kepada Anda")
		}
		if deliv.Status == models.DeliveryCompleted {
			return errors.New("pengiriman ini sudah diselesaikan sebelumnya")
		}
		if deliv.Status != models.DeliveryInDelivery {
			return errors.New("pengiriman harus berada pada tahap 'Dalam Perjalanan' sebelum diselesaikan")
		}
		// 1. Potong stok fisik produk & catat mutasi OUTBOUND sesuai kuantitas aktual yang diterima
		for _, item := range deliv.Items {
			actualQty := item.Qty
			if customQty, ok := actualMap[item.ProductID]; ok {
				if customQty < 0 {
					customQty = 0
				}
				if customQty > item.Qty {
					customQty = item.Qty
				}
				actualQty = customQty
			}

			// Simpan jumlah aktual diterima pada item surat jalan
			if err := tx.Model(&models.DeliveryItem{}).Where("id = ?", item.ID).Update("delivered_qty", actualQty).Error; err != nil {
				return err
			}

			if actualQty > 0 {
				var product models.Product
				if err := tx.First(&product, item.ProductID).Error; err != nil {
					return fmt.Errorf("produk #%d tidak ditemukan", item.ProductID)
				}

				res := tx.Model(&models.Product{}).
					Where("id = ? AND stock >= ?", item.ProductID, actualQty).
					Update("stock", gorm.Expr("stock - ?", actualQty))
				if res.Error != nil {
					return res.Error
				}
				if res.RowsAffected == 0 {
					return fmt.Errorf("Stok produk %s tidak mencukupi atau telah berubah", product.Name)
				}

				mv := models.InventoryMovement{
					ProductID: product.ID,
					UserID:    userID,
					Type:      models.MovementOutbound,
					Quantity:  actualQty,
					Notes:     fmt.Sprintf("Pengiriman Selesai %s (%d/%d unit) — Penerima: %s (Nota %s)", deliv.DeliveryNo, actualQty, item.Qty, in.ReceiverName, deliv.Transaction.TransactionNo),
				}
				if err := tx.Create(&mv).Error; err != nil {
					return err
				}

				// Tambahkan ke DeliveredQty pada TransactionItem
				if deliv.TransactionID > 0 {
					tx.Model(&models.TransactionItem{}).
						Where("transaction_id = ? AND product_id = ?", deliv.TransactionID, item.ProductID).
						UpdateColumn("delivered_qty", gorm.Expr("delivered_qty + ?", actualQty))
				}
			}
		}

		// 2. Update status Delivery -> COMPLETED
		deliv.Status = models.DeliveryCompleted
		if in.Note != "" {
			deliv.Note = in.Note
		}
		if err := tx.Save(&deliv).Error; err != nil {
			return err
		}

		// 3. Evaluasi pemenuhan barang pada Transaksi (Nota):
		// Jika seluruh item pada nota sudah terkirim penuh (DeliveredQty >= Qty), status Transaksi = COMPLETED.
		// Jika masih ada yang kurang kirim, status Transaksi tetap PROCESSING agar Admin bisa menjadwalkan pengiriman susulan.
		if deliv.TransactionID > 0 {
			var trxItems []models.TransactionItem
			if err := tx.Where("transaction_id = ?", deliv.TransactionID).Find(&trxItems).Error; err != nil {
				return err
			}
			allDelivered := true
			for _, ti := range trxItems {
				if ti.DeliveredQty < ti.Qty {
					allDelivered = false
					break
				}
			}
			targetStatus := models.StatusProcessing
			if allDelivered && len(trxItems) > 0 {
				targetStatus = models.StatusCompleted
			}
			if err := tx.Model(&models.Transaction{}).
				Where("id = ?", deliv.TransactionID).
				Update("status", targetStatus).Error; err != nil {
				return err
			}
		}

		// 4. Update atau buat DeliveryProof + simpan foto DROPOFF
		var proof models.DeliveryProof
		if err := tx.Where("delivery_id = ?", deliv.ID).First(&proof).Error; err != nil {
			proof = models.DeliveryProof{
				DeliveryID:   deliv.ID,
				ReceiverName: in.ReceiverName,
				DeliveredAt:  &now,
				Note:         in.Note,
			}
			if err := tx.Create(&proof).Error; err != nil {
				return err
			}
		} else {
			proof.ReceiverName = in.ReceiverName
			proof.DeliveredAt = &now
			proof.Note = in.Note
			if err := tx.Save(&proof).Error; err != nil {
				return err
			}
		}

		for _, url := range in.PhotoURLs {
			photo := models.DeliveryProofPhoto{
				ProofID:  proof.ID,
				Stage:    models.ProofStageDropoff,
				PhotoURL: url,
			}
			if err := tx.Create(&photo).Error; err != nil {
				return err
			}
		}

		return nil
	})
	if err != nil {
		return nil, err
	}

	var result models.Delivery
	s.db.
		Preload("Transaction").
		Preload("Transaction.Customer").
		Preload("Transaction.Payments").
		Preload("Driver").
		Preload("Items.Product").
		Preload("Proof").
		Preload("Proof.Photos").
		First(&result, deliv.ID)
	return &result, nil
}
