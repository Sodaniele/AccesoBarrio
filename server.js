const express = require('express');
const app = express();
const PORT = 3000;

app.use(express.json());

app.get('/', (req, res) => {
    res.send('API de AccesoBarrio Online ♿ - Desde la Nube');
});

app.listen(PORT, () => {
    console.log(`Servidor en la nube corriendo en puerto ${PORT}`);
});