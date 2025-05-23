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

        const qrCodeData = `ID:${empleado.id}|CI:${empleado.cedula}|${empleado.nombre} ${empleado.apellido}`;
        const qrCodeImageBase64 = await QRCode.toDataURL(qrCodeData, { width: 70, margin: 1 });

        const carnetBackgroundPath = getPublicPath('images/carnet_template_vertical.png');
        const companyLogoPath = getPublicPath('images/logo.jpg');

        const doc = new PDFDocument({
            size: [153, 243],
            margin: 0
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="carnet_${empleado.nombre.replace(/\s/g, '')}_${empleado.apellido.replace(/\s/g, '')}.pdf"`);

        doc.pipe(res);

        if (fs.existsSync(carnetBackgroundPath)) {
            doc.image(carnetBackgroundPath, 0, 0, { width: 153, height: 243 });
        } else {
            console.warn('Advertencia: No se encontró la imagen de fondo del carnet vertical en:', carnetBackgroundPath);
            doc.rect(0, 0, 153, 243).fill('#e0f7fa');
        }

        doc.fillColor('#000000')
           .fontSize(7)
           .font('Helvetica-Bold')
           .text('REPÚBLICA BOLIVARIANA DE VENEZUELA', 0, 10, { align: 'center', width: 153 });

        if (fs.existsSync(companyLogoPath)) {
            doc.image(companyLogoPath, (153 - 60) / 2, 25, { width: 60 }); 
        } else {
            console.warn('Advertencia: El logo de la empresa no se encontró en la ruta:', companyLogoPath);
            doc.fontSize(8).fillColor('gray').text('Logo', (153 - 40) / 2, 30, { width: 40, align: 'center' });
        }

        doc.fillColor('#c0392b')
           .fontSize(14)
           .font('Helvetica-Bold')
           .text('ALIMENTOS DEL ALBA', 0, 80, { align: 'center', width: 153 });

        if (empleado.foto_perfil) {
            const fotoPerfilFullPath = getPublicPath(empleado.foto_perfil);
            if (fs.existsSync(fotoPerfilFullPath)) {
                doc.image(fotoPerfilFullPath, (153 - 70) / 2, 105, { width: 70, height: 70, fit: [70, 70], align: 'center', valign: 'center' });
            } else {
                console.warn('Advertencia: La foto de perfil del empleado no se encontró en la ruta:', fotoPerfilFullPath);
                doc.rect((153 - 70) / 2, 105, 70, 70).fill('#cccccc');
                doc.fillColor('black').fontSize(8).text('Sin Foto', (153 - 70) / 2, 130, { width: 70, align: 'center' });
            }
        } else {
            doc.rect((153 - 70) / 2, 105, 70, 70).fill('#cccccc');
            doc.fillColor('black').fontSize(8).text('Sin Foto', (153 - 70) / 2, 130, { width: 70, align: 'center' });
        }

        doc.image(qrCodeImageBase64, (153 - 70) / 2, 185);

        doc.fillColor('#000000')
           .fontSize(10)
           .font('Helvetica-Bold')
           .text(`${empleado.nombre.toUpperCase()} ${empleado.apellido.toUpperCase()}`, 0, 215, { align: 'center', width: 153 })
           .font('Helvetica')
           .fontSize(9) 
           .text(`${empleado.cedula}`, 0, 225, { align: 'center', width: 153 });

        doc.fontSize(8)
           .text(`${empleado.cargo.toUpperCase()}`, 0, 235, { align: 'center', width: 153 });

        doc.fillColor('#555')
           .fontSize(7)
           .text('Alimentos del Alba C.A.', 0, 250, { align: 'center', width: 153 })
           .text('¡Nutriendo a Venezuela!', 0, 260, { align: 'center', width: 153 });

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