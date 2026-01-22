// src/controllers/localesController.js
const locales = require('../models/locales');

// Función 1: GET (Leer)
exports.obtenerTodosLosLocales = (req, res) => {
    res.json(locales);
};

// Función 2: POST (Crear)
exports.crearLocal = (req, res) => {
    const nuevoLocal = req.body;
    
    // Asignamos un ID temporal
    if (locales.length > 0) {
        nuevoLocal.id = locales[locales.length - 1].id + 1;
    } else {
        nuevoLocal.id = 1;
    }

    locales.push(nuevoLocal);
    
    console.log("✅ Local guardado:", nuevoLocal.nombre);
    
    res.status(201).json({
        mensaje: "Local creado correctamente",
        local: nuevoLocal
    });
};