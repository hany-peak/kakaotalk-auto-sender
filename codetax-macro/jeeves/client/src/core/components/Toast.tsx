import { useEffect, useState } from 'react';

interface ToastProps {
  message: string | null;
  duration?: number;
  onDone: () => void;
}

export function Toast({ message, duration = 2000, onDone }: ToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!message) return;
    setVisible(true);
    const timer = setTimeout(() => {
      setVisible(false);
      onDone();
    }, duration);
    return () => clearTimeout(timer);
  }, [message, duration, onDone]);

  if (!visible || !message) return null;

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[3000] bg-surface border border-border text-text px-5 py-2.5 rounded-lg shadow-xl text-sm font-medium">
      {message}
    </div>
  );
}
