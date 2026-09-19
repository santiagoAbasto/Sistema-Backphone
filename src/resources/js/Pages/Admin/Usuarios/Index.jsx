import AdminLayout from '@/Layouts/AdminLayout';
import { Head, router, useForm } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { route } from 'ziggy-js';
import {
  Globe, KeyRound, Pencil, Plus, Search, Shield, ShieldCheck, Trash2, TriangleAlert, UserPlus, Users, X,
} from 'lucide-react';
import AdminGuide from '@/Components/Admin/AdminGuide';
import { Consejos,
  Field, Input, Modal, PageHeader, Select, Textarea, Toast, bsFmt, buttonCls, fmtDate, inputCls, useToast,
} from '@/Components/Admin/ui';
import { Aviso, ChipsEstado, ModalEliminar, Nota, Stat } from '@/Components/Admin/inventario';
import { CONSEJOS_USUARIOS, ListaPermisos, SelectorPermisos, iniciales } from '@/Components/Admin/usuarios';
import IconoUsuarios from '@/Components/Admin/IconoUsuarios';
import { IconoLocal } from '@/Components/Marca/IconosSucursal';

// Sistema → Usuarios y roles: quién entra al panel y qué parte puede abrir. El rol de cada persona decide los
// módulos, y el servidor aplica la misma regla que el menú (App\Support\Permisos).

