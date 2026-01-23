let mapa, marcadores = [], locales = [], ptoSel = 5;
let mapaSel, marcadorSel;
let editandoId = null; 
let localidadDetectada = ""; // ✨ Variable para CIUDAD, PAÍS

// 1. CARGAR DATOS
async function cargarSitios() {
    try {
        const r = await fetch('/api/sitios');
        locales = await r.json();
        const loader = document.getElementById('loading-overlay');
        if (loader) loader.style.display = 'none';
    } catch(e) {
        console.error("Error al cargar", e);
        const loader = document.getElementById('loading-overlay');
        if (loader) loader.style.display = 'none';
    }
}

// ✨ Iconos
const crearIcono = (emoji, color) => L.divIcon({
    html: `<div style="background-color: ${color}; width: 35px; height: 35px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3); font-size: 20px;">${emoji}</div>`,
    className: '',
    iconSize: [35, 35],
    iconAnchor: [17, 35],
    popupAnchor: [0, -35]
});

const iconos = {
    movilidad: crearIcono('♿', '#006D77'),
    calma: crearIcono('🧠', '#83C5BE'),
    visual: crearIcono('👁️', '#E29578'),
    especial: crearIcono('❤️', '#FFD700'), 
    default: crearIcono('📍', '#008080')
};

// 2. INICIALIZAR MAPA
function initMap() {
    if (mapa) return;
    mapa = L.map('mapa', {zoomControl: false}).setView([40.4167, -3.7033], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapa);
    mapa.locate({setView: true, maxZoom: 15});
}

