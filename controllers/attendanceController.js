const {
    getEmpleadoPorQrCode,
    registrarEntrada,
    registrarSalida,
    getHistorialAsistencia,
    getHistorialAsistenciaPorMes,
    cerrarSalidaManual,
    getempleados,
    getEntradaHoy,
    verificarEstadoQrEmpleado,
} = require('../db/models');
const { formatFecha, formatHora, fechaHoy, ahoraISO } = require('../utils/dateUtils');
const ExcelJS = require('exceljs');
const { DateTime } = require('luxon');

const TIMEZONE = 'America/Caracas';

/**
 * Calcula la duración entre dos marcas de tiempo ISO en minutos y texto legible.
 */
function calcularDuracion(entradaISO, salidaISO) {
    if (!entradaISO || !salidaISO) return { minutos: 0, texto: 'N/A' };
    const inicio = DateTime.fromISO(entradaISO).setZone(TIMEZONE);
    const fin = DateTime.fromISO(salidaISO).setZone(TIMEZONE);
    const diff = fin.diff(inicio, ['hours', 'minutes']).toObject();
    const horas = Math.floor(diff.hours || 0);
    const minutos = Math.floor(diff.minutes || 0);
    const totalMinutos = (horas * 60) + minutos;
    return {
        minutos: totalMinutos,
        texto: `${horas} hr${horas !== 1 ? 's' : ''} ${minutos} min${minutos !== 1 ? 's' : ''}`
    };
}

/**
 * Genera la evaluación y observación inteligente para cada registro de asistencia.
 */
function evaluarRegistroInteligente(registro) {
    const hoy = fechaHoy();
    const esHoy = registro.fecha === hoy;
    const tieneSalida = Boolean(registro.hora_salida_raw || (registro.hora_salida && registro.hora_salida !== 'N/A'));
    const esSalidaManual = Boolean(registro.salida_manual);
    const jornadaNombre = registro.tipo_jornada || 'Diurna (8:00 AM - 5:00 PM)';

    // Caso 1: Sin salida en fecha pasada (QR Bloqueado)
    if (!tieneSalida && !esHoy) {
        return {
            estado: 'Bloqueado (Sin Salida)',
            duracion: 'Incompleto',
            evaluacion: 'Salida no registrada',
            observacion: `Atención: El empleado no escaneó su salida el día ${formatFecha(registro.fecha) || registro.fecha}. Código QR bloqueado hasta regularizar con el Administrador.`,
            alertaTipo: 'danger'
        };
    }

    // Caso 2: Jornada en curso el día de hoy
    if (!tieneSalida && esHoy) {
        const horaEntradaFmt = registro.hora_entrada || 'N/A';
        return {
            estado: 'En Jornada (Activa)',
            duracion: 'En curso',
            evaluacion: 'En proceso',
            observacion: `En jornada activa [${jornadaNombre}]. Entrada registrada a las ${horaEntradaFmt}. Pendiente por marcar salida.`,
            alertaTipo: 'warning'
        };
    }

    // Caso 3: Jornada cerrada (ya sea por escaneo o por ajuste manual)
    const dur = calcularDuracion(registro.hora_entrada_raw, registro.hora_salida_raw);
    const durMinutos = dur.minutos;
    const durTexto = dur.texto;

    let evaluacionTurno = 'Turno Normal';
    let detalleEvaluacion = 'Cumplió su horario regular.';

    // Asumiendo jornada regular estándar de 8 horas (480 minutos)
    const horasReglamentariasMinutos = 480;

    if (durMinutos > horasReglamentariasMinutos + 30) {
        const extraMin = durMinutos - horasReglamentariasMinutos;
        const extraHrs = (extraMin / 60).toFixed(1);
        evaluacionTurno = `Horas Extra (+${extraHrs} hrs)`;
        detalleEvaluacion = `Permaneció más tiempo de su turno reglamentario (+${extraMin} min).`;
    } else if (durMinutos < horasReglamentariasMinutos - 30 && durMinutos > 0) {
        const menosMin = horasReglamentariasMinutos - durMinutos;
        evaluacionTurno = `Salida Anticipada (-${menosMin} min)`;
        detalleEvaluacion = `Marcó salida antes de completar la jornada reglamentaria (-${menosMin} min).`;
    }

    let obsTexto = esSalidaManual
        ? `Salida registrada manualmente por Administración. ${detalleEvaluacion}`
        : `Jornada [${jornadaNombre}] completada. ${detalleEvaluacion}`;

    return {
        estado: esSalidaManual ? 'Completado (Manual)' : 'Jornada Completa',
        duracion: durTexto,
        evaluacion: evaluacionTurno,
        observacion: obsTexto,
        alertaTipo: 'success'
    };
}

