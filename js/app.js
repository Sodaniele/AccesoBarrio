let mapa, marcadores = [], locales = [], ptoSel = 5;
let mapaSel, marcadorSel;
let editandoId = null;
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

// Iconos personalizados
const crearIcono = (emoji, color) => L.divIcon({
    html: `<div style="background-color: ${color}; width: 35px; height: 35px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3); font-size: 20px;">${emoji}</div>`,
    className: '', iconSize: [35, 35], iconAnchor: [17, 35]
});

const iconos = {
    movilidad: crearIcono('♿', '#006D77'),
    calma: crearIcono('🧠', '#83C5BE'),
    visual: crearIcono('👁️', '#E29578'),
    especial: crearIcono('❤️', '#FFD700'),
    default: crearIcono('📍', '#008080')
};

function initMap() {
    if (mapa) return;
    mapa = L.map('mapa', {zoomControl: false}).setView([40.4167, -3.7033], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapa);
    mapa.locate({setView: true, maxZoom: 15});
}

// ✨ FUNCIÓN MODIFICADA: Ahora agrupa por CIUDAD
function mostrarSitios(lista) {
    if (mapa) {
        marcadores.forEach(m => mapa.removeLayer(m));
    }
    marcadores = [];
    const divContenedor = document.getElementById('contenedor-items-lista');
    if (!divContenedor) return;
    divContenedor.innerHTML = '';

    // 1. Agrupamos los sitios por localidad
    const grupos = lista.reduce((acc, s) => {
        const loc = s.localidad || 'UBICACIÓN GENERAL';
        if (!acc[loc]) acc[loc] = [];
        acc[loc].push(s);
        return acc;
    }, {});

    // 2. Creamos una tarjeta por cada CIUDAD
    Object.keys(grupos).forEach(ciudad => {
        const contenedorCiudad = document.createElement('div');
        contenedorCiudad.className = 'contenedor-ciudad';

        // Cabecera de la ciudad (La tarjeta principal)
        contenedorCiudad.innerHTML = `
            <div class="header-ciudad" onclick="toggleCiudad(this)">
                <span>📍 ${ciudad}</span>
                <span class="contador-pines">${grupos[ciudad].length} sitios</span>
            </div>
            <div class="lista-pines-ciudad" style="display: none;"></div>
        `;

        const contenedorPines = contenedorCiudad.querySelector('.lista-pines-ciudad');

        // 3. Metemos los sitios dentro de esa ciudad
        grupos[ciudad].forEach(s => {
            const esPinProtegido = s.nombre === "Familia Daniele";
            let iconoAUsar = s.caracteristicas.includes('Rampa') ? iconos.movilidad : iconos.default;
            if (esPinProtegido) iconoAUsar = iconos.especial;

            if (mapa) {
                const m = L.marker([s.lat, s.lng], { icon: iconoAUsar }).addTo(mapa).bindPopup(`<b>${s.nombre}</b>`);
                marcadores.push(m);
            }

            const card = document.createElement('div');
            card.className = 'item-lista';
            card.innerHTML = `
                <div>
                    <h3 style="margin:0; color:#006d77; font-size:16px;">${s.nombre}</h3>
                    <p style="font-size:12px; color:#666;">${s.descripcion || ''}</p>
                </div>
                <div style="margin-top:10px;">
                    ${s.caracteristicas.map(cat => `<span class="tag-accesibilidad">${cat}</span>`).join('')}
                </div>
            `;
            contenedorPines.appendChild(card);
        });

        divContenedor.appendChild(contenedorCiudad);
    });
}

// ✨ Nueva función para abrir/cerrar ciudades
function toggleCiudad(elemento) {
    const lista = elemento.nextElementSibling;
    const estaAbierto = lista.style.display === 'grid';
    lista.style.display = estaAbierto ? 'none' : 'grid';
    elemento.classList.toggle('ciudad-activa');
}

