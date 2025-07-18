const db = require('./connection');
const bcrypt = require('bcrypt');
const saltRounds = 10;
const { DateTime } = require('luxon');

let querys = {
    getempleados: 'SELECT id, usuario, nombre, apellido, cedula, cargo, departamento, telefono, correo, qr_code, foto_perfil FROM empleados',
    getempleadosID: 'SELECT id, usuario, nombre, apellido, cedula, cargo, departamento, telefono, correo, qr_code, foto_perfil FROM empleados WHERE id = ?',
    insertempleados: 'INSERT INTO empleados (usuario, password_hash, nombre, apellido, cedula, cargo, departamento, telefono, correo, qr_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    updateempleados: 'UPDATE empleados SET usuario = ?, nombre = ?, apellido = ?, cedula = ?, cargo = ?, departamento = ?, telefono = ?, correo = ?, qr_code = ?, foto_perfil = ? WHERE id = ?',
    deleteempleados: 'DELETE FROM empleados WHERE id = ?',
    obtenerEmpleadoPorCedula: 'SELECT id FROM empleados WHERE cedula = ?',
    getEmpleadoPorId: 'SELECT id, usuario, password_hash, nombre, apellido, cedula, cargo, departamento, telefono, correo, qr_code, foto_perfil FROM empleados WHERE id = ?',
    getQrCodePorId: 'SELECT qr_code FROM empleados WHERE id = ?',
    getEmpleadoParaAsistenciaPorCedula: 'SELECT id, nombre, apellido, foto_perfil FROM empleados WHERE cedula = ?',
    insertarAsistenciaEntrada: 'INSERT INTO historial_asistencia (empleado_id, fecha, hora_entrada) VALUES (?, ?, ?)',
    actualizarAsistenciaSalida: 'UPDATE historial_asistencia SET hora_salida = ? WHERE empleado_id = ? AND fecha = ? AND hora_salida IS NULL',
    getEntradaPendiente: 'SELECT id_asistencia FROM historial_asistencia WHERE empleado_id = ? AND fecha = ? AND hora_salida IS NULL',
    getHistorialAsistencia: 'SELECT ha.id_asistencia, e.nombre, e.apellido, e.cargo, e.departamento, e.cedula, ha.fecha, ha.hora_entrada, ha.hora_salida FROM historial_asistencia ha JOIN empleados e ON ha.empleado_id = e.id ORDER BY ha.fecha DESC, ha.hora_entrada DESC',
    getHistorialAsistenciaPorEmpleado: 'SELECT ha.id_asistencia, ha.fecha, ha.hora_entrada, ha.hora_salida FROM historial_asistencia ha WHERE ha.empleado_id = ? ORDER BY ha.fecha DESC, ha.hora_entrada DESC',
    getHistorialAsistenciaPorFecha: 'SELECT ha.id_asistencia, e.nombre, e.apellido, e.cargo, e.departamento, e.cedula, ha.fecha, ha.hora_entrada, ha.hora_salida FROM historial_asistencia ha JOIN empleados e ON ha.empleado_id = e.id WHERE ha.fecha = ? ORDER BY ha.fecha DESC, ha.hora_entrada DESC',
    getHistorialAsistenciaPorEmpleadoYFecha: 'SELECT ha.id_asistencia, ha.fecha, ha.hora_entrada, ha.hora_salida FROM historial_asistencia ha WHERE ha.empleado_id = ? AND ha.fecha = ? ORDER BY ha.fecha DESC, ha.hora_entrada DESC'
};

