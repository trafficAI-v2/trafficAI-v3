// src/components/dashboard/ManualAnnotationTab.tsx

import React, { useState, useEffect, useRef, useCallback } from "react";
import { BiPlus, BiZoomIn, BiZoomOut, BiTrash, BiSave } from "react-icons/bi";
import type { ViolationType } from '../../types';
import type { MouseEvent as ReactMouseEvent } from "react";
import './ManualAnnotationTab.css';

// --- 從環境變數讀取後端 API 的 URL ---
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// --- 地點類型定義 ---
interface CameraLocation {
    camera_name: string;
    location_description?: string;
}

// --- 型別定義 ---
interface Annotation {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    type: string;
    location: string;
    description?: string;
}

// --- 手動違規記錄型別 ---
interface ManualViolation {
    violation_type: string;
    violation_address: string;
    description?: string;
    confidence: number;
    image_data: string;
    annotations: {
        x: number;
        y: number;
        width: number;
        height: number;
        type: string;
    }[];
}

// 這個元件目前不接收任何 props，符合 CameraFeed.tsx 的修正
const ManualAnnotationTab: React.FC = () => {
    // --- 狀態管理 ---
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
    const [imageDimensions, setImageDimensions] = useState<{ width: number, height: number } | null>(null);
    const [isAnnotationMode, setIsAnnotationMode] = useState<boolean>(false);
    
    // --- API 資料狀態 ---
    const [violationTypes, setViolationTypes] = useState<ViolationType[]>([]);
    const [locations, setLocations] = useState<CameraLocation[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    
    // --- 全域違規設定 ---
    const [selectedViolationType, setSelectedViolationType] = useState<string>('');
    const [selectedLocation, setSelectedLocation] = useState<string>('');
    const [violationDescription, setViolationDescription] = useState<string>('');
    
    const [annotations, setAnnotations] = useState<Annotation[]>([]);
    const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
    
    const [isDrawing, setIsDrawing] = useState(false);
    const [startPoint, setStartPoint] = useState<{ x: number, y: number } | null>(null);
    const [currentRect, setCurrentRect] = useState<{x: number, y: number, width: number, height: number, location: string, description?: string} | null>(null);
    
    const [zoom, setZoom] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 });

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // --- API 調用函數 ---
    const fetchViolationTypes = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/violations/types`);
            if (!response.ok) throw new Error('獲取違規類型失敗');
            const data: ViolationType[] = await response.json();
            setViolationTypes(data);
            if (data.length > 0) {
                setSelectedViolationType(data[0].type_name);
            }
        } catch (err) {
            console.error('獲取違規類型失敗:', err);
            setError('無法載入違規類型選項');
        }
    };

    const fetchLocations = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/cameras/list`);
            if (!response.ok) throw new Error('獲取地點失敗');
            const data: CameraLocation[] = await response.json();
            setLocations(data);
            if (data.length > 0) {
                setSelectedLocation(data[0].camera_name);
            }
        } catch (err) {
            console.error('獲取地點失敗:', err);
            setError('無法載入地點選項');
        }
    };

    // --- 初始化API資料 ---
    useEffect(() => {
        fetchViolationTypes();
        fetchLocations();
    }, []);
    
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
            location: selectedLocation,
            description: violationDescription
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
                type: selectedViolationType,
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

    // --- 刪除標註 ---
    const deleteAnnotation = (annotationId: string) => {
        setAnnotations(prev => prev.filter(ann => ann.id !== annotationId));
        if (selectedAnnotationId === annotationId) {
            setSelectedAnnotationId(null);
        }
    };

    // --- 保存違規記錄到資料庫 ---
    const saveViolationRecord = async () => {
        if (!imageFile || annotations.length === 0) {
            setError('請上傳圖片並至少標註一個違規區域');
            return;
        }

        if (!selectedViolationType || !selectedLocation) {
            setError('請選擇違規類型和地點');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // 將圖片轉換為 base64
            const reader = new FileReader();
            const imageDataPromise = new Promise<string>((resolve, reject) => {
                reader.onload = () => {
                    const result = reader.result as string;
                    resolve(result.split(',')[1]); // 移除 data:image/...;base64, 前綴
                };
                reader.onerror = reject;
            });
            reader.readAsDataURL(imageFile);
            const imageData = await imageDataPromise;

            // 準備違規記錄資料
            const violationData: ManualViolation = {
                violation_type: selectedViolationType,
                violation_address: selectedLocation,
                description: violationDescription,
                confidence: 1.0, // 手動標註的信心度設為 100%
                image_data: imageData,
                annotations: annotations.map(ann => ({
                    x: ann.x,
                    y: ann.y,
                    width: ann.width,
                    height: ann.height,
                    type: ann.type
                }))
            };

            // 發送到後端API
            const response = await fetch(`${API_BASE_URL}/api/violations/manual`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(violationData),
            });

            if (!response.ok) {
                throw new Error('保存失敗');
            }

            // 成功後清理狀態
            setImageFile(null);
            setImagePreviewUrl(null);
            setAnnotations([]);
            setViolationDescription('');
            alert('違規記錄已成功保存！');

        } catch (err) {
            console.error('保存違規記錄失敗:', err);
            setError('保存失敗，請稍後再試');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="manual-annotation-container">
            {error && (
                <div className="error-message" style={{ 
                    background: '#fee', 
                    color: '#c33', 
                    padding: '12px', 
                    borderRadius: '4px', 
                    marginBottom: '16px' 
                }}>
                    {error}
                </div>
            )}
            
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

                    {/* 違規類型和地點選擇 */}
                    <div className="violation-settings" style={{ 
                        padding: '16px', 
                        background: '#f9f9f9', 
                        borderRadius: '8px', 
                        marginBottom: '16px',
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '16px'
                    }}>
                        <div>
                            <label htmlFor="violation-type-select" style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                                違規類型
                            </label>
                            <select
                                id="violation-type-select"
                                value={selectedViolationType}
                                onChange={(e) => setSelectedViolationType(e.target.value)}
                                style={{ 
                                    width: '100%', 
                                    padding: '8px', 
                                    border: '1px solid #ddd', 
                                    borderRadius: '4px' 
                                }}
                            >
                                {violationTypes.map((type) => (
                                    <option key={type.type_name} value={type.type_name}>
                                        {type.type_name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        
                        <div>
                            <label htmlFor="location-select" style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                                違規地點
                            </label>
                            <select
                                id="location-select"
                                value={selectedLocation}
                                onChange={(e) => setSelectedLocation(e.target.value)}
                                style={{ 
                                    width: '100%', 
                                    padding: '8px', 
                                    border: '1px solid #ddd', 
                                    borderRadius: '4px' 
                                }}
                            >
                                {locations.map((location) => (
                                    <option key={location.camera_name} value={location.camera_name}>
                                        {location.camera_name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        
                        <div style={{ gridColumn: '1 / -1' }}>
                            <label htmlFor="description-input" style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                                詳細描述 (選填)
                            </label>
                            <textarea
                                id="description-input"
                                rows={3}
                                value={violationDescription}
                                onChange={(e) => setViolationDescription(e.target.value)}
                                placeholder="輸入違規行為的詳細描述..."
                                style={{ 
                                    width: '100%', 
                                    padding: '8px', 
                                    border: '1px solid #ddd', 
                                    borderRadius: '4px',
                                    resize: 'vertical'
                                }}
                            />
                        </div>
                    </div>
                    
                    <div className="image-info-bar">
                        <span className="info-dot"></span>
                        <span>已載入圖片 - 尺寸: {imageDimensions?.width} x {imageDimensions?.height}</span>
                        <span style={{ marginLeft: 'auto' }}>
                            已標註: {annotations.length} 個區域
                        </span>
                    </div>

                    <div 
                      className="annotation-canvas-container" 
                      onMouseDown={handleMouseDown}
                      onMouseMove={handleMouseMove}
                      onMouseUp={handleMouseUp}
                      onMouseLeave={handleMouseUp}
                    >
                        <canvas 
                            ref={canvasRef} 
                            className="annotation-canvas" 
                            style={{ cursor: isAnnotationMode ? (isPanning ? 'grabbing' : 'crosshair') : 'grab' }} 
                        />
                        <div className="canvas-controls">
                            <button onClick={() => setZoom(z => Math.max(0.2, z / 1.2))} className="control-button">
                                <BiZoomOut />
                            </button>
                            <input 
                                type="range" 
                                min="20" 
                                max="400" 
                                value={zoom * 100} 
                                onChange={e => setZoom(Number(e.target.value) / 100)} 
                                className="zoom-slider"
                            />
                            <button onClick={() => setZoom(z => Math.min(8, z * 1.2))} className="control-button">
                                <BiZoomIn />
                            </button>
                        </div>
                    </div>

                    {/* 標註列表 */}
                    {annotations.length > 0 && (
                        <div className="annotations-list" style={{ 
                            marginTop: '16px', 
                            padding: '16px', 
                            background: '#f9f9f9', 
                            borderRadius: '8px' 
                        }}>
                            <h5 style={{ marginBottom: '12px' }}>標註列表</h5>
                            {annotations.map((annotation, index) => (
                                <div key={annotation.id} style={{ 
                                    display: 'flex', 
                                    justifyContent: 'space-between', 
                                    alignItems: 'center',
                                    padding: '8px',
                                    background: 'white',
                                    borderRadius: '4px',
                                    marginBottom: '8px'
                                }}>
                                    <span>
                                        #{index + 1} - {annotation.type} ({annotation.location})
                                    </span>
                                    <button 
                                        onClick={() => deleteAnnotation(annotation.id)}
                                        style={{ 
                                            background: '#ff4444', 
                                            color: 'white', 
                                            border: 'none', 
                                            borderRadius: '4px',
                                            padding: '4px 8px',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <BiTrash />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="action-buttons">
                        <button 
                            className="cancel-button"
                            onClick={() => {
                                setImageFile(null);
                                setImagePreviewUrl(null);
                                setAnnotations([]);
                                setViolationDescription('');
                            }}
                        >
                            取消
                        </button>
                        <button 
                            className="submit-button"
                            onClick={saveViolationRecord}
                            disabled={loading || annotations.length === 0}
                            style={{ 
                                background: loading ? '#ccc' : '#4CAF50',
                                cursor: loading ? 'not-allowed' : 'pointer'
                            }}
                        >
                            <BiSave style={{ marginRight: '8px' }} />
                            {loading ? '保存中...' : `儲存 ${annotations.length} 個違規標記`}
                        </button>
                    </div>
                </div>
            )}
            <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleImageUpload} 
                accept="image/*" 
                className="hidden" 
            />
        </div>
    );
};

export default ManualAnnotationTab;