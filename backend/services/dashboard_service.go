package services

import (
	"fmt"
	"time"

	"backend/models"

	"gorm.io/gorm"
)

type DashboardService struct {
	db *gorm.DB
}

func NewDashboardService(db *gorm.DB) *DashboardService {
	return &DashboardService{db: db}
}

type MonthlyChartPoint struct {
	Bulan string  `json:"bulan"`
	Omset float64 `json:"omset"`
}

type DashboardSummary struct {
	TotalSales             float64             `json:"total_sales"`
	TotalSalesToday        float64             `json:"total_sales_today"`
	TotalSalesMonth        float64             `json:"total_sales_month"`
	TotalOrders            int64               `json:"total_orders"`
	TotalTransactionsToday int64               `json:"total_transactions_today"`
	TotalCustomers         int64               `json:"total_customers"`
	ActiveProducts         int64               `json:"active_products"`
	TotalStock             int64               `json:"total_stock"`
	ActiveDeliveriesCount  int64               `json:"active_deliveries_count"`
	LowStockCount          int64               `json:"low_stock_count"`
	LowStockProducts       int64               `json:"low_stock_products"`
	TodayAttendancesCount  int64               `json:"today_attendances_count"`
	TodayAttendancesList   []models.Attendance `json:"today_attendances_list"`
	MonthlyChart           []MonthlyChartPoint `json:"monthly_chart"`
	MonthlySales           []MonthlyChartPoint `json:"monthly_sales"`
	MyActiveDeliveries     int64               `json:"my_active_deliveries"`
	MyCompletedDeliveries  int64               `json:"my_completed_deliveries"`
	TodayAttendanceStatus  string              `json:"today_attendance_status"`
	MonthlyAttendanceDays  int64               `json:"monthly_attendance_days"`
	ActiveDeliveriesList   []models.Delivery   `json:"active_deliveries_list"`
}

