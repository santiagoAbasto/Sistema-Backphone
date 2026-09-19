import VendedorLayout from '@/Layouts/VendedorLayout';
import CotizacionesForm from '@/Components/Panel/CotizacionesForm';

export default function Create(props) {
  return <CotizacionesForm {...props} Layout={VendedorLayout} prefijo="vendedor" />;
}
