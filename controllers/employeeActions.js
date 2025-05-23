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

const downloadCarnet = async (req, res) => {
    try {
        const empleado = await db.getEmpleadoPorId(req.session.userId);

        if (!empleado) {
            req.session.message = { type: 'danger', text: 'No se encontró la información del empleado.' };
            return res.redirect('/auth/panel-empleado');
        }

        const qrCodeData = `ID:${empleado.id}|CI:${empleado.cedula}`;
        const qrCodeImageBase64 = await QRCode.toDataURL(qrCodeData, { width: 60, margin: 1 });
        const companyLogoPath = getPublicPath('images/logo.jpg');

        const doc = new PDFDocument({
            size: [153, 243],
            margin: 0
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="carnet_${empleado.nombre.replace(/\s/g, '')}_${empleado.apellido.replace(/\s/g, '')}.pdf"`);

        doc.pipe(res);

        doc.rect(0, 0, 153, 243).fill('#F0F8FF');
        doc.lineWidth(1);
        doc.strokeColor('#A9A9A9');
        doc.rect(5, 5, 143, 233).stroke();

        doc.fillColor('#000000')
           .fontSize(7)
           .font('Helvetica-Bold')
           .text('REPÚBLICA BOLIVARIANA DE VENEZUELA', 0, 15, { align: 'center', width: 153 });

        if (fs.existsSync(companyLogoPath)) {
            const logoWidth = 50;
            doc.image(companyLogoPath, (153 - logoWidth) / 2, 30, { width: logoWidth });
        } else {
            console.warn('Advertencia: El logo de la empresa no se encontró en la ruta:', companyLogoPath);
            doc.fontSize(8).fillColor('gray').text('Logo', (153 - 40) / 2, 35, { width: 40, align: 'center' });
        }

        doc.fillColor('#c0392b')
           .fontSize(14)
           .font('Helvetica-Bold')
           .text('ALIMENTOS DEL ALBA', 0, 70, { align: 'center', width: 153 });

        const photoQrAreaY = 95;

        const photoWidth = 60;
        const photoHeight = 60;
        const photoX = (153 - photoWidth) / 2;
        const photoY = photoQrAreaY;

        if (empleado.foto_perfil) {
            const fotoPerfilFullPath = getPublicPath(empleado.foto_perfil);
            if (fs.existsSync(fotoPerfilFullPath)) {
                doc.image(fotoPerfilFullPath, photoX, photoY, { width: photoWidth, height: photoHeight, fit: [photoWidth, photoHeight], align: 'center', valign: 'center' });
            } else {
                console.warn('Advertencia: La foto de perfil del empleado no se encontró en la ruta:', fotoPerfilFullPath);
                doc.rect(photoX, photoY, photoWidth, photoHeight).fill('#cccccc');
                doc.fillColor('black').fontSize(8).text('Sin Foto', photoX, photoY + (photoHeight / 2) - 4, { width: photoWidth, align: 'center' });
            }
        } else {
            doc.rect(photoX, photoY, photoWidth, photoHeight).fill('#cccccc');
            doc.fillColor('black').fontSize(8).text('Sin Foto', photoX, photoY + (photoHeight / 2) - 4, { width: photoWidth, align: 'center' });
        }

        const qrWidth = 70;
        const qrX = (153 - qrWidth) / 2;
        const qrY = photoY + photoHeight + 8;

        doc.image(qrCodeImageBase64, qrX, qrY, { width: qrWidth });

        let currentY = qrY + qrWidth + 10;

        doc.fillColor('#000000')
           .fontSize(11)
           .font('Helvetica-Bold')
           .text(`${empleado.nombre.toUpperCase()} ${empleado.apellido.toUpperCase()}`, 0, currentY, { align: 'center', width: 153 });

        currentY += 15;
        doc.fontSize(10)
           .font('Helvetica')
           .text(`${empleado.cedula}`, 0, currentY, { align: 'center', width: 153 });

        currentY += 15;
        doc.fontSize(9)
           .text(`${empleado.cargo.toUpperCase()}`, 0, currentY, { align: 'center', width: 153 });


        if (empleado.departamento) {
            currentY += 12;
            doc.fontSize(8)
            .text(`${empleado.departamento.toUpperCase()}`, 0, currentY, { align: 'center', width: 153 });
        }

        const footerHeight = 35; 
        const footerY = 243 - footerHeight;

        doc.rect(0, footerY, 153, footerHeight).fill('#ADD8E6');

        doc.fillColor('#000000')
           .fontSize(7)
           .text('Alimentos del Alba C.A.', 0, footerY + 8, { align: 'center', width: 153 })
           .text('¡Nutriendo a Venezuela!', 0, footerY + 18, { align: 'center', width: 153 });

        doc.end();

    } catch (error) {
        console.error('Error al descargar el carnet PDF:', error);
        req.session.message = { type: 'danger', text: 'Hubo un error al generar o descargar el carnet PDF.' };
        if (!res.headersSent) {
            res.redirect('/auth/panel-empleado');
        } else {
            console.error('Error: Las cabeceras ya fueron enviadas, no se puede redirigir después de un error en la generación del PDF.');
        }
    }
};

module.exports = {
    uploadProfilePhoto,
    downloadCarnet
};