import AdminLayout from '@/Layouts/AdminLayout';
import ClienteForm from '@/Components/Panel/ClienteForm';

export default function Edit({ cliente, actividad = {} }) {
  return <ClienteForm cliente={cliente} actividad={actividad} Layout={AdminLayout} prefijo="admin" />;
}
