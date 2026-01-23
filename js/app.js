let mapa, marcadores = [], locales = [], ptoSel = 5;
let mapaSel, marcadorSel;
let editandoId = null;
let localidadDetectada = ""; // ✨ Nueva variable global

// Cargar Datos
async function cargarSitios() {
    try {
        const r = await fetch('/api/sitios');
        locales = await r.json();
        document.getElementById('loading-overlay').style.display = 'none';
        mostrarSitios(locales);
    } catch(e) { console.error(e); }
}

// Iconos personalizados
const crearIcono = (emoji, color) => L.divIcon({
    html: `<div style="background-color: ${color}; width: 35px; height: 35px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid white;">${emoji}</div>`,
    className: '', iconSize: [35, 35], iconAnchor: [17, 35]
});

const iconos = {
    movilidad: crearIcono('♿', '#006D77'),
    calma: crearIcono('🧠', '#83C5BE'),
    visual: crearIcono('👁️', '#E29578'),
    especial: crearIcono('❤️', '#FFD700'),
    default: crearIcono('📍', '#008080')
};

function mostrarSitios(lista) {
    marcadores.forEach(m => mapa.removeLayer(m));
    marcadores = [];
    
    // ✨ Cambiamos al nuevo contenedor de items
    const divContenedor = document.getElementById('contenedor-items-lista');
    if (!divContenedor) return;
    divContenedor.innerHTML = '';

    lista.forEach(s => {
        const esPinProtegido = s.nombre === "Familia Daniele";
        let iconoAUsar = s.caracteristicas.includes('Rampa') ? iconos.movilidad : iconos.default;
        if (esPinProtegido) iconoAUsar = iconos.especial;

        // Marcador Mapa
        const m = L.marker([s.lat, s.lng], { icon: iconoAUsar }).addTo(mapa).bindPopup(`<b>${s.nombre}</b>`);
        marcadores.push(m);

        // TARJETA LISTA
        const card = document.createElement('div');
        card.className = 'item-lista';
        card.innerHTML = `
            <div>
                <span class="tag-localidad">📍 ${s.localidad || 'UBICACIÓN GENERAL'}</span>
                <h3 style="margin:0; color:#006d77;">${s.nombre}</h3>
                <p style="font-size:12px; color:#666;">${s.descripcion || ''}</p>
            </div>
            <div style="margin-top:10px;">
                ${s.caracteristicas.map(cat => `<span class="tag-accesibilidad">${cat}</span>`).join('')}
            </div>
        `;
        divContenedor.appendChild(card);
    });
}

// Buscar Localidad (Nominatim)
async function buscarDireccion() {
    const calle = document.getElementById('input-direccion').value;
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(calle)}&limit=1&addressdetails=1`;
    
    const r = await fetch(url);
    const data = await r.json();
    if (data.length > 0) {
        const addr = data[0].address;
        const ciudad = addr.city || addr.town || addr.village || "Desconocida";
        const pais = addr.country || "";
        localidadDetectada = `${ciudad.toUpperCase()}, ${pais.toUpperCase()}`;
        
        const latlng = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
        mapaSel.setView(latlng, 17);
        if (marcadorSel) marcadorSel.setLatLng(latlng);
        else marcadorSel = L.marker(latlng).addTo(mapaSel);
    }
}

// Guardar con Localidad
async function guardarSitio() {
    const nombre = document.getElementById('nombre').value;
    const desc = document.getElementById('descripcion').value;
    const checks = document.querySelectorAll('.cat-check:checked');
    const caracteristicas = Array.from(checks).map(c => c.value);

    const datos = {
        nombre, descripcion: desc, caracteristicas,
        localidad: localidadDetectada, // ✨ Se guarda CIUDAD, PAÍS
        lat: marcadorSel.getLatLng().lat, lng: marcadorSel.getLatLng().lng
    };

    const r = await fetch('/api/sitios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos)
    });
    if (r.ok) location.reload();
}

// Filtro por Zona
function filtrarPorZona() {
    const texto = document.getElementById('inputBuscadorZona').value.toUpperCase();
    const sugerenciasUl = document.getElementById('sugerenciasZona');
    sugerenciasUl.innerHTML = '';

    if (texto.length < 1) { mostrarSitios(locales); return; }

    const zonas = [...new Set(locales.map(l => l.localidad).filter(l => l))];
    zonas.filter(z => z.includes(texto)).forEach(z => {
        const li = document.createElement('li');
        li.textContent = z;
        li.onclick = () => {
            document.getElementById('inputBuscadorZona').value = z;
            sugerenciasUl.innerHTML = '';
            mostrarSitios(locales.filter(l => l.localidad === z));
        };
        sugerenciasUl.appendChild(li);
    });
}

// Inicializar y utilidades (Mantenés tus funciones de alternarVista, initMap, etc.)
// ...
window.onload = cargarSitios;