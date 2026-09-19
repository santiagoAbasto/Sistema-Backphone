import VendedorLayout from '@/Layouts/VendedorLayout';
import AdminGuide from '@/Components/Admin/AdminGuide';
import CotizacionesIndex from '@/Components/Panel/CotizacionesIndex';

// Misma pantalla que la del administrador (Components/Panel/CotizacionesIndex).
// El servidor manda solo las cotizaciones que hizo este vendedor.
export default function Index({ cotizaciones = [] }) {
  return (
    <CotizacionesIndex
      cotizaciones={cotizaciones}
      Layout={VendedorLayout}
      prefijo="vendedor"
      titulo="Mis cotizaciones"
      subtitulo="Los precios que le pasaste a cada cliente. Desde acá abrís el PDF, lo mandás por WhatsApp o lo reenviás por correo."
      guia={(
        <AdminGuide
          id="vendedor-cotizaciones"
          title="¿Cómo cierro una cotización?"
          steps={[
            'Armás la cotización con los productos y el cliente recibe un PDF con el precio.',
            'La mandás por WhatsApp o por correo: queda anotado por dónde se la enviaste.',
            'Si el cliente acepta, registrás la venta normalmente; la cotización queda como antecedente.',
          ]}
          tip="Podés mandar varias de una sola vez con «Enviar por WhatsApp» y elegir a quiénes."
        >
          Solo las tuyas
        </AdminGuide>
      )}
    />
  );
}
