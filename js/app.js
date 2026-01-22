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
    // Centrado inicial (se ajustará al localizar al usuario)
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
                ${s.caracteristicas ? s.caracteristicas.map(cat => `<span class="tag-accesibilidad" style="background:#e0f2f1; color:#006d77; padding:4px 8px; border-radius:8px; font-size:11px; font-weight:600;">${cat}</span>`).join('') : ''}
            </div>
        `;
        div.appendChild(card);
    });
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
    const filtrados = locales.filter(l => 
        l.nombre.toLowerCase().includes(texto) || 
        (l.descripcion && l.descripcion.toLowerCase().includes(texto))
    );

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

// 6. FORMULARIO Y DIRECCIÓN
function abrirFormulario() {
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
            Swal.fire({ icon: 'error', title: 'No encontrado', text: 'No ubicamos esa dirección exacta.', confirmButtonColor: '#FF7E6B' });
        }
    } catch (e) { console.error(e); }
}

function cerrarModal() { document.getElementById('modal-anadir').style.display = 'none'; }

async function guardarSitio() {
    console.log("Iniciando proceso de guardado...");

    // 1. Obtener los elementos del formulario
    const nombreInput = document.getElementById('nombre');
    const descInput = document.getElementById('descripcion');
    
    // Verificamos que los inputs existan en el HTML para evitar errores
    if (!nombreInput || !descInput) {
        console.error("Error: No se encontraron los campos 'nombre' o 'descripcion' en el HTML.");
        return;
    }

    const nombre = nombreInput.value;
    const desc = descInput.value;
    const checks = document.querySelectorAll('.cat-check:checked');
    const caracteristicas = Array.from(checks).map(c => c.value);

    // 2. Validaciones básicas
    if (!nombre.trim()) {
        return Swal.fire({ icon: 'warning', title: 'Falta el nombre', text: 'El nombre del lugar es obligatorio.', confirmButtonColor: '#FF7E6B' });
    }

    if (!marcadorSel) {
        return Swal.fire({ icon: 'warning', title: 'Falta ubicación', text: 'Por favor, marca el sitio en el mapa.', confirmButtonColor: '#FF7E6B' });
    }

    // 3. Creamos el objeto con los datos
    const nuevoSitio = {
        nombre: nombre,
        descripcion: desc,
        caracteristicas: caracteristicas,
        lat: marcadorSel.getLatLng().lat,
        lng: marcadorSel.getLatLng().lng,
        puntuacion: 5,
        reportes: 0
    };

    try {
        // 4. AQUÍ DEFINIMOS "r" (La respuesta del servidor)
        const r = await fetch('/api/sitios', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(nuevoSitio)
        });

        // 5. Ahora que "r" existe, ya podemos usar r.ok
        if (r.ok) {
            // ✨ PRIMERO: Cerramos el modal para que no estorbe
            cerrarModal(); 

            // ✨ SEGUNDO: Mostramos la alerta linda
            Swal.fire({
                title: '¡Guardado!',
                text: 'Gracias por colaborar con AccesoBarrio.',
                icon: 'success',
                confirmButtonColor: '#006D77'
            }).then(() => {
                location.reload(); 
            });
        } else {
            throw new Error("Error en el servidor");
        }
    } catch (error) {
        console.error("Error en la petición:", error);
        Swal.fire({
            title: 'Error de red',
            text: 'No se pudo guardar. Verifica que el servidor esté funcionando.',
            icon: 'error',
            confirmButtonColor: '#FF7E6B'
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
    const result = await Swal.fire({
        title: '¿Reportar problema?',
        text: "Informarás que este sitio tiene errores de accesibilidad.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#FF7E6B',
        confirmButtonText: 'Sí, reportar',
        cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
        await fetch(`/api/sitios/${id}/reportar`, { method: 'POST' });
        Swal.fire({ title: 'Enviado', text: 'Gracias por tu reporte.', icon: 'success', confirmButtonColor: '#006D77' });
    }
}

// 8. ACCESIBILIDAD (Corregida para ROOT/REM)
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
    Swal.fire({ title: 'Restablecido', text: 'Vista original restaurada', icon: 'info', timer: 1500, showConfirmButton: false });
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