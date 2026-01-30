let mapa, marcadores = [], locales = [], editandoId = null;
let localidadDetectada = "";
let mapaSel, marcadorSel;
// Variable global para guardar los grupos y poder navegar
let gruposPorCiudad = {}; 

// ============================================
// 🔐 CONFIGURACIÓN DE ADMIN (NIVEL PROTOTIPO)
// ============================================
const ADMIN_PIN = "sofi2026"; 
let esAdmin = false; 

// ============================================
// 🛡️ SEGURIDAD: SANITIZACIÓN (Anti-XSS)
// ============================================
// Esta función limpia el texto para que nadie pueda inyectar código malicioso
function escapeHTML(str) {
    if (!str) return "";
    return str.toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Cargar Datos
async function cargarSitios() {
    try {
        const r = await fetch('/api/sitios');
        locales = await r.json();
        document.getElementById('loading-overlay').style.display = 'none';
        
        comprobarSesion();
        mostrarSitios(locales);
        
        // Actualizamos los contadores y curiosidades al cargar
        actualizarInfoPortada();

    } catch(e) { console.error(e); }
}

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
    ascensor: crearIcono('🛗', '#9C27B0'), 
    default: crearIcono('📍', '#008080')
};

function initMap() {
    if (mapa) return;
    mapa = L.map('mapa', {zoomControl: false}).setView([40.4167, -3.7033], 13);
    
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(mapa);
}

