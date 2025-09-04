import React, { useState, useRef, useEffect } from 'react';
// ⬇️ Update this path to where you put the SVG in your project
import QualiZealLogo from './QualiZeal Monogram Colored.svg';

interface Point { x: number; y: number; }
interface EvaluationResult { score: number; message: string; }

export default function DrawPerfectLogo() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [points, setPoints] = useState<Point[]>([]);
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [bestScore, setBestScore] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const logoImgRef = useRef<HTMLImageElement | null>(null); // ⬅️ cache the SVG image

  // ----- evaluation (unchanged) -----
  const evaluateLogo = (points: Point[]): EvaluationResult => {
    if (points.length < 15) return { score: 0, message: "Draw the complete logo!" };
    const canvas = canvasRef.current;
    if (!canvas) return { score: 0, message: "Error evaluating drawing" };
    const displayWidth = canvas.width / (window.devicePixelRatio || 1);
    const displayHeight = canvas.height / (window.devicePixelRatio || 1);

    let minX = Math.min(...points.map(p => p.x));
    let maxX = Math.max(...points.map(p => p.x));
    let minY = Math.min(...points.map(p => p.y));
    let maxY = Math.max(...points.map(p => p.y));
    const drawingWidth = maxX - minX;
    const drawingHeight = maxY - minY;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    // circularity
    let circularityScore = 0;
    const expectedRadius = Math.min(drawingWidth, drawingHeight) / 3;
    let circularPoints = 0;
    let totalRadiusVariance = 0;
    for (const point of points) {
      const distFromCenter = Math.hypot(point.x - centerX, point.y - centerY);
      if (distFromCenter >= expectedRadius * 0.6 && distFromCenter <= expectedRadius * 1.4) {
        circularPoints++;
        totalRadiusVariance += Math.abs(distFromCenter - expectedRadius);
      }
    }
    if (circularPoints > 0) {
      const avgVariance = totalRadiusVariance / circularPoints;
      const consistencyFactor = Math.max(0, 1 - (avgVariance / expectedRadius));
      circularityScore = (circularPoints / points.length) * consistencyFactor;
    }

    // arrow/lines
    let arrowScore = 0;
    let straightSegments = 0;
    let diagonalSegments = 0;
    for (let i = 3; i < points.length - 3; i++) {
      const p1 = points[i - 3], p2 = points[i], p3 = points[i + 3];
      const dist1 = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const dist2 = Math.hypot(p3.x - p2.x, p3.y - p2.y);
      const directDist = Math.hypot(p3.x - p1.x, p3.y - p1.y);
      const straightness = directDist / (dist1 + dist2);
      if (straightness > 0.95) {
        straightSegments++;
        const angle = Math.atan2(p3.y - p1.y, p3.x - p1.x);
        if (Math.abs(angle) > Math.PI / 6 && Math.abs(angle) < Math.PI * 5 / 6) diagonalSegments++;
      }
    }
    arrowScore = Math.min(1, (straightSegments / (points.length * 0.15)) * (1 + diagonalSegments / 10));

    // completeness
    let completenessScore = 0;
    if (circularityScore > 0.2 && arrowScore > 0.1) {
      completenessScore = Math.min(circularityScore + arrowScore, 1);
    } else {
      completenessScore = Math.max(circularityScore, arrowScore) * 0.6;
    }

    // size/proportion
    const canvasArea = displayWidth * displayHeight;
    const drawingArea = drawingWidth * drawingHeight;
    const sizeRatio = drawingArea / canvasArea;
    const aspectRatio = drawingWidth / drawingHeight;
    let proportionScore = 1;
    if (sizeRatio < 0.02) proportionScore *= sizeRatio / 0.02;
    else if (sizeRatio > 0.4) proportionScore *= 0.7;
    if (aspectRatio < 0.7 || aspectRatio > 1.4) proportionScore *= 0.8;

    // smoothness
    let smoothnessScore = 0;
    if (points.length > 20) {
      let totalDeviation = 0;
      for (let i = 1; i < points.length - 1; i++) {
        const p1 = points[i - 1], p2 = points[i], p3 = points[i + 1];
        const a1 = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        const a2 = Math.atan2(p3.y - p2.y, p3.x - p2.x);
        let diff = Math.abs(a2 - a1);
        if (diff > Math.PI) diff = 2 * Math.PI - diff;
        totalDeviation += diff;
      }
      const avgDeviation = totalDeviation / (points.length - 2);
      smoothnessScore = Math.max(0, 1 - avgDeviation);
    }

    // final
    let totalScore = Math.round((
      completenessScore * 0.45 +
      circularityScore  * 0.25 +
      arrowScore        * 0.15 +
      proportionScore   * 0.10 +
      smoothnessScore   * 0.05
    ) * 100);
    if (smoothnessScore > 0.8 && completenessScore > 0.7) totalScore += 5;
    totalScore = Math.max(0, Math.min(100, totalScore));

    let message;
    if (totalScore >= 95) message = "Perfect! Master-level logo! 🏆";
    else if (totalScore >= 85) message = "Excellent! Nearly perfect logo! 🎯";
    else if (totalScore >= 70) message = "Great work! Very recognizable! 👏";
    else if (totalScore >= 55) message = "Good job! Nice logo elements! 💪";
    else if (totalScore >= 40) message = "Not bad! Keep practicing! 🖊️";
    else if (totalScore >= 25) message = "Getting there! Try the ring + arrow! 🔄";
    else message = "Keep trying! Focus on the circular ring! 🎨";

    return { score: totalScore, message };
  };

  // ----- setup & resize (fixed transform) -----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const applySize = () => {
      const scale = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * scale;
      canvas.height = window.innerHeight * scale;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      // ✅ reset transform instead of compounding scale()
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      drawCanvas();
    };

    applySize();
    window.addEventListener('resize', applySize);
    return () => window.removeEventListener('resize', applySize);
  }, []);

  // ----- preload SVG once -----
  useEffect(() => {
    const img = new Image();
    img.src = QualiZealLogo; // bundlers resolve to a URL
    img.onload = () => {
      logoImgRef.current = img;
      drawCanvas();
    };
  }, []);

  useEffect(() => {
    drawCanvas();
  }, [points, showGrid, result]);

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scale = window.devicePixelRatio || 1;
    const displayWidth = canvas.width / scale;
    const displayHeight = canvas.height / scale;

    // clear
    ctx.clearRect(0, 0, displayWidth, displayHeight);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, displayWidth, displayHeight);

    // grid
    if (showGrid) {
      ctx.strokeStyle = '#f0f0f0';
      ctx.lineWidth = 1;
      const gridSize = 40;
      for (let x = 0; x < displayWidth; x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, displayHeight); ctx.stroke();
      }
      for (let y = 0; y < displayHeight; y += gridSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(displayWidth, y); ctx.stroke();
      }

      // ✅ draw actual QualiZeal SVG as the non-skewed guide
      if (points.length === 0 && logoImgRef.current) {
        const img = logoImgRef.current;
        // target size = 12% of min dimension, preserve aspect ratio
        const target = Math.min(displayWidth, displayHeight) * 0.22; // a bit larger so details are clear
        const aspect = img.width / img.height || 1;
        let drawW = target, drawH = target;
        if (aspect >= 1) {
          drawW = target;
          drawH = target / aspect;
        } else {
          drawH = target;
          drawW = target * aspect;
        }
        const cx = displayWidth / 2;
        const cy = displayHeight / 2;

        // drop shadow to make it pop on grid
        ctx.save();
        ctx.globalAlpha = 0.95;
        ctx.shadowColor = 'rgba(0,0,0,0.12)';
        ctx.shadowBlur = 12;
        ctx.drawImage(img, cx - drawW / 2, cy - drawH / 2, drawW, drawH);
        ctx.restore();

        // caption
        ctx.fillStyle = '#888';
        ctx.font = '16px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Draw this logo', cx, cy - target * 0.75);
      }
    }

    // user stroke
    if (points.length > 1) {
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
      ctx.stroke();
    }

    // result overlay
    if (result) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fillRect(0, 0, displayWidth, displayHeight);

      ctx.fillStyle = '#000';
      ctx.font = 'bold 72px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${result.score}/100`, displayWidth / 2, displayHeight / 2 - 50);

      ctx.font = '24px system-ui, -apple-system, sans-serif';
      ctx.fillText(result.message, displayWidth / 2, displayHeight / 2 + 30);

      ctx.font = '18px system-ui, -apple-system, sans-serif';
      ctx.fillText(`Best score: ${bestScore} | Attempts: ${attempts}`, displayWidth / 2, displayHeight / 2 + 70);
    }
  };

  const getMousePos = (e: React.MouseEvent): Point | null => {
    const canvas = canvasRef.current; if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const getTouchPos = (e: React.TouchEvent): Point | null => {
    if (e.touches.length === 0) return null;
    const canvas = canvasRef.current; if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
  };

  const startDrawing = (pos: Point | null) => { if (!pos) return; setIsDrawing(true); setPoints([pos]); setResult(null); };
  const draw = (pos: Point | null) => { if (!pos || !isDrawing || result) return; setPoints(prev => [...prev, pos]); };
  const stopDrawing = () => {
    if (!isDrawing || result) return;
    setIsDrawing(false);
    const evaluation = evaluateLogo(points);
    setResult(evaluation);
    setAttempts(prev => prev + 1);
    if (evaluation.score > bestScore) setBestScore(evaluation.score);
  };

  const handleMouseDown = (e: React.MouseEvent) => { e.preventDefault(); startDrawing(getMousePos(e)); };
  const handleMouseMove = (e: React.MouseEvent) => { e.preventDefault(); draw(getMousePos(e)); };
  const handleMouseUp =   (e: React.MouseEvent) => { e.preventDefault(); stopDrawing(); };
  const handleTouchStart = (e: React.TouchEvent) => { e.preventDefault(); startDrawing(getTouchPos(e)); };
  const handleTouchMove  = (e: React.TouchEvent) => { e.preventDefault(); draw(getTouchPos(e)); };
  const handleTouchEnd   = (e: React.TouchEvent) => { e.preventDefault(); stopDrawing(); };

  const clearCanvas = () => { setPoints([]); setResult(null); };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-white">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 cursor-crosshair"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ zIndex: 1 }}
      />

      <div className="absolute top-4 left-4 flex gap-2 z-10">
        <button onClick={clearCanvas} className="px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition-colors">Clear</button>
        <button onClick={() => setShowGrid(!showGrid)} className="px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition-colors">
          {showGrid ? 'Hide guide' : 'Show guide'}
        </button>
      </div>

      {points.length === 0 && !result && (
        <div className="absolute top-1/3 left-1/2 -
