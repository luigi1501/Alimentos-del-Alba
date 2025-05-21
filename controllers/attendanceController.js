const {
    getEmpleadoPorQrCode,
    registrarEntrada,
    registrarSalida,
    getHistorialAsistencia,
} = require('../db/models');

const attendanceController = {

    registrarAsistenciaQR: async (req, res) => {
        const { qr_code, tipo } = req.body;

        if (!qr_code || !tipo) {
            return res.status(400).json({ error: true, message: 'Datos incompletos: Código QR o tipo de asistencia no proporcionado.' });
        }

        try {
            const empleado = await getEmpleadoPorQrCode(qr_code);

            if (!empleado) {
                return res.status(404).json({ error: true, message: 'Empleado no encontrado para este código QR.' });
            }

            let message = '';
            if (tipo === 'entrada') {
                await registrarEntrada(empleado.id);
                message = `Entrada registrada para ${empleado.nombre} ${empleado.apellido}.`;
            } else if (tipo === 'salida') {
                await registrarSalida(empleado.id);
                message = `Salida registrada para ${empleado.nombre} ${empleado.apellido}.`;
            } else {
                return res.status(400).json({ error: true, message: 'Tipo de asistencia inválido. Debe ser "entrada" o "salida".' });
            }

            return res.status(200).json({ success: true, message: message });

        } catch (error) {
            console.error('Error al registrar la asistencia:', error);
            if (error.message.includes('Ya se registró una entrada para hoy')) {
                return res.status(409).json({ error: true, message: 'Ya tienes una entrada registrada para hoy. Debes registrar una salida antes de otra entrada.' });
            }
            if (error.message.includes('No se encontró una entrada pendiente')) {
                return res.status(409).json({ error: true, message: 'No se encontró una entrada pendiente para hoy para registrar la salida.' });
            }
            return res.status(500).json({ error: true, message: 'Error interno del servidor al registrar la asistencia.' });
        }
    },

    mostrarHistorialAsistencia: async (req, res) => {
        try {
            const historial = await getHistorialAsistencia();
            const formattedHistorial = historial.map(registro => {
                const horaEntradaDate = new Date(registro.hora_entrada);
                const horaSalidaDate = registro.hora_salida ? new Date(registro.hora_salida) : null;

                return {
                    ...registro,
                    fechaFormatted: new Date(registro.fecha).toLocaleDateString('es-VE', { timeZone: 'America/Caracas', year: 'numeric', month: '2-digit', day: '2-digit' }),
                    horaEntradaFormatted: horaEntradaDate.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'America/Caracas' }),
                    horaSalidaFormatted: horaSalidaDate ? horaSalidaDate.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'America/Caracas' }) : 'N/A'
                };
            });

            res.render('historial-asistencia', {
                title: 'Historial de Asistencia',
                historial: formattedHistorial,
                error: null
            });

        } catch (error) {
            console.error('Error al obtener historial de asistencia:', error);
            res.render('historial-asistencia', {
                title: 'Historial de Asistencia',
                historial: [],
                error: 'No se pudo cargar el historial de asistencia. Por favor, inténtalo de nuevo más tarde.'
            });
        }
    }
};

module.exports = attendanceController;