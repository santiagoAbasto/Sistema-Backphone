import AdminLayout from '@/Layouts/AdminLayout';
import ServiciosIndex from '@/Components/Panel/ServiciosIndex';

export default function Index(props) {
  return <ServiciosIndex {...props} Layout={AdminLayout} prefijo="admin" />;
}
