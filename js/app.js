let mapa, marcadores = [], locales = [], editandoId = null;
let localidadDetectada = "";

// Cargar Datos
async function cargarSitios() {
    try {
        const r = await fetch('/api/sitios');
        locales = await r.json();
        document.getElementById('loading-overlay').style.display = 'none';
        mostrarSitios(locales);
    } catch(e) { console.error(e); }
}

// Iconos
const crearIcono = (emoji, color) => L.divIcon({
    html: `<div style="background-color: ${color}; width: 35px; height: 35px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid white; font-size: 20px;">${emoji}</div>`,
    className: '', iconSize: [35, 35], iconAnchor: [17, 35]
});

const iconos = {
    movilidad: crearIcono('♿', '#006D77'),
    calma: crearIcono('🧠', '#83C5BE'),
    visual: crearIcono('👁️', '#E29578'),
    default: crearIcono('📍', '#008080')
};

// Mostrar Sitios Agrupados por Ciudad
function mostrarSitios(lista) {
    if (mapa) { marcadores.forEach(m => mapa.removeLayer(m)); }
    marcadores = [];
    const divContenedor = document.getElementById('contenedor-items-lista');
    if (!divContenedor) return;
    divContenedor.innerHTML = '';

    // ✨ AGRUPACIÓN INTELIGENTE
    const grupos = lista.reduce((acc, s) => {
        const loc = s.localidad || 'UBICACIÓN GENERAL';
        if (!acc[loc]) acc[loc] = [];
        acc[loc].push(s);
        return acc;
    }, {});

    Object.keys(grupos).sort().forEach(ciudad => {
        const container = document.createElement('div');
        container.className = 'contenedor-ciudad';
        container.innerHTML = `
            <div class="header-ciudad" onclick="toggleCiudad(this)">
                <span>📍 ${ciudad}</span>
                <span class="contador-pines">${grupos[ciudad].length} sitios</span>
            </div>
            <div class="lista-pines-ciudad" style="display: none;"></div>
        `;
        const pinesDiv = container.querySelector('.lista-pines-ciudad');
        grupos[ciudad].forEach(s => {
            if (mapa) {
                const icono = s.caracteristicas.includes('Rampa') ? iconos.movilidad : iconos.default;
                const m = L.marker([s.lat, s.lng], { icon: icono }).addTo(mapa).bindPopup(`<b>${s.nombre}</b>`);
                marcadores.push(m);
            }
            const card = document.createElement('div');
            card.className = 'item-lista';
            card.innerHTML = `<h3>${s.nombre}</h3><p>${s.descripcion || ''}</p>
                <div>${s.caracteristicas.map(c => `<span class="tag-accesibilidad">${c}</span>`).join('')}</div>`;
            pinesDiv.appendChild(card);
        });
        divContenedor.appendChild(container);
    });
}

// ✨ BUSCADOR CON SUGERENCIAS DINÁMICAS
function filtrarPorZona() {
    const input = document.getElementById('inputBuscadorZona');
    const valor = input.value.toUpperCase();
    const listaSug = document.getElementById('sugerenciasZona');
    listaSug.innerHTML = '';

    if (valor.length < 1) { mostrarSitios(locales); return; }

    const ciudades = [...new Set(locales.map(l => l.localidad || 'UBICACIÓN GENERAL'))];
    const coincidencias = ciudades.filter(c => c.includes(valor));

    coincidencias.forEach(c => {
        const li = document.createElement('li');
        li.textContent = c;
        li.onclick = () => {
            input.value = c;
            listaSug.innerHTML = '';
            const filtrados = locales.filter(l => (l.localidad || 'UBICACIÓN GENERAL') === c);
            mostrarSitios(filtrados);
            // Abrir automáticamente el acordeón de la ciudad buscada
            setTimeout(() => {
                const header = document.querySelector('.header-ciudad');
                if (header) toggleCiudad(header);
            }, 100);
        };
        listaSug.appendChild(li);
    });
}

function toggleCiudad(el) {
    const list = el.nextElementSibling;
    list.style.display = (list.style.display === 'grid') ? 'none' : 'grid';
}

// Navegación
function alternarVista() {
    const mapCont = document.getElementById('contenedor-mapa-pro'), listCont = document.getElementById('vista-lista');
    const isMap = mapCont.style.display !== 'none';
    mapCont.style.display = isMap ? 'none' : 'flex';
    listCont.style.display = isMap ? 'block' : 'none';
    document.getElementById('btn-vista').innerText = isMap ? '🗺️ Ver Mapa' : '📋 Ver Lista';
}

function buscarDesdeInicio() {
    document.getElementById('pantalla-inicio').style.display = 'none';
    document.getElementById('pantalla-resultados').style.display = 'flex';
    initMap();
    mostrarSitios(locales);
}

function initMap() {
    if (mapa) return;
    mapa = L.map('mapa').setView([40.41, -3.70], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapa);
}

// Registro de Sitios
let mapaSel, marcadorSel;
function abrirFormulario() {
    document.getElementById('modal-anadir').style.display = 'flex';
    if (!mapaSel) {
        mapaSel = L.map('mapa-seleccion', { zoomControl: false }).setView([40.41, -3.70], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapaSel);
        mapaSel.on('click', e => {
            if (marcadorSel) marcadorSel.setLatLng(e.latlng);
            else marcadorSel = L.marker(e.latlng).addTo(mapaSel);
        });
    }
}

async function buscarDireccion() {
    const calle = document.getElementById('input-direccion').value;
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(calle)}&addressdetails=1&limit=1`);
    const data = await r.json();
    if (data.length > 0) {
        const addr = data[0].address;
        localidadDetectada = `${(addr.city || addr.town || addr.village || 'Desconocida').toUpperCase()}, ${(addr.country || 'ESPAÑA').toUpperCase()}`;
        mapaSel.setView([data[0].lat, data[0].lon], 16);
        if (marcadorSel) marcadorSel.setLatLng([data[0].lat, data[0].lon]);
        else marcadorSel = L.marker([data[0].lat, data[0].lon]).addTo(mapaSel);
    }
}

async function guardarSitio() {
    const datos = {
        nombre: document.getElementById('nombre').value,
        descripcion: document.getElementById('descripcion').value,
        localidad: localidadDetectada,
        lat: marcadorSel.getLatLng().lat, lng: marcadorSel.getLatLng().lng,
        caracteristicas: []
    };
    await fetch('/api/sitios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos) });
    location.reload();
}

// Cierres de modal
function cerrarModal() { document.getElementById('modal-anadir').style.display = 'none'; }
function cerrarModalFiltros() { document.getElementById('modal-filtros').style.display = 'none'; }
function abrirModalFiltros() { document.getElementById('modal-filtros').style.display = 'flex'; }

window.onload = cargarSitios;