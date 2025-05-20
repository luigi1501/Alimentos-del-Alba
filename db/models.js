const db = require('./connection');
const bcrypt = require('bcrypt');
const saltRounds = 10;

let querys = {
    getempleados: 'SELECT id, usuario, nombre, apellido, cedula, cargo, departamento, telefono, correo, qr_code FROM empleados',
    getempleadosID: 'SELECT id, usuario, nombre, apellido, cedula, cargo, departamento, telefono, correo, qr_code FROM empleados WHERE id = ?',
    insertempleados: 'INSERT INTO empleados (usuario, password_hash, nombre, apellido, cedula, cargo, departamento, telefono, correo, qr_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    updateempleados: 'UPDATE empleados SET usuario = ?, nombre = ?, apellido = ?, cedula = ?, cargo = ?, departamento = ?, telefono = ?, correo = ?, qr_code = ? WHERE id = ?',
    deleteempleados: 'DELETE FROM empleados WHERE id = ?',
    obtenerEmpleadoPorCedula: 'SELECT id FROM empleados WHERE cedula = ?',
    getEmpleadoPorId: 'SELECT * FROM empleados WHERE id = ?',
    getQrCodePorId: 'SELECT qr_code FROM empleados WHERE id = ?'
};

module.exports = {
    async registrarEmpleado(usuario, password, nombre, apellido, cedula, cargo, departamento, telefono, correo) {
        try {
            const empleadoExistenteCedula = await new Promise((resolve, reject) => {
                db.get(querys.obtenerEmpleadoPorCedula, [cedula], (err, row) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve(row);
                });
            });

            if (empleadoExistenteCedula) {
                throw new Error('La cédula ya está registrada.');
            }

            const hashedPassword = await bcrypt.hash(password, saltRounds);
            return new Promise((resolve, reject) => {
                db.run(
                    querys.insertempleados,
                    [usuario, hashedPassword, nombre, apellido, cedula, cargo, departamento, telefono, correo, null],
                    function(err) {
                        if (err) {
                            reject(err);
                            return;
                        }
                        resolve(this.lastID);
                    }
                );
            });
        } catch (error) {
            console.error("Error al registrar empleado:", error);
            throw error;
        }
    },

    async obtenerEmpleadoPorUsuario(usuario) {
        return new Promise((resolve, reject) => {
            db.get('SELECT * FROM empleados WHERE usuario = ?', [usuario], (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(row);
            });
        });
    },

    async verificarPassword(passwordIngresada, hashedPasswordAlmacenado) {
        try {
            return await bcrypt.compare(passwordIngresada, hashedPasswordAlmacenado);
        } catch (error) {
            console.error("Error al comparar contraseñas:", error);
            throw error;
        }
    },

    getempleados() {
        return new Promise((resolve, reject) => {
            db.all(querys.getempleados, (err, rows) => {
                if (err) reject(err);
                resolve(rows);
            });
        });
    },

    getempleadosID(id) {
        return new Promise((resolve, reject) => {
            db.get(querys.getempleadosID, [id], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });
    },

    async getEmpleadoPorId(id) {
        return new Promise((resolve, reject) => {
            db.get(querys.getEmpleadoPorId, [id], (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(row);
            });
        });
    },

    async getQrCodePorId(id) {
        return new Promise((resolve, reject) => {
            db.get(querys.getQrCodePorId, [id], (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(row ? row.qr_code : null);
            });
        });
    },

    updateempleados(id, usuario, nombre, apellido, cedula, cargo, departamento, telefono, correo, qr_code) {
        return new Promise((resolve, reject) => {
            db.run(
                'UPDATE empleados SET usuario = ?, nombre = ?, apellido = ?, cedula = ?, cargo = ?, departamento = ?, telefono = ?, correo = ?, qr_code = ? WHERE id = ?',
                [usuario, nombre, apellido, cedula, cargo, departamento, telefono, correo, qr_code, id],
                function(err) {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve(this.changes);
                }
            );
        });
    },

    deleteempleados(id) {
        return new Promise((resolve, reject) => {
            db.run(querys.deleteempleados, [id], function(err) {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(this.changes);
            });
        });
    },

};
