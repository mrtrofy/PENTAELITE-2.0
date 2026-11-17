# Sistema Web - Pentatlón Moderno 🏅

Sistema de gestión de tiempos y puntajes para competencias de Pentatlón Moderno, basado en las reglas oficiales UIPM.

## Archivos del Proyecto

| Archivo | Descripción |
|---------|-------------|
| `index.html` | Pantalla de inicio de sesión |
| `Penta.html` | Panel principal del sistema |
| `script.js` | Lógica completa del sistema |
| `deeee.jpeg` | Logo para los PDFs (debes colocarlo aquí) |

## Cómo usar

1. Abre `index.html` en un servidor web (no funciona con `file://` por las restricciones de módulos ES y Firebase)
2. Para desarrollo local puedes usar:
   ```
   npx serve .
   # o
   python3 -m http.server 8080
   ```
3. Inicia sesión con tu cuenta de Google o con email/contraseña
4. Para acceder al **Panel Admin**: haz clic en el botón "Admin" → contraseña: `Newman.999`

## Funcionalidades

### Vista Pública
- Lista de eventos disponibles con acordeón
- Filtros por: Prueba, Género, Categoría, Fase y Grupo
- Resultados en tiempo real (Firebase)

### Vistas de Resultados
- **Ranking General**: Puntajes totales (Esgrima + Obstáculos + Natación + Láser)
- **Esgrima/Status**: Victorias y derrotas por atleta
- **Hándicap**: Orden de salida para Láser Run
- **Torneo**: Llaves de eliminación directa

### Panel Admin
- Gestión de Eventos (crear/eliminar)
- Gestión de Atletas (crear/editar/eliminar)
- Registro de Pruebas individuales (Obstáculos, OCR, etc.)
- Generador de PDF para todos los reportes

## Sistema de Puntuación (UIPM Oficial)

### Esgrima
Basado en la tabla oficial UIPM (posición 1 = 250 pts, decreciente)

### Natación (Individual)
- **Senior/Junior**: `max(0, 375 - ceil((t - 45) / 0.2))`
- **U19**: `max(0, 250 - (t - 45) * 2)`

### Obstáculos
- `max(0, 400 - floor((t - 15) / 0.33))`

### Láser Run
- **Senior/Junior**: `max(0, 700 - floor(t - 600))`
- **U19**: `max(0, 700 - (t - 260))`

### Relevos y JDN
Fórmulas especiales según el Apéndice 4B2/4B3/5B2/5B3 del reglamento UIPM.

## Correcciones sobre el script original

1. ✅ `downloadGeneralPDF` duplicada → una sola definición
2. ✅ Código fuera del `try/catch` en `renderResults` → movido dentro del bloque correcto
3. ✅ `advancePlayer` sin parámetros → usa `currentRenderParams` global
4. ✅ Variable `modal` no declarada en `dibujarRondas` → `document.getElementById()`
5. ✅ `refreshDestinations()` inexistente → `refreshAdvanceDestinations()`
6. ✅ Columnas de penalidad en OCR → condicionales correctas
