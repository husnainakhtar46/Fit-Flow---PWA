/**
 * Image Uploader - Handles photo evidence upload with category and caption.
 * Extracted from FinalInspectionForm.tsx for better maintainability.
 */

import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Upload, Trash2 } from 'lucide-react';
import { UploadedImage } from './types';

interface ImageUploaderProps {
    uploadedImages: UploadedImage[];
    onImagesChange: (images: UploadedImage[]) => void;
}

export function ImageUploader({ uploadedImages, onImagesChange }: ImageUploaderProps) {
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files) {
            const newImages: UploadedImage[] = Array.from(files).map(file => ({
                file,
                caption: '',
                category: 'General',
            }));
            onImagesChange([...uploadedImages, ...newImages]);
        }
    };

    const updateImageField = (index: number, field: 'caption' | 'category', value: string) => {
        const newImages = [...uploadedImages];
        newImages[index] = { ...newImages[index], [field]: value };
        onImagesChange(newImages);
    };

    const removeImage = (index: number) => {
        const newImages = [...uploadedImages];
        newImages.splice(index, 1);
        onImagesChange(newImages);
    };

    const getImagePreviewUrl = (img: UploadedImage): string => {
        if (img.isExisting && img.previewUrl) {
            return img.previewUrl;
        }
        return URL.createObjectURL(img.file);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>7. Photo Evidence</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {/* Upload Area */}
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:bg-gray-50 transition-colors cursor-pointer relative">
                        <input
                            type="file"
                            multiple
                            accept="image/*"
                            capture="environment"
                            onChange={handleImageUpload}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <div className="flex flex-col items-center gap-2">
                            <Upload className="h-10 w-10 text-gray-400" />
                            <p className="text-sm text-gray-600 font-medium">Click to upload or drag and drop</p>
                            <p className="text-xs text-gray-400">JPG, PNG (Max 10MB)</p>
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
                                            src={getImagePreviewUrl(img)}
                                            alt="Preview"
                                            className="h-full w-full object-cover"
                                        />
                                    </div>

                                    {/* Controls */}
                                    <div className="flex-1 space-y-2">
                                        <div className="flex justify-between">
                                            <span className="text-xs text-gray-500 font-mono truncate max-w-[150px]">
                                                {img.file.name || 'Existing Image'}
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
