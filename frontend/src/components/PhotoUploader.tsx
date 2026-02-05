import { useCallback, useState } from 'react';
import { Upload, X, Image as ImageIcon, User, MapPin } from 'lucide-react';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';

interface PhotoUploaderProps {
  label: string;
  description?: string;
  photos: File[];
  onChange: (files: File[]) => void;
  max?: number;
  min?: number;
  required?: boolean;
  type?: 'character' | 'decor';
  characterName?: string;
  onCharacterNameChange?: (name: string) => void;
}

export function PhotoUploader({
  label,
  description,
  photos,
  onChange,
  max = 5,
  min,
  required = false,
  type = 'character',
  characterName,
  onCharacterNameChange,
}: PhotoUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const { t } = useI18n();

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      const validFiles = Array.from(files).filter((file) => file.type.startsWith('image/'));
      const newPhotos = [...photos, ...validFiles].slice(0, max);
      onChange(newPhotos);
    },
    [photos, onChange, max]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const removePhoto = useCallback(
    (index: number) => {
      const newPhotos = photos.filter((_, i) => i !== index);
      onChange(newPhotos);
    },
    [photos, onChange]
  );

  const Icon = type === 'decor' ? MapPin : User;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        {label ? (
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-teal-600" />
            <label className="font-display text-lg text-dark">
              {label}
              {required && <span className="text-teal-500 ml-1">*</span>}
            </label>
          </div>
        ) : (
          <div />
        )}
        <span className="text-sm text-gray-500">
          {t('common.photoCount', { current: photos.length.toString(), max: max.toString() })}
        </span>
      </div>

      {/* Character name input */}
      {type === 'character' && onCharacterNameChange && (
        <input
          type="text"
          value={characterName || ''}
          onChange={(e) => onCharacterNameChange(e.target.value)}
          placeholder={t('create.characterNamePlaceholder')}
          className="input-romantic text-sm py-2.5"
        />
      )}

      {description && (
        <p className="text-sm text-gray-500 italic">{description}</p>
      )}

      {/* Upload zone */}
      <div
        className={cn('upload-zone', isDragging && 'active')}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => document.getElementById(`upload-${label}`)?.click()}
      >
        <input
          id={`upload-${label}`}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
          disabled={photos.length >= max}
        />

        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center">
            <Upload className="w-5 h-5 text-teal-600" />
          </div>
          <div>
            <p className="text-gray-700 font-medium">
              {min ? t('upload.dragPhotosHere', { min: min.toString(), max: max.toString() }) : t('upload.dragHere')}
            </p>
            <p className="text-sm text-gray-500">{t('upload.orClick')}</p>
          </div>
        </div>
      </div>

      {/* Photo grid */}
      {photos.length > 0 && (
        <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
          {photos.map((file, index) => (
            <div key={index} className="photo-thumb">
              <img src={URL.createObjectURL(file)} alt={`Photo ${index + 1}`} />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removePhoto(index);
                }}
                className="remove-btn"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}

          {photos.length < max && (
            <button
              type="button"
              onClick={() => document.getElementById(`upload-${label}`)?.click()}
              className="aspect-square rounded-xl border-2 border-dashed border-teal-200 flex items-center justify-center hover:border-teal-400 hover:bg-teal-50 transition-colors"
            >
              <ImageIcon className="w-5 h-5 text-teal-300" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
