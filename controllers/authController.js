const {
    registrarEmpleado,
    obtenerEmpleadoPorUsuario,
    verificarPassword,
    getEmpleadoPorId,
    getHistorialAsistenciaPorEmpleado,
} = require('../db/models');
const QRCode = require('qrcode');

// ─────────────────────────────────────────────
// GET /auth/login-empleado
// ─────────────────────────────────────────────
const getLoginEmpleado = (req, res) => {
    if (req.session && req.session.userId) {
        return res.redirect('/auth/panel-empleado');
    }
    res.render('login-empleado', { error: req.query.error || null });
};

// ─────────────────────────────────────────────
// POST /auth/login-empleado
// ─────────────────────────────────────────────
const postLoginEmpleado = async (req, res) => {
    const { usuario, password } = req.body;

    if (!usuario || !password) {
        return res.redirect('/auth/login-empleado?error=missingFields');
    }

    try {
        const empleado = await obtenerEmpleadoPorUsuario(usuario);

        if (!empleado) {
            return res.redirect('/auth/login-empleado?error=employeeNotFound');
        }

        const passwordValido = await verificarPassword(password, empleado.password_hash);

        if (!passwordValido) {
            return res.redirect('/auth/login-empleado?error=incorrectPassword');
        }

        // Regenerar sesión para prevenir session fixation
        req.session.regenerate((err) => {
            if (err) {
                console.error('Error al regenerar sesión:', err);
                return res.redirect('/auth/login-empleado?error=loginFailed');
            }
            req.session.userId = empleado.id;
            req.session.nombreEmpleado = empleado.nombre;
            req.session.empleadoApellido = empleado.apellido;
            res.redirect('/auth/panel-empleado');
        });

    } catch (error) {
        console.error('Error al iniciar sesión de empleado:', error);
        res.redirect('/auth/login-empleado?error=loginFailed');
    }
};

// ─────────────────────────────────────────────
// GET /auth/registro-empleado
// ─────────────────────────────────────────────
const getRegistroEmpleado = (req, res) => {
    res.render('registro-empleado', { error: req.query.error || null });
};

// ─────────────────────────────────────────────
// POST /auth/registro-empleado
// ─────────────────────────────────────────────
const postRegistroEmpleado = async (req, res) => {
    const { usuario, password, confirm_password, nombre, apellido, cedula, cargo, departamento, telefono, correo } = req.body;

    if (!usuario || !password || !confirm_password || !nombre || !apellido || !cedula || !correo) {
        return res.redirect('/auth/registro-empleado?error=missingFields');
    }

    if (password !== confirm_password) {
        return res.redirect('/auth/registro-empleado?error=passwordMismatch');
    }

    try {
        const empleadoId = await registrarEmpleado(
            usuario, password, nombre, apellido,
            parseInt(cedula), cargo, departamento,
            parseInt(telefono), correo
        );

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
};

// ─────────────────────────────────────────────
// GET /auth/logout
// ─────────────────────────────────────────────
const getLogout = (req, res, next) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error al destruir la sesión:', err);
            return next(err);
        }
        res.clearCookie('connect.sid');
        res.redirect('/auth/login-empleado');
    });
};

// ─────────────────────────────────────────────
// GET /auth/panel-empleado
// ─────────────────────────────────────────────
const getPanelEmpleado = async (req, res) => {
    try {
        const empleado = await getEmpleadoPorId(req.session.userId);
        let qrCodeUrl = null;

        if (empleado && empleado.cedula) {
            qrCodeUrl = await QRCode.toDataURL(`ID:${empleado.id}|CI:${empleado.cedula}`);
        }

        res.render('panel-empleado', {
            empleado,
            qrCodeUrl,
            message: req.session.message || null
        });

        delete req.session.message;

    } catch (error) {
        console.error('Error al cargar el panel del empleado:', error);
        req.session.message = { type: 'danger', text: 'No se pudo cargar tu panel. Por favor, intenta de nuevo.' };
        res.redirect('/auth/login-empleado');
    }
};

// ─────────────────────────────────────────────
// GET /auth/historial-asistencia
// ─────────────────────────────────────────────
const getHistorialPropio = async (req, res) => {
    try {
        const historial = await getHistorialAsistenciaPorEmpleado(req.session.userId);
        res.render('historial-asistencia', { historial, error: null });
    } catch (error) {
        console.error('Error al obtener historial de asistencia del empleado:', error);
        res.render('historial-asistencia', { historial: [], error: 'Error al cargar tu historial de asistencia.' });
    }
};

module.exports = {
    getLoginEmpleado,
    postLoginEmpleado,
    getRegistroEmpleado,
    postRegistroEmpleado,
    getLogout,
    getPanelEmpleado,
    getHistorialPropio,
};
