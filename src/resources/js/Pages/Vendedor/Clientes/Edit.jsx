import VendedorLayout from '@/Layouts/VendedorLayout';
import ClienteForm from '@/Components/Panel/ClienteForm';

export default function Edit({ cliente, actividad = {} }) {
  return <ClienteForm cliente={cliente} actividad={actividad} Layout={VendedorLayout} prefijo="vendedor" />;
}
