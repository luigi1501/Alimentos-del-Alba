const {
    registrarEmpleado,
    obtenerEmpleadoPorUsuario,
    obtenerEmpleadoPorCorreo,
    verificarPassword,
    getEmpleadoPorId,
    getHistorialAsistenciaPorEmpleado,
    verificarEstadoQrEmpleado,
    getEmpleadoMasResponsable,
} = require('../db/models');
const { formatFecha } = require('../utils/dateUtils');
const QRCode = require('qrcode');

// ─────────────────────────────────────────────
// GET /auth/login-empleado
// ─────────────────────────────────────────────
const getLoginEmpleado = (req, res) => {
    if (req.session && req.session.userId) {
        return res.redirect('/auth/panel-empleado');
    }
    res.render('login-empleado', {
        error: req.query.error || null,
        logout: req.query.logout || null
    });
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
    const { usuario, password, confirm_password, nombre, apellido, cedula, cargo, departamento, telefono, correo, tipo_jornada, estatus_empleado } = req.body;

    if (!usuario || !password || !confirm_password || !nombre || !apellido || !cedula || !correo) {
        return res.redirect('/auth/registro-empleado?error=missingFields');
    }

    if (password !== confirm_password) {
        return res.redirect('/auth/registro-empleado?error=passwordMismatch');
    }

    const jornadaFinal = (tipo_jornada && tipo_jornada.trim() !== '') 
        ? tipo_jornada.trim() 
        : '';
    const estatusFinal = estatus_empleado || 'Activo';

    try {
        const empleadoId = await registrarEmpleado(
            usuario, password, nombre, apellido,
            parseInt(cedula), cargo, departamento,
            parseInt(telefono), correo, jornadaFinal, estatusFinal
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
    const esAdmin = Boolean(req.session && (req.session.isAdmin || req.session.loggedIn));
    
    req.session.destroy((err) => {
        if (err) {
            console.error('Error al destruir la sesión:', err);
            return next(err);
        }
        res.clearCookie('connect.sid');
        if (esAdmin) {
            return res.redirect('/login?logout=success');
        } else {
            return res.redirect('/auth/login-empleado?logout=success');
        }
    });
};

// ─────────────────────────────────────────────
// GET /auth/panel-empleado
// ─────────────────────────────────────────────
const getPanelEmpleado = async (req, res) => {
    try {
        const empleado = await getEmpleadoPorId(req.session.userId);
        const estadoQr = await verificarEstadoQrEmpleado(req.session.userId);
        const topEmpleado = await getEmpleadoMasResponsable();
        const esElMasResponsable = Boolean(topEmpleado && topEmpleado.id === req.session.userId);

        let qrCodeUrl = null;
        if (empleado && empleado.cedula && estadoQr.qrHabilitado) {
            qrCodeUrl = await QRCode.toDataURL(`ID:${empleado.id}|CI:${empleado.cedula}`);
        }

        res.render('panel-empleado', {
            empleado,
            qrCodeUrl,
            estadoQr,
            esElMasResponsable,
            topEmpleado,
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
        const empleado = await getEmpleadoPorId(req.session.userId);
        const historialRaw = await getHistorialAsistenciaPorEmpleado(req.session.userId);

        const historial = (historialRaw || []).map(registro => ({
            ...registro,
            fechaFormatted: formatFecha(registro.fecha) || registro.fecha,
            horaEntradaFormatted: registro.hora_entrada || 'N/A',
            horaSalidaFormatted: registro.hora_salida || 'N/A'
        }));

        res.render('historial-empleado', { empleado, historial, error: null });
    } catch (error) {
        console.error('Error al obtener historial de asistencia del empleado:', error);
        res.render('historial-empleado', { empleado: null, historial: [], error: 'Error al cargar tu historial de asistencia.' });
    }
};

// GET /auth/verificar-usuario
// ─────────────────────────────────────────────
const verificarUsuarioDisponibilidad = async (req, res) => {
    try {
        const usuarioInput = req.query.usuario ? req.query.usuario.trim() : '';
        if (!usuarioInput) {
            return res.json({ available: false, message: 'Ingresa un nombre de usuario.' });
        }

        if (usuarioInput.toLowerCase() === 'admin') {
            return res.json({ available: false, message: 'El nombre de usuario "admin" está reservado para el sistema.' });
        }

        const empleadoExistente = await obtenerEmpleadoPorUsuario(usuarioInput);
        if (empleadoExistente) {
            return res.json({ available: false, message: 'Este nombre de usuario ya está registrado por otro empleado.' });
        }

        return res.json({ available: true, message: '¡Genial! Este nombre de usuario está disponible.' });
    } catch (error) {
        console.error('Error verificando disponibilidad de usuario:', error);
        return res.status(500).json({ available: false, message: 'Error al comprobar disponibilidad.' });
    }
};

// GET /auth/verificar-correo
// ─────────────────────────────────────────────
const verificarCorreoDisponibilidad = async (req, res) => {
    try {
        const correoInput = req.query.correo ? req.query.correo.trim() : '';
        if (!correoInput) {
            return res.json({ available: false, message: 'Ingresa un correo electrónico.' });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(correoInput)) {
            return res.json({ available: false, message: 'Formato de correo electrónico inválido.' });
        }

        const empleadoExistente = await obtenerEmpleadoPorCorreo(correoInput);
        if (empleadoExistente) {
            return res.json({ available: false, message: 'Este correo electrónico ya está registrado por otro empleado.' });
        }

        return res.json({ available: true, message: '¡Genial! Este correo electrónico está disponible.' });
    } catch (error) {
        console.error('Error verificando disponibilidad de correo:', error);
        return res.status(500).json({ available: false, message: 'Error al comprobar disponibilidad.' });
    }
};

module.exports = {
    getLoginEmpleado,
    postLoginEmpleado,
    getRegistroEmpleado,
    postRegistroEmpleado,
    verificarUsuarioDisponibilidad,
    verificarCorreoDisponibilidad,
    getLogout,
    getPanelEmpleado,
    getHistorialPropio,
};
