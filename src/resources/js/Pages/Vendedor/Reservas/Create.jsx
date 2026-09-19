import VendedorLayout from '@/Layouts/VendedorLayout';
import ReservasForm from '@/Components/Panel/ReservasForm';

// Mismo formulario que el del administrador (Components/Panel/ReservasForm), con el menú del vendedor.
export default function Create() {
  return <ReservasForm Layout={VendedorLayout} prefijo="vendedor" />;
}
