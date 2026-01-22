const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3000;

app.use(express.json());

// Servir archivos estáticos (CSS, JS, Imágenes)
app.use(express.static(__dirname));

const ARCHIVO_DB = 'base_de_datos.json';

// --- Funciones de Base de Datos ---
function cargarDatos() {
    if (fs.existsSync(ARCHIVO_DB)) {
        try {
            const datosRaw = fs.readFileSync(ARCHIVO_DB, 'utf-8');
            return JSON.parse(datosRaw);
        } catch (e) {
            console.error("Error al leer el JSON, devolviendo lista vacía");
            return [];
        }
    } else {
        return [];
    }
}

function guardarDatos(datos) {
    fs.writeFileSync(ARCHIVO_DB, JSON.stringify(datos, null, 2));
}

let baseDeDatos = cargarDatos();

// --- RUTAS ---

// Página principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Cambiado de /api/locales a /api/sitios para que coincida con tu app.js
app.get('/api/sitios', (req, res) => {
    res.json(baseDeDatos);
});

app.post('/api/sitios', (req, res) => {
    const nuevoSitio = req.body;
    baseDeDatos.push(nuevoSitio);
    guardarDatos(baseDeDatos);
    res.status(201).json({ mensaje: "¡Sitio guardado con éxito! 🎉" });
});

// Esto permite que Render elija el puerto automáticamente
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Servidor funcionando en el puerto ${PORT}`);
});