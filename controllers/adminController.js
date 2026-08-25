const db = require('../db/models');

// ─────────────────────────────────────────────
// GET /login
// ─────────────────────────────────────────────
const getLogin = (req, res) => {
    if (req.session && req.session.loggedIn && req.session.isAdmin) {
        return res.redirect('/admin');
    }
    res.render('login', {
        error: req.query.error || null,
        logout: req.query.logout || null
    });
};

// ─────────────────────────────────────────────
// POST /login
// ─────────────────────────────────────────────
const postLogin = (req, res) => {
    const { user, password } = req.body;

    if (!user || !password) {
        return res.redirect('/login?error=missingFields');
    }

    const expectedUser = process.env.ADMIN_USER || process.env.USER || 'admin';
    const expectedPass = process.env.ADMIN_PASS || process.env.PASS || 'admin123';

    if (user === expectedUser && password === expectedPass) {
        req.session.regenerate((err) => {
            if (err) {
                console.error('Error al regenerar sesión admin:', err);
                return res.redirect('/login?error=loginFailed');
            }
            req.session.loggedIn = true;
            req.session.isAdmin = true;
            res.redirect('/admin');
        });
    } else {
        res.redirect('/login?error=incorrectCredentials');
    }
};

// ─────────────────────────────────────────────
// GET /admin
// ─────────────────────────────────────────────
const getAdmin = async (req, res) => {
    try {
        const empleados = await db.getempleados();
        const historial = await db.getHistorialAsistencia();
        const empleadoMasResponsable = await db.getEmpleadoMasResponsable();

        const totalEmpleados = empleados.length;
        const qrHabilitados = empleados.filter(e => e.tipo_jornada && e.tipo_jornada.trim() !== '').length;
        const totalMarcajes = historial.length;

        res.render('admin', {
            stats: {
                totalEmpleados,
                qrHabilitados,
                totalMarcajes
            },
            empleadoMasResponsable,
            message: req.session.message || null
        });

        delete req.session.message;
    } catch (error) {
        console.error('Error al cargar panel admin:', error);
        res.render('admin', { stats: { totalEmpleados: 0, qrHabilitados: 0, totalMarcajes: 0 }, message: null });
    }
};

// ─────────────────────────────────────────────
// GET /tabGeneral
// ─────────────────────────────────────────────
const getTabGeneral = async (req, res) => {
    try {
        const empleados = await db.getempleados();
        const totalEmpleados = empleados.length;
        const qrHabilitados = empleados.filter(e => e.tipo_jornada && e.tipo_jornada.trim() !== '').length;
        const pendientesJornada = totalEmpleados - qrHabilitados;

        res.render('tabGeneral', {
            empleados,
            stats: {
                totalEmpleados,
                qrHabilitados,
                pendientesJornada
            },
            message: req.session.message || null
        });

        delete req.session.message;
    } catch (err) {
        console.error('Error al obtener empleados:', err);
        res.render('tabGeneral', { empleados: [], stats: { totalEmpleados: 0, qrHabilitados: 0, pendientesJornada: 0 }, message: null });
    }
};

// ─────────────────────────────────────────────
// POST /guardarEmpleado
// ─────────────────────────────────────────────
const postGuardarEmpleado = async (req, res) => {
    const { usuario, password, nombre, apellido, cedula, cargo, departamento, telefono, correo, tipo_jornada, estatus_empleado, estatus_desde, estatus_hasta, estatus_observacion } = req.body;

    if (!usuario || !password) {
        return res.redirect('/tabGeneral?error=missingPasswordOrUser');
    }

    const jornadaFinal    = (tipo_jornada && tipo_jornada.trim() !== '') ? tipo_jornada.trim() : 'Lunes a Viernes (8:00 AM - 5:00 PM)';
    const estatusFinal    = estatus_empleado || 'Activo';
    const estatusDesde    = (estatusFinal !== 'Activo' && estatus_desde)    ? estatus_desde    : null;
    const estatusHasta    = (estatusFinal !== 'Activo' && estatus_hasta)    ? estatus_hasta    : null;
    const estatusObs      = (estatusFinal !== 'Activo' && estatus_observacion) ? estatus_observacion.trim() : null;

    try {
        await db.registrarEmpleado(
            usuario, password, nombre, apellido,
            parseInt(cedula), cargo, departamento,
            parseInt(telefono), correo, jornadaFinal, estatusFinal, estatusDesde, estatusHasta, estatusObs
        );

        req.session.message = {
            type: 'success',
            text: `Empleado ${nombre} ${apellido || ''} registrado. Jornada: "${jornadaFinal}" | Estatus: ${estatusFinal}. ¡Código QR habilitado!`
        };
        res.redirect('/tabGeneral');
    } catch (err) {
        console.error('Error al guardar empleado:', err);
        let errorParam = 'guardarFailed';
        if (err.message.includes('UNIQUE constraint failed: empleados.usuario')) {
            errorParam = 'usernameTaken';
        } else if (err.message.includes('UNIQUE constraint failed: empleados.correo')) {
            errorParam = 'emailTaken';
        } else if (err.message === 'La cédula ya está registrada.') {
            errorParam = 'cedulaTaken';
        }
        res.redirect(`/tabGeneral?error=${errorParam}`);
    }
};

