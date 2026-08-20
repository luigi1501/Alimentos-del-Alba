const express = require('express');
const session = require('express-session');
const path = require('path');
const dotenv = require('dotenv');
const morgan = require('morgan');
const multer = require('multer');
const SQLiteStore = require('better-sqlite3-session-store')(session);
const Database = require('better-sqlite3');

// ── Configurar ruta de base de datos para Vercel ──────────────
const dbPath = process.env.NODE_ENV === 'production' 
    ? '/tmp/sessions.db' 
    : path.join(__dirname, 'db', 'sessions.db');
const sessionDb = new Database(dbPath);

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
    store: new SQLiteStore({
        client: sessionDb,
        expired: {
            clear: true,
            intervalMs: 15 * 60 * 1000
        }
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
app.use((req, res, next) => {
    res.locals.userId = req.session.userId;
    res.locals.nombreEmpleado = req.session.nombreEmpleado;
    res.locals.empleadoApellido = req.session.empleadoApellido;
    res.locals.message = req.session.message;
    delete req.session.message;
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

// ── 404 ────────────────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).send('Lo siento, no puedo encontrar eso!');
});

// ── Manejo de errores ──────────────────────────────────────────
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

    res.status(500).send('¡Algo salió mal en el servidor!');
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