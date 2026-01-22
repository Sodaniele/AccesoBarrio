let mapa, marcadores = [], locales = [], ptoSel = 5;
let mapaSel, marcadorSel;
let editandoId = null;

// 1. CARGAR DATOS DESDE MONGODB
async function cargarSitios() {
    try {
        const r = await fetch('/api/sitios');
        locales = await r.json();
        console.log("Datos cargados correctamente de la base de datos.");
    } catch(e) {
        console.error("Error al cargar de MongoDB", e);
    }
}

// ✨ NUEVO: Configuración de Iconos Personalizados
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
    especial: crearIcono('❤️', '#FFD700'), // Icono dorado para Familia Daniele
    default: crearIcono('📍', '#008080')
};

// 2. INICIALIZAR MAPA PRINCIPAL
function initMap() {
    if (mapa) return;
    mapa = L.map('mapa', {zoomControl: false}).setView([40.4167, -3.7033], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapa);
    mapa.locate({setView: true, maxZoom: 15});
}

// 3. FUNCIÓN MAESTRA: DIBUJAR SITIOS EN MAPA Y LISTA
function mostrarSitios(lista) {
    marcadores.forEach(m => mapa.removeLayer(m));
    marcadores = [];
    const div = document.getElementById('vista-lista');
    div.innerHTML = '';

    lista.forEach(s => {
        const esPinProtegido = s.nombre === "Familia Daniele";
        
        // 1. Decidir qué icono usar según la categoría o si es protegido
        let iconoAUsar = iconos.default;
        if (esPinProtegido) iconoAUsar = iconos.especial;
        else if (s.caracteristicas.includes('Rampa')) iconoAUsar = iconos.movilidad;
        else if (s.caracteristicas.includes('Calma')) iconoAUsar = iconos.calma;
        else if (s.caracteristicas.includes('Braille')) iconoAUsar = iconos.visual;

        // 2. HTML de las etiquetas y verificaciones
        const etiquetasPopup = s.caracteristicas ? s.caracteristicas.map(cat => 
            `<span style="background:#e0f2f1; color:#006d77; font-size:10px; padding:2px 8px; border-radius:10px; margin-right:4px; border:1px solid #b2dfdb; display:inline-block; margin-top:4px; font-weight:700;">${cat}</span>`
        ).join('') : '';

        const verifTexto = s.verificaciones > 0 ? `<p style="color: #2D6A4F; font-size: 11px; font-weight: 700; margin: 5px 0;">✅ ${s.verificaciones} personas lo confirmaron</p>` : '';

        // 3. Marcador en el Mapa con Icono Personalizado
        const m = L.marker([s.lat, s.lng], { icon: iconoAUsar }).addTo(mapa).bindPopup(`
            <div style="font-family: 'Poppins', sans-serif; min-width: 160px; padding: 5px;">
                <h3 style="margin:0; color:#006d77; font-size:16px; font-weight:800;">${s.nombre}</h3>
                <p style="margin:8px 0; font-size:12px; color:#555; line-height:1.4;">${s.descripcion || 'Sin descripción'}</p>
                ${verifTexto}
                <div style="display:flex; flex-wrap:wrap; margin-bottom:10px;">
                    ${etiquetasPopup}
                </div>
                <button onclick="verificarSitio('${s._id}')" style="width:100%; border:none; background:#2D6A4F; color:white; border-radius:8px; padding:8px; cursor:pointer; font-weight:700; margin-bottom: 5px;">Confirmar datos ✅</button>
                <a href="https://www.google.com/maps?q=${s.lat},${s.lng}" 
                   target="_blank" 
                   style="display:block; background:#FF7E6B; color:white; text-align:center; padding:10px; border-radius:12px; text-decoration:none; font-size:12px; font-weight:700;">
                    🚗 Cómo llegar
                </a>
            </div>
        `);
        marcadores.push(m);

        // 4. Card en la Lista
        const card = document.createElement('div');
        card.className = 'item-lista';
        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:start;">
                <h3 style="margin:0; color:#006d77; font-weight:800;">${s.nombre}</h3>
                <div style="display:flex; gap:10px;">
                    ${esPinProtegido ? '' : `<button onclick="prepararEdicion('${s._id}')" style="background:none; border:none; cursor:pointer; font-size:18px;" title="Editar">✏️</button>`}
                    <button onclick="reportarSitio('${s._id}')" style="background:none; border:none; cursor:pointer;">⚠️</button>
                </div>
            </div>
            <p style="color:#666; font-size:14px; margin:10px 0;">${s.descripcion || 'Sin descripción'}</p>
            ${verifTexto}
            <div style="display:flex; flex-wrap:wrap; gap:6px; align-items: center;">
                ${s.caracteristicas ? s.caracteristicas.map(cat => `<span class="tag-accesibilidad">${cat}</span>`).join('') : ''}
                <button onclick="verificarSitio('${s._id}')" style="background:#e8f5e9; border:1px solid #2d6a4f; color:#2d6a4f; padding:4px 10px; border-radius:20px; font-size:11px; cursor:pointer; font-weight:700; margin-left: auto;">Verificar ✅</button>
            </div>
        `;
        div.appendChild(card);
    });
}

// ✨ NUEVA FUNCIÓN: Enviar verificación al servidor
async function verificarSitio(id) {
    try {
        const r = await fetch(`/api/sitios/${id}/verificar`, { method: 'POST' });
        if (r.ok) {
            Swal.fire({
                title: '¡Gracias!',
                text: 'Tu verificación ayuda a otros usuarios a moverse con seguridad.',
                icon: 'success',
                timer: 2000,
                showConfirmButton: false
            }).then(() => location.reload());
        }
    } catch (e) {
        console.error("Error al verificar:", e);
    }
}

// 4. BUSCADORES
function buscarDesdeInicio() {
    const texto = document.getElementById('input-inicio').value;
    if (!texto.trim()) {
        return Swal.fire({ icon: 'warning', title: 'Campo vacío', text: 'Escribe el nombre de un lugar', confirmButtonColor: '#006D77' });
    }
    document.getElementById('pantalla-inicio').style.display = 'none';
    document.getElementById('pantalla-resultados').style.display = 'flex';
    initMap();
    document.getElementById('buscador-texto').value = texto;
    setTimeout(() => {
        mapa.invalidateSize();
        buscarTexto(); 
    }, 400);
}

function buscarTexto() {
    const texto = document.getElementById('buscador-texto').value.toLowerCase();
    const filtrados = locales.filter(l => l.nombre.toLowerCase().includes(texto) || (l.descripcion && l.descripcion.toLowerCase().includes(texto)));
    mostrarSitios(filtrados);
    if (filtrados.length === 1) {
        mapa.flyTo([filtrados[0].lat, filtrados[0].lng], 16, { duration: 1.5 });
        setTimeout(() => { if (marcadores[0]) marcadores[0].openPopup(); }, 1600);
    } else if (filtrados.length > 1) {
        const grupo = L.featureGroup(marcadores);
        mapa.fitBounds(grupo.getBounds(), { padding: [50, 50] });
    }
}

// 5. CATEGORÍAS
async function cargarResultados(f) {
    document.getElementById('pantalla-inicio').style.display = 'none';
    document.getElementById('pantalla-resultados').style.display = 'flex';
    initMap();
    let res = f ? locales.filter(l => l.caracteristicas && l.caracteristicas.some(c => c.includes(f))) : locales;
    setTimeout(() => { 
        mapa.invalidateSize(); 
        mostrarSitios(res); 
        if (res.length > 0) {
            const grupo = L.featureGroup(marcadores);
            mapa.fitBounds(grupo.getBounds(), { padding: [50, 50] });
        }
    }, 400);
}

// 6. FORMULARIO Y EDICIÓN
function abrirFormulario() {
    editandoId = null; 
    document.querySelector('#modal-anadir h2').innerText = "📍 Registrar Espacio";
    document.getElementById('nombre').value = '';
    document.getElementById('descripcion').value = '';
    document.querySelectorAll('.cat-check').forEach(c => c.checked = false);
    document.getElementById('modal-anadir').style.display = 'flex';
    if (!mapaSel) {
        mapaSel = L.map('mapa-seleccion', { zoomControl: false }).setView([40.4167, -3.7033], 14);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapaSel);
        mapaSel.on('click', (e) => { colocarMarcador(e.latlng); });
    }
    setTimeout(() => { mapaSel.invalidateSize(); }, 300);
}

function prepararEdicion(id) {
    const sitio = locales.find(l => l._id === id);
    if (!sitio) return;
    if (sitio.nombre === "Familia Daniele") {
        return Swal.fire({ icon: 'error', title: 'Acceso Denegado', text: 'Este es un espacio protegido.', confirmButtonColor: '#FF7E6B' });
    }
    editandoId = id; 
    document.getElementById('modal-anadir').style.display = 'flex';
    document.querySelector('#modal-anadir h2').innerText = "✏️ Editar Espacio";
    document.getElementById('nombre').value = sitio.nombre;
    document.getElementById('descripcion').value = sitio.descripcion || '';
    const checks = document.querySelectorAll('.cat-check');
    checks.forEach(ch => { ch.checked = sitio.caracteristicas.includes(ch.value); });
    if (!mapaSel) {
        mapaSel = L.map('mapa-seleccion', { zoomControl: false }).setView([sitio.lat, sitio.lng], 16);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapaSel);
        mapaSel.on('click', (e) => { colocarMarcador(e.latlng); });
    }
    setTimeout(() => {
        mapaSel.invalidateSize();
        mapaSel.setView([sitio.lat, sitio.lng], 17);
        colocarMarcador({lat: sitio.lat, lng: sitio.lng});
    }, 400);
}

function colocarMarcador(latlng) {
    if (marcadorSel) { marcadorSel.setLatLng(latlng); } 
    else { marcadorSel = L.marker(latlng, { draggable: true }).addTo(mapaSel); }
}

async function buscarDireccion() {
    const calle = document.getElementById('input-direccion').value;
    if (!calle) return Swal.fire({ icon: 'info', title: 'Atención', text: 'Escribe calle y número', confirmButtonColor: '#006D77' });
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(calle)}&limit=1`;
    try {
        const r = await fetch(url);
        const data = await r.json();
        if (data.length > 0) {
            const latlng = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
            mapaSel.setView(latlng, 17);
            colocarMarcador(latlng);
        } else {
            Swal.fire({ icon: 'error', title: 'No encontrado', text: 'No ubicamos esa dirección.', confirmButtonColor: '#FF7E6B' });
        }
    } catch (e) { console.error(e); }
}

function cerrarModal() { document.getElementById('modal-anadir').style.display = 'none'; }

async function guardarSitio() {
    const nombreInput = document.getElementById('nombre');
    const descInput = document.getElementById('descripcion');
    if (!nombreInput || !descInput) return;
    const nombre = nombreInput.value;
    const desc = descInput.value;
    const checks = document.querySelectorAll('.cat-check:checked');
    const caracteristicas = Array.from(checks).map(c => c.value);
    if (!nombre.trim()) return Swal.fire({ icon: 'warning', title: 'Falta el nombre', confirmButtonColor: '#FF7E6B' });
    if (!marcadorSel) return Swal.fire({ icon: 'warning', title: 'Falta ubicación', confirmButtonColor: '#FF7E6B' });

    const datosSitio = {
        nombre: nombre, descripcion: desc, caracteristicas: caracteristicas,
        lat: marcadorSel.getLatLng().lat, lng: marcadorSel.getLatLng().lng,
        puntuacion: 5, reportes: 0
    };

    try {
        const url = editandoId ? `/api/sitios/${editandoId}` : '/api/sitios';
        const metodo = editandoId ? 'PUT' : 'POST';
        const r = await fetch(url, {
            method: metodo,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datosSitio)
        });
        if (r.ok) {
            cerrarModal(); 
            Swal.fire({ title: editandoId ? '¡Actualizado!' : '¡Guardado!', icon: 'success', confirmButtonColor: '#006D77' }).then(() => {
                editandoId = null;
                location.reload(); 
            });
        }
    } catch (error) {
        Swal.fire({ title: 'Error', icon: 'error', confirmButtonColor: '#FF7E6B' });
    }
}

// 7. UTILIDADES
function alternarVista() {
    const mCont = document.getElementById('contenedor-mapa-pro'), l = document.getElementById('vista-lista');
    const esMapa = mCont.style.display !== 'none';
    mCont.style.display = esMapa ? 'none' : 'flex';
    l.style.display = esMapa ? 'block' : 'none';
    document.getElementById('btn-vista').innerText = esMapa ? '🗺️ Ver Mapa' : '📋 Ver Lista';
}

async function reportarSitio(id) {
    const result = await Swal.fire({
        title: '¿Reportar problema?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#FF7E6B',
        confirmButtonText: 'Sí, reportar'
    });
    if (result.isConfirmed) {
        await fetch(`/api/sitios/${id}/reportar`, { method: 'POST' });
        Swal.fire({ title: 'Enviado', icon: 'success', confirmButtonColor: '#006D77' });
    }
}

// 8. ACCESIBILIDAD
function toggleMenuAccesibilidad() {
    document.getElementById('menu-accesibilidad').classList.toggle('menu-oculto');
}

function ajustarTexto(factor) {
    const root = document.documentElement;
    let currentSize = parseFloat(window.getComputedStyle(root).fontSize);
    root.style.fontSize = (currentSize * factor) + 'px';
}

function toggleFiltro(clase) { document.body.classList.toggle(clase); }

function restablecerAccesibilidad() {
    document.body.className = ''; 
    document.documentElement.style.fontSize = '16px';
    Swal.fire({ title: 'Restablecido', icon: 'info', timer: 1500, showConfirmButton: false });
}

// 9. SOPORTE DE VOZ 
let vozActiva = false;
function toggleVoz() {
    vozActiva = !vozActiva;
    const btn = document.getElementById('btn-voz');
    btn.innerText = vozActiva ? '🔊' : '🔇';
    btn.style.background = vozActiva ? '#FF7E6B' : '#ccc';
    if(vozActiva) {
        const msg = new SpeechSynthesisUtterance("Modo de voz activado");
        window.speechSynthesis.speak(msg);
    }
}

window.onload = cargarSitios;