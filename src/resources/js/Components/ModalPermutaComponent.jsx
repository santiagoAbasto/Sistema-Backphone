import { Fragment, useEffect, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Repeat, X } from 'lucide-react';
import { inputCls } from '@/Components/Admin/ui';

// Campos que pide el servidor para cada tipo de permuta (VentaController@store). * = obligatorio
const CAMPOS = {
  celular: [
    { name: 'modelo', label: 'Modelo', placeholder: 'Ej.: iPhone 13 Pro', req: true },
    { name: 'capacidad', label: 'Capacidad', placeholder: 'Ej.: 128 GB', req: true },
    { name: 'color', label: 'Color', req: true },
    { name: 'bateria', label: 'Batería', placeholder: 'Ej.: 87%', req: true },
    { name: 'imei_1', label: 'IMEI 1', placeholder: '15 dígitos', req: true, imei: true },
    { name: 'imei_2', label: 'IMEI 2 (opcional)', placeholder: '15 dígitos', imei: true },
    {
      name: 'estado_imei', label: 'Estado del IMEI', req: true, options: [
        ['libre', 'Libre'], ['registrado', 'Registrado'],
        ['imei1_libre_imei2_registrado', 'IMEI 1 libre / IMEI 2 registrado'],
        ['imei1_registrado_imei2_libre', 'IMEI 1 registrado / IMEI 2 libre'],
      ],
    },
    { name: 'procedencia', label: 'Procedencia', placeholder: 'Ej.: cliente', req: true },
  ],
  computadora: [
    { name: 'nombre', label: 'Nombre', placeholder: 'Ej.: MacBook Air M1', req: true },
    { name: 'procesador', label: 'Procesador (opcional)' },
    { name: 'numero_serie', label: 'Número de serie', req: true },
    { name: 'color', label: 'Color', req: true },
    { name: 'bateria', label: 'Batería', placeholder: 'Ej.: 92% o 120 ciclos', req: true },
    { name: 'ram', label: 'RAM', placeholder: 'Ej.: 8 GB', req: true },
    { name: 'almacenamiento', label: 'Almacenamiento', placeholder: 'Ej.: 256 GB', req: true },
    { name: 'procedencia', label: 'Procedencia', placeholder: 'Ej.: cliente', req: true },
  ],
  producto_general: [
    {
      name: 'tipo', label: 'Tipo', req: true, options: [
        ['funda', 'Funda'], ['cargador_20w', 'Cargador 20 W'], ['cargador_5w', 'Cargador 5 W'],
        ['vidrio_templado', 'Vidrio templado'], ['vidrio_camara', 'Protector de cámara'],
        ['accesorio', 'Accesorio'], ['otro', 'Otro'],
      ],
    },
    { name: 'nombre', label: 'Nombre', req: true },
    { name: 'codigo', label: 'Código', placeholder: 'Código único', req: true },
    { name: 'procedencia', label: 'Procedencia', placeholder: 'Ej.: cliente', req: true },
  ],
};

const TITULOS = { celular: 'celular', computadora: 'computadora', producto_general: 'producto general' };