function FormularioUsuario({ usuario, roles, sucursales, soySuperAdmin, miSucursal, onCerrar }) {
  const editando = Boolean(usuario);
  // Quien está atado a una sucursal solo puede dar acceso a la suya
  const sucursalInicial = editando
    ? (usuario.sucursal_id ?? '')
    : (soySuperAdmin ? (sucursales[0]?.id ?? '') : miSucursal);

  const { data, setData, post, patch, processing, errors } = useForm({
    name: usuario?.name ?? '',
    email: usuario?.email ?? '',
    rol: usuario?.rol ?? (roles.find((r) => r.clave !== 'admin')?.clave ?? roles[0]?.clave ?? ''),
    sucursal_id: sucursalInicial,
    password: '',
    password_confirmation: '',
    meta_mensual: usuario?.meta_mensual ? String(usuario.meta_mensual) : '',
  });

  const rolElegido = roles.find((r) => r.clave === data.rol);
  const esSuperAdmin = data.sucursal_id === '' || data.sucursal_id === null;
  const sucursalElegida = sucursales.find((s) => s.id === Number(data.sucursal_id));
  // La meta solo se ve en el panel propio del rol (hoy, el del vendedor)
  const conMeta = Boolean(rolElegido?.panel_propio);

  const guardar = () => {
    const opciones = { preserveScroll: true, onSuccess: onCerrar };
    if (editando) patch(route('admin.usuarios.update', usuario.id), opciones);
    else post(route('admin.usuarios.store'), opciones);
  };

  return (
    <Modal
      wide
      title={editando ? `Editar a ${usuario.name}` : 'Nuevo usuario'}
      onClose={onCerrar}
      footer={(
        <>
          <button type="button" onClick={onCerrar} className={buttonCls('secondary', 'h-11')}>Cancelar</button>
          <button type="button" onClick={guardar} disabled={processing || !data.name.trim() || !data.email.trim()}
            className={buttonCls('primary', 'h-11')}>
            {processing ? 'Guardando…' : editando ? 'Guardar' : 'Crear usuario'}
          </button>
        </>
      )}
    >
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_260px]">
        <div className="grid content-start gap-4">
          <Field label="Nombre y apellido" error={errors.name} hint="Es el que se ve en el panel y en el historial.">
            <Input value={data.name} maxLength={120} autoFocus onChange={(e) => setData('name', e.target.value)} />
          </Field>

          <Field label="Correo" error={errors.email} hint="Con este correo entra al panel.">
            <Input type="email" value={data.email} maxLength={191} onChange={(e) => setData('email', e.target.value)} />
          </Field>

          <Field label="Rol" error={errors.rol} hint="Decide a qué parte del panel entra.">
            <Select value={data.rol} onChange={(e) => setData('rol', e.target.value)}>
              {roles.filter((r) => r.activo).map((r) => (
                <option key={r.clave} value={r.clave}>{r.nombre}</option>
              ))}
            </Select>
          </Field>

          <Field
            label="Sucursal"
            error={errors.sucursal_id}
            hint={esSuperAdmin
              ? 'Sin sucursal, ve todas y puede filtrar desde el encabezado.'
              : 'Ve y carga solo en esta sucursal. No puede mirar las otras.'}
          >
            <Select
              value={data.sucursal_id ?? ''}
              disabled={!soySuperAdmin}
              onChange={(e) => setData('sucursal_id', e.target.value === '' ? '' : Number(e.target.value))}
            >
              {sucursales.map((s) => (
                <option key={s.id} value={s.id}>{s.nombre}{s.ciudad && s.ciudad !== s.nombre ? ` · ${s.ciudad}` : ''}</option>
              ))}
              {soySuperAdmin && <option value="">Todas — super administrador</option>}
            </Select>
          </Field>

          <Field
            label={editando ? 'Contraseña nueva (opcional)' : 'Contraseña'}
            error={errors.password}
            hint={editando
              ? 'Déjala vacía para no cambiarla. Si la cambias, avísale: con la anterior no entra más.'
              : 'Al menos 8 caracteres, con letras y números.'}
          >
            <Input type="password" autoComplete="new-password" value={data.password}
              onChange={(e) => setData('password', e.target.value)} />
          </Field>

          {data.password !== '' && (
            <Field label="Repetir la contraseña" error={errors.password_confirmation}>
              <Input type="password" autoComplete="new-password" value={data.password_confirmation}
                onChange={(e) => setData('password_confirmation', e.target.value)} />
            </Field>
          )}

          {conMeta && (
            <Field
              label="Meta de ventas del mes (Bs)"
              error={errors.meta_mensual}
              hint="Es la que ve en su panel. Déjala en blanco o en 0 si todavía no le pusiste meta."
            >
              <Input type="number" min="0" step="0.01" inputMode="decimal" placeholder="0.00"
                value={data.meta_mensual} onChange={(e) => setData('meta_mensual', e.target.value)} />
            </Field>
          )}
        </div>

        <div className="grid content-start gap-3 md:sticky md:top-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-gris-600">Con ese rol entra a</p>
          <div className="rounded-xl border border-gris-200 px-3.5 py-3">
            <p className="text-[13px] font-bold text-gris-900">{rolElegido?.nombre ?? 'Sin rol'}</p>
            {rolElegido?.descripcion && (
              <p className="mt-0.5 text-xs leading-relaxed text-gris-500">{rolElegido.descripcion}</p>
            )}
            <div className="mt-2.5 border-t border-gris-100 pt-2.5">
              <ListaPermisos permisos={rolElegido?.permisos ?? []} catalogo={window.__PERMISOS__ ?? []} max={8}
                panelPropio={Boolean(rolElegido?.panel_propio)} />
            </div>
          </div>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-gris-600">Y trabaja en</p>
          <div className="rounded-xl border border-gris-200 px-3.5 py-3">
            {esSuperAdmin ? (
              <>
                <p className="flex items-center gap-2 text-[13px] font-bold text-gris-900">
                  <Globe className="h-4 w-4 text-[color:var(--acento)]" /> Todas las sucursales
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-gris-500">
                  Ve el negocio completo y elige con cuál trabajar desde el encabezado.
                </p>
              </>
            ) : (
              <>
                <p className="flex items-center gap-2 text-[13px] font-bold text-gris-900">
                  <IconoLocal className="h-4 w-4 text-[color:var(--acento)]" />
                  {sucursalElegida?.nombre ?? 'Sin sucursal'}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-gris-500">
                  Solo ve el inventario, las ventas y los clientes de esta sucursal. Sus códigos de nota
                  empiezan con <span className="cifra font-semibold">{sucursalElegida?.prefijo ?? '—'}</span>.
                </p>
              </>
            )}
          </div>
          <Nota>La contraseña se guarda cifrada: nadie, ni tú, la puede volver a ver.</Nota>
        </div>
      </div>
    </Modal>
  );
}

