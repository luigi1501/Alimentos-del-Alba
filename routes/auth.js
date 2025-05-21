const express = require('express');
const router = express.Router();
const { registrarEmpleado, obtenerEmpleadoPorUsuario, verificarPassword, getEmpleadoPorId, updateempleados } = require('../db/models');
const db = require('../db/connection');
const { isAuthenticated, isAdmin } = require('../middleware/authMiddleware');

router.get('/login-empleado', (req, res) => {
    if (req.session && req.session.userId) {
        return res.redirect('/panel-empleado');
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
                res.redirect('/panel-empleado');
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


module.exports = router;