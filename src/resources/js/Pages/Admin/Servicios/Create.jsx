import AdminLayout from '@/Layouts/AdminLayout';
import ServiciosForm from '@/Components/Panel/ServiciosForm';

export default function Create({ tecnicos = [], piezas = [], revision = [] }) {
  return <ServiciosForm tecnicos={tecnicos} piezas={piezas} revision={revision} Layout={AdminLayout} prefijo="admin" />;
}