export default function ModalPermutaComponent({ show, onClose, tipo, onGuardar }) {
  const [formData, setFormData] = useState({});
  const [faltan, setFaltan] = useState([]);

  useEffect(() => {
    setFormData({});
    setFaltan([]);
  }, [tipo]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFaltan((f) => f.filter((x) => x !== name));

    if (name === 'imei_1' || name === 'imei_2') {
      const cleaned = value.replace(/\D/g, '');
      if (cleaned.length <= 15) setFormData((prev) => ({ ...prev, [name]: cleaned }));
    } else if (name === 'precio_costo' || name === 'precio_venta') {
      const parsed = parseFloat(value);
      setFormData((prev) => ({ ...prev, [name]: isNaN(parsed) ? '' : parsed }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleGuardar = () => {
    const requeridos = [...(CAMPOS[tipo] || []).filter((c) => c.req).map((c) => c.name), 'precio_costo', 'precio_venta'];
    const pendientes = requeridos.filter((n) => formData[n] === undefined || formData[n] === '' || formData[n] === null);
    if (pendientes.length) {
      setFaltan(pendientes);
      return;
    }

    // El equipo recibido siempre entra al inventario como "permuta"
    onGuardar({ ...formData, estado: 'permuta' });
    onClose();
  };

  const campo = (c) => {
    const error = faltan.includes(c.name);
    const cls = `${inputCls} h-11 ${c.options ? 'pr-9' : ''} ${error ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : ''}`;
    return (
      <div key={c.name}>
        <label htmlFor={`permuta-${c.name}`} className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gris-600">
          {c.label}{c.req && <span className="text-rose-500"> *</span>}
        </label>
        {c.options ? (
          <select id={`permuta-${c.name}`} name={c.name} className={cls} value={formData[c.name] || ''} onChange={handleChange}>
            <option value="">Elegir…</option>
            {c.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        ) : (
          <input id={`permuta-${c.name}`} name={c.name} className={cls} placeholder={c.placeholder}
            inputMode={c.imei ? 'numeric' : undefined} maxLength={c.imei ? 15 : undefined}
            value={formData[c.name] ?? ''} onChange={handleChange} />
        )}
        {error && <p className="mt-1 text-xs font-medium text-red-600">Completa este dato.</p>}
      </div>
    );
  };

  return (
    <Transition.Root show={show} as={Fragment}>
      <Dialog as="div" className="relative z-[1060]" onClose={onClose}>
        <Transition.Child as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0">
          <div className="fixed inset-0 bg-[#121214]/40 backdrop-blur-[2px]" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0 translate-y-2 scale-[0.98]" enterTo="opacity-100 translate-y-0 scale-100" leave="ease-in duration-150" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-[0.98]">
              <Dialog.Panel className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white text-left shadow-2xl" style={{ fontFamily: "var(--fuente-texto)" }}>
                <div className="flex items-start justify-between gap-4 border-b border-gris-100 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#96684F]/10 text-[#96684F]"><Repeat className="h-5 w-5" /></span>
                    <div>
                      <Dialog.Title className="text-base font-bold text-gris-900">Equipo que entrega el cliente</Dialog.Title>
                      <p className="text-[13px] text-gris-500">Tipo: {TITULOS[tipo] ?? '—'} · entra al inventario como permuta</p>
                    </div>
                  </div>
                  <button type="button" onClick={onClose} aria-label="Cerrar" className="grid h-9 w-9 place-items-center rounded-lg text-gris-400 hover:bg-gris-100 hover:text-gris-700">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    {(CAMPOS[tipo] || []).map(campo)}
                  </div>

                  <div className="mt-5 grid gap-4 rounded-xl border border-gris-200 bg-gris-50/70 p-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="permuta-precio_costo" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gris-600">
                        Valor para el cliente (Bs)<span className="text-rose-500"> *</span>
                      </label>
                      <input id="permuta-precio_costo" name="precio_costo" type="number" min="0" step="0.01" onChange={handleChange} value={formData.precio_costo ?? ''}
                        className={`${inputCls} h-11 ${faltan.includes('precio_costo') ? 'border-red-400' : ''}`} />
                      <p className="mt-1 text-xs text-gris-500">Se descuenta del total de la venta.</p>
                    </div>
                    <div>
                      <label htmlFor="permuta-precio_venta" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gris-600">
                        Precio de reventa (Bs)<span className="text-rose-500"> *</span>
                      </label>
                      <input id="permuta-precio_venta" name="precio_venta" type="number" min="0" step="0.01" onChange={handleChange} value={formData.precio_venta ?? ''}
                        className={`${inputCls} h-11 ${faltan.includes('precio_venta') ? 'border-red-400' : ''}`} />
                      <p className="mt-1 text-xs text-gris-500">A cuánto lo venderás después.</p>
                    </div>
                  </div>

                  {faltan.length > 0 && (
                    <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700" role="alert">
                      Faltan {faltan.length} {faltan.length === 1 ? 'dato' : 'datos'} marcados en rojo.
                    </p>
                  )}
                </div>

                <div className="flex justify-end gap-3 border-t border-gris-100 bg-gris-50/60 px-6 py-4">
                  <button type="button" onClick={onClose}
                    className="inline-flex items-center rounded-xl border border-gris-200 bg-white px-4 py-2 text-sm font-semibold text-gris-700 hover:bg-gris-50">
                    Cancelar
                  </button>
                  <button type="button" onClick={handleGuardar}
                    className="inline-flex items-center rounded-xl bg-[#121214] px-5 py-2 text-sm font-semibold text-white shadow-[0_8px_18px_-10px_rgba(10, 10, 11,0.6)] hover:bg-[#1D1D21]">
                    Guardar equipo
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
