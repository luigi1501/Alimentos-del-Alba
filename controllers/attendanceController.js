const {
    getEmpleadoPorQrCode,
    registrarEntrada,
    registrarSalida,
    getHistorialAsistencia
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

            res.render('historial-asistencia', {
                title: 'Historial de Asistencia',
                historial: historial,
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