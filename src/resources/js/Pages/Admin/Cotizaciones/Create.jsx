import AdminLayout from '@/Layouts/AdminLayout';
import CotizacionesForm from '@/Components/Panel/CotizacionesForm';

export default function Create(props) {
  return <CotizacionesForm {...props} Layout={AdminLayout} prefijo="admin" />;
}
