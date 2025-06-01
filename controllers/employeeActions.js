const db = require('../db/models');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');
const PDFDocument = require('pdfkit');

const getPublicPath = (relativePath) => {
    return path.join(__dirname, '..', 'public', relativePath);
};

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

const downloadQrPdf = async (req, res) => {
    try {
        const empleado = await db.getEmpleadoPorId(req.session.userId);

        if (!empleado) {
            return res.status(404).send('Información del empleado no encontrada.');
        }

        const qrCodeData = `ID:${empleado.id}|CI:${empleado.cedula}`;
        const qrCodeDataURL = await QRCode.toDataURL(qrCodeData, { width: 300, margin: 2 });

        const doc = new PDFDocument({
            size: 'A4',
            margins: {
                top: 50,
                bottom: 50,
                left: 50,
                right: 50
            }
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="QR_Asistencia_AlimentosDelAlba_${empleado.nombre.replace(/\s/g, '')}_${empleado.apellido.replace(/\s/g, '')}.pdf"`);

        doc.pipe(res);

        doc.font('Helvetica-Bold') 
           .fontSize(24)
           .text('Código QR de Asistencia', { align: 'center' })
           .moveDown(0.7);

        doc.font('Helvetica')
           .fontSize(16)
           .text('Alimentos del Alba C.A.', { align: 'center' })
           .moveDown(0.5);

        doc.fontSize(12)
           .text(`Empleado: ${empleado.nombre} ${empleado.apellido}`, { align: 'center' })
           .text(`Cédula de Identidad: ${empleado.cedula}`, { align: 'center' })
           .moveDown(1.5);

        const currentDate = new Date().toLocaleDateString('es-VE', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        doc.fontSize(10)
           .text(`Fecha de emisión: ${currentDate}`, { align: 'center' })
           .moveDown(1);

        const base64Image = qrCodeDataURL.split(';base64,').pop();
        const imageBuffer = Buffer.from(base64Image, 'base64');

        const imgSize = 200;
        const x = (doc.page.width - imgSize) / 2; 
        const y = doc.y;

        doc.image(imageBuffer, x, y, { width: imgSize, height: imgSize });

        doc.moveDown(2);

        doc.fontSize(12)
           .text('Presente este código para registrar su asistencia en la entrada y salida de la jornada laboral.', { align: 'center' })
           .moveDown(0.5);
        doc.text('Este código es personal e intransferible.', { align: 'center' });

        doc.end();

    } catch (error) {
        console.error('Error al generar o descargar el PDF del QR:', error);
        res.status(500).send('Hubo un error al generar o descargar el código QR en PDF.');
    }
};

module.exports = {
    uploadProfilePhoto,
    downloadQrPdf
};