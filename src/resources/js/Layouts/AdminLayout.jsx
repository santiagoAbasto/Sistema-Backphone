import {
  ArrowLeftRight, CalendarCheck, ChartLine, ClipboardCheck, FileDown, Hammer, Laptop, LayoutDashboard, Package, Receipt,
  Settings, ShoppingCart, SlidersHorizontal, Smartphone, Tablet, Users, Wallet, Wrench,
} from 'lucide-react';
import IconoUsuarios from '@/Components/Admin/IconoUsuarios';
import { IconoPieza } from '@/Components/Admin/piezas';
import { IconoRed } from '@/Components/Marca/IconosSucursal';
import PanelShell, { MARCA, FUENTE_MARCA } from '@/Layouts/PanelShell';

export { MARCA, FUENTE_MARCA };

/**
 * El menú del panel de administración.
 *
 * Arriba lo de todos los días (vender, atender, cobrar), después el inventario y al final
 * lo que se toca de vez en cuando. `modulo` tiene que coincidir con las claves de
 * `App\Support\Permisos`: el menú esconde lo que el servidor va a rechazar igual.
 */
const NAV = [
  { key: 'inicio', items: [
    { r: 'admin.dashboard', icon: LayoutDashboard, label: 'Resumen', exact: true, modulo: 'resumen' },
  ] },
  { key: 'operacion', label: 'Ventas y operación', items: [
    { r: 'admin.ventas.index', icon: ShoppingCart, label: 'Ventas', modulo: 'ventas' },
    { r: 'admin.reservas.index', icon: CalendarCheck, label: 'Reservas', modulo: 'reservas' },
    { r: 'admin.servicios.index', icon: Hammer, label: 'Servicio técnico', modulo: 'servicios' },
    { r: 'admin.tecnicos.index', icon: Wrench, label: 'Técnicos y comisiones', modulo: 'tecnicos' },
    { r: 'admin.cotizaciones.index', icon: Receipt, label: 'Cotizaciones', modulo: 'cotizaciones' },
    { r: 'admin.egresos.index', icon: Wallet, label: 'Egresos', modulo: 'egresos' },
    { r: 'admin.clientes.index', icon: Users, label: 'Clientes', modulo: 'clientes' },
    { r: 'admin.reportes.index', icon: ChartLine, label: 'Reportes', modulo: 'reportes' },
  ] },
  { key: 'inventario', label: 'Inventario', items: [
    { r: 'admin.celulares.index', icon: Smartphone, label: 'Celulares', modulo: 'inventario' },
    { r: 'admin.computadoras.index', icon: Laptop, label: 'Computadoras', modulo: 'inventario' },
    { r: 'admin.productos-apple.index', icon: Tablet, label: 'Equipos de marca', modulo: 'inventario' },
    { r: 'admin.productos-generales.index', icon: Package, label: 'Accesorios y generales', modulo: 'inventario' },
    { r: 'admin.piezas.index', icon: IconoPieza, label: 'Piezas y repuestos', modulo: 'piezas' },
    { r: 'admin.traspasos.index', icon: ArrowLeftRight, label: 'Traspasos', modulo: 'traspasos' },
    { r: 'admin.inventory-audits.index', icon: ClipboardCheck, label: 'Auditoría', modulo: 'auditoria' },
  ] },
  { key: 'datos', label: 'Exportar datos', items: [
    { r: 'admin.exportaciones.index', icon: FileDown, label: 'Exportaciones', modulo: 'exportar' },
    { r: 'admin.exportar.personalizado', icon: SlidersHorizontal, label: 'Exportador', modulo: 'exportar' },
  ] },
  { key: 'sistema', label: 'Sistema', items: [
    { r: 'admin.usuarios.index', icon: IconoUsuarios, label: 'Usuarios y roles', modulo: 'usuarios' },
    { r: 'admin.sucursales.index', icon: IconoRed, label: 'Sucursales', modulo: 'sucursales' },
    { r: 'admin.configuracion.negocio.edit', icon: Settings, label: 'Datos del negocio', modulo: 'ajustes' },
  ] },
];

export default function AdminLayout({ children, title }) {
  return (
    <PanelShell
      nav={NAV}
      homeRoute="admin.dashboard"
      headTitle={title ?? 'Panel de administración'}
      migaPorDefecto="Panel de administración"
      filtrarPorPermisos
    >
      {children}
    </PanelShell>
  );
}
