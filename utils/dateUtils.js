const { DateTime } = require('luxon');

const TIMEZONE = 'America/Caracas';

/**
 * Formatea un string ISO a hora legible en la zona horaria de Venezuela.
 * @param {string|null} isoString
 * @returns {string|null}
 */
const formatHora = (isoString) => {
    if (!isoString) return null;
    return DateTime.fromISO(isoString)
        .setZone(TIMEZONE)
        .toFormat('hh:mm:ss a');
};

/**
 * Formatea un string de fecha a formato DD/MM/YYYY en la zona horaria de Venezuela.
 * @param {string|null} fechaString
 * @returns {string|null}
 */
const formatFecha = (fechaString) => {
    if (!fechaString) return null;
    return DateTime.fromISO(fechaString)
        .setZone(TIMEZONE)
        .toFormat('dd/MM/yyyy');
};

/**
 * Obtiene la fecha de hoy en formato YYYY-MM-DD en la zona horaria de Venezuela.
 * @returns {string}
 */
const fechaHoy = () => {
    return DateTime.now().setZone(TIMEZONE).toISODate();
};

/**
 * Obtiene el timestamp actual en ISO en la zona horaria de Venezuela.
 * @returns {string}
 */
const ahoraISO = () => {
    return DateTime.now().setZone(TIMEZONE).toISO();
};

/**
 * Normaliza una fecha recibida del cliente a formato YYYY-MM-DD.
 * Usa luxon para evitar problemas de timezone con `new Date()`.
 * @param {string} fechaString
 * @returns {string}
 */
const normalizarFecha = (fechaString) => {
    return DateTime.fromISO(fechaString).toISODate();
};

module.exports = { formatHora, formatFecha, fechaHoy, ahoraISO, normalizarFecha };
