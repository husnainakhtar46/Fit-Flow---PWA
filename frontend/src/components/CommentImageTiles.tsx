/**
 * CommentImageTiles.tsx
 * 
 * Inline attachment tiles for StyleCycle sample comments.
 * Shows thumbnail previews under each comment category (WhatsApp/Slack style).
 * Features: thumbnail grid, "+N more" overflow, fullscreen lightbox, upload zone.
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, X, ChevronLeft, ChevronRight, ZoomIn, Trash2, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import api from '../lib/api';
import { formatDate } from '../utils/dateFormatter';

// ==========================================
// Types
// ==========================================

export interface CommentImage {
    id: string;
    image: string;
    caption: string;
    category: string;
    uploaded_at?: string;
}

interface CommentImageTilesProps {
    /** Images from the API for this specific category */
    images: CommentImage[];
    /** New files selected but not yet uploaded */
    pendingFiles: File[];
    /** Callback when user selects new files */
    onFilesSelected: (files: File[]) => void;
    /** Callback to remove a pending file by index */
    onRemovePending: (index: number) => void;
    /** Callback to delete an existing image by ID */
    onRemoveExisting: (imageId: string) => void;
    /** Whether to show upload/remove controls */
    editable: boolean;
    /** Max thumbnails to show before "+N more" */
    maxVisible?: number;
    /** Whether images are currently being compressed */
    isCompressing?: boolean;
}

// ==========================================
// Constants
// ==========================================
const TILE_SIZE = 'w-20 h-20';          // 80×80px
const MAX_VISIBLE_DEFAULT = 4;

// ==========================================
// Component
// ==========================================

