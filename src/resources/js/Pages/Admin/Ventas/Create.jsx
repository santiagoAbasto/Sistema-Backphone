import AdminLayout from '@/Layouts/AdminLayout';
import VentaForm from '@/Components/Panel/VentaForm';

export default function Create(props) {
  return <VentaForm {...props} Layout={AdminLayout} prefijo="admin" />;
}
