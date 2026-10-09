import AdminLayout from '@/Layouts/AdminLayout';
import CajaDiaria from '@/Components/Panel/CajaDiaria';

// Misma pantalla que la del vendedor (Components/Panel/CajaDiaria), con «debería haber» en vivo.
export default function Index(props) {
  return <CajaDiaria {...props} Layout={AdminLayout} prefijo="admin" />;
}
