// Lo mínimo para que la app siga andando en iPhone con iOS 14 a 15.3 (Safari 14 y 15), como antes de Inertia 3.
// es-toolkit, que Inertia 3 usa para copiar los datos de los formularios, llama a Object.hasOwn (Safari 15.4).
if (typeof Object.hasOwn !== 'function') {
    Object.defineProperty(Object, 'hasOwn', {
        value: (objeto, clave) => Object.prototype.hasOwnProperty.call(objeto, clave),
        configurable: true,
        writable: true,
    });
}
