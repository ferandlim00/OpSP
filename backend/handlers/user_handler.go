package handlers

import (
	"strconv"

	"backend/services"
	"backend/utils"

	"github.com/gofiber/fiber/v2"
)

type UserHandler struct {
	userService *services.UserService
}

func NewUserHandler(userService *services.UserService) *UserHandler {
	return &UserHandler{userService: userService}
}

// GET /api/users
func (h *UserHandler) GetAllUsers(c *fiber.Ctx) error {
	users, err := h.userService.GetAllUsers()
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "Gagal mengambil data user", err.Error())
	}
	return utils.SuccessResponse(c, fiber.StatusOK, "Berhasil mengambil daftar user", users)
}

// GET /api/roles
func (h *UserHandler) GetRoles(c *fiber.Ctx) error {
	roles, err := h.userService.GetRoles()
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "Gagal mengambil data role", err.Error())
	}
	return utils.SuccessResponse(c, fiber.StatusOK, "Berhasil mengambil daftar role", roles)
}

// POST /api/users
func (h *UserHandler) CreateUser(c *fiber.Ctx) error {
	var input services.CreateUserInput
	if err := c.BodyParser(&input); err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "Format input tidak valid", err.Error())
	}

	if input.Name == "" || input.Username == "" || input.Password == "" || input.RoleID == 0 {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "Nama, username, password, dan role wajib diisi", nil)
	}

	user, err := h.userService.CreateUser(input)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, err.Error(), nil)
	}

	return utils.SuccessResponse(c, fiber.StatusCreated, "User berhasil dibuat!", user)
}

// PUT /api/users/:id
func (h *UserHandler) UpdateUser(c *fiber.Ctx) error {
	idParam := c.Params("id")
	id, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "ID tidak valid", nil)
	}

	var input services.UpdateUserInput
	if err := c.BodyParser(&input); err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "Format input tidak valid", err.Error())
	}

	if input.Name == "" || input.RoleID == 0 {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "Nama dan role wajib diisi", nil)
	}

	user, err := h.userService.UpdateUser(uint(id), input)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, err.Error(), nil)
	}

	return utils.SuccessResponse(c, fiber.StatusOK, "User berhasil diperbarui!", user)
}

// DELETE /api/users/:id
func (h *UserHandler) DeleteUser(c *fiber.Ctx) error {
	idParam := c.Params("id")
	id, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		return utils.ErrorResponse(c, fiber.StatusBadRequest, "ID tidak valid", nil)
	}

	if err := h.userService.DeleteUser(uint(id)); err != nil {
		return utils.ErrorResponse(c, fiber.StatusInternalServerError, "Gagal menghapus user", err.Error())
	}

	return utils.SuccessResponse(c, fiber.StatusOK, "User berhasil dihapus!", nil)
}
