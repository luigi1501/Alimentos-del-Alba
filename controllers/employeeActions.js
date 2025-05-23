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

        doc.rect(0, 0, 153, 243).fill('#FFFFFF');
        doc.lineWidth(0.5);
        doc.strokeColor('#A9A9A9');
        doc.rect(2, 2, 149, 239).stroke();

        doc.fillColor('#000000')
           .fontSize(7)
           .font('Helvetica-Bold')
           .text('REPÚBLICA BOLIVARIANA DE VENEZUELA', 0, 10, { align: 'center', width: 153 });

        const logoWidth = 50;
        const logoX = (153 - logoWidth) / 2;
        const logoY = 25;

        if (fs.existsSync(companyLogoPath)) {
            doc.image(companyLogoPath, logoX, logoY, { width: logoWidth });
        }

        doc.fillColor('#c0392b')
           .fontSize(14)
           .font('Helvetica-Bold')
           .text('ALIMENTOS DEL ALBA', 0, 70, { align: 'center', width: 153 });

        const photoQrSectionY = 95;
        const photoWidth = 60;
        const photoHeight = 60;
        const photoX = (153 - photoWidth) / 2;
        const photoY = photoQrSectionY;

        if (empleado.foto_perfil) {
            const fotoPerfilFullPath = getPublicPath(empleado.foto_perfil);
            if (fs.existsSync(fotoPerfilFullPath)) {
                doc.image(fotoPerfilFullPath, photoX, photoY, {
                    width: photoWidth,
                    height: photoHeight,
                    fit: [photoWidth, photoHeight],
                    align: 'center',
                    valign: 'center'
                });
            }
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

        const footerY = 243 - 35;
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
        }
    }
};
