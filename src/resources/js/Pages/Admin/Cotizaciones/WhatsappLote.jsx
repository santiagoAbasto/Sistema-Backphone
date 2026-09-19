import AdminLayout from '@/Layouts/AdminLayout';
import CotizacionesLote from '@/Components/Panel/CotizacionesLote';

export default function WhatsappLote(props) {
  return <CotizacionesLote {...props} Layout={AdminLayout} prefijo="admin" />;
}
