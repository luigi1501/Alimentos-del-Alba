const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./db/database.sqlite', (err) =>{
    if(err) console.log(err);
    db.run(`
        CREATE TABLE IF NOT EXISTS empleados (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario TEXT UNIQUE,
            password_hash TEXT NOT NULL,
            nombre TEXT,
            apellido TEXT,
            cedula INTEGER,
            cargo TEXT,
            departamento TEXT,
            telefono INTEGER,
            correo TEXT UNIQUE,
            qr_code TEXT
        )`, (createTableErr) => {
                if (createTableErr) {
                    console.error("Error al crear la tabla empleados:", createTableErr);
                } else {
                    console.log("Tabla empleados creada o ya existente.");
                }
            });
    console.log("Base de Datos Conectada");
});

module.exports = db;
