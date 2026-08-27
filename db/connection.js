const { createClient } = require('@libsql/client');
const dotenv = require('dotenv');
dotenv.config({ override: true });

const url = process.env.TURSO_DATABASE_URL || 'file:database.sqlite';
const authToken = process.env.TURSO_AUTH_TOKEN || undefined;

const client = createClient({
    url,
    authToken
});

console.log(`Base de Datos Turso Conectada: ${url}`);

// Crear tablas si no existen en Turso
const initDb = async () => {
    try {
        await client.execute(`
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
        `);

        await client.execute(`
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
        const migraciones = [
            `ALTER TABLE empleados ADD COLUMN tipo_jornada TEXT;`,
            `ALTER TABLE empleados ADD COLUMN estatus_empleado TEXT DEFAULT 'Activo';`,
            `ALTER TABLE empleados ADD COLUMN estatus_desde TEXT;`,
            `ALTER TABLE empleados ADD COLUMN estatus_hasta TEXT;`,
            `ALTER TABLE empleados ADD COLUMN estatus_observacion TEXT;`,
            `ALTER TABLE historial_asistencia ADD COLUMN salida_manual INTEGER DEFAULT 0;`,
            `ALTER TABLE historial_asistencia ADD COLUMN tipo_jornada TEXT;`,
            `ALTER TABLE historial_asistencia ADD COLUMN observacion TEXT;`
        ];

        for (const sql of migraciones) {
            try { await client.execute(sql); } catch (e) { /* columna ya existe */ }
        }

        console.log('Tablas inicializadas correctamente en Turso.');
    } catch (err) {
        console.error('Error al inicializar esquema en Turso:', err.message);
    }
};

initDb();

// Wrapper compatible con la interfaz callback (get, all, run)
const db = {
    get(sql, params, callback) {
        if (typeof params === 'function') {
            callback = params;
            params = [];
        }
        client.execute({ sql, args: params || [] })
            .then(rs => {
                const row = (rs.rows && rs.rows.length > 0) ? { ...rs.rows[0] } : undefined;
                if (callback) callback(null, row);
            })
            .catch(err => {
                if (callback) callback(err);
            });
    },

    all(sql, params, callback) {
        if (typeof params === 'function') {
            callback = params;
            params = [];
        }
        client.execute({ sql, args: params || [] })
            .then(rs => {
                const rows = (rs.rows || []).map(r => ({ ...r }));
                if (callback) callback(null, rows);
            })
            .catch(err => {
                if (callback) callback(err);
            });
    },

    run(sql, params, callback) {
        if (typeof params === 'function') {
            callback = params;
            params = [];
        }
        client.execute({ sql, args: params || [] })
            .then(rs => {
                const context = {
                    lastID: rs.lastInsertRowid !== undefined ? Number(rs.lastInsertRowid) : 0,
                    changes: rs.rowsAffected || 0
                };
                if (callback) callback.call(context, null);
            })
            .catch(err => {
                if (callback) callback(err);
            });
    }
};

module.exports = db;