async function buscarDireccion() {
    const calle = document.getElementById('input-direccion').value;
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(calle)}&limit=1&addressdetails=1`;
    try {
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
            else marcadorSel = L.marker(latlng, {draggable: true}).addTo(mapaSel);
        }
    } catch(e) { console.error(e); }
}

async function guardarSitio() {
    const nombre = document.getElementById('nombre').value;
    const desc = document.getElementById('descripcion').value;
    const checks = document.querySelectorAll('.cat-check:checked');
    const caracteristicas = Array.from(checks).map(c => c.value);
    if (!nombre || !marcadorSel) return Swal.fire('Faltan datos');

    const datos = {
        nombre, descripcion: desc, caracteristicas,
        localidad: localidadDetectada,
        lat: marcadorSel.getLatLng().lat, lng: marcadorSel.getLatLng().lng
    };

    const r = await fetch('/api/sitios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos)
    });
    if (r.ok) location.reload();
}

// MODIFICADA: Ahora abre la ciudad automáticamente al buscarla
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
            
            // Filtramos los locales de esa ciudad
            const filtrados = locales.filter(l => l.localidad === z);
            mostrarSitios(filtrados);

            // AUTO-ABRIR la tarjeta de la ciudad
            const header = document.querySelector('.header-ciudad');
            if (header) toggleCiudad(header);
            
            // Volar en el mapa
            if(filtrados.length > 0) {
                alternarVista();
                mapa.flyTo([filtrados[0].lat, filtrados[0].lng], 13);
            }
        };
        sugerenciasUl.appendChild(li);
    });
}

// ... (El resto de tus funciones: alternarVista, abrirFormulario, cerrarModal, etc. se mantienen igual) ...

function alternarVista() {
    const mCont = document.getElementById('contenedor-mapa-pro'), l = document.getElementById('vista-lista');
    const esMapa = mCont.style.display !== 'none';
    mCont.style.display = esMapa ? 'none' : 'flex';
    l.style.display = esMapa ? 'block' : 'none';
    document.getElementById('btn-vista').innerText = esMapa ? '🗺️ Ver Mapa' : '📋 Ver Lista';
}

function abrirFormulario() {
    document.getElementById('modal-anadir').style.display = 'flex';
    if (!mapaSel) {
        mapaSel = L.map('mapa-seleccion', { zoomControl: false }).setView([40.4167, -3.7033], 14);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapaSel);
        mapaSel.on('click', (e) => { 
            if (marcadorSel) marcadorSel.setLatLng(e.latlng);
            else marcadorSel = L.marker(e.latlng, {draggable: true}).addTo(mapaSel);
        });
    }
    setTimeout(() => mapaSel.invalidateSize(), 300);
}

function cerrarModal() { document.getElementById('modal-anadir').style.display = 'none'; }

function cargarResultados(f) {
    document.getElementById('pantalla-inicio').style.display = 'none';
    document.getElementById('pantalla-resultados').style.display = 'flex';
    initMap();
    let res = f ? locales.filter(l => l.caracteristicas.includes(f)) : locales;
    setTimeout(() => { mapa.invalidateSize(); mostrarSitios(res); }, 400);
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
    }, 400);
}

function abrirModalFiltros() { document.getElementById('modal-filtros').style.display = 'flex'; }
function cerrarModalFiltros() { document.getElementById('modal-filtros').style.display = 'none'; }
function aplicarFiltrosMultiples() {
    const checks = document.querySelectorAll('.filtro-check:checked');
    const f = Array.from(checks).map(c => c.value);
    const res = f.length === 0 ? locales : locales.filter(s => f.every(val => s.caracteristicas.includes(val)));
    mostrarSitios(res);
    cerrarModalFiltros();
}

function toggleMenuAccesibilidad() { document.getElementById('menu-accesibilidad').classList.toggle('menu-oculto'); }
function ajustarTexto(f) {
    const r = document.documentElement;
    let s = parseFloat(window.getComputedStyle(r).fontSize);
    r.style.fontSize = (s * f) + 'px';
}
function restablecerAccesibilidad() { document.documentElement.style.fontSize = '16px'; }
function toggleVoz() {
    vozActiva = !vozActiva;
    document.getElementById('btn-voz').innerText = vozActiva ? '🔊' : '🔇';
}

window.onload = cargarSitios;