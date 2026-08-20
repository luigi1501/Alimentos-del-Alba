const multer = require('multer');
const path = require('path');
const fs = require('fs');

const UPLOAD_DIR = path.join(__dirname, '..', 'public', 'uploads');
const MAX_FILE_SIZE_MB = 5;

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        fs.mkdirSync(UPLOAD_DIR, { recursive: true });
        cb(null, UPLOAD_DIR);
    },
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname).toLowerCase();
        const safeName = `${Date.now()}-${req.session.userId || 'unknown'}${ext}`;
        cb(null, safeName);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Solo se permiten imágenes JPEG, PNG o JPG.'), false);
    }
};

const upload = multer({
    storage,
    limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024 },
    fileFilter
});

module.exports = upload;
