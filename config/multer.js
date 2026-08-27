const multer = require('multer');

const MAX_FILE_SIZE_MB = 5;

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Solo se permiten imágenes JPEG, PNG, JPG o WEBP.'), false);
    }
};

const upload = multer({
    storage,
    limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024 },
    fileFilter
});

module.exports = upload;