// ⚠️ FUNCIÓN MODIFICADA: APLICA SEGURIDAD Y MUESTRA AUTOR
function mostrarSitios(lista) {
    if (mapa) { marcadores.forEach(m => mapa.removeLayer(m)); }
    marcadores = [];

    const divContenedor = document.getElementById('contenedor-items-lista');

    // 🕵️‍♀️ ESTADO VACÍO
    if (lista.length === 0 && divContenedor) {
        divContenedor.innerHTML = `
            <div style="text-align: center; padding: 40px 20px;">
                <div style="font-size: 60px;">🕵️‍♀️</div>
                <h3 style="color: #006D77; margin-top: 10px; font-weight:800;">Vaya, no hay nada...</h3>
                <p style="color: #666; font-size: 14px;">Nadie ha registrado un sitio con ese nombre todavía.</p>
                <button onclick="abrirFormulario()" class="btn-principal" style="max-width: 250px; margin: 20px auto; background-color:#FF7E6B;">
                    + ¡Sé el primero en añadirlo!
                </button>
            </div>
        `;
        if(mapa) mapa.setView([40.4167, -3.7033], 5); 
        return; 
    }

    // Agrupamos
    gruposPorCiudad = lista.reduce((acc, s) => {
        const loc = s.localidad || 'UBICACIÓN GENERAL';
        if (!acc[loc]) acc[loc] = [];
        acc[loc].push(s);
        return acc;
    }, {});

    // RENDERIZADO LISTA (CARPETAS)
    if (divContenedor) {
        divContenedor.innerHTML = ''; 

        const grid = document.createElement('div');
        grid.className = 'grid-ciudades';

        Object.keys(gruposPorCiudad).sort().forEach(ciudad => {
            const cantidad = gruposPorCiudad[ciudad].length;
            const card = document.createElement('div');
            card.className = 'card-ciudad';
            card.onclick = () => verCiudadDetalle(ciudad); 

            // 🛡️ APLICAMOS SEGURIDAD AQUÍ
            card.innerHTML = `
                <div class="icono-ciudad">🏙️</div>
                <h3>${escapeHTML(ciudad)}</h3>
                <span>${cantidad} sitios</span>
            `;
            grid.appendChild(card);
        });

        divContenedor.appendChild(grid);
    }
        
    // RENDERIZADO MAPA
    Object.keys(gruposPorCiudad).forEach(ciudad => {
        gruposPorCiudad[ciudad].forEach(s => {
            let icono = iconos.default;

            if (s.caracteristicas.includes('Ascensor')) icono = iconos.ascensor;
            else if (s.caracteristicas.includes('Rampa') || s.caracteristicas.includes('Baño')) icono = iconos.movilidad;
            else if (s.caracteristicas.includes('Calma')) icono = iconos.calma;
            else if (s.caracteristicas.includes('Braille') || s.caracteristicas.includes('Podotactil')) icono = iconos.visual;
            else if (s.caracteristicas.includes('Pictogramas')) icono = iconos.cognitiva;
            else if (s.caracteristicas.includes('LSA') || s.caracteristicas.includes('Aro')) icono = iconos.auditiva;
            else if (s.caracteristicas.includes('Perro')) icono = iconos.perro || iconos.visual;
            
            if (mapa) {
                // 🛡️ LIMPIEZA DE DATOS ANTES DE PINTAR (XSS)
                const nombreSeguro = escapeHTML(s.nombre);
                const descSegura = escapeHTML(s.descripcion || 'Sin descripción.');
                // Recuperamos el autor o ponemos anónimo, y lo limpiamos
                const autorSeguro = escapeHTML(s.autor || 'Vecino Anónimo');

                const tagsPopup = s.caracteristicas.map(c => 
                    `<span style="background:#e0f2f1; color:#006d77; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:700; margin-right:3px; display:inline-block; border:1px solid #b2dfdb;">${escapeHTML(c)}</span>`
                ).join('');

                const idReal = s._id || s.id;
                const btnEditarPopup = esAdmin ? 
                    `<button onclick="editarSitio('${idReal}')" style="background:#eee; border:none; border-radius:50%; width:25px; height:25px; cursor:pointer; margin-left:5px;">✏️</button>` : '';

                const contenidoPopup = `
                    <div style="font-family: 'Poppins', sans-serif; min-width: 220px;">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <h3 style="margin:0 0 5px 0; color:#006d77; font-size:15px; font-weight:800;">${nombreSeguro}</h3>
                            ${btnEditarPopup}
                        </div>
                        
                        <div style="font-size: 10px; color: #E29578; font-weight: 600; margin-bottom: 8px;">
                            👤 Añadido por: ${autorSeguro}
                        </div>

                        <p style="font-size:11px; color:#555; margin:0 0 8px 0; line-height:1.4;">
                            ${descSegura}
                        </p>
                        <div style="margin-bottom:8px;">${tagsPopup}</div>
                        
                        <div style="display:flex; gap:5px; margin-top:10px; border-top:1px solid #eee; padding-top:10px;">
                             <a href="https://www.google.com/maps?q=${s.lat},${s.lng}" target="_blank" 
                                style="background:#006D77; color:white; text-decoration:none; padding:6px; border-radius:5px; font-size:11px; flex:1; text-align:center;">🗺️ Ir</a>
                             
                             <a href="https://api.whatsapp.com/send?text=¡Mira%20este%20sitio%20accesible!%20*${encodeURIComponent(nombreSeguro)}*%20tiene%20${encodeURIComponent(s.caracteristicas.join(', '))}.%20Encuéntralo%20en%20AccesoBarrio." 
                                target="_blank"
                                style="background:#25D366; color:white; text-decoration:none; padding:6px; border-radius:5px; font-size:11px; flex:1; text-align:center;">💬 Wsp</a>
                        </div>
                        <button onclick="verQR('${nombreSeguro}', ${s.lat}, ${s.lng})" 
                            style="margin-top:5px; width:100%; background:#333; color:white; border:none; border-radius:5px; padding:5px; cursor:pointer; font-size:10px; display:flex; align-items:center; justify-content:center; gap:5px;">
                            📱 Ver Código QR
                        </button>
                    </div>
                `;
                const m = L.marker([s.lat, s.lng], { icon: icono }).addTo(mapa).bindPopup(contenidoPopup);
                m.idSitio = idReal; 
                marcadores.push(m);
            }
        });
    });
}

