import AdminLayout from '@/Layouts/AdminLayout';
import CotizacionesIndex from '@/Components/Panel/CotizacionesIndex';

export default function Index({ cotizaciones = [] }) {
  return <CotizacionesIndex cotizaciones={cotizaciones} Layout={AdminLayout} prefijo="admin" />;
}
