import VendedorLayout from '@/Layouts/VendedorLayout';
import ServiciosForm from '@/Components/Panel/ServiciosForm';

export default function Create({ tecnicos = [] }) {
  return <ServiciosForm tecnicos={tecnicos} Layout={VendedorLayout} prefijo="vendedor" />;
}
