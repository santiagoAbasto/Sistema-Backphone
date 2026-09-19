import VendedorLayout from '@/Layouts/VendedorLayout';
import AdminGuide from '@/Components/Admin/AdminGuide';
import ReservasIndex from '@/Components/Panel/ReservasIndex';

// Misma pantalla que la del administrador (Components/Panel/ReservasIndex), con el menú del vendedor.
// El servidor ya filtra por `user_id`, así que acá solo se ven las reservas que tomó esta persona.
export default function Index({ reservas = [] }) {
  return (
    <ReservasIndex
      reservas={reservas}
      Layout={VendedorLayout}
      prefijo="vendedor"
      titulo="Mis reservas"
      subtitulo="Productos que separaste con una seña. Desde acá los vendes, los cancelas o imprimes la nota."
      guia={(
        <AdminGuide
          id="vendedor-reservas"
          title="¿Cómo funcionan las reservas?"
          steps={[
            'El cliente deja una seña y el producto queda separado: nadie más lo puede vender.',
            'Cuando vuelve, apretá «Vender» y la seña se descuenta sola del total.',
            'Si no vuelve en el plazo, marcá la reserva como vencida y el producto vuelve al stock.',
          ]}
          tip="El saldo que ves es lo que falta cobrar cuando el cliente pase a retirar."
        >
          Acá están solo las tuyas
        </AdminGuide>
      )}
    />
  );
}