func (s *DashboardService) GetSummary(role string, userID uint) (*DashboardSummary, error) {
	now := time.Now()

	// Jika role adalah EMPLOYEE (Kurir/Staf Lapangan), jangan bocorkan data finansial/omset toko!
	if role == "EMPLOYEE" {
		var myActive int64
		s.db.Model(&models.Delivery{}).
			Where("(driver_id = ? OR driver_id = 0) AND status IN ?", userID, []models.DeliveryStatus{
				models.DeliveryScheduled,
				models.DeliveryPreparing,
				models.DeliveryInDelivery,
			}).
			Count(&myActive)

		var myCompleted int64
		s.db.Model(&models.Delivery{}).
			Where("driver_id = ? AND status = ?", userID, models.DeliveryCompleted).
			Count(&myCompleted)

		var activeList []models.Delivery
		s.db.Preload("Transaction").
			Preload("Transaction.Customer").
			Preload("Items").
			Preload("Items.Product").
			Where("(driver_id = ? OR driver_id = 0) AND status IN ?", userID, []models.DeliveryStatus{
				models.DeliveryScheduled,
				models.DeliveryPreparing,
				models.DeliveryInDelivery,
			}).
			Order("created_at DESC").
			Limit(5).
			Find(&activeList)

		todayStatus := "BELUM_ABSEN"
		var monthlyDays int64
		var emp models.Employee
		if err := s.db.Where("user_id = ?", userID).First(&emp).Error; err == nil {
			startOfDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.Local)
			var todayAtts []models.Attendance
			s.db.Where("employee_id = ? AND timestamp >= ?", emp.ID, startOfDay).
				Order("timestamp DESC").
				Find(&todayAtts)
			if len(todayAtts) > 0 {
				if todayAtts[0].Type == models.CheckOut {
					todayStatus = "SUDAH_PULANG"
				} else {
					todayStatus = "SUDAH_MASUK"
				}
			}

			startOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.Local)
			s.db.Model(&models.Attendance{}).
				Where("employee_id = ? AND type = ? AND timestamp >= ?", emp.ID, models.CheckIn, startOfMonth).
				Count(&monthlyDays)
		}

		return &DashboardSummary{
			MyActiveDeliveries:    myActive,
			MyCompletedDeliveries: myCompleted,
			TodayAttendanceStatus: todayStatus,
			MonthlyAttendanceDays: monthlyDays,
			ActiveDeliveriesList:  activeList,
			MonthlyChart:          []MonthlyChartPoint{},
		}, nil
	}

	var totalSales float64
	s.db.Model(&models.Transaction{}).
		Where("status != ?", models.StatusCancelled).
		Select("COALESCE(SUM(total), 0)").
		Scan(&totalSales)

	startOfDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.Local)
	startOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.Local)

	var totalSalesToday float64
	s.db.Model(&models.Transaction{}).
		Where("status != ? AND created_at >= ?", models.StatusCancelled, startOfDay).
		Select("COALESCE(SUM(total), 0)").
		Scan(&totalSalesToday)

	var totalSalesMonth float64
	s.db.Model(&models.Transaction{}).
		Where("status != ? AND created_at >= ?", models.StatusCancelled, startOfMonth).
		Select("COALESCE(SUM(total), 0)").
		Scan(&totalSalesMonth)

	var totalOrders int64
	s.db.Model(&models.Transaction{}).
		Where("status != ?", models.StatusCancelled).
		Count(&totalOrders)

	var totalTrxToday int64
	s.db.Model(&models.Transaction{}).
		Where("status != ? AND created_at >= ?", models.StatusCancelled, startOfDay).
		Count(&totalTrxToday)

	var totalCustomers int64
	s.db.Model(&models.Customer{}).Count(&totalCustomers)

	var activeProducts int64
	s.db.Model(&models.Product{}).Where("is_active = ?", true).Count(&activeProducts)

	var totalStock int64
	s.db.Model(&models.Product{}).Where("is_active = ?", true).Select("COALESCE(SUM(stock), 0)").Scan(&totalStock)

	var activeDeliveriesCount int64
	s.db.Model(&models.Delivery{}).
		Where("status IN ?", []models.DeliveryStatus{
			models.DeliveryScheduled,
			models.DeliveryPreparing,
			models.DeliveryInDelivery,
		}).
		Count(&activeDeliveriesCount)

	var todayAttList []models.Attendance
	s.db.Preload("Employee").
		Preload("Employee.User").
		Preload("Employee.User.Role").
		Where("timestamp >= ?", startOfDay).
		Order("timestamp DESC").
		Limit(10).
		Find(&todayAttList)

	var todayAttCount int64
	s.db.Model(&models.Attendance{}).
		Where("timestamp >= ? AND type = ?", startOfDay, models.CheckIn).
		Count(&todayAttCount)

	var lowStockCount int64
	s.db.Model(&models.Product{}).
		Where("is_active = ? AND stock <= min_stock", true).
		Count(&lowStockCount)

	monthNames := []string{"Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"}
	chart := make([]MonthlyChartPoint, 0, 6)

	for i := 5; i >= 0; i-- {
		target := now.AddDate(0, -i, 0)
		start := time.Date(target.Year(), target.Month(), 1, 0, 0, 0, 0, time.Local)
		end := start.AddDate(0, 1, 0)

		var omset float64
		s.db.Model(&models.Transaction{}).
			Where("status != ? AND created_at >= ? AND created_at < ?", models.StatusCancelled, start, end).
			Select("COALESCE(SUM(total), 0)").
			Scan(&omset)

		chart = append(chart, MonthlyChartPoint{
			Bulan: fmt.Sprintf("%s", monthNames[int(target.Month())-1]),
			Omset: omset,
		})
	}

	return &DashboardSummary{
		TotalSales:             totalSales,
		TotalSalesToday:        totalSalesToday,
		TotalSalesMonth:        totalSalesMonth,
		TotalOrders:            totalOrders,
		TotalTransactionsToday: totalTrxToday,
		TotalCustomers:         totalCustomers,
		ActiveProducts:         activeProducts,
		TotalStock:             totalStock,
		ActiveDeliveriesCount:  activeDeliveriesCount,
		LowStockCount:          lowStockCount,
		LowStockProducts:       lowStockCount,
		TodayAttendancesCount:  todayAttCount,
		TodayAttendancesList:   todayAttList,
		MonthlyChart:           chart,
		MonthlySales:           chart,
	}, nil
}
