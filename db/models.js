const db = require('./connection');
const bcrypt = require('bcryptjs');
const saltRounds = 10;
const { formatHora, fechaHoy, ahoraISO, normalizarFecha } = require('../utils/dateUtils');

// ── Queries SQL ────────────────────────────────────────────────
const querys = {
    getempleados: 'SELECT id, usuario, nombre, apellido, cedula, cargo, departamento, telefono, correo, qr_code, foto_perfil, tipo_jornada, COALESCE(estatus_empleado, \'Activo\') AS estatus_empleado, estatus_desde, estatus_hasta, estatus_observacion FROM empleados',
    getempleadosID: 'SELECT id, usuario, nombre, apellido, cedula, cargo, departamento, telefono, correo, qr_code, foto_perfil, tipo_jornada, COALESCE(estatus_empleado, \'Activo\') AS estatus_empleado, estatus_desde, estatus_hasta, estatus_observacion FROM empleados WHERE id = ?',
    insertempleados: 'INSERT INTO empleados (usuario, password_hash, nombre, apellido, cedula, cargo, departamento, telefono, correo, qr_code, tipo_jornada, estatus_empleado, estatus_desde, estatus_hasta, estatus_observacion) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    updateempleados: 'UPDATE empleados SET usuario = ?, nombre = ?, apellido = ?, cedula = ?, cargo = ?, departamento = ?, telefono = ?, correo = ?, qr_code = ?, foto_perfil = ?, tipo_jornada = ?, estatus_empleado = ?, estatus_desde = ?, estatus_hasta = ?, estatus_observacion = ? WHERE id = ?',
    deleteempleados: 'DELETE FROM empleados WHERE id = ?',
    obtenerEmpleadoPorCedula: 'SELECT id FROM empleados WHERE cedula = ?',
    getEmpleadoPorId: 'SELECT id, usuario, password_hash, nombre, apellido, cedula, cargo, departamento, telefono, correo, qr_code, foto_perfil, tipo_jornada, COALESCE(estatus_empleado, \'Activo\') AS estatus_empleado, estatus_desde, estatus_hasta, estatus_observacion FROM empleados WHERE id = ?',
    getEmpleadoPorUsuario: 'SELECT *, foto_perfil, tipo_jornada, COALESCE(estatus_empleado, \'Activo\') AS estatus_empleado, estatus_desde, estatus_hasta, estatus_observacion FROM empleados WHERE usuario = ?',
    getQrCodePorId: 'SELECT qr_code FROM empleados WHERE id = ?',
    getEmpleadoParaAsistenciaPorCedula: 'SELECT id, nombre, apellido, cedula, cargo, departamento, foto_perfil, tipo_jornada, COALESCE(estatus_empleado, \'Activo\') AS estatus_empleado, estatus_desde, estatus_hasta, estatus_observacion FROM empleados WHERE cedula = ?',
    insertarAsistenciaEntrada: 'INSERT INTO historial_asistencia (empleado_id, fecha, hora_entrada, tipo_jornada, observacion) VALUES (?, ?, ?, (SELECT tipo_jornada FROM empleados WHERE id = ?), ?)',
    actualizarAsistenciaSalida: 'UPDATE historial_asistencia SET hora_salida = ?, observacion = COALESCE(?, observacion) WHERE empleado_id = ? AND fecha = ? AND hora_salida IS NULL',
    getEntradaPendiente: 'SELECT id_asistencia FROM historial_asistencia WHERE empleado_id = ? AND fecha = ? AND hora_salida IS NULL',
    getEntradaPendientePasada: 'SELECT id_asistencia, fecha, hora_entrada FROM historial_asistencia WHERE empleado_id = ? AND hora_salida IS NULL AND fecha < ? ORDER BY fecha DESC LIMIT 1',
    getHistorialAsistencia: 'SELECT ha.id_asistencia, ha.empleado_id, e.nombre, e.apellido, e.cargo, e.departamento, e.cedula, COALESCE(ha.tipo_jornada, e.tipo_jornada) AS tipo_jornada, ha.fecha, ha.hora_entrada, ha.hora_salida, ha.salida_manual FROM historial_asistencia ha JOIN empleados e ON ha.empleado_id = e.id ORDER BY ha.fecha DESC, ha.hora_entrada DESC',
    getHistorialAsistenciaPorEmpleado: 'SELECT ha.id_asistencia, ha.fecha, ha.hora_entrada, ha.hora_salida, ha.salida_manual, COALESCE(ha.tipo_jornada, e.tipo_jornada) AS tipo_jornada FROM historial_asistencia ha JOIN empleados e ON ha.empleado_id = e.id WHERE ha.empleado_id = ? ORDER BY ha.fecha DESC, ha.hora_entrada DESC',
    getHistorialAsistenciaPorFecha: 'SELECT ha.id_asistencia, ha.empleado_id, e.nombre, e.apellido, e.cargo, e.departamento, e.cedula, COALESCE(ha.tipo_jornada, e.tipo_jornada) AS tipo_jornada, ha.fecha, ha.hora_entrada, ha.hora_salida, ha.salida_manual FROM historial_asistencia ha JOIN empleados e ON ha.empleado_id = e.id WHERE ha.fecha = ? ORDER BY ha.fecha DESC, ha.hora_entrada DESC',
    getHistorialAsistenciaPorEmpleadoYFecha: 'SELECT ha.id_asistencia, ha.fecha, ha.hora_entrada, ha.hora_salida, ha.salida_manual, COALESCE(ha.tipo_jornada, e.tipo_jornada) AS tipo_jornada FROM historial_asistencia ha JOIN empleados e ON ha.empleado_id = e.id WHERE ha.empleado_id = ? AND ha.fecha = ? ORDER BY ha.fecha DESC, ha.hora_entrada DESC',
    cerrarSalidaManual: 'UPDATE historial_asistencia SET hora_salida = ?, salida_manual = 1, observacion = ? WHERE id_asistencia = ?'
};

