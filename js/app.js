let mapa, marcadores = [], locales = [], ptoSel = 5;
let mapaSel, marcadorSel;

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

// 2. INICIALIZAR MAPA PRINCIPAL
function initMap() {
    if (mapa) return;
    mapa = L.map('mapa', {zoomControl: false}).setView([-33.33, -60.21], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapa);
    mapa.locate({setView: true, maxZoom: 15});
}

// 3. FUNCIÓN DIBUJAR SITIOS EN MAPA Y LISTA
function mostrarSitios(lista) {
    marcadores.forEach(m => mapa.removeLayer(m));
    marcadores = [];
    const div = document.getElementById('vista-lista');
    div.innerHTML = '';

    lista.forEach(s => {
        const etiquetasPopup = s.caracteristicas ? s.caracteristicas.map(cat => 
            `<span style="background:#e0f2f1; color:#006d77; font-size:10px; padding:2px 8px; border-radius:10px; margin-right:4px; border:1px solid #b2dfdb; display:inline-block; margin-top:4px; font-weight:700;">${cat}</span>`
        ).join('') : '';

        const contenidoPopup = `
            <div style="font-family: 'Poppins', sans-serif; min-width: 160px; padding: 5px;">
                <h3 style="margin:0; color:#006d77; font-size:16px; font-weight:800;">${s.nombre}</h3>
                <p style="margin:8px 0; font-size:12px; color:#555; line-height:1.4;">${s.descripcion || 'Sin descripción'}</p>
                <div style="display:flex; flex-wrap:wrap; margin-bottom:10px;">
                    ${etiquetasPopup}
                </div>
                <a href="https://www.google.com/maps?q=${s.lat},${s.lng}" 
                   target="_blank" 
                   style="display:block; background:#FF7E6B; color:white; text-align:center; padding:10px; border-radius:12px; text-decoration:none; font-size:12px; font-weight:700; box-shadow: 0 4px 10px rgba(255,126,107,0.3);">
                    🚗 Cómo llegar
                </a>
            </div>
        `;

        const m = L.marker([s.lat, s.lng]).addTo(mapa).bindPopup(contenidoPopup);
        marcadores.push(m);

        const card = document.createElement('div');
        card.className = 'item-lista';
        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:start;">
                <h3 style="margin:0; color:#006d77; font-weight:800;">${s.nombre}</h3>
                <button onclick="reportarSitio('${s._id}')" style="background:none; border:none; cursor:pointer;">⚠️</button>
            </div>
            <p style="color:#666; font-size:14px; margin:10px 0;">${s.descripcion || 'Sin descripción'}</p>
            <div style="display:flex; flex-wrap:wrap; gap:6px;">
                ${s.caracteristicas ? s.caracteristicas.map(cat => `<span class="tag-accesibilidad" style="background:#e0f2f1; padding:4px 8px; border-radius:8px; font-size:11px;">${cat}</span>`).join('') : ''}
            </div>
        `;
        div.appendChild(card);
    });
}

// 4. BUSCADORES
function buscarDesdeInicio() {
    const texto = document.getElementById('input-inicio').value;
    if (!texto.trim()) return alert("Escribe el nombre de un lugar");

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
    const filtrados = locales.filter(l => 
        l.nombre.toLowerCase().includes(texto) || 
        (l.descripcion && l.descripcion.toLowerCase().includes(texto))
    );

    mostrarSitios(filtrados);

    if (filtrados.length === 1) {
        mapa.flyTo([filtrados[0].lat, filtrados[0].lng], 16, { duration: 1.5 });
        setTimeout(() => {
            if (marcadores[0]) marcadores[0].openPopup();
        }, 1600);
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

// 6. FORMULARIO Y DIRECCIÓN
function abrirFormulario() {
    document.getElementById('modal-anadir').style.display = 'flex';
    if (!mapaSel) {
        mapaSel = L.map('mapa-seleccion', { zoomControl: false }).setView([-33.33, -60.21], 14);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapaSel);
        mapaSel.on('click', (e) => {
            colocarMarcador(e.latlng);
        });
    }
    setTimeout(() => { mapaSel.invalidateSize(); }, 300);
}

function colocarMarcador(latlng) {
    if (marcadorSel) {
        marcadorSel.setLatLng(latlng);
    } else {
        marcadorSel = L.marker(latlng, { draggable: true }).addTo(mapaSel);
    }
}

async function buscarDireccion() {
    const calle = document.getElementById('input-direccion').value;
    if (!calle) return alert("Por favor, escribe calle y número");

    // Quitamos la parte fija de San Nicolás para que sea global
    const query = calle; 
    
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;

    try {
        const r = await fetch(url);
        const data = await r.json();
        
        if (data && data.length > 0) {
            const latlng = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
            
            // Movemos el mapa de selección y ponemos el pin
            mapaSel.setView(latlng, 17);
            colocarMarcador(latlng);
            
            console.log("Dirección encontrada:", data[0].display_name);
        } else {
            alert("No pudimos encontrar esa dirección exacta. Prueba a añadir la ciudad (ej: Calle Chile 4, Las Rozas).");
        }
    } catch (e) { 
        console.error("Error en la búsqueda:", e);
        alert("Hubo un error al conectar con el servicio de mapas.");
    }
}

function cerrarModal() {
    document.getElementById('modal-anadir').style.display = 'none';
}

async function guardarSitio() {
    // ... tu código anterior (nombre, desc, checks, etc.) ...

    if (r.ok) {
        // ✨ REEMPLAZO DE LA ALERTA FEA ✨
        Swal.fire({
            title: '¡Guardado con éxito!',
            text: 'Gracias por ayudar a mapear la accesibilidad.',
            icon: 'success',
            confirmButtonText: 'Genial',
            confirmButtonColor: '#006D77', // Tu color Teal
            borderRadius: '20px',
            fontFamily: 'Poppins'
        }).then((result) => {
            // Cuando el usuario haga clic en el botón, se recarga la página
            location.reload();
        });
    } else {
        Swal.fire({
            title: 'Ups...',
            text: 'Algo salió mal al guardar.',
            icon: 'error',
            confirmButtonColor: '#FF7E6B' // Tu color Coral
        });
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
    if (!confirm("¿Informar un problema con este sitio?")) return;
    await fetch(`/api/sitios/${id}/reportar`, { method: 'POST' });
    alert("Reporte enviado. Gracias.");
}


function toggleMenuAccesibilidad() {
    const menu = document.getElementById('menu-accesibilidad');
    menu.classList.toggle('menu-oculto');
}

function ajustarTexto(factor) {
    // Cambia el tamaño de fuente de todo el body
    const body = document.body;
    let currentSize = parseFloat(window.getComputedStyle(body).fontSize);
    // Aplico el factor (ej: 1.1 aumenta un 10%)
    body.style.fontSize = (currentSize * factor) + 'px';
}

function toggleFiltro(clase) {
    // Activa/Desactiva clases como 'escala-grises' o 'alto-contraste'
    document.body.classList.toggle(clase);
}

function restablecerAccesibilidad() {
    // Limpio todas las clases especiales y vuelve al tamaño base
    document.body.className = ''; 
    document.body.style.fontSize = '16px';
    alert("Configuración de accesibilidad restablecida.");
}

// 8. SOPORTE DE VOZ 
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