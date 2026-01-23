let mapa, marcadores = [], locales = [], editandoId = null;
let localidadDetectada = "";

async function cargarSitios() {
    try {
        const r = await fetch('/api/sitios');
        locales = await r.json();
        document.getElementById('loading-overlay').style.display = 'none';
        mostrarSitios(locales);
    } catch(e) { console.error(e); }
}

function mostrarSitios(lista) {
    if (mapa) { marcadores.forEach(m => mapa.removeLayer(m)); }
    marcadores = [];
    const divContenedor = document.getElementById('contenedor-items-lista');
    if (!divContenedor) return;
    divContenedor.innerHTML = '';

    // Agrupamiento por Ciudad
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
                <span class="contador-pines">${grupos[ciudad].length}</span>
            </div>
            <div class="lista-pines-ciudad" style="display: none;"></div>
        `;
        const pinesDiv = container.querySelector('.lista-pines-ciudad');
        grupos[ciudad].forEach(s => {
            const card = document.createElement('div');
            card.className = 'item-lista';
            card.innerHTML = `<h3>${s.nombre}</h3><p>${s.descripcion || ''}</p>
                <div>${s.caracteristicas.map(c => `<span class="tag-accesibilidad">${c}</span>`).join('')}</div>`;
            pinesDiv.appendChild(card);
        });
        divContenedor.appendChild(container);
    });
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
            const header = document.querySelector('.header-ciudad');
            if (header) toggleCiudad(header);
        };
        listaSug.appendChild(li);
    });
}

function toggleCiudad(el) {
    const list = el.nextElementSibling;
    list.style.display = list.style.display === 'grid' ? 'none' : 'grid';
}

function alternarVista() {
    const map = document.getElementById('contenedor-mapa-pro'), list = document.getElementById('vista-lista');
    const isMap = map.style.display !== 'none';
    map.style.display = isMap ? 'none' : 'flex';
    list.style.display = isMap ? 'block' : 'none';
}

function buscarDesdeInicio() {
    document.getElementById('pantalla-inicio').style.display = 'none';
    document.getElementById('pantalla-resultados').style.display = 'flex';
    if (!mapa) {
        mapa = L.map('mapa').setView([40.41, -3.70], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapa);
    }
    mostrarSitios(locales);
}

window.onload = cargarSitios;