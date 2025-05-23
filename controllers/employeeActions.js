const db = require('../db/models');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode'); 
const uploadProfilePhoto = async (req, res) => {
    try {
        if (!req.file) {
            req.session.message = { type: 'danger', text: 'No se seleccionó ninguna imagen.' };
            return res.redirect('/auth/panel-empleado');
        }

        const userId = req.session.userId;
        const newPhotoPath = '/uploads/' + req.file.filename;

        await db.updateEmpleadoFotoPerfil(userId, newPhotoPath);

        req.session.message = { type: 'success', text: 'Foto de perfil actualizada exitosamente.' };
        res.redirect('/auth/panel-empleado');

    } catch (error) {
        console.error('Error al subir la foto de perfil:', error);
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        req.session.message = { type: 'danger', text: 'Hubo un error al actualizar la foto de perfil.' };
        res.redirect('/auth/panel-empleado');
    }
};

const downloadCarnet = async (req, res) => {
    try {
        const empleado = await db.getEmpleadoPorId(req.session.userId);

        if (!empleado) {
            req.session.message = { type: 'danger', text: 'No se encontró la información del empleado.' };
            return res.redirect('/auth/panel-empleado');
        }

        const qrCodeData = empleado.qr_code || `ID: ${empleado.id}, Nombre: ${empleado.nombre}`;

        const qrCodeImageBase64 = await QRCode.toDataURL(qrCodeData, { width: 300, margin: 2 });

        const imgBuffer = Buffer.from(qrCodeImageBase64.split(',')[1], 'base64');
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Content-Disposition', `attachment; filename="carnet_${empleado.nombre}.png"`);
        res.send(imgBuffer);

    } catch (error) {
        console.error('Error al descargar el carnet:', error);
        req.session.message = { type: 'danger', text: 'Hubo un error al generar o descargar el carnet.' };
        res.redirect('/auth/panel-empleado');
    }
};

module.exports = {
    uploadProfilePhoto,
    downloadCarnet
};