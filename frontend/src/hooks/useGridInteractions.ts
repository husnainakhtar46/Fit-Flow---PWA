import { useState, useRef, useEffect } from 'react';
import { UseFormSetValue, UseFormGetValues } from 'react-hook-form';
import { FormData } from '../types/inspection';

interface UseGridInteractionsProps {
    columnKeys: string[];
    measurementFieldsLength: number;
    setValue: UseFormSetValue<FormData>;
    getValues: UseFormGetValues<FormData>;
    toast: any;
}

export const useGridInteractions = ({
    columnKeys,
    measurementFieldsLength,
    setValue,
    getValues,
    toast,
}: UseGridInteractionsProps) => {
    const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
    const [isDragSelecting, setIsDragSelecting] = useState(false);
    const [dragStart, setDragStart] = useState<{ r: number, c: number } | null>(null);

    const longPressTimer = useRef<NodeJS.Timeout | null>(null);

    const getCellId = (r: number, k: string) => `${r}-${k}`;
    const isSelected = (index: number, key: string) => selectedCells.has(getCellId(index, key));

    const handleCellKeyDown = (e: React.KeyboardEvent, index: number, key: string, sizeMeasurementIndices?: number[]) => {
        // Handle Enter for Navigation
        if (e.key === 'Enter') {
            e.preventDefault();
            const currentColIdx = columnKeys.indexOf(key);
            if (currentColIdx === -1) return;

            if (sizeMeasurementIndices && sizeMeasurementIndices.length > 0) {
                const posInSize = sizeMeasurementIndices.indexOf(index);
                const nextPosInSize = posInSize + 1;

                if (nextPosInSize < sizeMeasurementIndices.length) {
                    const nextIdx = sizeMeasurementIndices[nextPosInSize];
                    const nextInput = document.querySelector(`input[name="measurements.${nextIdx}.${key}"]`) as HTMLInputElement;
                    if (nextInput) {
                        nextInput.focus();
                        nextInput.select();
                    }
                } else {
                    const nextColIdx = currentColIdx + 1;
                    if (nextColIdx < columnKeys.length) {
                        const nextColKey = columnKeys[nextColIdx];
                        const firstIdx = sizeMeasurementIndices[0];
                        const nextInput = document.querySelector(`input[name="measurements.${firstIdx}.${nextColKey}"]`) as HTMLInputElement;
                        if (nextInput) {
                            nextInput.focus();
                            nextInput.select();
                        }
                    }
                }
            } else {
                const nextRowIdx = index + 1;
                if (nextRowIdx < measurementFieldsLength) {
                    const nextInput = document.querySelector(`input[name="measurements.${nextRowIdx}.${key}"]`) as HTMLInputElement;
                    if (nextInput) {
                        nextInput.focus();
                        nextInput.select();
                    }
                } else {
                    const nextColIdx = currentColIdx + 1;
                    if (nextColIdx < columnKeys.length) {
                        const nextColKey = columnKeys[nextColIdx];
                        const nextInput = document.querySelector(`input[name="measurements.0.${nextColKey}"]`) as HTMLInputElement;
                        if (nextInput) {
                            nextInput.focus();
                            nextInput.select();
                        }
                    }
                }
            }
            return;
        }

        if (e.key === 'Backspace' || e.key === 'Delete') {
            if (selectedCells.size > 0) {
                if (selectedCells.has(getCellId(index, key)) || selectedCells.size > 0) {
                    e.preventDefault();

                    if (selectedCells.size > 1) {
                        if (!confirm(`Are you sure you want to clear ${selectedCells.size} cells?`)) {
                            return;
                        }
                    }

                    const rowsToUpdate = new Map<number, Set<string>>();
                    selectedCells.forEach(cellId => {
                        const [rStr, k] = cellId.split('-');
                        const r = parseInt(rStr);
                        if (!rowsToUpdate.has(r)) rowsToUpdate.set(r, new Set());
                        rowsToUpdate.get(r)!.add(k);
                    });

                    const currentMeasurements = getValues('measurements');
                    let count = 0;

                    rowsToUpdate.forEach((keys, r) => {
                        if (r >= currentMeasurements.length) return;

                        let rowSamples = [...(currentMeasurements[r].samples || [])];
                        let samplesChanged = false;

                        keys.forEach(k => {
                            if (k === 'std' || k === 'tol' || k === 'spec') {
                                setValue(`measurements.${r}.${k}` as any, '');
                                count++;
                            } else if (k.startsWith('s')) {
                                const sampleNum = parseInt(k.replace('s', ''));
                                const existingIdx = rowSamples.findIndex(s => s.index === sampleNum);

                                if (existingIdx >= 0) {
                                    rowSamples[existingIdx] = { ...rowSamples[existingIdx], value: '' };
                                    samplesChanged = true;
                                    count++;
                                }
                            }
                        });

                        if (samplesChanged) {
                            setValue(`measurements.${r}.samples` as any, rowSamples);
                        }
                    });

                    if (count > 0) {
                        toast({ title: `Cleared ${count} cells` });
                    }
                }
            }
        }
    };

    const handleCellMouseDown = (index: number, key: string) => {
        const cIndex = columnKeys.indexOf(key);
        if (cIndex === -1) return;

        setIsDragSelecting(true);
        setDragStart({ r: index, c: cIndex });
        setSelectedCells(new Set([getCellId(index, key)]));
    };

    const handleCellMouseEnter = (index: number, key: string) => {
        if (isDragSelecting && dragStart) {
            const cIndex = columnKeys.indexOf(key);
            if (cIndex === -1) return;

            const rMin = Math.min(dragStart.r, index);
            const rMax = Math.max(dragStart.r, index);
            const cMin = Math.min(dragStart.c, cIndex);
            const cMax = Math.max(dragStart.c, cIndex);

            const newSet = new Set<string>();
            for (let r = rMin; r <= rMax; r++) {
                for (let c = cMin; c <= cMax; c++) {
                    newSet.add(getCellId(r, columnKeys[c]));
                }
            }
            setSelectedCells(newSet);
        }
    };

    useEffect(() => {
        const handleUp = () => {
            setIsDragSelecting(false);
            setDragStart(null);
        };
        window.addEventListener('mouseup', handleUp);
        window.addEventListener('touchend', handleUp);
        return () => {
            window.removeEventListener('mouseup', handleUp);
            window.removeEventListener('touchend', handleUp);
        };
    }, []);

    const handleTouchStart = (index: number, key: string) => {
        longPressTimer.current = setTimeout(() => {
            const id = getCellId(index, key);
            setSelectedCells(prev => {
                const newSet = new Set(prev);
                if (newSet.has(id)) newSet.delete(id);
                else newSet.add(id);
                return newSet;
            });
            if (navigator.vibrate) navigator.vibrate(50);
        }, 500);
    };

    const handleTouchEnd = () => {
        if (longPressTimer.current) clearTimeout(longPressTimer.current);
    };

    const handleCopy = (event: React.ClipboardEvent<HTMLInputElement>) => {
        if (selectedCells.size === 0) return;

        event.preventDefault();

        const cellsToCopy: { r: number, c: number, val: string }[] = [];
        const currentMeasurements = getValues('measurements');

        selectedCells.forEach(cellId => {
            const [rStr, key] = cellId.split('-');
            const r = parseInt(rStr);
            const c = columnKeys.indexOf(key);

            if (r >= 0 && r < currentMeasurements.length && c !== -1) {
                let val = '';
                if (key === 'spec') {
                    val = String(currentMeasurements[r]?.spec ?? '');
                } else if (key.startsWith('s')) {
                    const sampleNum = parseInt(key.replace('s', ''));
                    const sample = currentMeasurements[r]?.samples?.find((s: any) => s.index === sampleNum);
                    val = String(sample?.value ?? '');
                }
                cellsToCopy.push({ r, c, val });
            }
        });

        if (cellsToCopy.length === 0) return;

        cellsToCopy.sort((a, b) => {
            if (a.r !== b.r) return a.r - b.r;
            return a.c - b.c;
        });

        const uniqueRows = [...new Set(cellsToCopy.map(x => x.r))].sort((a, b) => a - b);
        const uniqueCols = [...new Set(cellsToCopy.map(x => x.c))].sort((a, b) => a - b);

        let clipboardString = "";

        uniqueRows.forEach((rowIndex, i) => {
            const rowCells = cellsToCopy.filter(c => c.r === rowIndex);
            const rowStr = uniqueCols.map(colIndex => {
                const cell = rowCells.find(c => c.c === colIndex);
                return cell ? cell.val : '';
            }).join('\t');

            clipboardString += rowStr;
            if (i < uniqueRows.length - 1) clipboardString += '\n';
        });

        event.clipboardData.setData('text/plain', clipboardString);
        toast({ title: `Copied ${cellsToCopy.length} cells` });
    };

    const handleMeasurementPaste = (rowIndex: number, startColumn: string) => (event: React.ClipboardEvent<HTMLInputElement>) => {
        const pastedData = event.clipboardData.getData('text');
        const lines = pastedData.split('\n').filter(line => line.trim());
        const firstLineColumns = lines[0]?.split('\t') || [];

        if (lines.length > 1 || firstLineColumns.length > 1) {
            event.preventDefault();

            const startColIndex = columnKeys.indexOf(startColumn);
            if (startColIndex === -1) return;

            const hasHeader = /pom|name|std|spec|s1|s2|s3|s4|s5|s6/i.test(lines[0]);
            const dataRows = hasHeader ? lines.slice(1) : lines;
            const affectedRows = Math.min(dataRows.length, measurementFieldsLength - rowIndex);

            if (!confirm(`Paste ${dataRows.length} row(s) starting from ${startColumn.toUpperCase()} at row ${rowIndex + 1}?`)) {
                return;
            }

            dataRows.forEach((line, rowOffset) => {
                const targetRow = rowIndex + rowOffset;
                if (targetRow < measurementFieldsLength) {
                    const columns = line.split('\t');

                    const currentMeasurements = getValues('measurements');
                    let rowSamples = [...(currentMeasurements[targetRow].samples || [])];
                    let rowChanged = false;

                    columns.forEach((value, colOffset) => {
                        const targetColIndex = startColIndex + colOffset;
                        if (targetColIndex < columnKeys.length) {
                            const fieldName = columnKeys[targetColIndex];
                            const cleanValue = value?.trim() || '';

                            const sampleMatch = fieldName.match(/^s(\d+)$/);
                            if (sampleMatch) {
                                const sampleIndex = parseInt(sampleMatch[1]);
                                const existingIdx = rowSamples.findIndex(s => s.index === sampleIndex);
                                if (existingIdx >= 0) {
                                    rowSamples[existingIdx] = { ...rowSamples[existingIdx], value: cleanValue };
                                } else {
                                    rowSamples.push({ index: sampleIndex, value: cleanValue });
                                }
                                rowChanged = true;
                            } else {
                                setValue(`measurements.${targetRow}.${fieldName}` as any, cleanValue);
                            }
                        }
                    });

                    if (rowChanged) {
                        setValue(`measurements.${targetRow}.samples` as any, rowSamples);
                    }
                }
            });
            toast({ title: `Pasted ${affectedRows} rows` });
        }
    };

    return {
        isSelected,
        handleCellKeyDown,
        handleCellMouseDown,
        handleCellMouseEnter,
        handleTouchStart,
        handleTouchEnd,
        handleCopy,
        handleMeasurementPaste
    };
};
