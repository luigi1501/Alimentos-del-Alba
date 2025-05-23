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

        const qrCodeData = `ID: ${empleado.id}, Cédula: ${empleado.cedula}, Nombre: ${empleado.nombre} ${empleado.apellido}`;
        const qrCodeImageBase64 = await QRCode.toDataURL(qrCodeData, { width: 100, margin: 2 });

        const carnetBackgroundPath = getPublicPath('images/carnet_template.png');
        const companyLogoPath = getPublicPath('images/logo.jpg');
        const doc = new PDFDocument({
            size: [243, 153],
            margin: 0
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="carnet_${empleado.nombre.replace(/\s/g, '')}_${empleado.apellido.replace(/\s/g, '')}.pdf"`);

        doc.pipe(res);

        if (fs.existsSync(carnetBackgroundPath)) {
            doc.image(carnetBackgroundPath, 0, 0, { width: 243, height: 153 });
        } else {
            console.warn('Advertencia: No se encontró la imagen de fondo del carnet en:', carnetBackgroundPath);
            doc.rect(0, 0, 243, 153).fill('#e0f7fa');
        }

        if (fs.existsSync(companyLogoPath)) {
            doc.image(companyLogoPath, 10, 10, { width: 40 });
        } else {
            console.warn('Advertencia: El logo de la empresa no se encontró en la ruta:', companyLogoPath);
            doc.fontSize(8).fillColor('gray').text('Logo no disponible', 10, 10, { width: 40, align: 'center' });
        }

        doc.fillColor('#2c3e50')
           .fontSize(14)
           .font('Helvetica-Bold')
           .text('CARNET DEL EMPLEADO', 60, 20, { align: 'left', width: 170 });

        doc.fontSize(10)
           .font('Helvetica')
           .text(`Nombre: ${empleado.nombre} ${empleado.apellido}`, 60, 50)
           .text(`Cédula: ${empleado.cedula}`, 60, 65)
           .text(`Cargo: ${empleado.cargo}`, 60, 80)
           .text(`Departamento: ${empleado.departamento}`, 60, 95);

        if (empleado.foto_perfil) {
            const fotoPerfilFullPath = getPublicPath(empleado.foto_perfil);
            if (fs.existsSync(fotoPerfilFullPath)) {
                doc.image(fotoPerfilFullPath, 170, 10, { width: 60, height: 60, fit: [60, 60], align: 'center', valign: 'center' });
            } else {
                console.warn('Advertencia: La foto de perfil del empleado no se encontró en la ruta:', fotoPerfilFullPath);
                doc.rect(170, 10, 60, 60).fill('#cccccc');
                doc.fillColor('black').fontSize(8).text('Sin Foto', 170, 35, { width: 60, align: 'center' });
            }
        } else {
            doc.rect(170, 10, 60, 60).fill('#cccccc');
            doc.fillColor('black').fontSize(8).text('Sin Foto', 170, 35, { width: 60, align: 'center' });
        }

        doc.image(qrCodeImageBase64, 170, 80, { width: 60 });

        doc.fillColor('#555')
           .fontSize(7)
           .text('Alimentos del Alba C.A.', 10, 135, { align: 'left' })
           .text('¡Nutriendo a Venezuela!', 10, 145, { align: 'left' });

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