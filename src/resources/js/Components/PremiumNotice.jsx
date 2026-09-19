import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useEffect } from 'react';

const variants = {
  error: { Icon: AlertCircle, icon: 'text-red-600', surface: 'bg-red-50' },
  success: { Icon: CheckCircle2, icon: 'text-emerald-600', surface: 'bg-emerald-50' },
  info: { Icon: Info, icon: 'text-blue-600', surface: 'bg-blue-50' },
};

export default function PremiumNotice({ notice, onClose }) {
  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(onClose, 4200);
    return () => window.clearTimeout(timer);
  }, [notice, onClose]);

  const config = variants[notice?.type] || variants.info;
  const Icon = config.Icon;

  return (
    <AnimatePresence>
      {notice && (
        <motion.div
          initial={{ opacity: 0, y: -16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.98 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="fixed left-1/2 top-5 z-[70] w-[calc(100%_-_2rem)] max-w-md -translate-x-1/2"
          role={notice.type === 'error' ? 'alert' : 'status'}
          aria-live="polite"
        >
          <div className="flex items-start gap-3 rounded-2xl bg-white/95 p-3.5 shadow-[0_4px_8px_rgba(15,23,42,0.12)] ring-1 ring-black/10 backdrop-blur-md">
            <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${config.surface}`}>
              <Icon className={`h-5 w-5 ${config.icon}`} strokeWidth={2} />
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-sm font-semibold leading-5 text-gris-900">{notice.title}</p>
              {notice.message && <p className="mt-0.5 text-sm leading-5 text-gris-600">{notice.message}</p>}
            </div>
            <button type="button" onClick={onClose} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-gris-500 hover:bg-gris-100 hover:text-gris-900" aria-label="Cerrar notificación">
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
