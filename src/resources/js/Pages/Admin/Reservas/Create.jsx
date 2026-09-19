import AdminLayout from '@/Layouts/AdminLayout';
import ReservasForm from '@/Components/Panel/ReservasForm';

export default function Create() {
  return <ReservasForm Layout={AdminLayout} prefijo="admin" />;
}