// 3. MOSTRAR SITIOS (CON BUSCADOR DE ZONA)
function mostrarSitios(lista) {
    marcadores.forEach(m => mapa.removeLayer(m));
    marcadores = [];
    
    // Inyectamos en el nuevo contenedor interno
    const divContenedor = document.getElementById('contenedor-items-lista');
    if (!divContenedor) return;
    divContenedor.innerHTML = '';

    lista.forEach(s => {
        const esPinProtegido = s.nombre === "Familia Daniele";
        let iconoAUsar = iconos.default;
        if (esPinProtegido) iconoAUsar = iconos.especial;
        else if (s.caracteristicas.includes('Rampa')) iconoAUsar = iconos.movilidad;
        else if (s.caracteristicas.includes('Calma')) iconoAUsar = iconos.calma;
        else if (s.caracteristicas.includes('Braille')) iconoAUsar = iconos.visual;

        const verifTexto = s.verificaciones > 0 ? `<p style="color: #2D6A4F; font-size: 11px; font-weight: 700; margin: 5px 0;">✅ ${s.verificaciones} confirmaciones</p>` : '';

        // Marcador Mapa
        const m = L.marker([s.lat, s.lng], { icon: iconoAUsar }).addTo(mapa).bindPopup(`
            <div style="font-family: 'Poppins'; min-width: 160px;">
                <h3 style="margin:0; color:#006d77; font-weight:800;">${s.nombre}</h3>
                <p style="font-size: 10px; color: #666; margin-bottom: 5px;">${s.localidad || ''}</p>
                <p style="font-size:12px; margin:5px 0;">${s.descripcion || ''}</p>
                ${verifTexto}
                <button onclick="verificarSitio('${s._id}')" style="width:100%; border:none; background:#2D6A4F; color:white; border-radius:8px; padding:8px; cursor:pointer; font-weight:700; margin-top:5px;">Confirmar ✅</button>
            </div>
        `);
        marcadores.push(m);

        // Tarjeta Lista
        const card = document.createElement('div');
        card.className = 'item-lista';
        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:start;">
                <div>
                    <span style="background:#e0f2f1; color:#006d77; font-size:9px; font-weight:800; padding:2px 6px; border-radius:4px; text-transform:uppercase;">📍 ${s.localidad || 'UBICACIÓN GENERAL'}</span>
                    <h3 style="margin:2px 0 0 0; color:#006d77; font-weight:800;">${s.nombre}</h3>
                </div>
                <div style="display:flex; gap:10px;">
                    ${esPinProtegido ? '' : `<button onclick="prepararEdicion('${s._id}')" style="background:none; border:none; cursor:pointer; font-size:18px;">✏️</button>`}
                    <button onclick="reportarSitio('${s._id}')" style="background:none; border:none; cursor:pointer;">⚠️</button>
                </div>
            </div>
            <p style="color:#666; font-size:13px; margin:5px 0;">${s.descripcion || ''}</p>
            ${verifTexto}
            <div style="display:flex; gap:5px; flex-wrap:wrap; align-items:center;">
                ${s.caracteristicas.map(cat => `<span class="tag-accesibilidad">${cat}</span>`).join('')}
                <button onclick="verificarSitio('${s._id}')" style="background:#e8f5e9; border:1px solid #2d6a4f; color:#2d6a4f; padding:2px 8px; border-radius:20px; font-size:11px; cursor:pointer; font-weight:700; margin-left: auto;">Verificar ✅</button>
            </div>
        `;
        divContenedor.appendChild(card);
    });
}

// ✨ NUEVA FUNCIÓN: Filtrado por Zona (Autocompletado)
function filtrarPorZona() {
    const input = document.getElementById('inputBuscadorZona');
    const texto = input.value.toUpperCase();
    const sugerenciasUl = document.getElementById('sugerenciasZona');
    sugerenciasUl.innerHTML = '';

    if (texto.length < 1) {
        mostrarSitios(locales);
        return;
    }

    const localidadesUnicas = [...new Set(locales.map(l => l.localidad).filter(l => l))];
    const coincidencias = localidadesUnicas.filter(loc => loc.includes(texto));

    coincidencias.forEach(ciudad => {
        const li = document.createElement('li');
        li.textContent = ciudad;
        li.style = "padding:10px; border-bottom:1px solid #eee; cursor:pointer; font-weight:600; color:#006D77; font-size:13px; list-style:none;";
        li.onclick = () => {
            input.value = ciudad;
            sugerenciasUl.innerHTML = '';
            const filtrados = locales.filter(l => l.localidad === ciudad);
            mostrarSitios(filtrados);
            if(filtrados.length > 0) {
                alternarVista();
                mapa.flyTo([filtrados[0].lat, filtrados[0].lng], 13);
            }
        };
        sugerenciasUl.appendChild(li);
    });
}

// 4. BUSCADOR DIRECCIÓN (CIUDAD, PAÍS)
async function buscarDireccion() {
    const calle = document.getElementById('input-direccion').value;
    if (!calle) return Swal.fire({ icon: 'info', text: 'Escribe calle y número' });
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(calle)}&limit=1&addressdetails=1`;
    try {
        const r = await fetch(url);
        const data = await r.json();
        if (data.length > 0) {
            const info = data[0];
            const addr = info.address;
            const ciudad = addr.city || addr.town || addr.village || addr.municipality || addr.county || "Desconocida";
            const pais = addr.country || "";
            localidadDetectada = `${ciudad.toUpperCase()}, ${pais.toUpperCase()}`;
            
            const latlng = [parseFloat(info.lat), parseFloat(info.lon)];
            mapaSel.setView(latlng, 17);
            colocarMarcador(latlng);
        }
    } catch (e) { console.error(e); }
}

// 5. GUARDAR SITIO
async function guardarSitio() {
    const nombre = document.getElementById('nombre').value;
    const desc = document.getElementById('descripcion').value;
    const checks = document.querySelectorAll('.cat-check:checked');
    const caracteristicas = Array.from(checks).map(c => c.value);

    if (!nombre.trim() || !marcadorSel) {
        return Swal.fire({ icon: 'warning', title: 'Faltan datos' });
    }

    const datos = {
        nombre, descripcion: desc, caracteristicas,
        localidad: localidadDetectada, // ✨ GUARDAMOS CIUDAD, PAÍS
        lat: marcadorSel.getLatLng().lat, lng: marcadorSel.getLatLng().lng,
        puntuacion: 5, reportes: 0
    };

    try {
        const url = editandoId ? `/api/sitios/${editandoId}` : '/api/sitios';
        const metodo = editandoId ? 'PUT' : 'POST';
        const r = await fetch(url, {
            method: metodo,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datos)
        });
        if (r.ok) {
            cerrarModal(); 
            Swal.fire({ title: '¡Éxito!', icon: 'success' }).then(() => {
                editandoId = null;
                location.reload(); 
            });
        }
    } catch (error) { console.error(error); }
}

// RESTO DE FUNCIONES (IGUALES A LAS TUYAS)
function abrirModalFiltros() { document.getElementById('modal-filtros').style.display = 'flex'; }
function cerrarModalFiltros() { document.getElementById('modal-filtros').style.display = 'none'; }
function aplicarFiltrosMultiples() {
    const checks = document.querySelectorAll('.filtro-check:checked');
    const filtrosSeleccionados = Array.from(checks).map(c => c.value);
    if (filtrosSeleccionados.length === 0) { mostrarSitios(locales); } 
    else {
        const filtrados = locales.filter(sitio => filtrosSeleccionados.every(f => sitio.caracteristicas.includes(f)));
        mostrarSitios(filtrados);
    }
    cerrarModalFiltros();
}

async function verificarSitio(id) {
    try {
        const r = await fetch(`/api/sitios/${id}/verificar`, { method: 'POST' });
        if (r.ok) location.reload();
    } catch (e) { console.error(e); }
}

function buscarDesdeInicio() {
    const texto = document.getElementById('input-inicio').value;
    if (!texto.trim()) return;
    document.getElementById('pantalla-inicio').style.display = 'none';
    document.getElementById('pantalla-resultados').style.display = 'flex';
    initMap();
    document.getElementById('buscador-texto').value = texto;
    setTimeout(() => { mapa.invalidateSize(); buscarTexto(); }, 400);
}

function buscarTexto() {
    const texto = document.getElementById('buscador-texto').value.toLowerCase();
    const filtrados = locales.filter(l => l.nombre.toLowerCase().includes(texto));
    mostrarSitios(filtrados);
}

async function cargarResultados(f) {
    document.getElementById('pantalla-inicio').style.display = 'none';
    document.getElementById('pantalla-resultados').style.display = 'flex';
    initMap();
    let res = f ? locales.filter(l => l.caracteristicas && l.caracteristicas.some(c => c.includes(f))) : locales;
    setTimeout(() => { mapa.invalidateSize(); mostrarSitios(res); }, 400);
}

function abrirFormulario() {
    editandoId = null; 
    document.getElementById('modal-anadir').style.display = 'flex';
    if (!mapaSel) {
        mapaSel = L.map('mapa-seleccion', { zoomControl: false }).setView([40.4167, -3.7033], 14);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapaSel);
        mapaSel.on('click', (e) => { colocarMarcador(e.latlng); });
    }
    setTimeout(() => { mapaSel.invalidateSize(); }, 300);
}

