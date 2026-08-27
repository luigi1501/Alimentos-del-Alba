// routes/auth.js
const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/authMiddleware');
const { loginLimiter } = require('../config/rateLimit');
const upload = require('../config/multer');
const authController = require('../controllers/authController');
const employeeActions = require('../controllers/employeeActions');

// ── Autenticación ──────────────────────────────────────────────
router.get('/login-empleado', authController.getLoginEmpleado);
router.post('/login-empleado', loginLimiter, authController.postLoginEmpleado);

// ── Registro ───────────────────────────────────────────────────
router.get('/registro-empleado', authController.getRegistroEmpleado);
router.post('/registro-empleado', authController.postRegistroEmpleado);
router.get('/verificar-usuario', authController.verificarUsuarioDisponibilidad);
router.get('/verificar-correo', authController.verificarCorreoDisponibilidad);
router.get('/verificar-cedula', authController.verificarCedulaDisponibilidad);

// ── Logout ─────────────────────────────────────────────────────
router.get('/logout', authController.getLogout);

// ── Panel del empleado (protegido) ─────────────────────────────
router.get('/panel-empleado', isAuthenticated, authController.getPanelEmpleado);

// ── Historial propio (protegido) ───────────────────────────────
router.get('/historial-asistencia', isAuthenticated, authController.getHistorialPropio);

// ── Foto de perfil (protegido) ─────────────────────────────────
router.post(
    '/empleados/perfil/upload-foto',
    isAuthenticated,
    upload.single('profilePic'),
    employeeActions.uploadProfilePhoto
);

// ── Descarga QR PDF (protegido) ────────────────────────────────
router.get('/descargar-qr-pdf', isAuthenticated, employeeActions.downloadQrPdf);

module.exports = router;