function verCiudadDetalle(ciudad) {
    const divContenedor = document.getElementById('contenedor-items-lista');
    divContenedor.innerHTML = ''; 

    const header = document.createElement('div');
    header.className = 'header-carpeta';
    // 🛡️ SANITIZAR
    header.innerHTML = `
        <button class="btn-volver-carpetas" onclick="mostrarSitios(locales)">⬅ Volver</button>
        <h3 style="margin:0; color:#006d77;">${escapeHTML(ciudad)}</h3>
    `;
    divContenedor.appendChild(header);

    const sitios = gruposPorCiudad[ciudad];
    
    sitios.forEach(s => {
        const card = document.createElement('div');
        card.className = 'item-lista';
        // 🛡️ SANITIZAR
        const tagsLista = s.caracteristicas.map(c => `<span class="tag-accesibilidad">${escapeHTML(c)}</span>`).join('');
        const idReal = s._id || s.id;
        const btnEditar = esAdmin ? 
            `<button onclick="editarSitio('${idReal}')" style="cursor:pointer; border:none; background:none; font-size:16px;" title="Editar">✏️</button>` : '';

        card.onclick = (e) => {
            if(e.target.tagName === 'BUTTON') return;
            alternarVista();
            mapa.flyTo([s.lat, s.lng], 18);
            setTimeout(() => {
                const m = marcadores.find(marker => marker.getLatLng().lat === s.lat && marker.getLatLng().lng === s.lng);
                if(m) m.openPopup();
            }, 500);
        };

        card.style.cursor = "pointer"; 

        // 🛡️ SANITIZAR
        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:start;">
                <h3 style="margin:0; color:#006d77; font-size:16px;">${escapeHTML(s.nombre)}</h3>
                ${btnEditar}
            </div>
            <p style="font-size:12px; color:#666; margin:5px 0;">${escapeHTML(s.descripcion || 'Sin descripción')}</p>
            <div style="margin-top:5px;">${tagsLista}</div>
        `;
        divContenedor.appendChild(card);
    });
}

// RESTO DE FUNCIONES (Buscadores, etc)

async function buscarDireccion() {
    const calle = document.getElementById('input-direccion').value;
    if (!calle) return Swal.fire('Escribe una dirección');
    
    let busqueda = calle.replace(/calle|av.|avenida/gi, "").trim();
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(busqueda)}&addressdetails=1&limit=1`);
    const data = await r.json();
    
    if (data.length > 0) {
        const info = data[0];
        localidadDetectada = `${(info.address.city || info.address.town || "Ciudad").toUpperCase()}, ${(info.address.country || "").toUpperCase()}`;
        const lat = parseFloat(info.lat);
        const lon = parseFloat(info.lon);
        
        mapaSel.flyTo([lat, lon], 17);
        if (marcadorSel) marcadorSel.setLatLng([lat, lon]);
        else {
            marcadorSel = L.marker([lat, lon], {draggable: true}).addTo(mapaSel);
            marcadorSel.on('dragend', (e) => actualizarDireccionDesdePin(e.target.getLatLng().lat, e.target.getLatLng().lng));
        }
    } else { Swal.fire('No encontrado. Prueba agregar la ciudad.'); }
}

async function actualizarDireccionDesdePin(lat, lng) {
    try {
        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`);
        const data = await r.json();
        if (data && data.address) {
            document.getElementById('input-direccion').value = (data.address.road || "") + " " + (data.address.house_number || "");
            
            const ciudadEncontrada = data.address.city || data.address.town || data.address.village || data.address.municipality || data.address.county || "Desconocida";
            const pais = data.address.country || "";
            localidadDetectada = `${ciudadEncontrada.toUpperCase()}, ${pais.toUpperCase()}`;
            console.log("Localidad detectada:", localidadDetectada);
            return true;
        }
    } catch (e) { console.error("Error detectando ciudad:", e); }
    return false;
}

// 🛡️ GUARDAR CON CAPTCHA MATEMÁTICO (Anti-Bots) Y AUTOR
async function guardarSitio() {
    const nombre = document.getElementById('nombre').value;
    const desc = document.getElementById('descripcion').value;
    const checks = document.querySelectorAll('.cat-check:checked');
    const caracteristicas = Array.from(checks).map(c => c.value);
    // 👤 Capturamos el autor
    const autor = document.getElementById('autor-sitio') ? document.getElementById('autor-sitio').value.trim() : "Vecino Anónimo";
    
    if (!nombre || !marcadorSel) return Swal.fire('Faltan datos');

    // 🤖 CAPTCHA SIMPLE (Solo 2-3 segundos)
    const num1 = Math.floor(Math.random() * 5) + 1;
    const num2 = Math.floor(Math.random() * 5) + 1;
    const { value: respuesta } = await Swal.fire({
        title: 'Comprobación de Seguridad 🤖',
        text: `Para evitar robots, ¿cuánto es ${num1} + ${num2}?`,
        input: 'text',
        confirmButtonColor: '#006D77'
    });

    if (parseInt(respuesta) !== (num1 + num2)) {
        return Swal.fire('Error', 'Matemáticas incorrectas. Inténtalo de nuevo.', 'error');
    }

    const datos = {
        nombre, 
        descripcion: desc, 
        caracteristicas,
        localidad: localidadDetectada || "UBICACIÓN GENERAL",
        lat: marcadorSel.getLatLng().lat, 
        lng: marcadorSel.getLatLng().lng,
        autor: autor || "Vecino Anónimo" // Guardamos el autor
    };

    if (editandoId) {
        // EDITAR
        const res = await fetch(`/api/sitios/${editandoId}`, { 
            method: 'PUT', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(datos) 
        });
        
        cerrarModal(); 
        
        if(res.ok) {
            confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
            await Swal.fire('¡Actualizado!', 'Sitio modificado.', 'success');
        } else await Swal.fire('Error', 'Error al editar.', 'error');

    } else {
        // CREAR
        const res = await fetch('/api/sitios', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(datos) 
        });
        
        cerrarModal(); 
        
        // ¡CELEBRACIÓN! 🎉
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
        await Swal.fire('¡Guardado!', 'Nuevo sitio añadido.', 'success');
    }
    
    editandoId = null;
    location.reload();
}

function buscarDesdeInicio() {
    const t = document.getElementById('input-inicio').value;
    if(!t) return;
    document.getElementById('pantalla-inicio').style.display = 'none';
    document.getElementById('pantalla-resultados').style.display = 'flex';
    initMap();
    setTimeout(() => {
        mapa.invalidateSize();
        document.getElementById('buscador-texto').value = t;
        superBuscador();
    }, 500); 
}

async function superBuscador() {
    const input = document.getElementById('buscador-texto');
    const texto = input.value.trim().toLowerCase(); 
    if (!texto) return; 

    const encontradoLocal = locales.find(sitio => sitio.nombre.toLowerCase().includes(texto));

    if (encontradoLocal) {
        const m = document.getElementById('contenedor-mapa-pro');
        const l = document.getElementById('vista-lista');
        if(m.style.display === 'none') { m.style.display = 'flex'; l.style.display = 'none'; }
        mapa.flyTo([encontradoLocal.lat, encontradoLocal.lng], 18, { animate: true, duration: 1.5 });
        setTimeout(() => {
            const marcador = marcadores.find(m => 
                (m.idSitio && (m.idSitio == encontradoLocal._id || m.idSitio == encontradoLocal.id)) ||
                (m.getLatLng().lat === encontradoLocal.lat && m.getLatLng().lng === encontradoLocal.lng)
            );
            if (marcador) marcador.openPopup();
        }, 1600); 
        return; 
    }

    Swal.fire({ title: 'Buscando...', text: `Viajando a: ${input.value}`, timer: 1500, showConfirmButton: false, toast: true, position: 'top-end', didOpen: () => Swal.showLoading() });

    try {
        const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(texto)}&limit=1`);
        const d = await r.json();
        if (d.length > 0) {
            mapa.flyTo([d[0].lat, d[0].lon], 13);
            mostrarSitios(locales); 
        } else { Swal.fire('No encontrado', 'No existe en tu mapa ni en el mundo.', 'error'); }
    } catch(e) { console.error(e); }
}

