import AdminLayout from '@/Layouts/AdminLayout';
import ClientesIndex from '@/Components/Panel/ClientesIndex';

export default function Index({ clientes = [] }) {
  return <ClientesIndex clientes={clientes} Layout={AdminLayout} prefijo="admin" />;
}