function colocarMarcador(latlng) {
    if (marcadorSel) { marcadorSel.setLatLng(latlng); } 
    else { marcadorSel = L.marker(latlng, { draggable: true }).addTo(mapaSel); }
}

function cerrarModal() { document.getElementById('modal-anadir').style.display = 'none'; }

function alternarVista() {
    const mCont = document.getElementById('contenedor-mapa-pro'), l = document.getElementById('vista-lista');
    const esMapa = mCont.style.display !== 'none';
    mCont.style.display = esMapa ? 'none' : 'flex';
    l.style.display = esMapa ? 'block' : 'none';
    document.getElementById('btn-vista').innerText = esMapa ? '🗺️ Ver Mapa' : '📋 Ver Lista';
}

async function reportarSitio(id) {
    await fetch(`/api/sitios/${id}/reportar`, { method: 'POST' });
    Swal.fire({ title: 'Reportado', icon: 'success' });
}

function toggleMenuAccesibilidad() { document.getElementById('menu-accesibilidad').classList.toggle('menu-oculto'); }
function ajustarTexto(factor) {
    const root = document.documentElement;
    let currentSize = parseFloat(window.getComputedStyle(root).fontSize);
    root.style.fontSize = (currentSize * factor) + 'px';
}
function restablecerAccesibilidad() { document.documentElement.style.fontSize = '16px'; }

let vozActiva = false;
function toggleVoz() {
    vozActiva = !vozActiva;
    document.getElementById('btn-voz').innerText = vozActiva ? '🔊' : '🔇';
}

window.onload = cargarSitios;