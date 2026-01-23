let mapa, marcadores = [], locales = [], editandoId = null;
let localidadDetectada = "";
let mapaSel, marcadorSel;

// Cargar Datos
async function cargarSitios() {
    try {
        const r = await fetch('/api/sitios');
        locales = await r.json();
        document.getElementById('loading-overlay').style.display = 'none';
        mostrarSitios(locales);
    } catch(e) { console.error(e); }
}

// Iconos Completos
const crearIcono = (emoji, color) => L.divIcon({
    html: `<div style="background-color: ${color}; width: 35px; height: 35px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3); font-size: 20px;">${emoji}</div>`,
    className: '', iconSize: [35, 35], iconAnchor: [17, 35], popupAnchor: [0, -35]
});

const iconos = {
    movilidad: crearIcono('♿', '#006D77'),
    calma: crearIcono('🧠', '#83C5BE'),
    visual: crearIcono('👁️', '#E29578'),
    cognitiva: crearIcono('🧩', '#FFD700'),
    auditiva: crearIcono('👂', '#4CAF50'),
    perro: crearIcono('🐕', '#FF9800'),
    default: crearIcono('📍', '#008080')
};

function initMap() {
    if (mapa) return;
    mapa = L.map('mapa', {zoomControl: false}).setView([40.4167, -3.7033], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapa);
}

function mostrarSitios(lista) {
    if (mapa) { marcadores.forEach(m => mapa.removeLayer(m)); }
    marcadores = [];
    const divContenedor = document.getElementById('contenedor-items-lista');
    if (divContenedor) divContenedor.innerHTML = '';

    const grupos = lista.reduce((acc, s) => {
        const loc = s.localidad || 'UBICACIÓN GENERAL';
        if (!acc[loc]) acc[loc] = [];
        acc[loc].push(s);
        return acc;
    }, {});

    Object.keys(grupos).sort().forEach(ciudad => {
        // En lista
        if (divContenedor) {
            const card = document.createElement('div');
            card.className = 'item-lista';
            card.innerHTML = `<h3>${ciudad}</h3><p>${grupos[ciudad].length} sitios registrados</p>`;
            divContenedor.appendChild(card);
        }
        
        // En mapa
        grupos[ciudad].forEach(s => {
            let icono = iconos.default;
            if (s.caracteristicas.includes('Rampa')) icono = iconos.movilidad;
            if (s.caracteristicas.includes('Calma')) icono = iconos.calma;
            if (s.caracteristicas.includes('Braille') || s.caracteristicas.includes('Podotactil')) icono = iconos.visual;
            if (s.caracteristicas.includes('Pictogramas')) icono = iconos.cognitiva;
            if (s.caracteristicas.includes('LSA') || s.caracteristicas.includes('Aro')) icono = iconos.auditiva;
            
            if (mapa) {
                const m = L.marker([s.lat, s.lng], { icon: icono }).addTo(mapa).bindPopup(`<b>${s.nombre}</b><br>${s.descripcion}`);
                marcadores.push(m);
            }
        });
    });
}

// Búsqueda Inteligente (Efecto Uber)
async function buscarDireccion() {
    const calle = document.getElementById('input-direccion').value;
    if (!calle) return Swal.fire('Escribe una dirección');
    
    // Limpieza
    let busqueda = calle.replace(/calle|av.|avenida/gi, "").trim();
    
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(busqueda)}&addressdetails=1&limit=1`);
    const data = await r.json();
    
    if (data.length > 0) {
        const info = data[0];
        const addr = info.address;
        const ciudad = addr.city || addr.town || addr.village || "Desconocida";
        const pais = addr.country || "";
        localidadDetectada = `${ciudad.toUpperCase()}, ${pais.toUpperCase()}`;
        
        const lat = parseFloat(info.lat);
        const lon = parseFloat(info.lon);
        
        mapaSel.flyTo([lat, lon], 17);
        if (marcadorSel) marcadorSel.setLatLng([lat, lon]);
        else {
            marcadorSel = L.marker([lat, lon], {draggable: true}).addTo(mapaSel);
            marcadorSel.on('dragend', (e) => actualizarDireccionDesdePin(e.target.getLatLng().lat, e.target.getLatLng().lng));
        }
    } else {
        Swal.fire('No encontrado. Prueba agregar la ciudad.');
    }
}

async function actualizarDireccionDesdePin(lat, lng) {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`);
    const data = await r.json();
    if (data && data.address) {
        document.getElementById('input-direccion').value = (data.address.road || "") + " " + (data.address.house_number || "");
        localidadDetectada = `${(data.address.city || "Ciudad").toUpperCase()}, ${(data.address.country || "").toUpperCase()}`;
    }
}

