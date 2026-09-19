import VendedorLayout from '@/Layouts/VendedorLayout';
import VentaForm from '@/Components/Panel/VentaForm';

// Mismo formulario que el del administrador (Components/Panel/VentaForm), con el menú del vendedor.
// El servidor guarda la venta a nombre de quien la registra, así que no hace falta elegir vendedor.
export default function Create(props) {
  return <VentaForm {...props} Layout={VendedorLayout} prefijo="vendedor" />;
}
