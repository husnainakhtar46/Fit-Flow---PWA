import { useState, useEffect, useRef } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Upload, Trash2, Loader2 } from 'lucide-react';
import { UploadedImage } from './types';
import { compressImage } from '../../lib/imageUtils';

interface ImageUploaderProps {
    uploadedImages: UploadedImage[];
    onImagesChange: (images: UploadedImage[]) => void;
}

export function ImageUploader({ uploadedImages, onImagesChange }: ImageUploaderProps) {
    const [isCompressing, setIsCompressing] = useState(false);
    // Fix: Use ref to track created URLs for cleanup, independent of state updates
    const generatedUrls = useRef<string[]>([]);

    // Memory Leak Fix: Clean up generated URLs on unmount
    useEffect(() => {
        return () => {
            generatedUrls.current.forEach(url => URL.revokeObjectURL(url));
        };
    }, []);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            setIsCompressing(true);
            const newImages: UploadedImage[] = [];

            try {
                // Compress images efficiently
                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    try {
                        const compressedFile = await compressImage(file);
                        const previewUrl = URL.createObjectURL(compressedFile);
                        generatedUrls.current.push(previewUrl); // Track for cleanup

                        newImages.push({
                            file: compressedFile, // Use smaller file
                            caption: '',
                            category: 'General',
                            previewUrl: previewUrl
                        });
                    } catch (err) {
                        console.error("Compression skipped for file", file.name, err);
                        // Fallback to original if compression fails
                        const previewUrl = URL.createObjectURL(file);
                        generatedUrls.current.push(previewUrl);

                        newImages.push({
                            file,
                            caption: '',
                            category: 'General',
                            previewUrl: previewUrl
                        });
                    }
                }

                onImagesChange([...uploadedImages, ...newImages]);
            } finally {
                setIsCompressing(false);
                // Reset input to allow re-uploading duplicate files if needed
                e.target.value = '';
            }
        }
    };

    const updateImageField = (index: number, field: 'caption' | 'category', value: string) => {
        const newImages = [...uploadedImages];
        newImages[index] = { ...newImages[index], [field]: value };
        onImagesChange(newImages);
    };

    const removeImage = (index: number) => {
        // We do typically want to revoke URL here to save memory immediately, 
        // but to be safe against double-revoke or race conditions with the ref list,
        // we'll rely on the unmount cleanup.
        const newImages = [...uploadedImages];
        newImages.splice(index, 1);
        onImagesChange(newImages);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>7. Photo Evidence {isCompressing && <span className="text-sm font-normal text-blue-600 animate-pulse ml-2">(Compressing...)</span>}</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {/* Upload Area */}
                    <div className={`border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:bg-gray-50 transition-colors cursor-pointer relative ${isCompressing ? 'opacity-50 pointer-events-none' : ''}`}>
                        <input
                            type="file"
                            multiple
                            accept="image/*"
                            capture="environment"
                            onChange={handleImageUpload}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            disabled={isCompressing}
                        />
                        <div className="flex flex-col items-center gap-2">
                            {isCompressing ? <Loader2 className="h-10 w-10 text-blue-500 animate-spin" /> : <Upload className="h-10 w-10 text-gray-400" />}
                            <p className="text-sm text-gray-600 font-medium">Click to upload or drag and drop</p>
                            <p className="text-xs text-gray-400">Auto-compressed for faster sync</p>
                        </div>
                    </div>

                    {/* Image Preview Grid */}
                    {uploadedImages.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                            {uploadedImages.map((img, idx) => (
                                <div key={idx} className="flex gap-3 p-3 bg-white border rounded shadow-sm items-start">
                                    {/* Thumbnail */}
                                    <div className="h-24 w-24 bg-gray-100 rounded overflow-hidden flex-shrink-0 border">
                                        <img
                                            src={img.previewUrl || (img.isExisting ? img.url : '')}
                                            alt="Preview"
                                            className="h-full w-full object-cover"
                                        />
                                    </div>

                                    {/* Controls */}
                                    <div className="flex-1 space-y-2">
                                        <div className="flex justify-between">
                                            <span className="text-xs text-gray-500 font-mono truncate max-w-[150px]">
                                                {img.file?.name ? `${(img.file.size / 1024).toFixed(0)}KB` : 'Existing Image'}
                                            </span>
                                            <span className="text-xs font-bold text-blue-600">{img.category}</span>
                                        </div>

                                        <select
                                            value={img.category}
                                            onChange={(e) => updateImageField(idx, 'category', e.target.value)}
                                            className="w-full border rounded p-1 text-sm h-8 bg-white"
                                        >
                                            <option value="General">General / Packaging</option>
                                            <option value="Labeling">Labeling / Marking</option>
                                            <option value="Defect">Defect Evidence</option>
                                            <option value="Measurement">Measurement</option>
                                            <option value="On-Site Test">On-Site Test</option>
                                        </select>

                                        <Input
                                            placeholder="Enter caption..."
                                            value={img.caption}
                                            onChange={(e) => updateImageField(idx, 'caption', e.target.value)}
                                            className="h-8 text-sm"
                                        />
                                    </div>

                                    {/* Delete Button */}
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => removeImage(idx)}
                                        className="self-center"
                                    >
                                        <Trash2 className="h-4 w-4 text-red-400 hover:text-red-600" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
