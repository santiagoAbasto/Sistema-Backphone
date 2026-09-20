import AdminLayout from '@/Layouts/AdminLayout';
import ServiciosForm from '@/Components/Panel/ServiciosForm';

export default function Create({ tecnicos = [], piezas = [], revision = [], marcas = [] }) {
  return <ServiciosForm tecnicos={tecnicos} piezas={piezas} revision={revision} marcas={marcas} Layout={AdminLayout} prefijo="admin" />;
}
