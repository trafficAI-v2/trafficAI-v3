// src/components/dashboard/ManualAnnotationTab.tsx

// ===== (已修正) 移除未使用的 React Icons 和型別 =====
import React, { useState, useEffect, useRef, useCallback } from "react";
import { BiPlus, BiZoomIn, BiZoomOut } from "react-icons/bi"; // 移除了 BiReset, BiFullscreen, BiTrash
import type { ViolationType } from '../../types'; // 移除了未使用的 Camera 型別
import type { MouseEvent as ReactMouseEvent } from "react"; // 移除了未使用的 WheelEvent
import './ManualAnnotationTab.css'; // 確保這個 CSS 檔案存在

// --- 在此處定義常數，或從外部導入 ---
const VIOLATION_TYPES: ViolationType[] = [
    { type: "紅燈違規", confidence: 0.94 },
    { type: "未繫安全帶", confidence: 0.87 },
    { type: "違規停車", confidence: 0.92 },
    { type: "超速行駛", confidence: 0.89 },
    { type: "逆向行駛", confidence: 0.95 },
];

// --- 型別定義 ---
interface Annotation {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    type: string;
}

// 這個元件目前不接收任何 props，符合 CameraFeed.tsx 的修正
const ManualAnnotationTab: React.FC = () => {
    // --- 狀態管理 ---
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
    const [imageDimensions, setImageDimensions] = useState<{ width: number, height: number } | null>(null);
    const [isAnnotationMode, setIsAnnotationMode] = useState<boolean>(false);
    
    const [annotations, setAnnotations] = useState<Annotation[]>([]);
    const [selectedAnnotationId, _setSelectedAnnotationId] = useState<string | null>(null);
    
    const [isDrawing, setIsDrawing] = useState(false);
    const [startPoint, setStartPoint] = useState<{ x: number, y: number } | null>(null);
    const [currentRect, setCurrentRect] = useState<Omit<Annotation, 'id' | 'type'> | null>(null);
    
    const [zoom, setZoom] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 });

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // --- 繪圖邏輯 ---
    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.translate(offset.x, offset.y);
        ctx.scale(zoom, zoom);

        if (imagePreviewUrl) {
            const img = new Image();
            img.src = imagePreviewUrl;
            if (img.complete) {
                ctx.drawImage(img, 0, 0);
            } else {
                img.onload = () => {
                    if(canvasRef.current) { // 確保 canvas 仍然存在
                        ctx.drawImage(img, 0, 0);
                    }
                };
            }
        }
        
        annotations.forEach(anno => {
            const isSelected = anno.id === selectedAnnotationId;
            ctx.strokeStyle = isSelected ? '#3b82f6' : '#ef4444';
            ctx.lineWidth = isSelected ? 3 / zoom : 2 / zoom;
            ctx.strokeRect(anno.x, anno.y, anno.width, anno.height);
        });

        if (currentRect) {
            ctx.strokeStyle = '#10b981';
            ctx.lineWidth = 2 / zoom;
            ctx.setLineDash([5, 5]);
            ctx.strokeRect(currentRect.x, currentRect.y, currentRect.width, currentRect.height);
            ctx.setLineDash([]);
        }
        ctx.restore();
    }, [imagePreviewUrl, annotations, currentRect, offset, zoom, selectedAnnotationId]);

    useEffect(() => {
        draw();
    }, [draw]);
    
    // --- 事件處理 ---
    const getTransformedPos = (e: ReactMouseEvent): { x: number, y: number } => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left - offset.x) / zoom,
            y: (e.clientY - rect.top - offset.y) / zoom
        };
    };

    const handleMouseDown = (e: ReactMouseEvent) => {
        if (!isAnnotationMode || !imageFile) return;
        if (e.button === 1) { // Middle mouse button for panning
            setIsPanning(true);
            setLastPanPoint({ x: e.clientX, y: e.clientY });
            return;
        }
        if (e.button !== 0) return; // Only allow left click for drawing
        
        setIsDrawing(true);
        setStartPoint(getTransformedPos(e));
    };
    
    const handleMouseMove = (e: ReactMouseEvent) => {
        if (isPanning) {
            const dx = e.clientX - lastPanPoint.x;
            const dy = e.clientY - lastPanPoint.y;
            setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
            setLastPanPoint({ x: e.clientX, y: e.clientY });
            return;
        }
        if (!isDrawing || !startPoint) return;
        const currentPos = getTransformedPos(e);
        const rect = {
            x: Math.min(startPoint.x, currentPos.x),
            y: Math.min(startPoint.y, currentPos.y),
            width: Math.abs(startPoint.x - currentPos.x),
            height: Math.abs(startPoint.y - currentPos.y),
        };
        setCurrentRect(rect);
    };

    const handleMouseUp = () => {
        if (isPanning) {
            setIsPanning(false);
            return;
        }
        if (isDrawing && currentRect && currentRect.width > 5 && currentRect.height > 5) {
            const newAnnotation: Annotation = {
                id: `anno-${Date.now()}`,
                ...currentRect,
                type: VIOLATION_TYPES[0].type,
            };
            setAnnotations(prev => [...prev, newAnnotation]);
        }
        setIsDrawing(false);
        setStartPoint(null);
        setCurrentRect(null);
    };
    
    // --- 檔案處理 ---
    const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setImageFile(file);
            const url = URL.createObjectURL(file);
            setImagePreviewUrl(url);
            
            const img = new Image();
            img.onload = () => {
                setImageDimensions({ width: img.width, height: img.height });
                const canvas = canvasRef.current;
                if(canvas && canvas.parentElement){
                    // Fit image within the parent container on initial load
                    const parentWidth = canvas.parentElement.clientWidth;
                    const parentHeight = canvas.parentElement.clientHeight;
                    canvas.width = parentWidth;
                    canvas.height = parentHeight;

                    const hRatio = parentWidth / img.width;
                    const vRatio = parentHeight / img.height;
                    const ratio = Math.min(hRatio, vRatio, 1); // Do not scale up beyond 100%
                    
                    setZoom(ratio);
                    // Center the image
                    setOffset({
                        x: (parentWidth - img.width * ratio) / 2,
                        y: (parentHeight - img.height * ratio) / 2,
                    });
                }
            };
            img.src = url;
            setAnnotations([]); // Clear previous annotations
        }
    };
    
    // --- UI 觸發 ---
    const triggerFileSelect = () => fileInputRef.current?.click();

    return (
        <div className="manual-annotation-container">
            {!imageFile ? (
                <div className="upload-prompt" onClick={triggerFileSelect}>
                    <div className="upload-icon-circle"><BiPlus /></div>
                    <p className="upload-text">點擊上傳圖片</p>
                    <p className="upload-hint">支援 JPG, PNG, GIF 格式</p>
                </div>
            ) : (
                <div className="annotation-workspace">
                    <div className="annotation-header">
                        <h4 className="text-lg font-semibold">手動違規標註</h4>
                        <div className="flex items-center gap-2">
                            <label htmlFor="annotation-toggle" className="text-sm font-medium">標註模式</label>
                            <input
                                type="checkbox"
                                id="annotation-toggle"
                                className="toggle-switch"
                                checked={isAnnotationMode}
                                onChange={(e) => setIsAnnotationMode(e.target.checked)}
                            />
                        </div>
                    </div>
                    
                    <div className="image-info-bar">
                        <span className="info-dot"></span>
                        <span>已載入圖片 - 尺寸: {imageDimensions?.width} x {imageDimensions?.height}</span>
                    </div>

                    <div 
                      className="annotation-canvas-container" 
                      onMouseDown={handleMouseDown}
                      onMouseMove={handleMouseMove}
                      onMouseUp={handleMouseUp}
                      onMouseLeave={handleMouseUp}
                    >
                        <canvas ref={canvasRef} className="annotation-canvas" style={{ cursor: isAnnotationMode ? (isPanning ? 'grabbing' : 'crosshair') : 'grab' }} />
                        <div className="canvas-controls">
                            <button onClick={() => setZoom(z => Math.max(0.2, z / 1.2))} className="control-button"><BiZoomOut /></button>
                            <input type="range" min="20" max="400" value={zoom * 100} onChange={e => setZoom(Number(e.target.value) / 100)} className="zoom-slider"/>
                            <button onClick={() => setZoom(z => Math.min(8, z * 1.2))} className="control-button"><BiZoomIn /></button>
                        </div>
                    </div>

                    <div className="action-buttons">
                        <button className="cancel-button">取消</button>
                        <button className="submit-button">提交 {annotations.length} 個違規標記</button>
                    </div>
                </div>
            )}
            <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
        </div>
    );
};

export default ManualAnnotationTab;