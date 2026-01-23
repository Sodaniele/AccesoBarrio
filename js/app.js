function mostrarResultadosFinal() {
    document.getElementById('pantalla-inicio').style.display = 'none';
    document.getElementById('pantalla-resultados').style.display = 'flex';
    
    if (!mapa) {
        initMap();
    }

    // Le damos un momento al CSS para renderizar y luego ajustamos el mapa
    setTimeout(() => {
        mapa.invalidateSize();
    }, 200);
}