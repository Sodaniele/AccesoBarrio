require('dotenv').config(); 
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ---------------------------------------------------------
// 🕵️‍♀️ ZONA DE DIAGNÓSTICO DE BASE DE DATOS
// ---------------------------------------------------------
const mongoUri = process.env.MONGO_URI;

if (!mongoUri) {
    console.error("❌ ERROR: Falta la variable MONGO_URI en el archivo .env");
    process.exit(1);
}

mongoose.connect(mongoUri)
    .then(async () => {
        console.log('✅ Conectado a MongoDB Atlas');
        
        // CHIVATO: ¿A qué base de datos estoy conectado?
        console.log(`📂 Base de datos seleccionada: "${mongoose.connection.name}"`);
        
        // CHIVATO: ¿Qué colecciones (carpetas) hay aquí dentro?
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log("📚 Colecciones encontradas en esta base de datos:");
        collections.forEach(c => console.log(`   - 📁 ${c.name}`));
        
        if (collections.length === 0) {
            console.log("⚠️ ¡ALERTA! Esta base de datos está VACÍA. Revisa el nombre en el archivo .env");
        }
    })
    .catch(err => console.error('❌ Error de conexión:', err));

// ---------------------------------------------------------

// DEFINICIÓN DEL MODELO (FORZANDO EL NOMBRE 'sitios')
const SitioSchema = new mongoose.Schema({
    nombre: String,
    descripcion: String,
    caracteristicas: [String],
    lat: Number,
    lng: Number,
    localidad: { type: String, default: "UBICACIÓN GENERAL" },
    puntuacion: { type: Number, default: 5 },
    reportes: { type: Number, default: 0 },
    verificaciones: { type: Number, default: 0 } 
});

// ⚠️ AQUÍ ESTÁ LA CLAVE: El tercer parámetro 'sitios' obliga a usar esa colección exacta.
// Si en tu Atlas se llama 'Sitios' (con mayúscula), cambia 'sitios' por 'Sitios' aquí abajo.
const Sitio = mongoose.model('Sitio', SitioSchema, 'sitios');

// RUTAS API
app.get('/api/sitios', async (req, res) => {
    try {
        const sitios = await Sitio.find();
        console.log(`🔎 Petición recibida: enviando ${sitios.length} sitios al mapa.`);
        res.json(sitios);
    } catch (err) {
        res.status(500).json({ error: 'Error al obtener sitios' });
    }
});

app.post('/api/sitios', async (req, res) => {
    try {
        const nuevoSitio = new Sitio(req.body);
        await nuevoSitio.save();
        res.status(201).json(nuevoSitio);
    } catch (err) {
        res.status(400).json({ error: 'Error al guardar' });
    }
});

app.put('/api/sitios/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const datos = req.body;
        const sitioActualizado = await Sitio.findByIdAndUpdate(id, datos, { new: true });
        if (!sitioActualizado) return res.status(404).json({ error: 'No encontrado' });
        res.json(sitioActualizado);
    } catch (err) {
        res.status(500).json({ error: 'Error al actualizar' });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
    console.log(`🚀 Servidor listo en http://localhost:${port}`);
});