import VendedorLayout from '@/Layouts/VendedorLayout';
import AdminGuide from '@/Components/Admin/AdminGuide';
import ServiciosIndex from '@/Components/Panel/ServiciosIndex';

// Misma pantalla que la del administrador (Components/Panel/ServiciosIndex).
// El servidor manda solo los servicios que registró este vendedor.
export default function Index(props) {
  return (
    <ServiciosIndex
      {...props}
      Layout={VendedorLayout}
      prefijo="vendedor"
      titulo="Mis servicios técnicos"
      subtitulo="Las reparaciones que registraste. Filtra por período o técnico y saca el reporte en PDF."
      guia={(
        <AdminGuide
          id="vendedor-servicios"
          title="¿Cómo se maneja un servicio?"
          steps={[
            'Cuando recibes un equipo, registras el servicio y le entregas la nota al cliente.',
            'La nota lleva el código para que el cliente lo reclame cuando vuelva a retirarlo.',
            'Podés imprimir la nota normal o la térmica, según la impresora que tengas a mano.',
          ]}
          tip="El reporte en PDF respeta el período y el técnico que hayas filtrado arriba."
        >
          Solo tus reparaciones
        </AdminGuide>
      )}
    />
  );
}
