interface ImagePopupProps {
  src: string | null;
  onClose: () => void;
}

export function ImagePopup({ src, onClose }: ImagePopupProps) {
  if (!src) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[2000] bg-black/85 backdrop-blur-sm flex items-center justify-center cursor-zoom-out"
    >
      <img
        src={src}
        onClick={(e) => e.stopPropagation()}
        className="max-w-[90vw] max-h-[90vh] rounded-lg shadow-2xl object-contain cursor-default"
      />
      <button
        onClick={onClose}
        className="fixed top-5 right-6 bg-white/10 border border-white/20 text-white rounded-full w-9 h-9 text-lg cursor-pointer flex items-center justify-center"
      >
        x
      </button>
    </div>
  );
}