const attendanceController = {

    // ── Consulta inteligente de Estado al Escanear QR ──────────────
    consultarEstadoScan: async (req, res) => {
        const { qr_code } = req.body;

        if (!qr_code) {
            return res.status(400).json({ error: true, message: 'Código QR no proporcionado.' });
        }

        try {
            const empleado = await getEmpleadoPorQrCode(qr_code);

            if (!empleado) {
                return res.status(404).json({ error: true, message: 'No se encontró ningún empleado registrado con este Código QR.' });
            }

            const estadoQr = await verificarEstadoQrEmpleado(empleado.id);
            if (!estadoQr.qrHabilitado) {
                return res.status(400).json({
                    error: true,
                    blocked: true,
                    message: estadoQr.motivo,
                    empleado
                });
            }

            const entradaPendienteHoy = await getEntradaHoy(empleado.id);
            const tieneEntradaHoy = Boolean(entradaPendienteHoy);

            let horaEntradaFormateada = null;
            if (tieneEntradaHoy && entradaPendienteHoy.hora_entrada) {
                horaEntradaFormateada = formatHora(entradaPendienteHoy.hora_entrada);
            }

            return res.status(200).json({
                success: true,
                empleado: {
                    id: empleado.id,
                    nombre: `${empleado.nombre} ${empleado.apellido || ''}`,
                    cedula: empleado.cedula,
                    cargo: empleado.cargo || 'Empleado',
                    departamento: empleado.departamento || 'Planta',
                    tipo_jornada: empleado.tipo_jornada || 'Diurna (8:00 AM - 5:00 PM)'
                },
                tieneEntradaHoy,
                horaEntradaHoy: horaEntradaFormateada,
                accionRecomendada: tieneEntradaHoy ? 'salida' : 'entrada',
                mensajeEstado: tieneEntradaHoy
                    ? `Entrada registrada hoy a las ${horaEntradaFormateada}. Pulsa para marcar Salida.`
                    : `Jornada asignada: ${empleado.tipo_jornada || 'Diurna'}. Pulsa para marcar Entrada.`
            });

        } catch (error) {
            console.error('Error al consultar estado de escaneo:', error);
            return res.status(500).json({ error: true, message: 'Error interno al consultar el Código QR.' });
        }
    },

    // ── Registro por Código QR ─────────────────────────────────────
    registrarAsistenciaQR: async (req, res) => {
        const { qr_code, tipo, observacion } = req.body;

        if (!qr_code || !tipo) {
            return res.status(400).json({ error: true, message: 'Datos incompletos: Código QR o tipo de asistencia no proporcionado.' });
        }

        try {
            const empleado = await getEmpleadoPorQrCode(qr_code);

            if (!empleado) {
                return res.status(404).json({ error: true, message: 'Empleado no encontrado para este código QR.' });
            }

            let message = '';
            const obsTexto = observacion && observacion.trim() !== '' ? observacion.trim() : null;

            if (tipo === 'entrada') {
                await registrarEntrada(empleado.id, obsTexto);
                message = `¡Entrada registrada exitosamente para ${empleado.nombre} ${empleado.apellido}! Jornada: ${empleado.tipo_jornada || 'Diurna'}`;
            } else if (tipo === 'salida') {
                await registrarSalida(empleado.id, obsTexto);
                message = `¡Salida registrada exitosamente para ${empleado.nombre} ${empleado.apellido}!`;
            } else {
                return res.status(400).json({ error: true, message: 'Tipo de asistencia inválido.' });
            }

            return res.status(200).json({ success: true, message: message });

        } catch (error) {
            console.error('Error al registrar la asistencia:', error);
            return res.status(409).json({ error: true, message: error.message || 'Error al procesar la asistencia.' });
        }
    },

    // ── Vista de Historial General (Admin) ─────────────────────────
    mostrarHistorialAsistencia: async (req, res) => {
        try {
            const historialRaw = await getHistorialAsistencia();
            const empleados = await getempleados();

            const formattedHistorial = historialRaw.map(registro => {
                const evalInfo = evaluarRegistroInteligente(registro);
                return {
                    ...registro,
                    fechaFormatted: formatFecha(registro.fecha) || registro.fecha,
                    horaEntradaFormatted: registro.hora_entrada || 'N/A',
                    horaSalidaFormatted: registro.hora_salida || 'N/A',
                    estadoJornada: evalInfo.estado,
                    duracionJornada: evalInfo.duracion,
                    evaluacionTurno: evalInfo.evaluacion,
                    observacionInteligente: evalInfo.observacion,
                    alertaTipo: evalInfo.alertaTipo
                };
            });

            res.render('historial-asistencia', {
                title: 'Historial de Asistencia',
                historial: formattedHistorial,
                empleados: empleados || [],
                message: req.session.message || null,
                error: null
            });

            delete req.session.message;

        } catch (error) {
            console.error('Error al obtener historial de asistencia:', error);
            res.render('historial-asistencia', {
                title: 'Historial de Asistencia',
                historial: [],
                empleados: [],
                message: null,
                error: 'No se pudo cargar el historial de asistencia.'
            });
        }
    },

    // ── Cierre Manual de Salida por Admin (Desbloquea el QR) ───────
    cerrarSalidaManual: async (req, res) => {
        const { id_asistencia, hora_salida, observacion } = req.body;

        if (!id_asistencia || !hora_salida) {
            req.session.message = { type: 'danger', text: 'Debes proporcionar la hora de salida para completar el registro.' };
            return res.redirect('/historial-asistencia');
        }

        try {
            // Construir ISO string con la fecha del registro original y la hora ingresada (HH:mm)
            const historial = await getHistorialAsistencia();
            const registroTarget = historial.find(r => r.id_asistencia === parseInt(id_asistencia));

            if (!registroTarget) {
                req.session.message = { type: 'danger', text: 'Registro de asistencia no encontrado.' };
                return res.redirect('/historial-asistencia');
            }

            const fechaRegistro = registroTarget.fecha; // YYYY-MM-DD
            const horaSalidaISO = `${fechaRegistro}T${hora_salida}:00-04:00`;
            const obsTexto = observacion && observacion.trim() !== '' ? observacion.trim() : null;

            await cerrarSalidaManual(id_asistencia, horaSalidaISO, obsTexto);

            req.session.message = {
                type: 'success',
                text: `Salida registrada manualmente${obsTexto ? ` (motivo: ${obsTexto})` : ''}. El Código QR del empleado ha sido desbloqueado exitosamente.`
            };
            res.redirect('/historial-asistencia');

        } catch (error) {
            console.error('Error al cerrar salida manualmente:', error);
            req.session.message = { type: 'danger', text: 'No se pudo registrar la salida manual.' };
            res.redirect('/historial-asistencia');
        }
    },

    // ── Exportar Historial a Excel (.xlsx) ──────────────────────────
    exportarExcelGeneral: async (req, res) => {
        const { mes, empleadoId } = req.query;

        try {
            const historialRaw = await getHistorialAsistenciaPorMes(mes, empleadoId);

            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'Alimentos del Alba C.A.';
            workbook.lastModifiedBy = 'Panel de Administración';
            workbook.created = new Date();

            const sheet = workbook.addWorksheet('Historial de Asistencia', {
                views: [{ showGridLines: true }]
            });

            // Configurar Ancho de Columnas
            sheet.columns = [
                { header: 'Nº Reg.', key: 'id', width: 10 },
                { header: 'Empleado', key: 'nombre', width: 26 },
                { header: 'Cédula', key: 'cedula', width: 15 },
                { header: 'Cargo', key: 'cargo', width: 22 },
                { header: 'Departamento', key: 'departamento', width: 18 },
                { header: 'Tipo de Jornada', key: 'jornada', width: 28 },
                { header: 'Fecha', key: 'fecha', width: 14 },
                { header: 'Hora Entrada', key: 'entrada', width: 16 },
                { header: 'Hora Salida', key: 'salida', width: 16 },
                { header: 'Duración', key: 'duracion', width: 16 },
                { header: 'Evaluación de Turno', key: 'evaluacion', width: 22 },
                { header: 'Estado', key: 'estado', width: 22 },
                { header: 'Observaciones e Incidencias (Inteligente)', key: 'observacion', width: 55 }
            ];

            // Título Superior Institucional (Fila 1)
            sheet.insertRow(1, ['ALIMENTOS DEL ALBA C.A. — REPORTE OFICIAL DE ASISTENCIA LABORAL']);
            sheet.mergeCells('A1:M1');
            const titleRow = sheet.getRow(1);
            titleRow.height = 35;
            titleRow.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
            titleRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
            titleRow.alignment = { vertical: 'middle', horizontal: 'center' };

            // Subtítulo de Filtro Aplicado (Fila 2)
            let textoFiltro = `Filtro: ${mes && mes !== 'todos' ? 'Mes ' + mes : 'Historial Completo'}`;
            if (empleadoId && empleadoId !== 'todos') {
                textoFiltro += ` | ID Empleado: ${empleadoId}`;
            }
            sheet.insertRow(2, [textoFiltro]);
            sheet.mergeCells('A2:M2');
            const subTitleRow = sheet.getRow(2);
            subTitleRow.height = 22;
            subTitleRow.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FFF59E0B' } };
            subTitleRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
            subTitleRow.alignment = { vertical: 'middle', horizontal: 'center' };

            // Fila Vaciá (Fila 3)
            sheet.insertRow(3, []);

            // Formatear Encabezados de Tabla (Fila 4)
            const headerRow = sheet.getRow(4);
            headerRow.height = 26;
            headerRow.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
            headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
            headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

            // Contadores para Resumen Final
            let totalRegistros = 0;
            let totalCompletados = 0;
            let totalBloqueados = 0;

            // Rellenar Filas de Datos
            historialRaw.forEach((reg) => {
                totalRegistros++;
                const evalInfo = evaluarRegistroInteligente(reg);

                if (evalInfo.estado.includes('Completo')) totalCompletados++;
                if (evalInfo.estado.includes('Bloqueado')) totalBloqueados++;

                const rowData = {
                    id: `#${reg.id_asistencia}`,
                    nombre: `${reg.nombre} ${reg.apellido || ''}`,
                    cedula: `V-${reg.cedula}`,
                    cargo: reg.cargo || 'General',
                    departamento: reg.departamento || 'Planta',
                    jornada: reg.tipo_jornada || 'Diurna (8:00 AM - 5:00 PM)',
                    fecha: formatFecha(reg.fecha) || reg.fecha,
                    entrada: reg.hora_entrada || 'N/A',
                    salida: reg.hora_salida || 'No registrada',
                    duracion: evalInfo.duracion,
                    evaluacion: evalInfo.evaluacion,
                    estado: evalInfo.estado,
                    observacion: evalInfo.observacion
                };

                const addedRow = sheet.addRow(rowData);
                addedRow.height = 22;
                addedRow.alignment = { vertical: 'middle', wrapText: true };

                // Resaltado de color según el estado del marcaje
                const obsCell = addedRow.getCell('observacion');
                const estadoCell = addedRow.getCell('estado');

                if (evalInfo.alertaTipo === 'danger') {
                    obsCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } }; // Rojo suave
                    obsCell.font = { color: { argb: 'FF991B1B' }, bold: true };
                    estadoCell.font = { color: { argb: 'FF991B1B' }, bold: true };
                } else if (evalInfo.alertaTipo === 'warning') {
                    obsCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }; // Amarillo suave
                    obsCell.font = { color: { argb: 'FF92400E' } };
                } else {
                    obsCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } }; // Verde suave
                    obsCell.font = { color: { argb: 'FF065F46' } };
                }
            });

            // Fila de Resumen / Totales al final
            sheet.addRow([]);
            const summaryRow = sheet.addRow([
                'RESUMEN GENERAL',
                `Total Registros: ${totalRegistros}`,
                '',
                `Jornadas Completadas: ${totalCompletados}`,
                '',
                `Pendientes / Bloqueados: ${totalBloqueados}`,
                '', '', '', '', '', '', ''
            ]);
            summaryRow.height = 28;
            summaryRow.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F172A' } };
            summaryRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
            summaryRow.alignment = { vertical: 'middle', horizontal: 'center' };

            // Nombre dinámico del archivo
            const fechaStr = new Date().toISOString().slice(0, 10);
            const fileName = `Reporte_Asistencia_AlimentosDelAlba_${mes || 'Completo'}_${fechaStr}.xlsx`;

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

            await workbook.xlsx.write(res);
            res.end();

        } catch (error) {
            console.error('Error al generar la exportación de Excel:', error);
            res.status(500).send('Hubo un error al generar el archivo Excel.');
        }
    }
};

module.exports = attendanceController;