document.addEventListener('DOMContentLoaded', () => {
    const inputBuscador = document.getElementById('buscador-texto');
    if(inputBuscador) {
        inputBuscador.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') { superBuscador(); }
        });
    }
});

function centrarEnMi() {
    if (!mapa) return;
    Swal.fire({ title: 'Localizando...', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000, didOpen: () => Swal.showLoading() });
    mapa.locate({setView: true, maxZoom: 16});
    mapa.on('locationfound', function(e) {
        L.circle(e.latlng, { color: '#4285F4', fillColor: '#4285F4', fillOpacity: 0.2, radius: e.accuracy / 2 }).addTo(mapa);
        L.circleMarker(e.latlng, { radius: 8, fillColor: '#4285F4', color: '#fff', weight: 2, fillOpacity: 1 }).addTo(mapa);
    });
}

function cargarResultados(tipo) {
    document.getElementById('pantalla-inicio').style.display = 'none';
    document.getElementById('pantalla-resultados').style.display = 'flex';
    initMap();
    setTimeout(() => {
        mapa.invalidateSize();
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

function cerrarModal() { 
    document.getElementById('modal-anadir').style.display = 'none'; 
    editandoId = null;
    document.getElementById('nombre').value = "";
    document.getElementById('descripcion').value = "";
    document.getElementById('input-direccion').value = "";
    
    // Limpiamos el autor si existe el campo
    const inputAutor = document.getElementById('autor-sitio');
    if(inputAutor) inputAutor.value = ""; 

    document.querySelectorAll('.cat-check').forEach(c => c.checked = false);
    const btn = document.querySelector('#modal-anadir .btn-principal');
    if(btn) btn.textContent = "Guardar Sitio";
}
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
// 🔒 LOGIN SEGURO (SESSION STORAGE)
// ============================================
function comprobarSesion() {
    const sesion = sessionStorage.getItem('acceso_admin_token');
    if (sesion === 'true') { esAdmin = true; actualizarInterfazAdmin(); }
}

async function iniciarSesionAdmin() {
    const { value: password } = await Swal.fire({ title: 'Acceso Admin 👩‍💻', input: 'password', confirmButtonColor: '#006D77', showCancelButton: true });
    if (password === ADMIN_PIN) {
        esAdmin = true; 
        sessionStorage.setItem('acceso_admin_token', 'true');
        Swal.fire({ icon: 'success', title: 'Hola Sofi', text: 'Modo edición activado', timer: 1000, showConfirmButton: false });
        actualizarInterfazAdmin(); mostrarSitios(locales);
    } else if (password) { Swal.fire('Error', 'PIN incorrecto', 'error'); }
}

function cerrarSesionAdmin() {
    esAdmin = false; 
    sessionStorage.removeItem('acceso_admin_token');
    Swal.fire('Sesión cerrada', '', 'info');
    actualizarInterfazAdmin(); mostrarSitios(locales);
}

function actualizarInterfazAdmin() {
    const btnLogin = document.getElementById('btn-login');
    const btnLogout = document.getElementById('btn-logout');
    if (esAdmin) {
        if(btnLogin) btnLogin.style.display = 'none';
        if(btnLogout) btnLogout.style.display = 'inline-block';
    } else {
        if(btnLogin) btnLogin.style.display = 'inline-block';
        if(btnLogout) btnLogout.style.display = 'none';
    }
}

// 🛡️ EDICIÓN
async function editarSitio(id) {
    const sitio = locales.find(l => l.id == id || l._id == id);
    if (!sitio) return;
    editandoId = id; 
    document.getElementById('nombre').value = sitio.nombre;
    document.getElementById('descripcion').value = sitio.descripcion;
    document.querySelectorAll('.cat-check').forEach(chk => { chk.checked = sitio.caracteristicas.includes(chk.value); });
    
    Swal.fire({ title: 'Detectando ubicación...', didOpen: () => Swal.showLoading(), backdrop: false, toast: true, position: 'top-end', showConfirmButton: false });
    await actualizarDireccionDesdePin(sitio.lat, sitio.lng);
    Swal.fire({ icon: 'success', title: 'Ubicación actualizada', text: `Carpeta: ${localidadDetectada}`, timer: 2000, toast: true, position: 'top-end', showConfirmButton: false });

    abrirFormulario();
    const btnGuardar = document.querySelector('#modal-anadir .btn-principal');
    if(btnGuardar) btnGuardar.textContent = "Actualizar Sitio 💾";

    setTimeout(() => {
        if(mapaSel) {
            mapaSel.setView([sitio.lat, sitio.lng], 16);
            if(marcadorSel) marcadorSel.setLatLng([sitio.lat, sitio.lng]);
            else marcadorSel = L.marker([sitio.lat, sitio.lng], {draggable: true}).addTo(mapaSel);
        }
    }, 500);
}

// PANEL ACCESIBILIDAD
const btnAccess = document.getElementById('btn-accesibilidad');
const panelAccess = document.getElementById('panel-accesibilidad');
let zoomLevel = 1;
if(btnAccess && panelAccess) {
    btnAccess.addEventListener('click', () => {
        panelAccess.classList.toggle('hidden');
        panelAccess.setAttribute('aria-hidden', panelAccess.classList.contains('hidden'));
    });
}
window.cambiarTexto = function(d) { zoomLevel += d * 0.1; if(zoomLevel>1.8)zoomLevel=1.8; if(zoomLevel<0.8)zoomLevel=0.8; document.body.style.transform=`scale(${zoomLevel})`; document.body.style.transformOrigin="top center"; document.body.style.width=`${100/zoomLevel}%`; }
window.toggleContraste = function() { document.body.classList.toggle('high-contrast'); }
window.toggleDislexia = function() { document.body.classList.toggle('dyslexia-font'); }
window.toggleAnimaciones = function() { document.body.classList.toggle('stop-animations'); }
window.resetAccesibilidad = function() { zoomLevel = 1; document.body.style.transform=''; document.body.style.width=''; document.body.classList.remove('high-contrast', 'dyslexia-font', 'stop-animations'); }

// ============================================
// 📊 LÓGICA DE IMPACTO Y CURIOSIDADES
// ============================================
const curiosidades = [
    "El color amarillo es el último que el ojo humano deja de ver antes de perder la visión, por eso es vital para marcar escalones.",
    "El 'Aro Magnético' filtra el ruido ambiente y transmite el sonido directo al audífono.",
    "La Lengua de Señas (LSA) no es universal ni es mímica: es un idioma completo.",
    "Los pictogramas y la 'Lectura Fácil' son esenciales para personas con autismo o discapacidad intelectual.",
    "Una rampa segura no debe superar el 10% de inclinación.",
    "El ancho libre de paso mínimo para una silla de ruedas es de 80cm.",
    "La discapacidad no está en la persona, sino en el entorno que no se adapta.",
    "La accesibilidad no es un favor ni caridad, es un DERECHO.",
    "Nada sobre nosotros sin nosotros.",
    "No queremos ser 'héroes' por salir a la calle, queremos salir con normalidad.",
    "Un lugar accesible beneficia a todos.",
    "Este mapa existe gracias a la fuerza de mi madre.",
    "Dedicado a mi mamá, que me enseñó que la única barrera real es la falta de empatía.",
    "Por la lucha de mi madre. Porque rendirse nunca fue una opción."
];

function actualizarInfoPortada() {
    const textoElement = document.getElementById('texto-curiosidad');
    if (textoElement) {
        const fraseRandom = curiosidades[Math.floor(Math.random() * curiosidades.length)];
        textoElement.innerText = `"${fraseRandom}"`;
    }
    const contadorSitios = document.getElementById('contador-sitios');
    const contadorTags = document.getElementById('contador-tags');
    if (contadorSitios && locales.length > 0) {
        contadorSitios.innerText = locales.length;
        const totalTags = locales.reduce((total, sitio) => total + sitio.caracteristicas.length, 0);
        contadorTags.innerText = totalTags;
    }
}

// ==========================================
// ✍️ EFECTO MÁQUINA DE ESCRIBIR
// ==========================================
const frases = [
    "¿Qué lugar buscas hoy?",
    "Por ejemplo: 'Bar El Tío'...",
    "Por ejemplo: 'Farmacia'...",
    "Por ejemplo: 'Escuela Nº5'...",
    "Por ejemplo: 'Teatro Colón'..."
];
let fraseIndex = 0;
let charIndex = 0;
let isDeleting = false;
const element = document.getElementById('subtitulo-dinamico');

function typeWriter() {
    if (!element) return;
    const currentFrase = frases[fraseIndex];
    if (isDeleting) {
        element.textContent = currentFrase.substring(0, charIndex - 1);
        charIndex--;
    } else {
        element.textContent = currentFrase.substring(0, charIndex + 1);
        charIndex++;
    }
    let typeSpeed = isDeleting ? 30 : 80;
    if (!isDeleting && charIndex === currentFrase.length) {
        typeSpeed = 2000;
        isDeleting = true;
    } else if (isDeleting && charIndex === 0) {
        isDeleting = false;
        fraseIndex = (fraseIndex + 1) % frases.length;
        typeSpeed = 500;
    }
    setTimeout(typeWriter, typeSpeed);
}
document.addEventListener('DOMContentLoaded', typeWriter);

// ==========================================
// 🔗 QR PARA COMPARTIR (GLOBO)
// ==========================================
function mostrarQRGeneral() {
    const urlWeb = "https://accesobarrio.onrender.com/"; 
    Swal.fire({
        title: '¡Comparte AccesoBarrio!',
        text: 'Escanea para abrir la app en otro móvil',
        html: `
            <div style="display:flex; justify-content:center; align-items:center; flex-direction:column; margin:10px;">
                <div id="qrcode-general" style="padding:10px; background:white; border-radius:10px; border:2px dashed #eee;"></div>
                <p style="margin-top:15px; font-size:12px; color:#888;">Juntos hacemos un barrio más inclusivo 💜</p>
            </div>
        `,
        showConfirmButton: false,
        showCloseButton: true,
        background: '#fff',
        didOpen: () => {
            new QRCode(document.getElementById("qrcode-general"), {
                text: urlWeb,
                width: 180,
                height: 180,
                colorDark : "#FF7E6B",
                colorLight : "#ffffff",
                correctLevel : QRCode.CorrectLevel.H
            });
        }
    });
}