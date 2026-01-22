const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const app = express();

// 1. Configuración de middlewares
app.use(express.json());
app.use(express.static(__dirname));

// 2. Conexión a MongoDB Atlas (Usando la variable que pusimos en Render)
const mongoURI = process.env.MONGO_URI; 

mongoose.connect(mongoURI)
    .then(() => console.log("✅ Conectado a MongoDB Atlas"))
    .catch(err => console.error("❌ Error de conexión a Mongo:", err));

// 3. Definir el esquema de los sitios (Cómo se guardan los datos)
const SitioSchema = new mongoose.Schema({
    nombre: String,
    descripcion: String,
    caracteristicas: [String],
    lat: Number,
    lng: Number,
    puntuacion: Number,
    reportes: Number
});

const Sitio = mongoose.model('Sitio', SitioSchema);

// 4. RUTAS API

// Obtener todos los sitios
app.get('/api/sitios', async (req, res) => {
    try {
        const sitios = await Sitio.find();
        res.json(sitios);
    } catch (err) {
        res.status(500).json({ error: "Error al obtener sitios" });
    }
});

// Guardar un nuevo sitio
app.post('/api/sitios', async (req, res) => {
    try {
        const nuevoSitio = new Sitio(req.body);
        await nuevoSitio.save();
        res.status(201).json({ mensaje: "¡Sitio guardado con éxito! 🎉" });
    } catch (err) {
        res.status(500).json({ error: "Error al guardar sitio" });
    }
});

// Página principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 5. Encendido del servidor (CORREGIDO)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor funcionando en el puerto ${PORT}`);
});