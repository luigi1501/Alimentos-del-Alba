const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { registrarEmpleado, obtenerEmpleadoPorUsuario, verificarPassword, getEmpleadoPorId, updateempleados } = require('../db/models');
const db = require('../db/connection');
const { isAuthenticated, isAdmin } = require('../middleware/authMiddleware');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const QRCode = require('qrcode');
const employeeActions = require('../controllers/employeeActions');

router.get('/login-empleado', (req, res) => {
    if (req.session && req.session.userId) {
        return res.redirect('/auth/panel-empleado');
    }
    res.render('login-empleado', { error: req.query.error });
});

router.post('/login-empleado', async (req, res) => {
    const { usuario, password } = req.body;

    try {
        const empleado = await obtenerEmpleadoPorUsuario(usuario);
        if (empleado) {
            console.log('Empleado encontrado para', usuario + ':', empleado);
            const passwordValido = await verificarPassword(password, empleado.password_hash);
            console.log('¿Contraseña válida?', passwordValido);

            if (passwordValido) {
                console.log('Inicio de sesión exitoso para:', usuario);
                req.session.userId = empleado.id;
                req.session.nombreEmpleado = empleado.nombre;
                req.session.empleadoApellido = empleado.apellido;
                res.redirect('/auth/panel-empleado');
            } else {
                console.log('Contraseña incorrecta para empleado:', usuario);
                res.redirect('/auth/login-empleado?error=incorrectPassword');
            }
        } else {
            console.log('Empleado no encontrado:', usuario);
            res.redirect('/auth/login-empleado?error=employeeNotFound');
        }
    } catch (error) {
        console.error('Error al iniciar sesión:', error);
        res.redirect('/auth/login-empleado?error=loginFailed');
    }
});

router.get('/historial-asistencia-propio', isAuthenticated, async (req, res) => {
    try {
        const historialPropio = await db.getHistorialAsistenciaPorEmpleado(req.session.userId);
        res.render('historial-asistencia', { historial: historialPropio, error: null });
    } catch (error) {
        console.error("Error al obtener el historial de asistencia del empleado:", error);
        res.render('historial-asistencia', { historial: [], error: 'Error al cargar tu historial de asistencia.' });
    }
});

router.get('/registro-empleado', (req, res) => {
    res.render('registro-empleado', { error: req.query.error });
});

router.post('/registro-empleado', async (req, res) => {
    const { usuario, password, nombre, apellido, cedula, cargo, departamento, telefono, correo } = req.body;

    try {
        const empleadoId = await registrarEmpleado(usuario, password, nombre, apellido, parseInt(cedula), cargo, departamento, parseInt(telefono), correo);
        console.log('Empleado registrado correctamente con ID:', empleadoId);
        await updateempleados(
            empleadoId,
            usuario,
            nombre, apellido, parseInt(cedula), cargo, departamento, parseInt(telefono), correo,
            String(empleadoId)
        );
        console.log(`Campo qr_code actualizado a '${empleadoId}' para el empleado ${empleadoId}`);

        res.redirect('/auth/login-empleado');

    } catch (error) {
        console.error('Error al registrar empleado:', error);
        let errorParam = 'registrationFailed';
        if (error.message.includes('UNIQUE constraint failed: empleados.usuario')) {
            errorParam = 'usernameTaken';
        } else if (error.message.includes('UNIQUE constraint failed: empleados.correo')) {
            errorParam = 'emailTaken';
        } else if (error.message === 'La cédula ya está registrada.') {
            errorParam = 'cedulaTaken';
        }
        res.redirect(`/auth/registro-empleado?error=${errorParam}`);
    }
});

router.get('/logout', (req, res, next) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Error al destruir la sesión:', err);
            return next(err);
        }
        res.clearCookie('connect.sid');
        res.redirect('/auth/login-empleado');
    });
});

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
        fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedMimes = ['image/jpeg', 'image/png', 'image/jpg'];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten imágenes JPEG, PNG o JPG.'), false);
        }
    }
});

router.post('/empleados/perfil/upload-foto', isAuthenticated, upload.single('profilePic'), employeeActions.uploadProfilePhoto);

router.get('/empleados/descargar-carnet', isAuthenticated, employeeActions.downloadCarnet);

router.get('/panel-empleado', isAuthenticated, async (req, res) => {
    try {
        const empleado = await getEmpleadoPorId(req.session.userId);
        let qrCodeUrl = null;

        if (empleado && empleado.qr_code) {
            qrCodeUrl = await QRCode.toDataURL(empleado.qr_code);
        }

        res.render('panel-empleado', {
            empleado: empleado,
            qrCodeUrl: qrCodeUrl
        });
    } catch (error) {
        console.error('Error al cargar el panel del empleado:', error);
        req.session.message = { type: 'danger', text: 'No se pudo cargar la información de tu panel. Por favor, intenta de nuevo.' };
        res.redirect('/auth/login-empleado');
    }
});

module.exports = router;