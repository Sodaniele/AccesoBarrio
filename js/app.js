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

// ✨ ICONOS AMPLIADOS
const crearIcono = (emoji, color) => L.divIcon({
    html: `<div style="background-color: ${color}; width: 35px; height: 35px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3); font-size: 20px;">${emoji}</div>`,
    className: '', iconSize: [35, 35], iconAnchor: [17, 35], popupAnchor: [0, -35]
});

const iconos = {
    movilidad: crearIcono('♿', '#006D77'),
    calma: crearIcono('🧠', '#83C5BE'),
    visual: crearIcono('👁️', '#E29578'), // Sirve para Braille y Piso Podotáctil
    auditiva: crearIcono('👂', '#4CAF50'), // Nuevo para Aro Magnético
    perro: crearIcono('🐕', '#FF9800'), // Nuevo para Perro Guía
    especial: crearIcono('❤️', '#FFD700'), 
    default: crearIcono('📍', '#008080')
};

function initMap() {
    if (mapa) return;
    mapa = L.map('mapa', {zoomControl: false}).setView([40.4167, -3.7033], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapa);
    mapa.locate({setView: true, maxZoom: 15});
}

function mostrarSitios(lista) {
    if (mapa) { marcadores.forEach(m => mapa.removeLayer(m)); }
    marcadores = [];
    const divContenedor = document.getElementById('contenedor-items-lista');
    if (!divContenedor) return;
    divContenedor.innerHTML = '';

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
            // Lógica de iconos según característica principal
            let iconoAUsar = iconos.default;
            if (s.nombre.includes("Familia")) iconoAUsar = iconos.especial;
            else if (s.caracteristicas.includes('Rampa')) iconoAUsar = iconos.movilidad;
            else if (s.caracteristicas.includes('Calma')) iconoAUsar = iconos.calma;
            else if (s.caracteristicas.includes('Pictogramas')) iconoAUsar = iconos.cognitiva;
            else if (s.caracteristicas.includes('LSA')) iconoAUsar = iconos.auditiva;

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
            pinesDiv.appendChild(card);
        });
        divContenedor.appendChild(container);
    });
}

function toggleCiudad(el) {
    const list = el.nextElementSibling;
    list.style.display = (list.style.display === 'grid') ? 'none' : 'grid';
}

function filtrarPorZona() {
    const input = document.getElementById('inputBuscadorZona');
    const valor = input.value.toUpperCase();
    const listaSug = document.getElementById('sugerenciasZona');
    listaSug.innerHTML = '';
    if (valor.length < 1) { mostrarSitios(locales); return; }
    const ciudades = [...new Set(locales.map(l => l.localidad || 'UBICACIÓN GENERAL'))];
    ciudades.filter(c => c.includes(valor)).forEach(c => {
        const li = document.createElement('li');
        li.textContent = c;
        li.onclick = () => {
            input.value = c;
            listaSug.innerHTML = '';
            const filtrados = locales.filter(l => (l.localidad || 'UBICACIÓN GENERAL') === c);
            mostrarSitios(filtrados);
            setTimeout(() => { 
                const h = document.querySelector('.header-ciudad');
                if(h) toggleCiudad(h);
            }, 100);
        };
        listaSug.appendChild(li);
    });
}

async function buscarDireccion() {
    const direccionUsuario = document.getElementById('input-direccion').value;
    if (!direccionUsuario) return Swal.fire({ icon: 'info', text: 'Por favor, escribe una dirección.' });

    // Mostramos un pequeño aviso de que estamos buscando
    const loadingToast = Swal.fire({
        title: 'Buscando...',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    // Usamos la API de Nominatim con addressdetails para extraer la ciudad y el país
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(direccionUsuario)}&addressdetails=1&limit=1`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.length > 0) {
            const resultado = data[0];
            const addr = resultado.address;

            // Extraemos la ciudad/pueblo y el país
            const ciudad = addr.city || addr.town || addr.village || addr.municipality || addr.county || "Desconocida";
            const pais = addr.country || "Desconocido";

            // Guardamos el formato que querías: CIUDAD, PAÍS
            localidadDetectada = `${ciudad.toUpperCase()}, ${pais.toUpperCase()}`;
            
            const lat = parseFloat(resultado.lat);
            const lon = parseFloat(resultado.lon);

            // Movemos el mapa de selección con un efecto suave
            mapaSel.flyTo([lat, lon], 17, { duration: 2 });

            // Colocamos o movemos el marcador
            if (marcadorSel) {
                marcadorSel.setLatLng([lat, lon]);
            } else {
                marcadorSel = L.marker([lat, lon], { draggable: true }).addTo(mapaSel);
            }

            Swal.close(); // Cerramos el aviso de carga
            console.log("Encontrado:", localidadDetectada);
            
        } else {
            Swal.fire({
                icon: 'error',
                title: 'No encontrado',
                text: 'No pudimos localizar esa dirección. Prueba agregando la ciudad o el país.',
                confirmButtonColor: '#006D77'
            });
        }
    } catch (e) {
        console.error("Error en la geocodificación:", e);
        Swal.fire({ icon: 'error', text: 'Hubo un problema con el buscador de mapas.' });
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

    const r = await fetch('/api/sitios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos)
    });
    if (r.ok) location.reload();
}

function alternarVista() {
    const mapCont = document.getElementById('contenedor-mapa-pro'), listCont = document.getElementById('vista-lista');
    const isMap = mapCont.style.display !== 'none';
    mapCont.style.display = isMap ? 'none' : 'flex';
    listCont.style.display = isMap ? 'block' : 'none';
    document.getElementById('btn-vista').innerText = isMap ? '🗺️ Ver Mapa' : '📋 Ver Lista';
}

function buscarDesdeInicio() {
    const t = document.getElementById('input-inicio').value;
    document.getElementById('pantalla-inicio').style.display = 'none';
    document.getElementById('pantalla-resultados').style.display = 'flex';
    initMap();
    setTimeout(() => {
        const res = locales.filter(l => l.nombre.toLowerCase().includes(t.toLowerCase()));
        mostrarSitios(res);
    }, 400);
}

function cargarResultados(f) {
    document.getElementById('pantalla-inicio').style.display = 'none';
    document.getElementById('pantalla-resultados').style.display = 'flex';
    initMap();
    let res = f ? locales.filter(l => l.caracteristicas.includes(f)) : locales;
    setTimeout(() => { mostrarSitios(res); }, 400);
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
}

function cerrarModal() { document.getElementById('modal-anadir').style.display = 'none'; }
function cerrarModalFiltros() { document.getElementById('modal-filtros').style.display = 'none'; }
function abrirModalFiltros() { document.getElementById('modal-filtros').style.display = 'flex'; }
function aplicarFiltrosMultiples() {
    const checks = document.querySelectorAll('.filtro-check:checked');
    const f = Array.from(checks).map(c => c.value);
    const res = f.length === 0 ? locales : locales.filter(s => f.every(val => s.caracteristicas.includes(val)));
    mostrarSitios(res);
    cerrarModalFiltros();
}

// Accesibilidad
function toggleMenuAccesibilidad() { document.getElementById('menu-accesibilidad').classList.toggle('menu-oculto'); }
function ajustarTexto(f) {
    const r = document.documentElement;
    let s = parseFloat(window.getComputedStyle(r).fontSize);
    r.style.fontSize = (s * f) + 'px';
}
function restablecerAccesibilidad() { document.documentElement.style.fontSize = '16px'; }
function toggleVoz() {}

window.onload = cargarSitios;