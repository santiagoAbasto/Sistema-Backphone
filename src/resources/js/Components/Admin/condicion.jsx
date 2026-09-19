import { BadgeCheck, Sparkles } from 'lucide-react';
import { Badge } from '@/Components/Admin/ui';

// Condición comercial del inventario (Nuevo / Seminuevo).
export const CONDICIONES = [
  { value: 'Nuevo', label: 'Nuevo', icon: Sparkles, ayuda: 'Sin uso, en su caja.' },
  { value: 'Seminuevo', label: 'Seminuevo', icon: BadgeCheck, ayuda: 'Usado, revisado y funcionando bien.' },
];

export const MENSAJE_CONDICION = 'Elige si es nuevo o seminuevo.';

const TONOS = { Nuevo: 'navy', Seminuevo: 'lila' };

export function CondicionBadge({ condicion, vacio = null }) {
  if (!condicion) return vacio;
  return <Badge tone={TONOS[condicion] ?? 'slate'}>{condicion}</Badge>;
}
