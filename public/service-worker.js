// Este archivo hace que el navegador reconozca esto como una APP instalable.

self.addEventListener('install', (event) => {
    console.log('👷 Service Worker: Instalado');
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('👷 Service Worker: Activado');
});

// ESTRATEGIA: "Network First" (Primero Internet)
// Esto es vital para ti: Intenta bajar siempre la última versión de tu código.
// Si no hay internet, no cargará (por ahora), pero así ves tus cambios al instante.
self.addEventListener('fetch', (event) => {
    event.respondWith(fetch(event.request));
});