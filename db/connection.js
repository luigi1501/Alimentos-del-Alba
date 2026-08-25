const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// En Vercel, la única carpeta escribible es /tmp
const isVercel = process.env.VERCEL || process.env.NODE_ENV === 'production';
const DB_DIR = isVercel ? '/tmp' : path.join(__dirname);

if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
}

const DB_PATH = path.join(DB_DIR, 'database.sqlite');
const rawDb = new Database(DB_PATH);

// En /tmp o Serverless es mejor usar modo DELETE o MEMORY en lugar de WAL
if (!isVercel) {
    rawDb.pragma('journal_mode = WAL');
}

console.log(`Base de Datos Conectada en: ${DB_PATH}`);

// Crear tablas si no existen
rawDb.exec(`
    CREATE TABLE IF NOT EXISTS empleados (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario TEXT UNIQUE,
        password_hash TEXT NOT NULL,
        nombre TEXT,
        apellido TEXT,
        cedula INTEGER UNIQUE,
        cargo TEXT,
        departamento TEXT,
        telefono INTEGER,
        correo TEXT UNIQUE,
        qr_code TEXT UNIQUE,
        foto_perfil TEXT,
        tipo_jornada TEXT,
        estatus_empleado TEXT DEFAULT 'Activo',
        estatus_desde TEXT,
        estatus_hasta TEXT,
        estatus_observacion TEXT
    );
    CREATE TABLE IF NOT EXISTS historial_asistencia (
        id_asistencia INTEGER PRIMARY KEY AUTOINCREMENT,
        empleado_id INTEGER NOT NULL,
        fecha TEXT NOT NULL,
        hora_entrada TEXT NOT NULL,
        hora_salida TEXT,
        salida_manual INTEGER DEFAULT 0,
        tipo_jornada TEXT,
        observacion TEXT,
        FOREIGN KEY (empleado_id) REFERENCES empleados(id)
    );
`);

// Migraciones automáticas de columnas para bases de datos existentes
try { rawDb.exec(`ALTER TABLE empleados ADD COLUMN tipo_jornada TEXT;`); } catch (e) {}
try { rawDb.exec(`ALTER TABLE empleados ADD COLUMN estatus_empleado TEXT DEFAULT 'Activo';`); } catch (e) {}
try { rawDb.exec(`ALTER TABLE empleados ADD COLUMN estatus_desde TEXT;`); } catch (e) {}
try { rawDb.exec(`ALTER TABLE empleados ADD COLUMN estatus_hasta TEXT;`); } catch (e) {}
try { rawDb.exec(`ALTER TABLE empleados ADD COLUMN estatus_observacion TEXT;`); } catch (e) {}
try { rawDb.exec(`ALTER TABLE historial_asistencia ADD COLUMN salida_manual INTEGER DEFAULT 0;`); } catch (e) {}
try { rawDb.exec(`ALTER TABLE historial_asistencia ADD COLUMN tipo_jornada TEXT;`); } catch (e) {}
try { rawDb.exec(`ALTER TABLE historial_asistencia ADD COLUMN observacion TEXT;`); } catch (e) {}

console.log('Tablas inicializadas correctamente.');

// Wrapper compatible con la interfaz callback (get, all, run)
const db = {
    get(sql, params, callback) {
        if (typeof params === 'function') {
            callback = params;
            params = [];
        }
        try {
            const stmt = rawDb.prepare(sql);
            const row = stmt.get(...(params || []));
            if (callback) callback(null, row);
        } catch (err) {
            if (callback) callback(err);
        }
    },

    all(sql, params, callback) {
        if (typeof params === 'function') {
            callback = params;
            params = [];
        }
        try {
            const stmt = rawDb.prepare(sql);
            const rows = stmt.all(...(params || []));
            if (callback) callback(null, rows);
        } catch (err) {
            if (callback) callback(err);
        }
    },

    run(sql, params, callback) {
        if (typeof params === 'function') {
            callback = params;
            params = [];
        }
        try {
            const stmt = rawDb.prepare(sql);
            const info = stmt.run(...(params || []));
            const context = {
                lastID: Number(info.lastInsertRowid),
                changes: info.changes
            };
            if (callback) callback.call(context, null);
        } catch (err) {
            if (callback) callback(err);
        }
    }
};

module.exports = db;