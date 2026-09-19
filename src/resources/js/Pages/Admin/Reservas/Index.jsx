import AdminLayout from '@/Layouts/AdminLayout';
import ReservasIndex from '@/Components/Panel/ReservasIndex';

export default function Index({ reservas = [] }) {
  return <ReservasIndex reservas={reservas} Layout={AdminLayout} prefijo="admin" />;
}