async function guardarSitio() {
    const nombre = document.getElementById('nombre').value;
    const desc = document.getElementById('descripcion').value;
    const checks = document.querySelectorAll('.cat-check:checked');
    const caracteristicas = Array.from(checks).map(c => c.value);
    
    if (!nombre || !marcadorSel) return Swal.fire('Faltan datos');

    const datos = {
        nombre, descripcion: desc, caracteristicas,
        localidad: localidadDetectada || "UBICACIÓN GENERAL",
        lat: marcadorSel.getLatLng().lat, lng: marcadorSel.getLatLng().lng
    };

    await fetch('/api/sitios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos) });
    location.reload();
}

function buscarDesdeInicio() {
    const t = document.getElementById('input-inicio').value;
    document.getElementById('pantalla-inicio').style.display = 'none';
    document.getElementById('pantalla-resultados').style.display = 'flex';
    initMap();
    setTimeout(() => {
        mapa.invalidateSize();
        const res = locales.filter(l => l.nombre.toLowerCase().includes(t.toLowerCase()));
        mostrarSitios(res);
    }, 200);
}

function cargarResultados(tipo) {
    document.getElementById('pantalla-inicio').style.display = 'none';
    document.getElementById('pantalla-resultados').style.display = 'flex';
    initMap();
    setTimeout(() => {
        mapa.invalidateSize();
        // Mapeo de categorías grandes a etiquetas específicas
        let filtro = [];
        if (tipo === 'Auditiva') filtro = ['LSA', 'Aro'];
        else if (tipo === 'Motora') filtro = ['Rampa', 'Baño'];
        else if (tipo === 'Cognitiva') filtro = ['Pictogramas', 'Calma'];
        else if (tipo === 'Visual') filtro = ['Braille', 'Podotactil', 'Perro'];
        
        let res = tipo ? locales.filter(l => l.caracteristicas.some(c => filtro.includes(c))) : locales;
        mostrarSitios(res);
    }, 200);
}

function abrirFormulario() {
    document.getElementById('modal-anadir').style.display = 'flex';
    if (!mapaSel) {
        mapaSel = L.map('mapa-seleccion', { zoomControl: false }).setView([40.41, -3.70], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapaSel);
        mapaSel.on('click', e => {
            if (marcadorSel) marcadorSel.setLatLng(e.latlng);
            else marcadorSel = L.marker(e.latlng, {draggable: true}).addTo(mapaSel);
        });
    }
    setTimeout(() => mapaSel.invalidateSize(), 200);
}

function cerrarModal() { document.getElementById('modal-anadir').style.display = 'none'; }
function cerrarModalFiltros() { document.getElementById('modal-filtros').style.display = 'none'; }
function abrirModalFiltros() { document.getElementById('modal-filtros').style.display = 'flex'; }
function alternarVista() {
    const m = document.getElementById('contenedor-mapa-pro'), l = document.getElementById('vista-lista');
    const isMap = m.style.display !== 'none';
    m.style.display = isMap ? 'none' : 'flex';
    l.style.display = isMap ? 'block' : 'none';
}

window.onload = cargarSitios;