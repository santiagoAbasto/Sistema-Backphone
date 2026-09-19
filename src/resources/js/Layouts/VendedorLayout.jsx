import { Boxes, CalendarCheck, Hammer, LayoutDashboard, PlusCircle, Receipt, ShoppingCart, Users } from 'lucide-react';
import PanelShell from '@/Layouts/PanelShell';

/**
 * Panel del vendedor: el mismo armazón que el de administración (PanelShell),
 * con las pantallas que el vendedor sí puede abrir. Lo que muestra el menú es
 * exactamente lo que permite el grupo de rutas `vendedor.` del servidor.
 */
const NAV = [
  { key: 'v-inicio', items: [
    { r: 'vendedor.dashboard', icon: LayoutDashboard, label: 'Mi día', exact: true },
  ] },
  { key: 'v-vender', label: 'Vender', items: [
    { r: 'vendedor.ventas.create', icon: PlusCircle, label: 'Registrar venta', exact: true },
    { r: 'vendedor.ventas.index', icon: ShoppingCart, label: 'Mis ventas', exact: true },
    { r: 'vendedor.reservas.index', icon: CalendarCheck, label: 'Reservas' },
    { r: 'vendedor.cotizaciones.index', icon: Receipt, label: 'Cotizaciones' },
  ] },
  { key: 'v-atender', label: 'Atender', items: [
    { r: 'vendedor.servicios.index', icon: Hammer, label: 'Servicio técnico' },
    { r: 'vendedor.clientes.index', icon: Users, label: 'Mis clientes' },
  ] },
  { key: 'v-consultar', label: 'Consultar', items: [
    { r: 'vendedor.productos.index', icon: Boxes, label: 'Productos en stock' },
  ] },
];

export default function VendedorLayout({ children, title }) {
  return (
    <PanelShell
      nav={NAV}
      homeRoute="vendedor.dashboard"
      headTitle={title ?? 'Panel del vendedor'}
      migaPorDefecto="Panel del vendedor"
      insignia="Vendedor"
      tema="vendedor"
    >
      {children}
    </PanelShell>
  );
}
