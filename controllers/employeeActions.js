const db = require('../db/models');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');
const PDFDocument = require('pdfkit');
const cloudinary = require('../config/cloudinary');
const https = require('https');
const http = require('http');

// Helper: subir buffer a Cloudinary
const uploadToCloudinary = (fileBuffer, userId) => {
    return new Promise((resolve, reject) => {
        if (!process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME.trim() === '') {
            return reject(new Error('Credenciales de Cloudinary no configuradas en .env'));
        }
        const stream = cloudinary.uploader.upload_stream(
            {
                folder: 'alimentos-del-alba/perfiles',
                public_id: `perfil-${userId}-${Date.now()}`,
                overwrite: true,
                transformation: [
                    { width: 400, height: 400, crop: 'fill', gravity: 'face' }
                ]
            },
            (error, result) => {
                if (error) return reject(error);
                resolve(result);
            }
        );
        stream.end(fileBuffer);
    });
};

// Helper: obtener buffer de imagen (local o remoto via URL)
const fetchImageBuffer = async (imagePathOrUrl) => {
    if (!imagePathOrUrl) return null;
    if (imagePathOrUrl.startsWith('http://') || imagePathOrUrl.startsWith('https://')) {
        return new Promise((resolve) => {
            const protocol = imagePathOrUrl.startsWith('https') ? https : http;
            protocol.get(imagePathOrUrl, (res) => {
                if (res.statusCode !== 200) return resolve(null);
                const data = [];
                res.on('data', chunk => data.push(chunk));
                res.on('end', () => resolve(Buffer.concat(data)));
                res.on('error', () => resolve(null));
            }).on('error', () => resolve(null));
        });
    } else {
        const cleanPath = imagePathOrUrl.replace(/^\/+/, '');
        const potentialPath = path.join(__dirname, '..', 'public', cleanPath);
        if (fs.existsSync(potentialPath)) {
            return fs.readFileSync(potentialPath);
        }
    }
    return null;
};

