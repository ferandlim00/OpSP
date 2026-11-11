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

type PurchaseOrderService struct {
	db *gorm.DB
}

func NewPurchaseOrderService(db *gorm.DB) *PurchaseOrderService {
	return &PurchaseOrderService{db: db}
}

type CreatePOItemInput struct {
	ProductID  uint     `json:"product_id"`
	Qty        int      `json:"qty"`
	PriceModal *float64 `json:"price_modal"`
}

type CreatePOInput struct {
	SupplierID uint                `json:"supplier_id"`
	Date       string              `json:"date"`
	Note       string              `json:"note"`
	Items      []CreatePOItemInput `json:"items"`
}

type ReceivePOItemInput struct {
	ProductID   uint     `json:"product_id"`
	ReceivedQty int      `json:"received_qty"`
	PriceModal  *float64 `json:"price_modal"`
}

type ReceivePOInput struct {
	Note  string               `json:"note"`
	Items []ReceivePOItemInput `json:"items"`
}

func (s *PurchaseOrderService) GetAll(statusFilter string) ([]models.PurchaseOrder, error) {
	var list []models.PurchaseOrder
	includeDeleted := func(db *gorm.DB) *gorm.DB { return db.Unscoped() }
	q := s.db.
		Preload("Supplier", includeDeleted).
		Preload("Items").
		Preload("Items.Product", includeDeleted).
		Order("created_at DESC")

	if statusFilter != "" && statusFilter != "ALL" {
		q = q.Where("status = ?", statusFilter)
	}

	err := q.Find(&list).Error
	return list, err
}

func (s *PurchaseOrderService) GetByID(id uint) (*models.PurchaseOrder, error) {
	var po models.PurchaseOrder
	includeDeleted := func(db *gorm.DB) *gorm.DB { return db.Unscoped() }
	err := s.db.
		Preload("Supplier", includeDeleted).
		Preload("Items").
		Preload("Items.Product", includeDeleted).
		First(&po, id).Error
	if err != nil {
		return nil, errors.New("Purchase Order tidak ditemukan")
	}
	return &po, nil
}

func (s *PurchaseOrderService) Create(in CreatePOInput) (*models.PurchaseOrder, error) {
	if in.SupplierID == 0 {
		return nil, errors.New("supplier wajib dipilih")
	}
	if len(in.Items) == 0 {
		return nil, errors.New("daftar produk pengadaan tidak boleh kosong")
	}

	var sup models.Supplier
	if err := s.db.First(&sup, in.SupplierID).Error; err != nil {
		return nil, errors.New("supplier tidak ditemukan")
	}

	poDate := time.Now()
	if strings.TrimSpace(in.Date) != "" {
		if parsed, err := time.Parse("2006-01-02", strings.TrimSpace(in.Date)); err == nil {
			poDate = parsed
		}
	}

	var createdID uint
	err := s.db.Transaction(func(tx *gorm.DB) error {
		tmpNo, err := tempCode()
		if err != nil {
			return err
		}

		po := models.PurchaseOrder{
			PONumber:   tmpNo,
			SupplierID: in.SupplierID,
			Date:       poDate,
			Status:     models.POOrdered,
			Note:       strings.TrimSpace(in.Note),
		}
		if err := tx.Create(&po).Error; err != nil {
			return err
		}

		poNo := fmt.Sprintf("PO-%s-%04d", time.Now().Format("060102"), po.ID)
		var total float64

		for _, it := range in.Items {
			if it.Qty <= 0 {
				return errors.New("kuantitas pengadaan minimal 1 unit")
			}
			var prod models.Product
			if err := tx.First(&prod, it.ProductID).Error; err != nil {
				return fmt.Errorf("produk #%d tidak ditemukan", it.ProductID)
			}

			var unitModal float64
			if it.PriceModal != nil && *it.PriceModal >= 0 {
				unitModal = *it.PriceModal
			} else if prod.PriceBuy != nil {
				unitModal = *prod.PriceBuy
			}
			total += unitModal * float64(it.Qty)

			poItem := models.PurchaseOrderItem{
				POOrderID:   po.ID,
				ProductID:   prod.ID,
				Qty:         it.Qty,
				ReceivedQty: 0,
				PriceModal:  &unitModal,
			}
			if err := tx.Create(&poItem).Error; err != nil {
				return err
			}
		}

		if err := tx.Model(&po).Updates(map[string]interface{}{
			"po_number": poNo,
			"total":     total,
		}).Error; err != nil {
			return err
		}

		createdID = po.ID
		return nil
	})
	if err != nil {
		return nil, err
	}

	return s.GetByID(createdID)
}

