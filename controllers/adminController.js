const db = require('../db/models');

// ─────────────────────────────────────────────
// GET /login
// ─────────────────────────────────────────────
const getLogin = (req, res) => {
    if (req.session && req.session.loggedIn && req.session.isAdmin) {
        return res.redirect('/admin');
    }
    res.render('login', { error: req.query.error || null });
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
        // Regenerar sesión para prevenir session fixation
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
const getAdmin = (req, res) => {
    res.render('admin');
};

// ─────────────────────────────────────────────
// GET /tabGeneral
// ─────────────────────────────────────────────
const getTabGeneral = async (req, res) => {
    try {
        const empleados = await db.getempleados();
        res.render('tabGeneral', { empleados });
    } catch (err) {
        console.error('Error al obtener empleados:', err);
        res.render('tabGeneral', { empleados: [] });
    }
};

// ─────────────────────────────────────────────
// POST /guardarEmpleado
// Corrección crítica: el admin asigna contraseña temporal obligatoria
// ─────────────────────────────────────────────
const postGuardarEmpleado = async (req, res) => {
    const { usuario, password, nombre, apellido, cedula, cargo, departamento, telefono, correo } = req.body;

    if (!usuario || !password) {
        return res.redirect('/tabGeneral?error=missingPasswordOrUser');
    }

    try {
        await db.registrarEmpleado(
            usuario, password, nombre, apellido,
            parseInt(cedula), cargo, departamento,
            parseInt(telefono), correo
        );
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
    const { usuario, nombre, apellido, cedula, cargo, departamento, telefono, correo, qr_code } = req.body;

    try {
        await db.updateempleados(
            id, usuario, nombre, apellido,
            parseInt(cedula), cargo, departamento,
            parseInt(telefono), correo, qr_code
        );
        res.redirect('/tabGeneral');
    } catch (err) {
        console.error('Error al actualizar empleado:', err);
        res.redirect('/tabGeneral?error=updateFailed');
    }
};

// ─────────────────────────────────────────────
// POST /deleteempleado/:id  (era GET — corregido)
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
