import AdminLayout from '@/Layouts/AdminLayout';
import ServiciosForm from '@/Components/Panel/ServiciosForm';

export default function Create({ tecnicos = [] }) {
  return <ServiciosForm tecnicos={tecnicos} Layout={AdminLayout} prefijo="admin" />;
}
