const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const dotenv = require('dotenv');
const multer = require('multer');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const Jimp = require('jimp');
const fs = require('fs');
const isAuthenticated = require('./middleware/authMiddleware');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

const db = require('./db/models');
async function initializeDatabase() {
    try {
        console.log('Base de datos inicializada correctamente (o al menos módulos cargados).');
    } catch (error) {
        console.error('Error FATAL al inicializar la base de datos:', error);
        process.exit(1);
    }
}
initializeDatabase(); 

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.join(__dirname, 'public', 'uploads', 'profile_pics');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const fileExtension = path.extname(file.originalname);
        const userId = req.session.userId || 'temp';
        cb(null, `empleado_${userId}_${uniqueSuffix}${fileExtension}`);
    }
});

const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png' || file.mimetype === 'image/jpg') {
        cb(null, true);
    } else {
        cb(new Error('Solo se permiten imágenes JPEG, PNG o JPG.'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024
    }
});

app.use(session({
    secret: process.env.SESSION_SECRET || 'supersecretkey',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: process.env.NODE_ENV === 'production' }
}));

app.use((req, res, next) => {
    res.locals.userId = req.session.userId;
    res.locals.nombreEmpleado = req.session.nombreEmpleado;
    res.locals.empleadoApellido = req.session.empleadoApellido;
    res.locals.qrCodeUrl = req.session.qrCodeUrl;
    res.locals.message = req.session.message;
    delete req.session.message;
    next();
});

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const authRouter = require('./routes/auth');
const indexRouter = require('./routes/index');

app.use('/auth', authRouter);
app.use('/', indexRouter);

app.get('/panel-empleado', isAuthenticated, async (req, res) => {
    try {
        const empleado = await db.getEmpleadoPorId(req.session.userId);
        if (!empleado) {
            req.session.destroy(() => {
                res.redirect('/auth/login-empleado?error=sessionExpired');
            });
            return;
        }

        let qrCodeDataUrl = null;
        if (empleado.qr_code) {
            qrCodeDataUrl = await QRCode.toDataURL(empleado.qr_code);
        }

        res.render('panel-empleado', {
            empleado: empleado,
            qrCodeUrl: qrCodeDataUrl
        });
    } catch (error) {
        console.error("Error al cargar el panel del empleado:", error);
        req.session.message = { type: 'danger', text: 'Error al cargar tus datos. Por favor, intenta iniciar sesión de nuevo.' };
        res.redirect('/auth/login-empleado');
    }
});

app.post('/empleados/perfil/upload-foto', isAuthenticated, upload.single('profilePic'), async (req, res) => {
    try {
        if (!req.file) {
            req.session.message = {
                type: 'danger',
                text: 'No se seleccionó ningún archivo o el archivo no es una imagen válida (JPEG, PNG, JPG).'
            };
            return res.redirect('/panel-empleado');
        }

        const empleadoId = req.session.userId;
        const fotoPerfilPath = '/uploads/profile_pics/' + req.file.filename;

        await db.updateEmpleadoFotoPerfil(empleadoId, fotoPerfilPath);

        req.session.message = {
            type: 'success',
            text: 'Foto de perfil actualizada exitosamente.'
        };
        res.redirect('/panel-empleado');

    } catch (error) {
        console.error('Error al subir foto de perfil:', error);
        req.session.message = {
            type: 'danger',
            text: `Error al subir la foto de perfil: ${error.message}`
        };
        res.redirect('/panel-empleado');
    }
});

