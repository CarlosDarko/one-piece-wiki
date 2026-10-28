// Interruptores de funciones. Para volver a mostrar «Los lugares» (el mapa), pon lugares: true y ejecuta npm run build.
// Con false la vista, su pestaña, sus enlaces y su ficha-resumen no existen: #/lugares y #/carta redirigen a la portada.
// El código del mapa (src/views/carta.ts) y sus datos (public/data/places.js) se conservan; las fichas de tipo «lugar» siguen siendo fichas normales.
export const LUGARES = false; // constante suelta (no propiedad) para que el empaquetador descarte el mapa entero cuando es false
export const FEATURES = { lugares: LUGARES };
