const rateLimit = require('express-rate-limit');

/**
 * Rate limiter para rutas de login.
 * Máximo 5 intentos por IP cada 15 minutos.
 */
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: true,
        message: 'Demasiados intentos de inicio de sesión. Por favor, intenta de nuevo en 15 minutos.'
    },
    handler: (req, res, next, options) => {
        // Para rutas que esperan JSON (API)
        if (req.accepts('json') && !req.accepts('html')) {
            return res.status(429).json(options.message);
        }
        // Para rutas que renderizan HTML (formularios web)
        return res.redirect(`${req.path}?error=tooManyAttempts`);
    }
});

/**
 * Rate limiter general para rutas públicas de la API.
 * Máximo 100 peticiones por IP cada 15 minutos.
 */
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
});

module.exports = { loginLimiter, generalLimiter };
