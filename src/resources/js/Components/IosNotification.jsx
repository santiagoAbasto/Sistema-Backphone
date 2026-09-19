import { useEffect, useState } from "react";
import { X } from 'lucide-react';

export default function IosNotification({
  title,
  subtitle,
  message,
  onView,
  onClose,
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`
        bp-reset fixed top-20 right-6 z-50 w-[350px]
        transform transition-all duration-500
        ${visible ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0"}
      `}
    >
      <div className="backdrop-blur-xl bg-white/80 shadow-2xl border border-gray-200 rounded-2xl p-4">
        
        {/* HEADER */}
        <div className="flex justify-between items-start">
          <div>
            <p className="text-xs text-gray-500">{subtitle}</p>
            <p className="font-semibold text-gray-900">{title}</p>
          </div>
          <button
            onClick={() => {
              setVisible(false);
              if (onClose) onClose();
            }}
            className="text-gray-400 hover:text-gray-600 text-sm transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* BODY */}
        <p className="text-sm text-gray-700 mt-2 line-clamp-3">
          {message}
        </p>

        {/* ACTION */}
        <button
          onClick={onView}
          className="mt-3 w-full bg-carbon-900 hover:bg-carbon-800 text-white text-sm py-2 rounded-xl font-semibold transition"
        >
          Ver reporte completo
        </button>
      </div>
    </div>
  );
}