app.get('/empleados/descargar-carnet', isAuthenticated, async (req, res) => {
    try {
        const empleadoId = req.session.userId;
        const empleado = await db.getEmpleadoPorId(empleadoId);

        if (!empleado) {
            req.session.message = {
                type: 'danger',
                text: 'No se pudo encontrar la información del empleado para generar el carnet.'
            };
            return res.status(404).redirect('/panel-empleado');
        }

        const doc = new PDFDocument({
            size: [240, 380],
            margins: {
                top: 15,
                bottom: 15,
                left: 15,
                right: 15
            }
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="carnet_${empleado.nombre}_${empleado.apellido}.pdf"`);

        doc.pipe(res);

        doc.font('Helvetica-Bold').fontSize(16).fillColor('#003366')
           .text('CARNET DE EMPLEADO', { align: 'center' });

        doc.moveDown(0.5);

        const logoPath = path.join(__dirname, 'public', 'images', 'logo2.jpg');
        if (fs.existsSync(logoPath)) {
            try {
                const logoBuffer = fs.readFileSync(logoPath);
                doc.image(logoBuffer, {
                    fit: [60, 60],
                    align: 'center',
                    valign: 'center'
                });
                doc.moveDown(0.5);
            } catch (logoErr) {
                console.warn('Advertencia: No se pudo incrustar el logo en el PDF (error de lectura):', logoErr.message);
                doc.text('Logo no disponible', { align: 'center' }).moveDown();
            }
        } else {
            console.warn(`Advertencia: El logo no existe en la ruta: ${logoPath}.`);
            doc.text('Logo no disponible', { align: 'center' }).moveDown();
        }


        let imageBuffer;
        let finalProfilePicPath;

        if (empleado.foto_perfil) {
            finalProfilePicPath = path.join(__dirname, 'public', empleado.foto_perfil);
        } else {
            finalProfilePicPath = path.join(__dirname, 'public', 'images', 'default-profile-pic.png');
        }

        if (!fs.existsSync(finalProfilePicPath)) {
            console.warn(`Advertencia: La foto de perfil no existe en la ruta: ${finalProfilePicPath}. Usando la imagen por defecto.`);
            finalProfilePicPath = path.join(__dirname, 'public', 'images', 'default-profile-pic.png');
            if (!fs.existsSync(finalProfilePicPath)) {
                console.error(`ERROR FATAL: La imagen por defecto tampoco existe: ${finalProfilePicPath}`);
                throw new Error("No se encontró la foto de perfil ni la imagen por defecto.");
            }
        }

        try {
            const image = await Jimp.read(finalProfilePicPath);
            imageBuffer = await image.getBufferAsync(Jimp.MIME_PNG);

            doc.image(imageBuffer, (doc.page.width - 100) / 2, doc.y, {
                width: 100,
                height: 100,
                fit: [100, 100],
                align: 'center',
                valign: 'top'
            });
            doc.moveDown(5);
        } catch (imageErr) {
            console.error('Error al incrustar la foto de perfil en el PDF (con Jimp):', imageErr.message);
            doc.text('Foto de perfil no disponible', { align: 'center' }).moveDown();
            doc.moveDown(2);
        }

        doc.font('Helvetica-Bold').fontSize(12).fillColor('#333');
        doc.text(`${empleado.nombre} ${empleado.apellido}`, { align: 'center' });
        doc.moveDown(0.2);

        doc.font('Helvetica').fontSize(10).fillColor('#555');
        doc.text(`Cédula: ${empleado.cedula}`, { align: 'center' });
        doc.text(`Cargo: ${empleado.cargo}`, { align: 'center' });
        doc.text(`Departamento: ${empleado.departamento}`, { align: 'center' });

        doc.moveDown(1);

        const qrCodeData = empleado.qr_code;
        const qrCodePngBuffer = await QRCode.toBuffer(qrCodeData, { type: 'png', errorCorrectionLevel: 'H', scale: 4 });

        const qrSize = 80;
        const qrX = (doc.page.width - qrSize) / 2;
        const qrY = doc.y;

        doc.image(qrCodePngBuffer, qrX, qrY, { width: qrSize, height: qrSize });
        doc.moveDown(qrSize / doc.currentLineHeight);

        doc.moveDown(0.5);

        doc.font('Helvetica').fontSize(8).fillColor('#888')
           .text('Alimentos del Alba C.A.', { align: 'center' });

        doc.end();

    } catch (error) {
        console.error('Error al generar el carnet PDF:', error);
        req.session.message = {
            type: 'danger',
            text: 'Error al generar el carnet. Inténtalo de nuevo.'
        };
        res.status(500).redirect('/panel-empleado');
    }
});

app.post('/registrar-entrada', isAuthenticated, async (req, res) => {
    try {
        const empleadoId = req.session.userId;
        const horaEntrada = new Date(); 
        await db.crearRegistroHora(empleadoId, horaEntrada.toISOString(), null);

        req.session.message = { type: 'success', text: 'Entrada registrada con éxito.' };
        res.redirect('/panel-empleado');
    } catch (error) {
        console.error('Error al registrar entrada:', error);
        req.session.message = { type: 'danger', text: 'Error al registrar entrada. Inténtalo de nuevo.' };
        res.redirect('/panel-empleado');
    }
});

app.post('/registrar-salida', isAuthenticated, async (req, res) => {
    try {
        const empleadoId = req.session.userId;
        const ultimoRegistro = await db.getUltimoRegistroEntrada(empleadoId);

        if (!ultimoRegistro || ultimoRegistro.horaSalida) {
            req.session.message = { type: 'danger', text: 'No hay una entrada pendiente para registrar salida.' };
            return res.redirect('/panel-empleado');
        }

        const horaSalida = new Date();
        await db.actualizarRegistroSalida(ultimoRegistro.id, horaSalida.toISOString());

        req.session.message = { type: 'success', text: 'Salida registrada con éxito.' };
        res.redirect('/panel-empleado');
    } catch (error) {
        console.error('Error al registrar salida:', error);
        req.session.message = { type: 'danger', text: 'Error al registrar salida. Inténtalo de nuevo.' };
        res.redirect('/panel-empleado');
    }
});

app.get('/registros-empleado', isAuthenticated, async (req, res) => {
    try {
        const empleadoId = req.session.userId;
        const registros = await db.getRegistrosPorEmpleadoId(empleadoId);
        const formattedRegistros = registros.map(registro => {
            const fecha = new Date(registro.fecha).toLocaleDateString('es-VE', { timeZone: 'America/Caracas' });
            const horaEntrada = new Date(registro.horaEntrada).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'America/Caracas' });
            const horaSalida = registro.horaSalida ? new Date(registro.horaSalida).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'America/Caracas' }) : 'N/A';

            return {
                ...registro,
                fechaFormatted: fecha,
                horaEntradaFormatted: horaEntrada,
                horaSalidaFormatted: horaSalida
            };
        });

        res.render('registros-empleado', { registros: formattedRegistros });
    } catch (error) {
        console.error('Error al obtener registros de empleado:', error);
        req.session.message = { type: 'danger', text: 'Error al cargar los registros de hora.' };
        res.redirect('/panel-empleado');
    }
});


app.use((req, res, next) => {
    res.status(404).send("Lo siento, no puedo encontrar eso!");
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('¡Algo salió mal en el servidor!');
});

app.listen(port, () => {
    console.log(`Servidor Express escuchando en http://localhost:${port}`);
    console.log('Presiona CTRL+C para detener el servidor');
});