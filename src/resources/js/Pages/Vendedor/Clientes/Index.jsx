import VendedorLayout from '@/Layouts/VendedorLayout';
import AdminGuide from '@/Components/Admin/AdminGuide';
import ClientesIndex from '@/Components/Panel/ClientesIndex';

// Misma pantalla que la del administrador (Components/Panel/ClientesIndex): acá el servidor
// manda solo los clientes que registró este vendedor.
export default function Index({ clientes = [] }) {
  return (
    <ClientesIndex
      clientes={clientes}
      Layout={VendedorLayout}
      prefijo="vendedor"
      titulo="Mis clientes"
      subtitulo="Se registran solos cuando les vendes, les cotizas o les tomas un servicio. Desde acá corriges sus datos o les escribes."
      guia={(
        <AdminGuide
          id="vendedor-clientes"
          title="¿Para qué te sirve tu lista?"
          steps={[
            'No tienes que cargarlos a mano: cada venta, reserva o cotización guarda el cliente sola.',
            'Cuando vuelvas a venderle, el nombre y el teléfono se completan solos al escribir las primeras letras.',
            'Con «Promoción por WhatsApp» preparas el mensaje y abres el chat de cada cliente, uno por uno.',
          ]}
          tip="WhatsApp no deja enviar a muchos de golpe desde la computadora: por eso se abre un chat a la vez."
        >
          Solo tus clientes
        </AdminGuide>
      )}
    />
  );
}
