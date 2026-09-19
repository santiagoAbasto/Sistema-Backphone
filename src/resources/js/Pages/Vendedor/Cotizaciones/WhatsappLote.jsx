import VendedorLayout from '@/Layouts/VendedorLayout';
import CotizacionesLote from '@/Components/Panel/CotizacionesLote';

export default function WhatsappLote(props) {
  return <CotizacionesLote {...props} Layout={VendedorLayout} prefijo="vendedor" />;
}
