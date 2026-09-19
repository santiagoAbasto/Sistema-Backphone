import VendedorLayout from '@/Layouts/VendedorLayout';
import VentaEditForm from '@/Components/VentaEditForm';

export default function Edit({ venta, productosGenerales = [], inventarioEdicion = {} }) {
  return (
    <VendedorLayout title="Editar venta">
      <VentaEditForm venta={venta} productosGenerales={productosGenerales} inventarioEdicion={inventarioEdicion} routePrefix="vendedor" />
    </VendedorLayout>
  );
}
