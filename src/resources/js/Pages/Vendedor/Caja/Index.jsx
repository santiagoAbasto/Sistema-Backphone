import VendedorLayout from '@/Layouts/VendedorLayout';
import CajaDiaria from '@/Components/Panel/CajaDiaria';

// Misma pantalla que la del administrador. El vendedor cuenta a ciegas: el servidor no le manda
// cuánto debería haber hasta que cierra.
export default function Index(props) {
  return <CajaDiaria {...props} Layout={VendedorLayout} prefijo="vendedor" />;
}