// ─────────────────────────────────────────────
// GET /editempleado/:id
// ─────────────────────────────────────────────
const getEditEmpleado = async (req, res) => {
    try {
        const empleado = await db.getempleadosID(req.params.id);
        if (!empleado) {
            return res.redirect('/tabGeneral?error=empleadoNotFound');
        }
        res.render('editarempleado', { empleado });
    } catch (err) {
        console.error('Error al obtener empleado para editar:', err);
        res.redirect('/tabGeneral?error=editFailed');
    }
};

// ─────────────────────────────────────────────
// POST /updateempleado/:id
// ─────────────────────────────────────────────
const postUpdateEmpleado = async (req, res) => {
    const { id } = req.params;
    const { usuario, nombre, apellido, cedula, cargo, departamento, telefono, correo, qr_code, tipo_jornada, estatus_empleado, estatus_desde, estatus_hasta, estatus_observacion } = req.body;

    const jornadaFinal = (tipo_jornada && tipo_jornada.trim() !== '') ? tipo_jornada.trim() : 'Lunes a Viernes (8:00 AM - 5:00 PM)';
    const estatusFinal = estatus_empleado || 'Activo';
    const estatusDesde = (estatusFinal !== 'Activo' && estatus_desde)       ? estatus_desde       : null;
    const estatusHasta = (estatusFinal !== 'Activo' && estatus_hasta)       ? estatus_hasta       : null;
    const estatusObs   = (estatusFinal !== 'Activo' && estatus_observacion) ? estatus_observacion.trim() : null;

    try {
        const empleadoActual = await db.getempleadosID(id);
        const fotoPerfil = empleadoActual ? empleadoActual.foto_perfil : null;

        await db.updateempleados(
            id, usuario, nombre, apellido,
            parseInt(cedula), cargo, departamento,
            parseInt(telefono), correo, qr_code, fotoPerfil, jornadaFinal, estatusFinal, estatusDesde, estatusHasta, estatusObs
        );

        req.session.message = {
            type: 'success',
            text: `Empleado ${nombre} actualizado. Jornada: "${jornadaFinal}" | Estatus: ${estatusFinal}.`
        };
        res.redirect('/tabGeneral');
    } catch (err) {
        console.error('Error al actualizar empleado:', err);
        res.redirect('/tabGeneral?error=updateFailed');
    }
};

// ─────────────────────────────────────────────
// POST /deleteempleado/:id
// ─────────────────────────────────────────────
const postDeleteEmpleado = async (req, res) => {
    const { id } = req.params;

    try {
        await db.deleteempleados(id);
        const empleadosGeneral = await db.getempleados();
        res.json({ success: true, empleadosGeneral });
    } catch (err) {
        console.error('Error al eliminar empleado:', err);
        res.status(500).json({ success: false, error: err.message });
    }
};

// ─────────────────────────────────────────────
// GET /escanear-asistencia
// ─────────────────────────────────────────────
const getEscanearAsistencia = (req, res) => {
    res.render('escanear-asistencia', { title: 'Escanear Asistencia' });
};

module.exports = {
    getLogin,
    postLogin,
    getAdmin,
    getTabGeneral,
    postGuardarEmpleado,
    getEditEmpleado,
    postUpdateEmpleado,
    postDeleteEmpleado,
    getEscanearAsistencia,
};