const uploadProfilePhoto = async (req, res) => {
    try {
        if (!req.file || !req.file.buffer) {
            req.session.message = { type: 'danger', text: 'No se seleccionó ninguna imagen.' };
            return res.redirect('/auth/panel-empleado');
        }

        const userId = req.session.userId;
        let newPhotoPath;

        if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_CLOUD_NAME.trim() !== '') {
            const uploadResult = await uploadToCloudinary(req.file.buffer, userId);
            newPhotoPath = uploadResult.secure_url;
        } else {
            req.session.message = { type: 'danger', text: 'Cloudinary no está configurado. Agrega tus credenciales en el archivo .env' };
            return res.redirect('/auth/panel-empleado');
        }

        await db.updateEmpleadoFotoPerfil(userId, newPhotoPath);

        req.session.message = { type: 'success', text: 'Foto de perfil actualizada exitosamente en Cloudinary.' };
        res.redirect('/auth/panel-empleado');

    } catch (error) {
        console.error('Error al subir la foto de perfil a Cloudinary:', error);
        req.session.message = { type: 'danger', text: 'Hubo un error al actualizar la foto de perfil: ' + error.message };
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
        const qrCodeDataURL = await QRCode.toDataURL(qrCodeData, { width: 250, margin: 1 });

        const doc = new PDFDocument({
            size: 'A4',
            margins: { top: 40, bottom: 40, left: 40, right: 40 }
        });

        const filename = `Carnet_AlimentosDelAlba_${empleado.cedula}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        doc.pipe(res);

        // ── Dimensiones del Carnet (Centrado en hoja A4) ─────────────
        const pageWidth = doc.page.width;
        const cardWidth = 260;
        const cardHeight = 440;
        const cardX = (pageWidth - cardWidth) / 2;
        const cardY = 90;

        // 1. Sombra exterior
        doc.roundedRect(cardX - 2, cardY - 2, cardWidth + 4, cardHeight + 4, 16)
           .fill('#CBD5E1');

        // 2. Fondo Blanco del Carnet
        doc.roundedRect(cardX, cardY, cardWidth, cardHeight, 14)
           .fill('#FFFFFF');

        // 3. Encabezado Institucional (Azul Oscuro #0F172A)
        doc.save();
        doc.roundedRect(cardX, cardY, cardWidth, 80, 14)
           .fill('#0F172A');
        doc.rect(cardX, cardY + 60, cardWidth, 20).fill('#0F172A');
        doc.restore();

        // Franja dorada de acento
        doc.rect(cardX, cardY + 77, cardWidth, 3).fill('#F59E0B');

        // Logo Institucional
        const logoPath = path.join(__dirname, '..', 'public', 'images', 'logo2.jpg');
        if (fs.existsSync(logoPath)) {
            doc.image(logoPath, cardX + 14, cardY + 14, { width: 36, height: 36 });
        }

        // Título del Encabezado
        doc.fillColor('#FFFFFF')
           .font('Helvetica-Bold')
           .fontSize(11)
           .text('ALIMENTOS DEL ALBA C.A.', cardX + 58, cardY + 16, { width: 185, align: 'left' });

        doc.fillColor('#F59E0B')
           .font('Helvetica-Bold')
           .fontSize(7.5)
           .text('CARNET DE IDENTIFICACIÓN', cardX + 58, cardY + 34, { width: 185, align: 'left' });

        // 4. Foto de Perfil del Empleado (Centrada)
        const photoY = cardY + 95;
        const photoWidth = 85;
        const photoHeight = 85;
        const photoX = cardX + (cardWidth - photoWidth) / 2;

        // Marco de la Foto
        doc.roundedRect(photoX - 3, photoY - 3, photoWidth + 6, photoHeight + 6, 8)
           .fill('#F1F5F9');
        doc.roundedRect(photoX - 1, photoY - 1, photoWidth + 2, photoHeight + 2, 7)
           .stroke('#D97706');

        let userPhotoBuffer = null;
        if (empleado.foto_perfil) {
            userPhotoBuffer = await fetchImageBuffer(empleado.foto_perfil);
        }
        if (!userPhotoBuffer && fs.existsSync(logoPath)) {
            userPhotoBuffer = fs.readFileSync(logoPath);
        }

        if (userPhotoBuffer) {
            doc.save();
            doc.roundedRect(photoX, photoY, photoWidth, photoHeight, 6).clip();
            doc.image(userPhotoBuffer, photoX, photoY, {
                cover: [photoWidth, photoHeight],
                align: 'center',
                valign: 'center'
            });
            doc.restore();
        }

        // 5. Datos del Empleado
        let infoY = photoY + photoHeight + 12;

        // Nombre Completo
        doc.fillColor('#0F172A')
           .font('Helvetica-Bold')
           .fontSize(13)
           .text(`${empleado.nombre} ${empleado.apellido || ''}`, cardX + 10, infoY, { width: cardWidth - 20, align: 'center' });

        infoY += 16;

        // Cargo
        doc.fillColor('#D97706')
           .font('Helvetica-Bold')
           .fontSize(9)
           .text((empleado.cargo || 'EMPLEADO').toUpperCase(), cardX + 10, infoY, { width: cardWidth - 20, align: 'center' });

        infoY += 14;

        // Cédula & Departamento
        doc.fillColor('#475569')
           .font('Helvetica')
           .fontSize(8)
           .text(`C.I: V-${empleado.cedula}   |   Dpto: ${empleado.departamento || 'General'}`, cardX + 10, infoY, { width: cardWidth - 20, align: 'center' });

        infoY += 14;

        // 6. Código QR de Asistencia
        const base64Image = qrCodeDataURL.split(';base64,').pop();
        const qrBuffer = Buffer.from(base64Image, 'base64');
        const qrSize = 105;
        const qrX = cardX + (cardWidth - qrSize) / 2;

        doc.image(qrBuffer, qrX, infoY, { width: qrSize, height: qrSize });

        infoY += qrSize + 4;

        doc.fillColor('#64748B')
           .font('Helvetica-Bold')
           .fontSize(7)
           .text('CÓDIGO DE ASISTENCIA QR', cardX + 10, infoY, { width: cardWidth - 20, align: 'center' });

        // 7. Pie de Página del Carnet
        const footerY = cardY + cardHeight - 24;
        doc.rect(cardX, footerY, cardWidth, 24).fill('#F8FAFC');
        doc.fillColor('#94A3B8')
           .font('Helvetica')
           .fontSize(6)
           .text('Documento personal e intransferible. Propiedad de Alimentos del Alba C.A.', cardX + 5, footerY + 8, { width: cardWidth - 10, align: 'center' });

        doc.end();

    } catch (error) {
        console.error('Error al generar o descargar el PDF del QR:', error);
        res.status(500).send('Hubo un error al generar el carnet digital.');
    }
};

module.exports = {
    uploadProfilePhoto,
    downloadQrPdf
};