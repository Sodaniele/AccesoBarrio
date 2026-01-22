const express = require('express');
const router = express.Router();
// Importamos el controlador
const localesController = require('../controllers/localesController');

// Ruta para LEER (Esta ya te funcionaba)
router.get('/', localesController.obtenerTodosLosLocales);

// 👇 ¡ESTA ES LA LÍNEA QUE FALTA! 👇
// Sin esto, el servidor responde "Cannot POST"
router.post('/', localesController.crearLocal); 

module.exports = router;