function FormularioRol({ rol, catalogo, onCerrar }) {
  const editando = Boolean(rol);
  const { data, setData, post, patch, processing, errors } = useForm({
    nombre: rol?.nombre ?? '',
    descripcion: rol?.descripcion ?? '',
    permisos: rol?.permisos?.includes('*') ? [] : (rol?.permisos ?? []),
    activo: rol?.activo ?? true,
  });

  const esAdmin = rol?.clave === 'admin';

  const guardar = () => {
    const opciones = { preserveScroll: true, onSuccess: onCerrar };
    if (editando) patch(route('admin.roles.update', rol.id), opciones);
    else post(route('admin.roles.store'), opciones);
  };

  return (
    <Modal
      wide
      title={editando ? `Rol «${rol.nombre}»` : 'Nuevo rol'}
      onClose={onCerrar}
      footer={(
        <>
          <button type="button" onClick={onCerrar} className={buttonCls('secondary', 'h-11')}>Cancelar</button>
          <button type="button" onClick={guardar} disabled={processing || !data.nombre.trim()}
            className={buttonCls('primary', 'h-11')}>
            {processing ? 'Guardando…' : editando ? 'Guardar' : 'Crear rol'}
          </button>
        </>
      )}
    >
      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre del rol" error={errors.nombre} hint="Es el que se elige al crear un usuario.">
            <Input value={data.nombre} maxLength={60} autoFocus placeholder="Encargado de local"
              onChange={(e) => setData('nombre', e.target.value)} />
          </Field>
          <Field label="¿Para quién es?" error={errors.descripcion} value={data.descripcion} max={120}
            hint="Una línea para acordarte dentro de seis meses.">
            <Input value={data.descripcion} maxLength={200} placeholder="Atiende el local y carga inventario"
              onChange={(e) => setData('descripcion', e.target.value)} />
          </Field>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gris-600">A qué parte del panel entra</p>
          <p className="mt-0.5 mb-3 text-[13px] text-gris-500">
            Lo que no marques no aparece en su menú y tampoco se abre escribiendo la dirección.
          </p>
          {errors.permisos && <p className="mb-2 text-xs font-semibold text-red-600">{errors.permisos}</p>}
          <SelectorPermisos catalogo={catalogo} valor={data.permisos} bloqueado={esAdmin}
            panelPropio={Boolean(rol?.panel_propio)} onChange={(v) => setData('permisos', v)} />
        </div>

        {editando && !rol.del_sistema && (
          <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl bg-gris-50 px-3.5 py-3">
            <span className="min-w-0">
              <span className="block text-[13px] font-bold text-gris-900">Rol activo</span>
              <span className="block text-xs leading-relaxed text-gris-500">
                Apagado, no se puede elegir al crear un usuario. Solo se apaga si no hay nadie con este rol.
              </span>
            </span>
            <input type="checkbox" checked={data.activo} onChange={(e) => setData('activo', e.target.checked)}
              className="h-5 w-5 rounded border-gris-300 text-[color:var(--acento)]" />
          </label>
        )}
        {errors.activo && <p className="text-xs font-semibold text-red-600">{errors.activo}</p>}
      </div>
    </Modal>
  );
}

