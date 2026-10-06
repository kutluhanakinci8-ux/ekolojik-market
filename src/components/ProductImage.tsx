import { useRef, useState } from 'react';
import type { Product } from '../types/product';
import { compressImage } from '../utils/imageCompress';
import { getPlaceholderImage, getProductImageUrl, isCustomImage } from '../utils/productImage';

interface ProductImageProps {
  product: Product;
  size?: 'sm' | 'md' | 'lg' | 'fill';
  editable?: boolean;
  onUpload?: (productId: number, imageUrl: string) => void;
  onRemove?: (productId: number) => void;
  onClick?: () => void;
}

export function ProductImage({
  product,
  size = 'md',
  editable = false,
  onUpload,
  onRemove,
  onClick,
}: ProductImageProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [imgError, setImgError] = useState(false);
  const [uploading, setUploading] = useState(false);
  const custom = isCustomImage(product);
  const src = imgError ? getPlaceholderImage(product) : getProductImageUrl(product);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/') || !onUpload) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Resim boyutu en fazla 5 MB olabilir.');
      return;
    }

    setUploading(true);
    try {
      const dataUrl = await compressImage(file);
      setImgError(false);
      onUpload(product.id, dataUrl);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Resim yüklenemedi');
    } finally {
      setUploading(false);
    }
  };

  const handleCardClick = () => {
    if (editable) {
      inputRef.current?.click();
    } else {
      onClick?.();
    }
  };

  return (
    <div
      className={`product-image product-image-${size} ${editable ? 'editable' : ''} ${onClick && !editable ? 'clickable' : ''}`}
      onClick={handleCardClick}
      role={onClick || editable ? 'button' : undefined}
      tabIndex={onClick || editable ? 0 : undefined}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && (onClick || editable)) {
          e.preventDefault();
          handleCardClick();
        }
      }}
    >
      <img
        key={src.slice(0, 80)}
        src={src}
        alt={product.name}
        loading="lazy"
        draggable={false}
        onError={() => setImgError(true)}
      />

      {uploading && <div className="product-image-loading">Yükleniyor…</div>}

      {editable && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="image-upload-input"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = '';
            }}
          />
          <div className="product-image-overlay">
            <span>📷 {custom ? 'Değiştir' : 'Resim Yükle'}</span>
          </div>
          {custom && onRemove && (
            <button
              type="button"
              className="product-image-remove"
              onClick={(e) => {
                e.stopPropagation();
                setImgError(false);
                onRemove(product.id);
              }}
              title="Varsayılan resme dön"
            >
              ✕
            </button>
          )}
        </>
      )}
    </div>
  );
}
