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
    // 1. Limpiar mapa
    if (mapa) { marcadores.forEach(m => mapa.removeLayer(m)); }
    marcadores = [];

    // 2. Limpiar lista
    const divContenedor = document.getElementById('contenedor-items-lista');
    if (divContenedor) divContenedor.innerHTML = '';

    // 3. Agrupar por localidad
    const grupos = lista.reduce((acc, s) => {
        const loc = s.localidad || 'UBICACIÓN GENERAL';
        if (!acc[loc]) acc[loc] = [];
        acc[loc].push(s);
        return acc;
    }, {});

    // 4. Renderizar
    Object.keys(grupos).sort().forEach(ciudad => {
        
        // --- A. RENDERIZADO EN VISTA DE LISTA ---
        if (divContenedor) {
            // Creamos un contenedor para la ciudad
            const seccionCiudad = document.createElement('div');
            seccionCiudad.style.marginBottom = "20px";
            
            // Título de la ciudad
            seccionCiudad.innerHTML = `
                <h3 style="color:#006D77; margin-bottom:10px; border-bottom:2px solid #e0f2f1; padding-bottom:5px;">
                    📍 ${ciudad} <span style="font-size:12px; color:#666; font-weight:400;">(${grupos[ciudad].length})</span>
                </h3>
            `;

            // Añadimos las tarjetas de los sitios de esa ciudad
            grupos[ciudad].forEach(s => {
                const card = document.createElement('div');
                card.className = 'item-lista'; // Usa tu estilo CSS existente
                
                // Generamos tags para la lista
                const tagsLista = s.caracteristicas.map(c => 
                    `<span class="tag-accesibilidad">${c}</span>`
                ).join('');

                card.innerHTML = `
                    <h3 style="margin:0; color:#006d77; font-size:16px;">${s.nombre}</h3>
                    <p style="font-size:12px; color:#666; margin:5px 0;">${s.descripcion || 'Sin descripción'}</p>
                    <div style="margin-top:5px;">${tagsLista}</div>
                `;
                seccionCiudad.appendChild(card);
            });

            divContenedor.appendChild(seccionCiudad);
        }
        
        // --- B. RENDERIZADO EN EL MAPA ---
        grupos[ciudad].forEach(s => {
            // Selección de icono (Tu lógica original mejorada)
            let icono = iconos.default;
            if (s.caracteristicas.includes('Rampa') || s.caracteristicas.includes('Baño')) icono = iconos.movilidad;
            else if (s.caracteristicas.includes('Calma')) icono = iconos.calma;
            else if (s.caracteristicas.includes('Braille') || s.caracteristicas.includes('Podotactil')) icono = iconos.visual;
            else if (s.caracteristicas.includes('Pictogramas')) icono = iconos.cognitiva;
            else if (s.caracteristicas.includes('LSA') || s.caracteristicas.includes('Aro')) icono = iconos.auditiva;
            else if (s.caracteristicas.includes('Perro')) icono = iconos.perro || iconos.visual;
            
            if (mapa) {
                // Generamos tags con estilos en línea para asegurar que se vean bien en el popup
                const tagsPopup = s.caracteristicas.map(c => 
                    `<span style="background:#e0f2f1; color:#006d77; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:700; margin-right:3px; display:inline-block; border:1px solid #b2dfdb;">${c}</span>`
                ).join('');

                // Diseño del Globo (Popup) Completo
                const contenidoPopup = `
                    <div style="font-family: 'Poppins', sans-serif; min-width: 200px;">
                        <h3 style="margin:0 0 5px 0; color:#006d77; font-size:15px; font-weight:800;">${s.nombre}</h3>
                        <p style="font-size:11px; color:#555; margin:0 0 8px 0; line-height:1.4;">
                            ${s.descripcion || 'Sin descripción.'}
                        </p>
                        <div style="margin-bottom:8px;">${tagsPopup}</div>
                        <p style="font-size:9px; color:#999; margin:0; text-transform:uppercase;">📍 ${s.localidad || ciudad}</p>
                    </div>
                `;

                const m = L.marker([s.lat, s.lng], { icon: icono })
                           .addTo(mapa)
                           .bindPopup(contenidoPopup);
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

// ============================================
// CÓDIGO NUEVO DEL PANEL DE ACCESIBILIDAD ♿
// ============================================

const btnAccess = document.getElementById('btn-accesibilidad');
const panelAccess = document.getElementById('panel-accesibilidad');
let zoomLevel = 1; // Para el tamaño de fuente

// 1. Abrir/Cerrar Panel
if(btnAccess && panelAccess) {
    btnAccess.addEventListener('click', () => {
        const isHidden = panelAccess.classList.contains('hidden');
        if (isHidden) {
            panelAccess.classList.remove('hidden');
            panelAccess.setAttribute('aria-hidden', 'false');
        } else {
            panelAccess.classList.add('hidden');
            panelAccess.setAttribute('aria-hidden', 'true');
        }
    });
}

// 2. Función Tamaño Texto (Zoom)
window.cambiarTexto = function(direction) {
    zoomLevel += direction * 0.1;
    // Límites para que no se rompa (entre 0.8x y 1.5x es razonable)
    if (zoomLevel > 1.8) zoomLevel = 1.8;
    if (zoomLevel < 0.8) zoomLevel = 0.8;
    
    // Aplicamos el zoom al body, afectando a toda la app
    document.body.style.transform = `scale(${zoomLevel})`;
    document.body.style.transformOrigin = "top center";
    
    // Ajuste para que el scroll no se rompa al hacer zoom
    document.body.style.width = `${100/zoomLevel}%`;
}

// 3. Función Alto Contraste (ONCE Style)
window.toggleContraste = function() {
    document.body.classList.toggle('high-contrast');
}

// 4. Función Fuente Dislexia (Comic Sans / Verdana)
window.toggleDislexia = function() {
    document.body.classList.toggle('dyslexia-font');
}

// 5. Función Parar Animaciones (Stop Motion)
window.toggleAnimaciones = function() {
    document.body.classList.toggle('stop-animations');
}

// 6. Resetear todo a la normalidad
window.resetAccesibilidad = function() {
    zoomLevel = 1;
    document.body.style.transform = '';
    document.body.style.width = '';
    document.body.classList.remove('high-contrast', 'dyslexia-font', 'stop-animations');
}