const CommentImageTiles = ({
    images,
    pendingFiles,
    onFilesSelected,
    onRemovePending,
    onRemoveExisting,
    editable,
    maxVisible = MAX_VISIBLE_DEFAULT,
    isCompressing = false,
}: CommentImageTilesProps) => {
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const lightboxRef = useRef<HTMLDivElement>(null);

    // Auto-focus lightbox when it opens so keyboard navigation works immediately
    useEffect(() => {
        if (lightboxIndex !== null && lightboxRef.current) {
            lightboxRef.current.focus();
        }
    }, [lightboxIndex]);

    // ---- Clipboard paste handler (container-level, not document-level) ----
    const handlePaste = useCallback((e: React.ClipboardEvent) => {
        if (!editable) return;
        const items = e.clipboardData?.items;
        if (!items) return;

        const imageFiles: File[] = [];
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.type.startsWith('image/')) {
                const file = item.getAsFile();
                if (file) {
                    const ext = item.type.split('/')[1] || 'png';
                    const named = new File([file], `pasted-image-${Date.now()}-${i}.${ext}`, { type: file.type });
                    imageFiles.push(named);
                }
            }
        }
        if (imageFiles.length > 0) {
            e.preventDefault();
            onFilesSelected(imageFiles);
        }
    }, [editable, onFilesSelected]);

    // Merge existing images + pending previews into one display list
    const allItems: { type: 'existing' | 'pending'; src: string; id?: string; pendingIndex?: number; uploadedAt?: string }[] = [
        ...images.map((img) => ({
            type: 'existing' as const,
            src: img.image.startsWith('http') ? img.image : `${api.defaults.baseURL}${img.image.startsWith('/') ? '' : '/'}${img.image}`,
            id: img.id,
            uploadedAt: img.uploaded_at,
        })),
        ...pendingFiles.map((file, i) => ({
            type: 'pending' as const,
            src: URL.createObjectURL(file),
            pendingIndex: i,
        })),
    ];

    const totalCount = allItems.length;
    const visibleItems = allItems.slice(0, maxVisible);
    const overflowCount = totalCount - maxVisible;

    // ---- Handlers ----
    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length > 0) {
            onFilesSelected(files);
        }
        // Reset so the same file can be selected again
        e.target.value = '';
    }, [onFilesSelected]);

    const openLightbox = (index: number) => setLightboxIndex(index);
    const closeLightbox = () => setLightboxIndex(null);

    const lightboxPrev = () => {
        if (lightboxIndex !== null && lightboxIndex > 0) {
            setLightboxIndex(lightboxIndex - 1);
        }
    };

    const lightboxNext = () => {
        if (lightboxIndex !== null && lightboxIndex < totalCount - 1) {
            setLightboxIndex(lightboxIndex + 1);
        }
    };

    // Handle keyboard navigation in lightbox
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Escape') closeLightbox();
        if (e.key === 'ArrowLeft') lightboxPrev();
        if (e.key === 'ArrowRight') lightboxNext();
    }, [lightboxIndex, totalCount]);

    // Nothing to show and not editable → render nothing
    if (totalCount === 0 && !editable) return null;

    return (
        <div className="mt-2 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-1 rounded-lg" onPaste={handlePaste} tabIndex={0}>
            <div className="flex items-center gap-2 flex-wrap">
                {/* Thumbnail tiles */}
                {visibleItems.map((item, idx) => (
                    <div key={item.id || `pending-${item.pendingIndex}`} className="flex flex-col items-center gap-0.5">
                        <div
                            className={`${TILE_SIZE} relative rounded-lg overflow-hidden border border-gray-200 cursor-pointer group flex-shrink-0 transition-shadow hover:shadow-md`}
                            onClick={() => openLightbox(idx)}
                        >
                            <img
                                src={item.src}
                                alt={`Attachment ${idx + 1}`}
                                className="w-full h-full object-cover"
                                loading="lazy"
                            />
                            {/* Hover overlay with zoom icon */}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                <ZoomIn className="w-5 h-5 text-white drop-shadow" />
                            </div>
                            {/* Remove button (edit mode only) */}
                            {editable && (
                                <button
                                    className="absolute top-0.5 right-0.5 p-0.5 bg-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (item.type === 'existing' && item.id) {
                                            onRemoveExisting(item.id);
                                        } else if (item.type === 'pending' && item.pendingIndex !== undefined) {
                                            onRemovePending(item.pendingIndex);
                                        }
                                    }}
                                >
                                    <X className="w-3 h-3 text-white" />
                                </button>
                            )}
                            {/* Pending indicator */}
                            {item.type === 'pending' && (
                                <div className="absolute bottom-0 left-0 right-0 bg-blue-500/80 text-white text-[9px] text-center py-0.5">
                                    New
                                </div>
                            )}
                        </div>
                        {/* Upload date for existing images */}
                        {item.type === 'existing' && item.uploadedAt && (
                            <span className="text-[9px] text-gray-400 leading-none">
                                {formatDate(item.uploadedAt)}
                            </span>
                        )}
                    </div>
                ))}

                {/* "+N more" tile */}
                {overflowCount > 0 && (
                    <div
                        className={`${TILE_SIZE} relative rounded-lg overflow-hidden border border-gray-200 cursor-pointer flex-shrink-0 bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors`}
                        onClick={() => openLightbox(maxVisible)}
                    >
                        <span className="text-sm font-semibold text-gray-600">+{overflowCount}</span>
                    </div>
                )}

                {/* Upload button (edit mode only) */}
                {editable && (
                    <button
                        className={`${TILE_SIZE} rounded-lg border-2 border-dashed ${isCompressing ? 'border-blue-400 bg-blue-50' : 'border-gray-300'} flex flex-col items-center justify-center gap-0.5 ${isCompressing ? 'text-blue-500' : 'text-gray-400 hover:text-blue-500 hover:border-blue-400'} transition-colors flex-shrink-0`}
                        onClick={() => !isCompressing && fileInputRef.current?.click()}
                        type="button"
                        title={isCompressing ? 'Compressing images...' : 'Click to browse files, or Ctrl+V to paste from clipboard'}
                        disabled={isCompressing}
                    >
                        {isCompressing ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <Camera className="w-5 h-5" />
                        )}
                        <span className="text-[9px] font-medium">
                            {isCompressing ? 'Compressing...' : 'Add / Paste'}
                        </span>
                    </button>
                )}

                {/* Hidden file input */}
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileSelect}
                />
            </div>

            {/* ==========================================
                Fullscreen Lightbox
            ========================================== */}
            {lightboxIndex !== null && allItems[lightboxIndex] && (
                <div
                    ref={lightboxRef}
                    className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center outline-none"
                    onClick={closeLightbox}
                    onKeyDown={handleKeyDown}
                    tabIndex={0}
                >
                    {/* Close */}
                    <Button
                        variant="ghost"
                        size="sm"
                        className="absolute top-4 right-4 text-white hover:bg-white/20 z-10"
                        onClick={closeLightbox}
                    >
                        <X className="w-6 h-6" />
                    </Button>

                    {/* Counter */}
                    <div className="absolute top-4 left-4 text-white/70 text-sm z-10">
                        {lightboxIndex + 1} / {totalCount}
                    </div>

                    {/* Previous */}
                    {lightboxIndex > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 z-10"
                            onClick={(e) => {
                                e.stopPropagation();
                                lightboxPrev();
                            }}
                        >
                            <ChevronLeft className="w-8 h-8" />
                        </Button>
                    )}

                    {/* Image */}
                    <img
                        src={allItems[lightboxIndex].src}
                        alt={`Image ${lightboxIndex + 1}`}
                        className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    />

                    {/* Next */}
                    {lightboxIndex < totalCount - 1 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 z-10"
                            onClick={(e) => {
                                e.stopPropagation();
                                lightboxNext();
                            }}
                        >
                            <ChevronRight className="w-8 h-8" />
                        </Button>
                    )}

                    {/* Delete from lightbox (edit mode) */}
                    {editable && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="absolute bottom-4 right-4 text-red-400 hover:bg-red-500/20 z-10"
                            onClick={(e) => {
                                e.stopPropagation();
                                const item = allItems[lightboxIndex];
                                if (item.type === 'existing' && item.id) {
                                    onRemoveExisting(item.id);
                                } else if (item.type === 'pending' && item.pendingIndex !== undefined) {
                                    onRemovePending(item.pendingIndex);
                                }
                                // Move to prev if at end, else stay
                                if (lightboxIndex >= totalCount - 1 && lightboxIndex > 0) {
                                    setLightboxIndex(lightboxIndex - 1);
                                } else if (totalCount <= 1) {
                                    closeLightbox();
                                }
                            }}
                        >
                            <Trash2 className="w-5 h-5 mr-1" /> Delete
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
};

export default CommentImageTiles;