func (s *PurchaseOrderService) UpdateStatus(id uint, userID uint, status string) (*models.PurchaseOrder, error) {
	st := models.POStatus(strings.ToUpper(strings.TrimSpace(status)))
	if st == models.POReceived {
		return s.ReceiveItems(id, userID, ReceivePOInput{})
	}
	if st != models.POPending && st != models.POOrdered && st != models.POCancelled {
		return nil, errors.New("status PO tidak valid")
	}

	var po models.PurchaseOrder
	if err := s.db.First(&po, id).Error; err != nil {
		return nil, errors.New("Purchase Order tidak ditemukan")
	}
	if po.Status == models.POReceived {
		return nil, errors.New("Purchase Order yang sudah diterima (RECEIVED) tidak dapat diubah statusnya")
	}

	if err := s.db.Model(&po).Update("status", st).Error; err != nil {
		return nil, err
	}
	return s.GetByID(id)
}

func (s *PurchaseOrderService) ReceiveItems(id uint, userID uint, in ReceivePOInput) (*models.PurchaseOrder, error) {
	customMap := make(map[uint]ReceivePOItemInput)
	for _, ri := range in.Items {
		customMap[ri.ProductID] = ri
	}

	var po models.PurchaseOrder
	now := time.Now()
	err := s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Preload("Items").Preload("Supplier").First(&po, id).Error; err != nil {
			return errors.New("Purchase Order tidak ditemukan")
		}
		if po.Status == models.POReceived {
			return errors.New("Purchase Order ini sudah dikonfirmasi diterima sebelumnya")
		}
		if po.Status == models.POCancelled {
			return errors.New("Purchase Order yang sudah dibatalkan tidak dapat diterima")
		}

		var newTotal float64

		for _, item := range po.Items {
			recQty := item.Qty
			modalPtr := item.PriceModal

			if custom, ok := customMap[item.ProductID]; ok {
				if custom.ReceivedQty >= 0 {
					recQty = custom.ReceivedQty
				}
				if custom.PriceModal != nil {
					modalPtr = custom.PriceModal
				}
			}

			if err := tx.Model(&models.PurchaseOrderItem{}).
				Where("id = ?", item.ID).
				Updates(map[string]interface{}{
					"received_qty": recQty,
					"price_modal":  modalPtr,
				}).Error; err != nil {
				return err
			}

			if modalPtr != nil {
				newTotal += (*modalPtr) * float64(recQty)
			}

			if recQty > 0 {
				updates := map[string]interface{}{
					"stock": gorm.Expr("stock + ?", recQty),
				}
				if modalPtr != nil && *modalPtr > 0 {
					updates["price_buy"] = *modalPtr
				}
				if err := tx.Model(&models.Product{}).
					Where("id = ?", item.ProductID).
					Updates(updates).Error; err != nil {
					return err
				}

				mv := models.InventoryMovement{
					ProductID: item.ProductID,
					UserID:    userID,
					Type:      models.MovementInbound,
					Quantity:  recQty,
					Notes:     fmt.Sprintf("Penerimaan Purchase Order %s dari Supplier %s (%d/%d unit)", po.PONumber, po.Supplier.Name, recQty, item.Qty),
				}
				if err := tx.Create(&mv).Error; err != nil {
					return err
				}
			}
		}

		updatedNote := po.Note
		if strings.TrimSpace(in.Note) != "" {
			updatedNote = strings.TrimSpace(po.Note + " [Diterima: " + strings.TrimSpace(in.Note) + "]")
		}

		return tx.Model(&po).Updates(map[string]interface{}{
			"status":      models.POReceived,
			"received_at": &now,
			"total":       newTotal,
			"note":        updatedNote,
		}).Error
	})
	if err != nil {
		return nil, err
	}

	return s.GetByID(id)
}