export default function UsuariosIndex({ usuarios = [], roles = [], permisos = [], filtros = {}, yo, resumen = {},
  sucursales = [], soySuperAdmin = false, miSucursal = null }) {
  const [toast] = useToast();
  const [q, setQ] = useState(filtros.q ?? '');
  const [formUsuario, setFormUsuario] = useState(null);
  const [formRol, setFormRol] = useState(null);
  const [borrarUsuario, setBorrarUsuario] = useState(null);
  const [borrarRol, setBorrarRol] = useState(null);
  const [borrando, setBorrando] = useState(false);

  useEffect(() => setQ(filtros.q ?? ''), [filtros.q]);
  // El formulario de usuario muestra los módulos del rol elegido
  useEffect(() => { window.__PERMISOS__ = permisos; }, [permisos]);

  const ir = (params) => router.get(route('admin.usuarios.index'), { ...filtros, ...params },
    { preserveState: true, preserveScroll: true, replace: true });

  const confirmar = (url) => {
    setBorrando(true);
    router.delete(url, {
      preserveScroll: true,
      onFinish: () => { setBorrando(false); setBorrarUsuario(null); setBorrarRol(null); },
    });
  };

  const chips = [
    { key: 'todos', label: 'Todos' },
    ...roles.map((r) => ({ key: r.clave, label: r.nombre })),
  ];
  const conteo = { todos: resumen.total ?? 0, ...Object.fromEntries(roles.map((r) => [r.clave, r.usuarios])) };
  // Un rol sin módulos y sin panel propio no puede abrir nada: eso sí es un problema
  const sinPermisos = roles.filter((r) => !r.todo && !r.panel_propio && (r.permisos?.length ?? 0) === 0);

  return (
    <AdminLayout>
      <Head title="Usuarios y roles" />
      <Toast toast={toast} />

      {formUsuario && (
        <FormularioUsuario usuario={formUsuario.usuario} roles={roles} sucursales={sucursales}
          soySuperAdmin={soySuperAdmin} miSucursal={miSucursal} onCerrar={() => setFormUsuario(null)} />
      )}
      {formRol && (
        <FormularioRol rol={formRol.rol} catalogo={permisos} onCerrar={() => setFormRol(null)} />
      )}

      {borrarUsuario && (
        <ModalEliminar
          titulo="Borrar usuario"
          icon={Users}
          nombre={`${borrarUsuario.name} (${borrarUsuario.email})`}
          advertencia="Deja de tener acceso al panel al instante. Lo que registró (ventas, servicios) se conserva."
          procesando={borrando}
          onConfirmar={() => confirmar(route('admin.usuarios.destroy', borrarUsuario.id))}
          onCerrar={() => setBorrarUsuario(null)}
        />
      )}

      {borrarRol && (
        <ModalEliminar
          titulo="Borrar rol"
          icon={Shield}
          nombre={borrarRol.nombre}
          advertencia="Solo se puede borrar un rol que no tenga gente asignada."
          procesando={borrando}
          onConfirmar={() => confirmar(route('admin.roles.destroy', borrarRol.id))}
          onCerrar={() => setBorrarRol(null)}
        />
      )}

      <div className="bp-reset mx-auto max-w-[1400px] space-y-5">
        <PageHeader
          title="Usuarios y roles"
          subtitle="Quién entra al panel y a qué parte. Cada persona tiene su cuenta y su rol; el rol decide los módulos que ve."
          actions={(
            <>
              <button type="button" onClick={() => setFormRol({ rol: null })} className={buttonCls('secondary', 'h-11 px-4')}>
                <Shield className="h-4 w-4" /> Nuevo rol
              </button>
              <button type="button" onClick={() => setFormUsuario({ usuario: null })} className={buttonCls('primary', 'h-11 px-4')}>
                <UserPlus className="h-4 w-4" /> Nuevo usuario
              </button>
            </>
          )}
        />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat icon={IconoUsuarios} label="Usuarios" value={resumen.total ?? 0} tone="navy"
            hint={(resumen.total ?? 0) === 1 ? 'con acceso al panel' : 'con acceso al panel'} />
          <Stat icon={ShieldCheck} label="Administradores" value={resumen.admins ?? 0} tone="emerald"
            hint="entran a todo el panel" />
          <Stat icon={Shield} label="Roles" value={resumen.roles ?? 0} tone="lila"
            hint="formas distintas de entrar" />
          <Stat icon={KeyRound} label="Módulos del panel" value={permisos.reduce((n, g) => n + g.modulos.length, 0)}
            tone="slate" hint="se reparten entre los roles" />
        </div>

        <AdminGuide id="usuarios-roles" title="¿Cómo funcionan los usuarios y los roles?" steps={[
          'Cada persona que trabaja contigo tiene su cuenta: entra con su correo y su contraseña, y queda registrado quién hizo qué.',
          'El rol decide a qué parte del panel entra. Puedes usar los que vienen (Administrador y Vendedor) o crear el tuyo con «Nuevo rol».',
          'Lo que un rol no tiene marcado no le aparece en el menú y tampoco se abre escribiendo la dirección a mano.',
        ]} tip="El administrador entra a todo, siempre, y nunca te puedes quitar el rol a ti mismo ni borrar al último administrador: es la forma de que nadie quede afuera del sistema." />

        {(resumen.admins ?? 0) === 1 && (
          <Aviso tono="lila" icon={ShieldCheck}>
            <span className="font-bold">Hay un solo administrador.</span>{' '}
            Si pierdes esa contraseña, nadie puede entrar a configurar el sistema. Conviene tener un segundo.
          </Aviso>
        )}

        {sinPermisos.length > 0 && (
          <Aviso tono="amber" icon={TriangleAlert}>
            <span className="font-bold">
              {sinPermisos.length === 1 ? 'Un rol no tiene ningún módulo marcado' : `${sinPermisos.length} roles no tienen ningún módulo marcado`}:
            </span>{' '}
            {sinPermisos.map((r) => r.nombre).join(', ')}. Quien lo tenga no va a poder abrir nada del panel.
          </Aviso>
        )}

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="min-w-0 space-y-5">
            <section className="rounded-2xl border border-gris-200 bg-white shadow-sutil">
              <div className="border-b border-gris-100 px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="flex items-center gap-2 text-base font-bold text-gris-900">
                      <IconoUsuarios className="h-[18px] w-[18px] text-[color:var(--acento)]" /> Usuarios
                      <span className="text-sm font-semibold text-gris-400">{usuarios.length}</span>
                    </h2>
                    <p className="mt-0.5 text-[13px] text-gris-500">Los administradores van primero.</p>
                  </div>

                  <form onSubmit={(e) => { e.preventDefault(); ir({ q }); }} className="flex gap-2">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gris-400" />
                      <input className={`${inputCls} h-10 w-52 pl-9`} value={q} onChange={(e) => setQ(e.target.value)}
                        placeholder="Buscar nombre o correo" aria-label="Buscar usuario" />
                      {q && (
                        <button type="button" onClick={() => { setQ(''); ir({ q: '' }); }} aria-label="Limpiar búsqueda"
                          className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-lg text-gris-400 hover:bg-gris-100">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <button type="submit" className={buttonCls('secondary', 'h-10')}>Buscar</button>
                  </form>
                </div>

                <ChipsEstado filtros={chips} activo={filtros.rol ?? 'todos'} conteo={conteo}
                  onChange={(k) => ir({ rol: k })} etiqueta="Filtrar por rol" />
              </div>

              {usuarios.length === 0 ? (
                <div className="px-5 py-12 text-center">
                  <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-gris-100 text-gris-400">
                    <IconoUsuarios className="h-6 w-6" />
                  </span>
                  <p className="mt-3 text-sm font-bold text-gris-800">Ningún usuario coincide</p>
                  <p className="mx-auto mt-1 max-w-sm text-[13px] text-gris-500">Prueba con otro filtro o con parte del correo.</p>
                </div>
              ) : (
                <ul className="divide-y divide-gris-100">
                  {usuarios.map((u) => (
                    <li key={u.id} className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center">
                      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-[13px] font-bold ${u.rol === 'admin' ? 'bg-carbon-900 text-white' : 'bg-[color:var(--acento)]/12 text-[color:var(--acento)]'}`}>
                        {iniciales(u.name)}
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2 text-[15px] font-bold text-gris-900">
                          {u.name}
                          {u.id === yo && <span className="rounded-full bg-[#C49A7C]/25 px-2 py-0.5 text-[10px] font-bold text-[#4a4f10]">TÚ</span>}
                        </p>
                        <p className="mt-0.5 truncate text-[13px] text-gris-500">{u.email}</p>
                        <p className="mt-1 text-xs text-gris-400">Desde {fmtDate(u.created_at)}</p>
                      </div>

                      <div className="lg:w-[150px] lg:shrink-0">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${u.rol === 'admin' ? 'bg-carbon-900/[0.08] text-carbon-900' : 'bg-gris-100 text-gris-600'}`}>
                          {u.rol === 'admin' ? <ShieldCheck className="h-3 w-3" /> : <Shield className="h-3 w-3" />}
                          {u.rol_nombre}
                        </span>
                        {!u.rol_activo && (
                          <p className="mt-1 text-[11px] font-semibold text-amber-700">Su rol está apagado</p>
                        )}
                        {u.panel_propio && (
                          <p className="mt-1 text-[11px] font-semibold text-gris-500">
                            {u.meta_mensual > 0 ? `Meta del mes: ${bsFmt(u.meta_mensual)}` : 'Sin meta del mes'}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
                        <button type="button" onClick={() => setFormUsuario({ usuario: u })} className={buttonCls('secondary', 'h-9 px-3 text-xs')}>
                          <Pencil className="h-3.5 w-3.5" /> Editar
                        </button>
                        <button type="button" onClick={() => setBorrarUsuario(u)} disabled={u.id === yo}
                          aria-label={`Borrar a ${u.name}`}
                          className="grid h-9 w-9 place-items-center rounded-xl text-gris-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gris-400">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-2xl border border-gris-200 bg-white p-5 shadow-sutil">
              <h2 className="text-base font-bold text-gris-900">Cómo dar acceso sin perder el control</h2>
              <p className="mt-0.5 text-[13px] text-gris-500">El panel tiene los costos, los precios y los datos de tus clientes.</p>
              <Consejos
                consejos={CONSEJOS_USUARIOS}
                cierre={(
                  <>
                    <span className="font-bold text-gris-800">Si alguien olvidó su contraseña:</span> edítalo acá y
                    escríbele una nueva. No se puede ver la anterior, ni siquiera desde el panel: se guardan cifradas.
                  </>
                )}
              />
            </section>
          </div>

          <aside className="space-y-5 xl:sticky xl:top-24">
            <section className="rounded-2xl border border-gris-200 bg-white shadow-sutil">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gris-100 px-5 py-4">
                <div className="min-w-0">
                  <h2 className="flex items-center gap-2 text-base font-bold text-gris-900">
                    <Shield className="h-[18px] w-[18px] text-[color:var(--acento)]" /> Roles
                    <span className="text-sm font-semibold text-gris-400">{roles.length}</span>
                  </h2>
                  <p className="mt-0.5 text-[13px] text-gris-500">Cada uno abre su parte del panel.</p>
                </div>
                <button type="button" onClick={() => setFormRol({ rol: null })} className={buttonCls('secondary', 'h-9 px-3 text-xs')}>
                  <Plus className="h-3.5 w-3.5" /> Nuevo
                </button>
              </div>

              <ul className="divide-y divide-gris-100">
                {roles.map((r) => (
                  <li key={r.id} className={`px-5 py-4 ${r.activo ? '' : 'bg-gris-50/60'}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 text-[15px] font-bold text-gris-900">
                          {r.nombre}
                          {r.del_sistema && <span className="rounded-full bg-gris-100 px-2 py-0.5 text-[10px] font-bold text-gris-500">DEL SISTEMA</span>}
                          {!r.activo && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">APAGADO</span>}
                        </p>
                        <p className="mt-0.5 text-[13px] leading-relaxed text-gris-500">
                          {r.descripcion || 'Sin explicación.'}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-1.5">
                        <button type="button" onClick={() => setFormRol({ rol: r })} className={buttonCls('secondary', 'h-8 px-2.5 text-xs')}>
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" onClick={() => setBorrarRol(r)} disabled={r.del_sistema || r.usuarios > 0}
                          aria-label={`Borrar el rol ${r.nombre}`}
                          className="grid h-8 w-8 place-items-center rounded-xl text-gris-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gris-400">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-2.5">
                      <ListaPermisos permisos={r.permisos} catalogo={permisos} panelPropio={r.panel_propio} />
                    </div>

                    <p className="mt-2 text-xs text-gris-400">
                      {r.usuarios === 0 ? 'Nadie lo tiene todavía' : r.usuarios === 1 ? '1 persona con este rol' : `${r.usuarios} personas con este rol`}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          </aside>
        </div>
      </div>
    </AdminLayout>
  );
}
