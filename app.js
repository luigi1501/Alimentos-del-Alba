const express = require('express');
const session = require('express-session');
const path = require('path');
const dotenv = require('dotenv');
const morgan = require('morgan');
const multer = require('multer');
const MemoryStore = require('memorystore')(session);

dotenv.config({ override: true });

const app = express();
const port = process.env.PORT || 3000;

// ── Confianza en proxy (para Render/Railway/Vercel/etc.) ──────
app.set('trust proxy', 1);

// ── Logging HTTP ───────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
}

// ── Inicializar modelos / conexión DB ──────────────────────────
require('./db/models');

// ── Sesiones ───────────────────────────────────────────────────
app.use(session({
    store: new MemoryStore({
        checkPeriod: 86400000 // Podar entradas expiradas cada 24h
    }),
    secret: process.env.SESSION_SECRET || 'una_cadena_secreta_de_respaldo',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production'
    }
}));

// ── Variables locales de sesión ────────────────────────────────
app.use(async (req, res, next) => {
    res.locals.userId = req.session ? req.session.userId : null;
    res.locals.isAdmin = req.session ? req.session.isAdmin : null;
    res.locals.nombreEmpleado = req.session ? req.session.nombreEmpleado : null;
    res.locals.empleadoApellido = req.session ? req.session.empleadoApellido : null;
    res.locals.message = req.session ? req.session.message : null;
    if (req.session) {
        delete req.session.message;
    }

    if (req.session && req.session.isAdmin) {
        try {
            const dbModels = require('./db/models');
            const empleados = await dbModels.getempleados();
            const historial = await dbModels.getHistorialAsistencia();

            // 1. Empleados pendientes por asignar jornada o activación
            const empleadosPendientes = (empleados || []).filter(e => 
                !e.tipo_jornada || 
                e.tipo_jornada.trim() === '' || 
                e.tipo_jornada === 'Pendiente' || 
                e.estatus_empleado !== 'Activo'
            );

            // 2. Marcajes de asistencia pendientes por salida (hora_salida es null/N/A)
            const asistenciasPendientes = (historial || []).filter(h => 
                !h.hora_salida || h.hora_salida === 'N/A'
            );

            const countEmpleadosPendientes = empleadosPendientes.length;
            const countAsistenciasPendientes = asistenciasPendientes.length;
            const totalPendientes = countEmpleadosPendientes + countAsistenciasPendientes;

            res.locals.pendientesCount = totalPendientes;
            res.locals.countEmpleadosPendientes = countEmpleadosPendientes;
            res.locals.countAsistenciasPendientes = countAsistenciasPendientes;
            res.locals.empleadosPendientesList = empleadosPendientes;
            res.locals.asistenciasPendientesList = asistenciasPendientes;

            if (countAsistenciasPendientes > 0 && countEmpleadosPendientes === 0) {
                res.locals.pendientesTargetUrl = '/historial-asistencia?filter=pendientes';
            } else {
                res.locals.pendientesTargetUrl = '/tabGeneral?filter=pendientes';
            }
        } catch (err) {
            console.error('Error calculando elementos pendientes:', err);
            res.locals.pendientesCount = 0;
            res.locals.countEmpleadosPendientes = 0;
            res.locals.countAsistenciasPendientes = 0;
            res.locals.pendientesTargetUrl = '/tabGeneral?filter=pendientes';
        }
    } else {
        res.locals.pendientesCount = 0;
        res.locals.countEmpleadosPendientes = 0;
        res.locals.countAsistenciasPendientes = 0;
        res.locals.pendientesTargetUrl = '/tabGeneral?filter=pendientes';
    }

    next();
});

// ── Motor de vistas ────────────────────────────────────────────
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// ── Archivos estáticos ─────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// ── Parseo de body (Express nativo — body-parser no es necesario) ──
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ── Rutas ──────────────────────────────────────────────────────
const authRouter = require('./routes/auth');
const indexRouter = require('./routes/index');
app.use('/auth', authRouter);
app.use('/', indexRouter);

// ── 404 Página no encontrada ───────────────────────────────────
app.use((req, res) => {
    res.status(404).render('error', {
        statusCode: 404,
        title: 'Página no encontrada',
        message: 'La sección o dirección que intentas visitar no existe o ha sido movida.',
        session: req.session
    });
});

// ── Manejo de errores del servidor (500) ────────────────────────
app.use((err, req, res, next) => {
    console.error(err.stack);

    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            req.session.message = { type: 'danger', text: 'El archivo es demasiado grande (máximo 5MB).' };
        } else {
            req.session.message = { type: 'danger', text: 'Error al subir el archivo: ' + err.message };
        }
        return res.redirect('/auth/panel-empleado');
    }

    res.status(500).render('error', {
        statusCode: 500,
        title: 'Inconveniente temporal',
        message: 'Tuvimos un pequeño problema técnico en nuestro servidor. Por favor intenta nuevamente en unos momentos.',
        session: req.session
    });
});

// ── Exportar para Vercel ──────────────────────────────────────
module.exports = app;

// ── Iniciar servidor (solo en desarrollo local) ──────────────
if (process.env.NODE_ENV !== 'production') {
    app.listen(port, () => {
        console.log(`Servidor Express escuchando en http://localhost:${port}`);
        console.log('Presiona CTRL+C para detener el servidor');
    });
}