module.exports = {

    async registrarEmpleado(usuario, password, nombre, apellido, cedula, cargo, departamento, telefono, correo) {
        try {
            const empleadoExistenteCedula = await new Promise((resolve, reject) => {
                db.get(querys.obtenerEmpleadoPorCedula, [cedula], (err, row) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve(row);
                });
            });

            if (empleadoExistenteCedula) {
                throw new Error('La cédula ya está registrada.');
            }

            const hashedPassword = await bcrypt.hash(password, saltRounds);

            const qr_code = `QR-${cedula}-${Date.now()}`;

            return new Promise((resolve, reject) => {
                db.run(
                    querys.insertempleados,
                    [usuario, hashedPassword, nombre, apellido, cedula, cargo, departamento, telefono, correo, qr_code],
                    function(err) {
                        if (err) {
                            console.error('Error al insertar empleado:', err.message);
                            return reject(err);
                        }
                        console.log(`Empleado ${nombre} ${apellido} registrado con ID: ${this.lastID}`);
                        resolve(this.lastID);
                    }
                );
            });
        } catch (error) {
            console.error("Error en registrarEmpleado:", error.message);
            throw error;
        }
    },

    async obtenerEmpleadoPorUsuario(usuario) {
        return new Promise((resolve, reject) => {
            db.get('SELECT *, foto_perfil FROM empleados WHERE usuario = ?', [usuario], (err, row) => {
                if (err) {
                    return reject(err);
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
                if (err) return reject(err);
                resolve(rows);
            });
        });
    },

    getempleadosID(id) {
        return new Promise((resolve, reject) => {
            db.get(querys.getempleadosID, [id], (err, row) => {
                if (err) return reject(err);
                resolve(row);
            });
        });
    },

    async getEmpleadoPorId(id) {
        console.log(`DEBUG DB: [getEmpleadoPorId] Intentando obtener empleado con ID: ${id}`);
        return new Promise((resolve, reject) => {
            db.get(querys.getEmpleadoPorId, [id], (err, row) => {
                if (err) {
                    console.error('DEBUG DB: [getEmpleadoPorId] Error al obtener empleado por ID:', err.message);
                    return reject(err);
                }
                if (row) {
                    console.log('DEBUG DB: [getEmpleadoPorId] Empleado ENCONTRADO:', row);
                    resolve(row);
                } else {
                    console.log(`DEBUG DB: [getEmpleadoPorId] No se encontró empleado con ID: ${id}`);
                    resolve(null);
                }
            });
        });
    },

    async getQrCodePorId(id) {
        return new Promise((resolve, reject) => {
            db.get(querys.getQrCodePorId, [id], (err, row) => {
                if (err) {
                    return reject(err);
                }
                resolve(row ? row.qr_code : null);
            });
        });
    },

    async getEmpleadoPorQrCode(qrCode) {
        return new Promise((resolve, reject) => {
            console.log(`DEBUG DB: [getEmpleadoPorQrCode] QR Code recibido: ${qrCode}`);

            const ciMatch = qrCode.match(/CI:(\d+)/);

            if (!ciMatch || !ciMatch[1]) {
                console.warn('DEBUG DB: [getEmpleadoPorQrCode] Formato de QR Code inválido o CI no encontrado:', qrCode);
                return resolve(null);
            }
            const cedula = ciMatch[1];
            console.log(`DEBUG DB: [getEmpleadoPorQrCode] Cédula extraída: ${cedula}`);

            db.get(querys.getEmpleadoParaAsistenciaPorCedula, [cedula], (err, row) => {
                if (err) {
                    console.error('DEBUG DB: [getEmpleadoPorQrCode] Error al buscar empleado por cédula:', err.message);
                    return reject(err);
                }
                if (row) {
                    console.log('DEBUG DB: [getEmpleadoPorQrCode] Empleado ENCONTRADO por cédula:', row);
                } else {
                    console.log(`DEBUG DB: [getEmpleadoPorQrCode] No se encontró empleado con cédula: ${cedula}`);
                }
                resolve(row);
            });
        });
    },

    updateempleados(id, usuario, nombre, apellido, cedula, cargo, departamento, telefono, correo, qr_code, foto_perfil = null) {
        return new Promise((resolve, reject) => {
            db.run(
                querys.updateempleados,
                [usuario, nombre, apellido, cedula, cargo, departamento, telefono, correo, qr_code, foto_perfil, id],
                function(err) {
                    if (err) {
                        return reject(err);
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
                    return reject(err);
                }
                resolve(this.changes);
            });
        });
    },

    async updateEmpleadoFotoPerfil(empleadoId, fotoPerfilPath) {
        return new Promise((resolve, reject) => {
            db.run(
                'UPDATE empleados SET foto_perfil = ? WHERE id = ?',
                [fotoPerfilPath, empleadoId],
                function(err) {
                    if (err) {
                        console.error('Error al actualizar foto de perfil:', err.message);
                        return reject(err);
                    }
                    console.log(`Foto de perfil actualizada para empleado ID: ${empleadoId}. Cambios: ${this.changes}`);
                    resolve(this.changes);
                }
            );
        });
    },

    async registrarEntrada(empleadoId) {
        return new Promise((resolve, reject) => {
            const now = DateTime.now().setZone('America/Caracas');
            const fechaHoy = now.toISODate();
            const horaActual = now.toISO();

            db.get(querys.getEntradaPendiente, [empleadoId, fechaHoy], (err, row) => {
                if (err) {
                    console.error('Error al verificar entrada pendiente:', err.message);
                    return reject(err);
                }
                if (row) {
                    return reject(new Error('Ya se registró una entrada para hoy sin salida.'));
                }

                db.run(
                    querys.insertarAsistenciaEntrada,
                    [empleadoId, fechaHoy, horaActual],
                    function(err) {
                        if (err) {
                            console.error('Error al insertar asistencia de entrada:', err.message);
                            return reject(err);
                        }
                        resolve(this.lastID);
                    }
                );
            });
        });
    },

    async registrarSalida(empleadoId) {
        return new Promise((resolve, reject) => {
            const now = DateTime.now().setZone('America/Caracas');
            const fechaHoy = now.toISODate();
            const horaActual = now.toISO();

            db.run(
                querys.actualizarAsistenciaSalida,
                [horaActual, empleadoId, fechaHoy],
                function(err) {
                    if (err) {
                        console.error('Error al actualizar asistencia de salida:', err.message);
                        return reject(err);
                    }
                    if (this.changes === 0) {
                        return reject(new Error('No se encontró una entrada pendiente para hoy para registrar la salida.'));
                    }
                    resolve(true);
                }
            );
        });
    },

    async getHistorialAsistencia() {
        return new Promise((resolve, reject) => {
            db.all(querys.getHistorialAsistencia, (err, rows) => {
                if (err) {
                    return reject(err);
                }
                const formattedRows = rows.map(row => {
                    return {
                        ...row,
                        hora_entrada: row.hora_entrada ? new Date(row.hora_entrada).toLocaleTimeString('es-VE', {hour: '2-digit', minute:'2-digit', second:'2-digit', hour12: true}) : null,
                        hora_salida: row.hora_salida ? new Date(row.hora_salida).toLocaleTimeString('es-VE', {hour: '2-digit', minute:'2-digit', second:'2-digit', hour12: true}) : null
                    };
                });
                resolve(formattedRows);
            });
        });
    },

    async getHistorialAsistenciaPorEmpleado(id_empleado) {
        return new Promise((resolve, reject) => {
            db.all(querys.getHistorialAsistenciaPorEmpleado, [id_empleado], (err, rows) => {
                if (err) {
                    return reject(err);
                }
                const formattedRows = rows.map(row => {
                    return {
                        ...row,
                        hora_entrada: row.hora_entrada ? new Date(row.hora_entrada).toLocaleTimeString('es-VE', {hour: '2-digit', minute:'2-digit', second:'2-digit', hour12: true}) : null,
                        hora_salida: row.hora_salida ? new Date(row.hora_salida).toLocaleTimeString('es-VE', {hour: '2-digit', minute:'2-digit', second:'2-digit', hour12: true}) : null
                    };
                });
                resolve(formattedRows);
            });
        });
    },

    async getHistorialAsistenciaPorFecha(fecha) {
        return new Promise((resolve, reject) => {
            const searchDate = new Date(fecha);
            const formattedSearchDate = `${searchDate.getFullYear()}-${(searchDate.getMonth() + 1).toString().padStart(2, '0')}-${searchDate.getDate().toString().padStart(2, '0')}`;
            
            db.all(querys.getHistorialAsistenciaPorFecha, [formattedSearchDate], (err, rows) => {
                if (err) {
                    return reject(err);
                }
                const formattedRows = rows.map(row => {
                    return {
                        ...row,
                        hora_entrada: row.hora_entrada ? new Date(row.hora_entrada).toLocaleTimeString('es-VE', {hour: '2-digit', minute:'2-digit', second:'2-digit', hour12: true}) : null,
                        hora_salida: row.hora_salida ? new Date(row.hora_salida).toLocaleTimeString('es-VE', {hour: '2-digit', minute:'2-digit', second:'2-digit', hour12: true}) : null
                    };
                });
                resolve(formattedRows);
            });
        });
    },

    async getHistorialAsistenciaPorEmpleadoYFecha(id_empleado, fecha) {
        return new Promise((resolve, reject) => {
            const searchDate = new Date(fecha);
            const formattedSearchDate = `${searchDate.getFullYear()}-${(searchDate.getMonth() + 1).toString().padStart(2, '0')}-${searchDate.getDate().toString().padStart(2, '0')}`;

            db.all(querys.getHistorialAsistenciaPorEmpleadoYFecha, [id_empleado, formattedSearchDate], (err, rows) => {
                if (err) {
                    return reject(err);
                }
                const formattedRows = rows.map(row => {
                    return {
                        ...row,
                        hora_entrada: row.hora_entrada ? new Date(row.hora_entrada).toLocaleTimeString('es-VE', {hour: '2-digit', minute:'2-digit', second:'2-digit', hour12: true}) : null,
                        hora_salida: row.hora_salida ? new Date(row.hora_salida).toLocaleTimeString('es-VE', {hour: '2-digit', minute:'2-digit', second:'2-digit', hour12: true}) : null
                    };
                });
                resolve(formattedRows);
            });
        });
    }
};