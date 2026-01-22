const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const app = express();

// 1. Configuración de middlewares
app.use(express.json());
app.use(express.static(__dirname));

// 2. Conexión a MongoDB Atlas
const mongoURI = process.env.MONGO_URI; 

mongoose.connect(mongoURI)
    .then(() => console.log("✅ Conectado a MongoDB Atlas"))
    .catch(err => console.error("❌ Error de conexión a Mongo:", err));

// 3. Definir el esquema de los sitios
const SitioSchema = new mongoose.Schema({
    nombre: String,
    descripcion: String,
    caracteristicas: [String],
    lat: Number,
    lng: Number,
    puntuacion: { type: Number, default: 5 },
    reportes: { type: Number, default: 0 }
});

const Sitio = mongoose.model('Sitio', SitioSchema);

// 4. RUTAS API

// --- OBTENER TODOS LOS SITIOS ---
app.get('/api/sitios', async (req, res) => {
    try {
        const sitios = await Sitio.find();
        res.json(sitios);
    } catch (err) {
        res.status(500).json({ error: "Error al obtener sitios" });
    }
});

// --- GUARDAR UN NUEVO SITIO (POST) ---
app.post('/api/sitios', async (req, res) => {
    try {
        const nuevoSitio = new Sitio(req.body);
        await nuevoSitio.save();
        res.status(201).json({ mensaje: "¡Sitio guardado con éxito! 🎉" });
    } catch (err) {
        res.status(500).json({ error: "Error al guardar sitio" });
    }
});

// --- ACTUALIZAR UN SITIO EXISTENTE (PUT) ---
// ✨ Nueva ruta para la función de editar
app.put('/api/sitios/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const datosActualizados = req.body;
        
        const sitioActualizado = await Sitio.findByIdAndUpdate(id, datosActualizados, { new: true });
        
        if (!sitioActualizado) {
            return res.status(404).json({ error: "No se encontró el sitio para editar" });
        }
        
        res.json({ mensaje: "Sitio actualizado correctamente ✅", sitio: sitioActualizado });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error al actualizar el sitio" });
    }
});

// --- REPORTAR UN SITIO (POST) ---
// ✨ Nueva ruta para el botón de la advertencia ⚠️
app.post('/api/sitios/:id/reportar', async (req, res) => {
    try {
        const { id } = req.params;
        // Buscamos el sitio y sumamos 1 al contador de reportes
        await Sitio.findByIdAndUpdate(id, { $inc: { reportes: 1 } });
        res.json({ mensaje: "Reporte registrado correctamente" });
    } catch (err) {
        res.status(500).json({ error: "Error al procesar el reporte" });
    }
});

// --- PÁGINA PRINCIPAL ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 5. Encendido del servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor funcionando en el puerto ${PORT}`);
});