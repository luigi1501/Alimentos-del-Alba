const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const db = require('../db/models');

const employeeController = {
    uploadProfilePhoto: async (req, res) => {
        if (!req.file) {
            req.session.message = { type: 'danger', text: 'No se seleccionó ningún archivo.' };
            return res.redirect('/panel-empleado');
        }

        try {
            const userId = req.session.userId;
            const fotoPerfilPath = `/uploads/${req.file.filename}`; 

            await db.updateEmpleadoFotoPerfil(userId, fotoPerfilPath);

            req.session.message = { type: 'success', text: 'Foto de perfil actualizada con éxito.' };
            res.redirect('/panel-empleado');

        } catch (error) {
            console.error('Error al subir o actualizar la foto de perfil:', error);
            req.session.message = { type: 'danger', text: 'Error al actualizar la foto de perfil.' };
            res.redirect('/panel-empleado');
        }
    },

    downloadCarnet: async (req, res) => {
        const userId = req.session.userId;

        if (!userId) {
            req.session.message = { type: 'danger', text: 'No se pudo obtener la información del empleado. Por favor, inicie sesión de nuevo.' };
            return res.redirect('/auth/login-empleado');
        }

        try {
            const empleado = await db.getEmpleadoPorId(userId);
            if (!empleado) {
                req.session.message = { type: 'danger', text: 'Empleado no encontrado.' };
                return res.redirect('/panel-empleado');
            }

            const doc = new PDFDocument({
                size: [240, 360],
                margins: { top: 20, bottom: 20, left: 20, right: 20 }
            });

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="carnet_${empleado.cedula}.pdf"`);

            doc.pipe(res);

            try {
                 const logoPath = path.join(__dirname, '../public/images/logo2.jpg'); 
                 if (fs.existsSync(logoPath)) {
                     doc.image(logoPath, {
                         fit: [50, 50],
                         align: 'center',
                         valign: 'top'
                     }).moveDown(0.5);
                 }
            } catch (error) {
                 console.warn('No se pudo cargar el logo del carnet:', error.message);
            }

            doc.fontSize(14).text('Alimentos del Alba', { align: 'center' });
            doc.fontSize(10).text('Carnet de Empleado', { align: 'center' }).moveDown();

            if (empleado.foto_perfil) {
                const fotoFullPath = path.join(__dirname, '../public', empleado.foto_perfil);
                try {
                    if (fs.existsSync(fotoFullPath)) {
                        const imageData = fs.readFileSync(fotoFullPath);
                        doc.image(imageData, {
                            fit: [80, 80],
                            align: 'center'
                        }).moveDown();
                    } else {
                        console.warn(`[PDF] Foto de perfil no encontrada en la ruta: ${fotoFullPath}`);
                        doc.text('Foto no disponible', { align: 'center' }).moveDown();
                    }
                } catch (imgError) {
                    console.error('[PDF] Error al incrustar la foto:', imgError);
                    doc.text('Error al cargar foto', { align: 'center' }).moveDown();
                }
            } else {
                doc.text('Sin foto de perfil', { align: 'center' }).moveDown();
            }

            doc.fontSize(12).text(`Nombre: ${empleado.nombre} ${empleado.apellido}`);
            doc.fontSize(12).text(`Cédula: ${empleado.cedula}`);
            doc.fontSize(12).text(`Cargo: ${empleado.cargo}`);
            doc.fontSize(12).text(`Departamento: ${empleado.departamento}`).moveDown();

            if (empleado.qr_code) {
                try {
                    const qrCodeDataUrl = await QRCode.toDataURL(empleado.qr_code, { scale: 4, margin: 1 });
                    doc.image(qrCodeDataUrl, {
                        fit: [80, 80],
                        align: 'center'
                    });
                } catch (qrError) {
                    console.error('[PDF] Error al generar o incrustar el QR code:', qrError);
                    doc.text('QR No Disponible', { align: 'center' });
                }
            } else {
                doc.text('QR No Asignado', { align: 'center' });
            }

            doc.end();

        } catch (error) {
            console.error('Error al generar el carnet PDF:', error);
            res.status(500).send('Error al generar el carnet. Por favor, inténtelo de nuevo.');
        }
    }
};

module.exports = employeeController;