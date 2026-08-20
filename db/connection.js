const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_DIR = path.join(__dirname);
fs.mkdirSync(DB_DIR, { recursive: true });

const DB_PATH = path.join(DB_DIR, 'database.sqlite');
const rawDb = new Database(DB_PATH);
rawDb.pragma('journal_mode = WAL');
console.log('Base de Datos Conectada (better-sqlite3)');

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
        foto_perfil TEXT
    );
    CREATE TABLE IF NOT EXISTS historial_asistencia (
        id_asistencia INTEGER PRIMARY KEY AUTOINCREMENT,
        empleado_id INTEGER NOT NULL,
        fecha TEXT NOT NULL,
        hora_entrada TEXT NOT NULL,
        hora_salida TEXT,
        FOREIGN KEY (empleado_id) REFERENCES empleados(id)
    );
`);
console.log('Tablas inicializadas correctamente.');

// Wrapper compatible con la interfaz callback (get, all, run) usada por db/models.js
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