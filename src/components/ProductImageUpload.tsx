import { useRef } from 'react';
import type { Product } from '../types/product';

interface ProductImageUploadProps {
  product: Product;
  onUpload: (productId: number, imageUrl: string) => void;
  onRemove: (productId: number) => void;
}

export function ProductImageUpload({ product, onUpload, onRemove }: ProductImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('Resim boyutu en fazla 2 MB olabilir.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onUpload(product.id, reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="image-upload">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={onInputChange}
        className="image-upload-input"
        aria-label={`${product.name} resmi yükle`}
      />

      {product.imageUrl ? (
        <div className="image-upload-preview">
          <img src={product.imageUrl} alt={product.name} />
          <div className="image-upload-actions">
            <button type="button" className="btn btn-sm" onClick={() => inputRef.current?.click()}>
              Değiştir
            </button>
            <button type="button" className="btn btn-sm btn-danger" onClick={() => onRemove(product.id)}>
              Kaldır
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="image-upload-dropzone"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
        >
          <span className="image-upload-icon">📷</span>
          <span>Resim yükle</span>
          <span className="image-upload-hint">Tıkla veya sürükle</span>
        </button>
      )}
    </div>
  );
}
