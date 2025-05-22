const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const dotenv = require('dotenv');
const fs = require('fs');
const isAuthenticated = require('./middleware/authMiddleware');
const multer = require('multer');
const QRCode = require('qrcode');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

const db = require('./db/models'); 

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

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, 'public', 'uploads');
        fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedMimes = ['image/jpeg', 'image/png', 'image/jpg'];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten imágenes JPEG, PNG o JPG.'), false);
        }
    }
});

const authRouter = require('./routes/auth');
const indexRouter = require('./routes/index');
const employeeController = require('./controllers/employeeController');

app.use('/auth', authRouter);
app.use('/', indexRouter);

app.post('/empleados/perfil/upload-foto', isAuthenticated, upload.single('profilePic'), employeeController.uploadProfilePhoto);
app.get('/empleados/descargar-carnet', isAuthenticated, employeeController.downloadCarnet);

app.get('/panel-empleado', isAuthenticated, async (req, res) => {
    try {
        const empleado = await db.getEmpleadoPorId(req.session.userId);
        let qrCodeUrl = null;

        if (empleado && empleado.qr_code) {
            qrCodeUrl = await QRCode.toDataURL(empleado.qr_code);
        }

        res.render('panel-empleado', {
            empleado: empleado,
            qrCodeUrl: qrCodeUrl
        });
    } catch (error) {
        console.error('Error al cargar el panel del empleado:', error);
        req.session.message = { type: 'danger', text: 'No se pudo cargar la información de tu panel. Por favor, intenta de nuevo.' };
        res.redirect('/auth/login-empleado');
    }
});

app.use((req, res, next) => {
    res.status(404).send("Lo siento, no puedo encontrar eso!");
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            req.session.message = { type: 'danger', text: 'El archivo es demasiado grande (máximo 5MB).' };
        } else {
            req.session.message = { type: 'danger', text: 'Error al subir el archivo: ' + err.message };
        }
        return res.redirect('/panel-empleado');
    }
    res.status(500).send('¡Algo salió mal en el servidor!');
});

app.listen(port, () => {
    console.log(`Servidor Express escuchando en http://localhost:${port}`);
    console.log('Presiona CTRL+C para detener el servidor');
});