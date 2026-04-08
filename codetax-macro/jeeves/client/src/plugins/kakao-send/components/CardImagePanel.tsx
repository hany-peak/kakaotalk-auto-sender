import { useState, useEffect } from 'react';
import { useApi } from '../../../core/hooks/useApi';

interface CardImage {
  name: string;
  url: string;
  path: string;
  mtime: number;
}

interface CardImagePanelProps {
  selected: CardImage | null;
  onSelect: (img: CardImage | null) => void;
}

export function CardImagePanel({ selected, onSelect }: CardImagePanelProps) {
  const api = useApi();
  const [images, setImages] = useState<CardImage[]>([]);

  async function load() {
    const data = await api.get('/kakao/card-images');
    setImages(data);
    if (!selected && data.length > 0) onSelect(data[0]);
  }

  useEffect(() => { load(); }, []);

  async function upload(files: FileList) {
    for (const file of Array.from(files)) {
      const data = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target!.result as string);
        reader.readAsDataURL(file);
      });
      await api.post('/kakao/card-images', { filename: file.name, data });
    }
    await load();
  }

  async function remove(name: string) {
    await api.del(`/kakao/card-images/${encodeURIComponent(name)}`);
    if (selected?.name === name) onSelect(null);
    await load();
  }

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2.5 mb-2">
        <span className="text-xs text-muted">Card Image <span className="text-border">(skip to not send)</span></span>
        <label className="cursor-pointer text-accent text-xs border border-accent rounded-md px-2.5 py-[3px]">
          + Upload
          <input type="file" accept="image/*" multiple onChange={(e) => e.target.files && upload(e.target.files)} className="hidden" />
        </label>
      </div>
      <div className="flex flex-wrap gap-2 min-h-[32px]">
        {images.length === 0 && <div className="text-muted text-[13px]">No card images uploaded.</div>}
        {images.map((img) => {
          const isSel = selected?.name === img.name;
          return (
            <div
              key={img.name}
              onClick={() => onSelect(isSel ? null : img)}
              className={`relative cursor-pointer w-20 h-20 border-2 rounded-lg overflow-hidden bg-surface2 shrink-0 ${
                isSel ? 'border-accent shadow-[0_0_0_2px_rgba(79,127,255,0.3)]' : 'border-border'
              }`}
            >
              <img src={img.url} className="w-full h-full object-cover" />
              {isSel && (
                <div className="absolute top-[3px] right-[3px] bg-accent rounded-full w-[18px] h-[18px] flex items-center justify-center text-[11px] text-white">
                  ✓
                </div>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); remove(img.name); }}
                className="absolute bottom-[3px] right-[3px] bg-black/65 border-none text-white rounded-full w-[18px] h-[18px] cursor-pointer text-[11px] flex items-center justify-center"
              >
                x
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
