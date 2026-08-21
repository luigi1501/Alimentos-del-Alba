// routes/index.js
const express = require('express');
const router = express.Router();
const { isAdmin } = require('../middleware/authMiddleware');
const { loginLimiter } = require('../config/rateLimit');
const adminController = require('../controllers/adminController');
const attendanceController = require('../controllers/attendanceController');

// ── Página de inicio ───────────────────────────────────────────
router.get('/', (req, res) => res.render('index'));

// ── Login admin ────────────────────────────────────────────────
router.get('/login', adminController.getLogin);
router.post('/login', loginLimiter, adminController.postLogin);

// ── Panel admin (protegido con middleware isAdmin) ─────────────
router.get('/admin', isAdmin, adminController.getAdmin);

// ── Tabla general de empleados (protegido) ─────────────────────
router.get('/tabGeneral', isAdmin, adminController.getTabGeneral);

// ── CRUD de empleados (protegido) ──────────────────────────────
router.post('/guardarEmpleado', isAdmin, adminController.postGuardarEmpleado);
router.get('/editempleado/:id', isAdmin, adminController.getEditEmpleado);
router.post('/updateempleado/:id', isAdmin, adminController.postUpdateEmpleado);

// CORREGIDO: era router.get → ahora router.post para prevenir CSRF
router.post('/deleteempleado/:id', isAdmin, adminController.postDeleteEmpleado);

// ── Asistencia ─────────────────────────────────────────────────
router.get('/escanear-asistencia', adminController.getEscanearAsistencia);
router.post('/registrar-asistencia', attendanceController.registrarAsistenciaQR);
router.get('/historial-asistencia', attendanceController.mostrarHistorialAsistencia);

module.exports = router;