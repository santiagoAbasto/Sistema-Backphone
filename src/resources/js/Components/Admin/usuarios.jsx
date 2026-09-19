import { Check, Lock, ShieldCheck, X } from 'lucide-react';
import { Badge } from '@/Components/Admin/ui';

// Piezas de Sistema → Usuarios y roles: el selector de módulos de un rol, la lista de lo que abre y la guía.

/** Las iniciales de una persona, para el círculo de la lista. */
export function iniciales(nombre = '') {
  return nombre.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

/** Qué abre un rol, en palabras: «Todo el panel» o los módulos elegidos. */
export function ListaPermisos({ permisos = [], catalogo = [], max = 4, panelPropio = false }) {
  if (permisos.includes('*')) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[color:var(--acento)]">
        <ShieldCheck className="h-3.5 w-3.5" /> Todo el panel
      </span>
    );
  }

  const etiquetas = catalogo
    .flatMap((g) => g.modulos)
    .filter((m) => permisos.includes(m.clave))
    .map((m) => m.label);

  if (etiquetas.length === 0) {
    return panelPropio
      ? <span className="text-xs font-semibold text-gris-500">Su propio panel, en /vendedor</span>
      : <span className="text-xs font-semibold text-amber-700">Sin módulos: no abre ninguna parte del panel</span>;
  }

  return (
    <span className="flex flex-wrap gap-1">
      {etiquetas.slice(0, max).map((e) => <Badge key={e} tone="slate">{e}</Badge>)}
      {etiquetas.length > max && <Badge tone="slate">+{etiquetas.length - max}</Badge>}
    </span>
  );
}

/** Los módulos del panel, agrupados, para marcar cuáles abre el rol. */
export function SelectorPermisos({ catalogo = [], valor = [], onChange, bloqueado = false, panelPropio = false }) {
  const marcados = new Set(valor);

  const alternar = (clave) => {
    if (bloqueado) return;
    const siguiente = new Set(marcados);
    siguiente.has(clave) ? siguiente.delete(clave) : siguiente.add(clave);
    onChange([...siguiente]);
  };

  const grupoCompleto = (modulos) => modulos.every((m) => marcados.has(m.clave));

  const alternarGrupo = (modulos) => {
    if (bloqueado) return;
    const siguiente = new Set(marcados);
    const todos = grupoCompleto(modulos);
    modulos.forEach((m) => (todos ? siguiente.delete(m.clave) : siguiente.add(m.clave)));
    onChange([...siguiente]);
  };

  if (bloqueado) {
    return (
      <p className="flex items-start gap-2 rounded-xl bg-[rgb(var(--acento-rgb)_/_0.06)] px-3.5 py-3 text-[13px] leading-relaxed text-gris-600">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--acento)]" />
        El administrador entra a todo el panel, siempre. Es la única forma de que nadie quede afuera de la
        los datos del negocio.
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      {panelPropio && (
        <p className="flex items-start gap-2 rounded-xl bg-gris-50 px-3.5 py-3 text-[13px] leading-relaxed text-gris-600">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-gris-400" />
          El vendedor entra a <span className="font-semibold">su propio panel</span>, en <code className="rounded bg-white px-1">/vendedor</code>,
          donde vende, cotiza y registra servicios sin ver los costos. Puede quedarse así; lo que marques acá abajo se
          suma, y le abre además esa parte del panel de administración.
        </p>
      )}
      {catalogo.map(({ grupo, modulos }) => (
        <div key={grupo} className="rounded-xl border border-gris-100">
          <div className="flex items-center justify-between gap-3 border-b border-gris-100 px-3.5 py-2">
            <p className="text-xs font-bold uppercase tracking-wide text-gris-500">{grupo}</p>
            <button type="button" onClick={() => alternarGrupo(modulos)}
              className="text-xs font-semibold text-[color:var(--acento)] hover:underline">
              {grupoCompleto(modulos) ? 'Quitar todo' : 'Marcar todo'}
            </button>
          </div>
          <div className="grid gap-1 p-2 sm:grid-cols-2">
            {modulos.map((m) => {
              const activo = marcados.has(m.clave);
              return (
                <label key={m.clave}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors ${activo ? 'bg-[rgb(var(--acento-rgb)_/_0.08)] font-semibold text-gris-900' : 'text-gris-600 hover:bg-gris-50'}`}>
                  <span className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${activo ? 'border-[color:var(--acento)] bg-[color:var(--acento)] text-white' : 'border-gris-300 bg-white'}`}>
                    {activo && <Check className="h-3 w-3" />}
                  </span>
                  <input type="checkbox" className="sr-only" checked={activo} onChange={() => alternar(m.clave)} />
                  {m.label}
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export const CONSEJOS_USUARIOS = [
  {
    titulo: 'Una cuenta por persona',
    texto: 'Compartir una cuenta hace imposible saber quién registró una venta o quién cambió un precio. Crear una cuenta lleva medio minuto.',
    bien: 'Lucía entra con su correo y su contraseña',
    mal: 'Todos entran con la cuenta del administrador',
  },
  {
    titulo: 'Da solo lo que necesita',
    texto: 'Quien atiende el mostrador no necesita ver los costos, los reportes ni los datos del negocio. Menos módulos es menos riesgo de tocar algo sin querer.',
    bien: 'Vendedor: ventas, reservas, servicio técnico, cotizaciones y clientes',
    mal: 'Todos administradores, «total es gente de confianza»',
  },
  {
    titulo: 'Da de baja el mismo día',
    texto: 'Cuando alguien deja de trabajar contigo, bórralo o cámbiale la contraseña en el momento. Su cuenta abre el panel desde cualquier computadora.',
    bien: 'Se fue → se borra su cuenta hoy',
    mal: 'Dejarla «por si vuelve»',
  },
];