// ── Helper: formatea filas con hora_entrada y hora_salida ──────
const formatearFilasAsistencia = (rows) =>
    rows.map(row => ({
        ...row,
        hora_entrada_raw: row.hora_entrada,
        hora_salida_raw: row.hora_salida,
        hora_entrada: formatHora(row.hora_entrada),
        hora_salida: formatHora(row.hora_salida)
    }));

// ─────────────────────────────────────────────────────────────
module.exports = {

    async registrarEmpleado(usuario, password, nombre, apellido, cedula, cargo, departamento, telefono, correo, tipo_jornada = '', estatus_empleado = 'Activo', estatus_desde = null, estatus_hasta = null, estatus_observacion = null) {
        try {
            const empleadoExistente = await new Promise((resolve, reject) => {
                db.get(querys.obtenerEmpleadoPorCedula, [cedula], (err, row) => {
                    if (err) return reject(err);
                    resolve(row);
                });
            });

            if (empleadoExistente) {
                throw new Error('La cédula ya está registrada.');
            }

            const hashedPassword = await bcrypt.hash(password, saltRounds);
            const qr_code = `QR-${cedula}-${Date.now()}`;
            const jornadaFinal = (tipo_jornada && tipo_jornada.trim() !== '') ? tipo_jornada.trim() : '';
            const estatusFinal = estatus_empleado || 'Activo';

            return new Promise((resolve, reject) => {
                db.run(
                    querys.insertempleados,
                    [usuario, hashedPassword, nombre, apellido, cedula, cargo, departamento, telefono, correo, qr_code, jornadaFinal, estatusFinal, estatus_desde || null, estatus_hasta || null, estatus_observacion || null],
                    function(err) {
                        if (err) {
                            console.error('Error al insertar empleado:', err.message);
                            return reject(err);
                        }
                        resolve(this.lastID);
                    }
                );
            });
        } catch (error) {
            console.error('Error en registrarEmpleado:', error.message);
            throw error;
        }
    },

    async obtenerEmpleadoPorUsuario(usuario) {
        return new Promise((resolve, reject) => {
            db.get(querys.getEmpleadoPorUsuario, [usuario], (err, row) => {
                if (err) return reject(err);
                resolve(row);
            });
        });
    },

    async obtenerEmpleadoPorCorreo(correo) {
        return new Promise((resolve, reject) => {
            db.get('SELECT * FROM empleados WHERE LOWER(correo) = LOWER(?)', [correo], (err, row) => {
                if (err) return reject(err);
                resolve(row || null);
            });
        });
    },

    async verificarPassword(passwordIngresada, hashedPasswordAlmacenado) {
        try {
            return await bcrypt.compare(passwordIngresada, hashedPasswordAlmacenado);
        } catch (error) {
            console.error('Error al comparar contraseñas:', error);
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
        return new Promise((resolve, reject) => {
            db.get(querys.getEmpleadoPorId, [id], (err, row) => {
                if (err) return reject(err);
                resolve(row || null);
            });
        });
    },

    async getQrCodePorId(id) {
        return new Promise((resolve, reject) => {
            db.get(querys.getQrCodePorId, [id], (err, row) => {
                if (err) return reject(err);
                resolve(row ? row.qr_code : null);
            });
        });
    },

    async getEmpleadoPorQrCode(qrCode) {
        return new Promise((resolve, reject) => {
            if (!qrCode) return resolve(null);

            // Intentar extraer cédula (Formatos: ID:12|CI:30703855, CI:30703855, QR-30703855-12345, o sólo dígitos)
            const ciMatch = qrCode.match(/CI:(\d+)/i) || qrCode.match(/QR-(\d+)-/i) || qrCode.match(/^(\d+)$/);

            if (ciMatch && ciMatch[1]) {
                const cedula = ciMatch[1];
                db.get(querys.getEmpleadoParaAsistenciaPorCedula, [cedula], (err, row) => {
                    if (err) return reject(err);
                    if (row) return resolve(row);

                    // Si no lo encuentra por cédula, intentar por ID si viene en el QR (ID:12|...)
                    const idMatch = qrCode.match(/ID:(\d+)/i);
                    if (idMatch && idMatch[1]) {
                        return module.exports.getEmpleadoPorId(idMatch[1]).then(resolve).catch(reject);
                    }
                    resolve(null);
                });
                return;
            }

            // Fallback: Intentar por ID si viene formato ID:12
            const idMatch = qrCode.match(/ID:(\d+)/i);
            if (idMatch && idMatch[1]) {
                db.get(querys.getEmpleadoPorId, [idMatch[1]], (err, row) => {
                    if (err) return reject(err);
                    resolve(row || null);
                });
                return;
            }

            // Fallback final: Buscar coincidencia exacta por string en qr_code de la tabla empleados
            db.get('SELECT id, nombre, apellido, cedula, cargo, departamento, foto_perfil, tipo_jornada, COALESCE(estatus_empleado, \'Activo\') AS estatus_empleado FROM empleados WHERE qr_code = ?', [qrCode], (err, row) => {
                if (err) return reject(err);
                resolve(row || null);
            });
        });
    },

    updateempleados(id, usuario, nombre, apellido, cedula, cargo, departamento, telefono, correo, qr_code, foto_perfil = null, tipo_jornada = 'Lunes a Viernes (8:00 AM - 5:00 PM)', estatus_empleado = 'Activo', estatus_desde = null, estatus_hasta = null, estatus_observacion = null) {
        return new Promise((resolve, reject) => {
            db.run(
                querys.updateempleados,
                [usuario, nombre, apellido, cedula, cargo, departamento, telefono, correo, qr_code, foto_perfil, tipo_jornada, estatus_empleado || 'Activo', estatus_desde || null, estatus_hasta || null, estatus_observacion || null, id],
                function(err) {
                    if (err) return reject(err);
                    resolve(this.changes);
                }
            );
        });
    },

    deleteempleados(id) {
        return new Promise((resolve, reject) => {
            db.run(querys.deleteempleados, [id], function(err) {
                if (err) return reject(err);
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
                    resolve(this.changes);
                }
            );
        });
    },

    async verificarEstadoQrEmpleado(empleadoId) {
        try {
            const empleado = await module.exports.getEmpleadoPorId(empleadoId);
            if (!empleado) {
                return { qrHabilitado: false, motivo: 'Empleado no encontrado.', salidaPendiente: null };
            }

            // Verificar estatus del empleado (vacaciones, reposo, suspensión, etc.)
            const estatus = (empleado.estatus_empleado || 'Activo').trim();
            if (estatus !== 'Activo') {
                const mensajesEstatus = {
                    'De Vacaciones':     'El empleado se encuentra de Vacaciones. El Código QR está deshabilitado durante este período.',
                    'En Reposo Médico':  'El empleado está en Reposo Médico. El Código QR permanecerá bloqueado hasta que la administración lo reactive.',
                    'Suspendido':        'El empleado se encuentra Suspendido. El Código QR está inhabilitado por decisión administrativa.',
                    'Permiso Especial':  'El empleado tiene un Permiso Especial activo. El Código QR está deshabilitado durante este período.',
                    'Baja Temporal':     'El empleado está en Baja Temporal. Contacta a la administración para más información.',
                    'Inactivo':          'El empleado figura como Inactivo en el sistema. Código QR deshabilitado.'
                };
                const mensajeEstatus = mensajesEstatus[estatus] || `El empleado tiene estatus "${estatus}". El Código QR está bloqueado. Contacta a la administración.`;
                return {
                    qrHabilitado: false,
                    motivo: mensajeEstatus,
                    salidaPendiente: null,
                    tipoJornada: empleado.tipo_jornada,
                    estatusEmpleado: estatus
                };
            }

            if (!empleado.tipo_jornada || empleado.tipo_jornada.trim() === '') {
                return {
                    qrHabilitado: false,
                    motivo: 'Código QR deshabilitado. Se requiere que la administración asigne el Tipo de Jornada del empleado.',
                    salidaPendiente: null,
                    tipoJornada: null
                };
            }

            const hoy = fechaHoy();
            const salidaPendientePasada = await new Promise((resolve, reject) => {
                db.get(querys.getEntradaPendientePasada, [empleadoId, hoy], (err, row) => {
                    if (err) return reject(err);
                    resolve(row || null);
                });
            });

            if (salidaPendientePasada) {
                return {
                    qrHabilitado: false,
                    motivo: `Código QR bloqueado: salida no registrada el día ${salidaPendientePasada.fecha}. Solicita al administrador el ajuste manual para rehabilitar el QR.`,
                    salidaPendiente: salidaPendientePasada,
                    tipoJornada: empleado.tipo_jornada
                };
            }

            return {
                qrHabilitado: true,
                motivo: 'Código QR activo y listo para escaneo de asistencia.',
                salidaPendiente: null,
                tipoJornada: empleado.tipo_jornada
            };

        } catch (error) {
            console.error('Error al verificar estado del QR:', error);
            return { qrHabilitado: false, motivo: 'Error al consultar estado de la cuenta.', salidaPendiente: null };
        }
    },

    async registrarEntrada(empleadoId, observacion = null) {
        const estadoQr = await module.exports.verificarEstadoQrEmpleado(empleadoId);
        if (!estadoQr.qrHabilitado) {
            throw new Error(estadoQr.motivo);
        }

        return new Promise((resolve, reject) => {
            const hoy = fechaHoy();
            const ahora = ahoraISO();

            db.get(querys.getEntradaPendiente, [empleadoId, hoy], (err, row) => {
                if (err) return reject(err);
                if (row) {
                    return reject(new Error('Ya se registró una entrada para hoy sin salida.'));
                }

                db.run(
                    querys.insertarAsistenciaEntrada,
                    [empleadoId, hoy, ahora, empleadoId, observacion || null],
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

    async getEntradaHoy(empleadoId) {
        return new Promise((resolve, reject) => {
            const hoy = fechaHoy();
            db.get(querys.getEntradaPendiente, [empleadoId, hoy], (err, row) => {
                if (err) return reject(err);
                resolve(row || null);
            });
        });
    },

    async registrarSalida(empleadoId, observacion = null) {
        return new Promise((resolve, reject) => {
            const hoy = fechaHoy();
            const ahora = ahoraISO();

            db.run(
                querys.actualizarAsistenciaSalida,
                [ahora, observacion || null, empleadoId, hoy],
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

    async cerrarSalidaManual(idAsistencia, horaSalidaISO, observacion = null) {
        return new Promise((resolve, reject) => {
            db.run(
                querys.cerrarSalidaManual,
                [horaSalidaISO, observacion || null, idAsistencia],
                function(err) {
                    if (err) {
                        console.error('Error al cerrar salida manual:', err.message);
                        return reject(err);
                    }
                    resolve(this.changes > 0);
                }
            );
        });
    },

    async getHistorialAsistencia() {
        return new Promise((resolve, reject) => {
            db.all(querys.getHistorialAsistencia, (err, rows) => {
                if (err) return reject(err);
                resolve(formatearFilasAsistencia(rows));
            });
        });
    },

    async getHistorialAsistenciaPorMes(mesAno, empleadoId = null) {
        return new Promise((resolve, reject) => {
            let sql = `SELECT ha.id_asistencia, ha.empleado_id, e.nombre, e.apellido, e.cargo, e.departamento, e.cedula, COALESCE(ha.tipo_jornada, e.tipo_jornada) AS tipo_jornada, ha.fecha, ha.hora_entrada, ha.hora_salida, ha.salida_manual FROM historial_asistencia ha JOIN empleados e ON ha.empleado_id = e.id`;
            const params = [];

            if (mesAno && mesAno !== 'todos') {
                sql += ` WHERE strftime('%Y-%m', ha.fecha) = ?`;
                params.push(mesAno);
            }

            if (empleadoId && empleadoId !== 'todos') {
                sql += (params.length ? ` AND` : ` WHERE`) + ` ha.empleado_id = ?`;
                params.push(parseInt(empleadoId));
            }

            sql += ` ORDER BY ha.fecha DESC, ha.hora_entrada DESC`;

            db.all(sql, params, (err, rows) => {
                if (err) return reject(err);
                resolve(formatearFilasAsistencia(rows));
            });
        });
    },

    async getHistorialAsistenciaPorEmpleado(id_empleado) {
        return new Promise((resolve, reject) => {
            db.all(querys.getHistorialAsistenciaPorEmpleado, [id_empleado], (err, rows) => {
                if (err) return reject(err);
                resolve(formatearFilasAsistencia(rows));
            });
        });
    },

    async getHistorialAsistenciaPorFecha(fecha) {
        return new Promise((resolve, reject) => {
            const fechaNorm = normalizarFecha(fecha);
            db.all(querys.getHistorialAsistenciaPorFecha, [fechaNorm], (err, rows) => {
                if (err) return reject(err);
                resolve(formatearFilasAsistencia(rows));
            });
        });
    },

    async getHistorialAsistenciaPorEmpleadoYFecha(id_empleado, fecha) {
        return new Promise((resolve, reject) => {
            const fechaNorm = normalizarFecha(fecha);
            db.all(querys.getHistorialAsistenciaPorEmpleadoYFecha, [id_empleado, fechaNorm], (err, rows) => {
                if (err) return reject(err);
                resolve(formatearFilasAsistencia(rows));
            });
        });
    },

    async getEmpleadoMasResponsable() {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    e.id, 
                    e.nombre, 
                    e.apellido, 
                    e.cargo, 
                    e.departamento, 
                    e.cedula, 
                    e.foto_perfil,
                    e.tipo_jornada,
                    COALESCE(e.estatus_empleado, 'Activo') AS estatus_empleado,
                    COUNT(ha.id_asistencia) AS total_asistencias,
                    SUM(CASE WHEN ha.hora_salida IS NOT NULL THEN 1 ELSE 0 END) AS salidas_marcadas,
                    SUM(CASE WHEN ha.salida_manual = 0 AND ha.hora_salida IS NOT NULL THEN 1 ELSE 0 END) AS marcajes_perfectos,
                    SUM(CASE WHEN ha.hora_salida IS NULL THEN 1 ELSE 0 END) AS marcajes_pendientes,
                    MIN(ha.hora_entrada) AS primera_hora_entrada
                FROM empleados e
                LEFT JOIN historial_asistencia ha ON e.id = ha.empleado_id
                WHERE COALESCE(e.estatus_empleado, 'Activo') = 'Activo'
                GROUP BY e.id
                HAVING marcajes_perfectos > 0 OR salidas_marcadas > 0
                ORDER BY 
                    marcajes_perfectos DESC, 
                    salidas_marcadas DESC,
                    marcajes_pendientes ASC,
                    primera_hora_entrada ASC,
                    e.nombre ASC
                LIMIT 1
            `;
            db.get(sql, [], (err, row) => {
                if (err) return reject(err);
                resolve(row || null);
            });
        });
    }
};