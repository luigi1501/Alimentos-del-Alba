const sqlite3 = require('sqlite3').verbose();
const DB_PATH = './db/database.sqlite';

const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
    if (err) {
        console.error("Error al conectar a la base de datos:", err.message);
    } else {
        console.log("Base de Datos Conectada");

        db.run(`
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
            )
        `, (createTableErr) => {
            if (createTableErr) {
                console.error("Error al crear la tabla empleados:", createTableErr.message);
            } else {
                console.log("Tabla empleados creada o ya existente.");
            }
        });
        db.run(`
            CREATE TABLE IF NOT EXISTS historial_asistencia (
                id_asistencia INTEGER PRIMARY KEY AUTOINCREMENT,
                empleado_id INTEGER NOT NULL,
                fecha TEXT NOT NULL,
                hora_entrada TEXT NOT NULL,
                hora_salida TEXT,
                FOREIGN KEY (empleado_id) REFERENCES empleados(id)
            )
        `, (err) => {
            if (err) {
                console.error("Error al crear la tabla historial_asistencia:", err.message);
            } else {
                console.log("Tabla historial_asistencia creada o ya existente.");
            }
        });
    }
});

module.exports = db;