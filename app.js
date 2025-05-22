const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const dotenv = require('dotenv');

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

const authRouter = require('./routes/auth');
const indexRouter = require('./routes/index');
app.use('/auth', authRouter);
app.use('/', indexRouter);

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
        return res.redirect('/auth/panel-empleado');
    }
    res.status(500).send('¡Algo salió mal en el servidor!');
});

app.listen(port, () => {
    console.log(`Servidor Express escuchando en http://localhost:${port}`);
    console.log('Presiona CTRL+C para detener el servidor');
});