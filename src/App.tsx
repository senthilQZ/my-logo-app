import React, { useEffect, useRef, useState } from 'react';
import QualiZealLogo from './QualiZeal Monogram Colored.svg';
import './App.css';

interface Point { x: number; y: number; }
interface EvaluationResult { score: number; message: string; }

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const logoImgRef = useRef<HTMLImageElement | null>(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [points, setPoints] = useState<Point[]>([]);
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [bestScore, setBestScore] = useState(0);
  const [attempts, setAttempts] = useState(0);

  // tiny throttle for smoother lines
  const lastAddRef = useRef<number>(0);
  const ADD_POINT_EVERY_MS = 10;

  // ---------- scoring ----------
  const evaluateLogo = (pts: Point[]): EvaluationResult => {
    if (pts.length < 15) return { score: 0, message: 'Draw the complete logo!' };
    const canvas = canvasRef.current;
    if (!canvas) return { score: 0, message: 'Error evaluating drawing' };

    const dpr = window.devicePixelRatio || 1;
    const displayWidth = canvas.width / dpr;
    const displayHeight = canvas.height / dpr;

    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const drawingWidth = maxX - minX, drawingHeight = maxY - minY;
    const centerX = (minX + maxX) / 2, centerY = (minY + maxY) / 2;

    // circularity
    let circularityScore = 0, circularPoints = 0, totalVar = 0;
    const expectedRadius = Math.min(drawingWidth, drawingHeight) / 3;
    for (const p of pts) {
      const d = Math.hypot(p.x - centerX, p.y - centerY);
      if (d >= expectedRadius * 0.6 && d <= expectedRadius * 1.4) {
        circularPoints++; totalVar += Math.abs(d - expectedRadius);
      }
    }
    if (circularPoints) {
      const avgVar = totalVar / circularPoints;
      const consistency = Math.max(0, 1 - (avgVar / expectedRadius));
      circularityScore = (circularPoints / pts.length) * consistency;
    }

    // arrow/lines
    let straightSegments = 0, diagonalSegments = 0;
    for (let i = 3; i < pts.length - 3; i++) {
      const p1 = pts[i - 3], p2 = pts[i], p3 = pts[i + 3];
      const d1 = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const d2 = Math.hypot(p3.x - p2.x, p3.y - p2.y);
      const direct = Math.hypot(p3.x - p1.x, p3.y - p1.y);
      const straightness = direct / (d1 + d2);
      if (straightness > 0.95) {
        straightSegments++;
        const angle = Math.atan2(p3.y - p1.y, p3.x - p1.x);
        if (Math.abs(angle) > Math.PI / 6 && Math.abs(angle) < Math.PI * 5 / 6) diagonalSegments++;
      }
    }
    const arrowScore = Math.min(1, (straightSegments / (pts.length * 0.15)) * (1 + diagonalSegments / 10));

    // completeness
    let completenessScore = 0;
    if (circularityScore > 0.2 && arrowScore > 0.1) {
      completenessScore = Math.min(circularityScore + arrowScore, 1);
    } else {
      completenessScore = Math.max(circularityScore, arrowScore) * 0.6;
    }

    // proportions
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
    if (pts.length > 20) {
      let totalDeviation = 0;
      for (let i = 1; i < pts.length - 1; i++) {
        const a1 = Math.atan2(pts[i].y - pts[i - 1].y, pts[i].x - pts[i - 1].x);
        const a2 = Math.atan2(pts[i + 1].y - pts[i].y, pts[i + 1].x - pts[i].x);
        let diff = Math.abs(a2 - a1);
        if (diff > Math.PI) diff = 2 * Math.PI - diff;
        totalDeviation += diff;
      }
      const avgDeviation = totalDeviation / (pts.length - 2);
      smoothnessScore = Math.max(0, 1 - avgDeviation);
    }

    let totalScore = Math.round((
      completenessScore * 0.45 +
      circularityScore  * 0.25 +
      arrowScore        * 0.15 +
      proportionScore   * 0.10 +
      smoothnessScore   * 0.05
    ) * 100);
    if (smoothnessScore > 0.8 && completenessScore > 0.7) totalScore += 5;
    totalScore = Math.max(0, Math.min(100, totalScore));

    let message = "Keep trying! Focus on the circular ring! 🎨";
    if (totalScore >= 95) message = "Perfect! Master-level logo! 🏆";
    else if (totalScore >= 85) message = "Excellent! Nearly perfect logo! 🎯";
    else if (totalScore >= 70) message = "Great work! Very recognizable! 👏";
    else if (totalScore >= 55) message = "Good job! Nice logo elements! 💪";
    else if (totalScore >= 40) message = "Not bad! Keep practicing! 🖊️";
    else if (totalScore >= 25) message = "Getting there! Try the ring + arrow! 🔄";

    return { score: totalScore, message };
  };

  // ---------- canvas sizing (mobile-safe) ----------
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const dpr = window.devicePixelRatio || 1;

        // CSS size
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        // Buffer size
        canvas.width = Math.max(1, Math.floor(width * dpr));
        canvas.height = Math.max(1, Math.floor(height * dpr));

        // Reset transform, then scale—prevents skew/compounding
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);

        drawCanvas();
      }
    });

    ro.observe(container);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- preload SVG ----------
  useEffect(() => {
    const img = new Image();
    img.src = QualiZealLogo;
    img.onload = () => { logoImgRef.current = img; drawCanvas(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- keyboard shortcuts ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'c') { e.preventDefault(); clearCanvas(); }
      if (k === 'r') { e.preventDefault(); resetAll(); }
      if (k === 'g') { e.preventDefault(); setShowGrid(s => !s); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ---------- draw routine ----------
  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    // clear
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);

    // grid + guide
    if (showGrid) {
      ctx.strokeStyle = '#f0f0f0';
      ctx.lineWidth = 1;
      const grid = 40;
      for (let x = 0; x < width; x += grid) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
      for (let y = 0; y < height; y += grid) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }

      if (points.length === 0 && logoImgRef.current) {
        const img = logoImgRef.current;
        const target = Math.min(width, height) * 0.22;
        const aspect = (img.width || 1) / (img.height || 1);
        let w = target, h = target;
        if (aspect >= 1) { h = target / aspect; } else { w = target * aspect; }
        const cx = width / 2, cy = height / 2;

        ctx.save();
        ctx.globalAlpha = 0.95;
        ctx.shadowColor = 'rgba(0,0,0,0.10)';
        ctx.shadowBlur = 10;
        ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
        ctx.restore();

        ctx.fillStyle = '#666';
        ctx.font = '16px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText("Draw QualiZeal's logo", cx, cy - target * 0.75);
      }
    }

    // user lines
    if (points.length > 1) {
      ctx.strokeStyle = '#000';
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
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#000';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 72px system-ui, -apple-system, sans-serif';
      ctx.fillText(`${result.score}/100`, width / 2, height / 2 - 50);
      ctx.font = '24px system-ui, -apple-system, sans-serif';
      ctx.fillText(result.message, width / 2, height / 2 + 30);
      ctx.font = '18px system-ui, -apple-system, sans-serif';
      ctx.fillText(`Best score: ${bestScore} | Attempts: ${attempts}`, width / 2, height / 2 + 70);
    }
  };

  // ---------- pointer helpers ----------
  const getMousePos = (e: React.MouseEvent): Point | null => {
    const canvas = canvasRef.current; if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const getTouchPos = (e: React.TouchEvent): Point | null => {
    const canvas = canvasRef.current; if (!canvas || e.touches.length === 0) return null;
    const rect = canvas.getBoundingClientRect();
    return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
  };

  // ---------- handlers ----------
  const startDrawing = (pos: Point | null) => {
    if (!pos) return;
    setIsDrawing(true);
    setResult(null);
    setPoints([pos]);
  };
  const draw = (pos: Point | null) => {
    if (!pos || !isDrawing || result) return;
    const now = performance.now();
    if (now - lastAddRef.current < ADD_POINT_EVERY_MS) return;
    lastAddRef.current = now;
    setPoints(prev => [...prev, pos]);
  };
  const stopDrawing = () => {
    if (!isDrawing || result) return;
    setIsDrawing(false);
    const r = evaluateLogo(points);
    setResult(r);
    setAttempts(a => a + 1);
    if (r.score > bestScore) setBestScore(r.score);
  };
  const clearCanvas = () => { setPoints([]); setResult(null); };
  const resetAll = () => {
    setPoints([]);
    setResult(null);
    setAttempts(0);
    setBestScore(0);
    setShowGrid(true);
    setIsDrawing(false);
  };

  return (
    <div ref={containerRef} className="qz-app">
      <canvas
        ref={canvasRef}
        onMouseDown={(e) => { e.preventDefault(); startDrawing(getMousePos(e)); }}
        onMouseMove={(e) => { e.preventDefault(); draw(getMousePos(e)); }}
        onMouseUp={(e) => { e.preventDefault(); stopDrawing(); }}
        onMouseLeave={(e) => { e.preventDefault(); stopDrawing(); }}
        onTouchStart={(e) => { e.preventDefault(); startDrawing(getTouchPos(e)); }}
        onTouchMove={(e) => { e.preventDefault(); draw(getTouchPos(e)); }}
        onTouchEnd={(e) => { e.preventDefault(); stopDrawing(); }}
      />

      {/* Controls */}
      <div className="qz-controls">
        <button className="qz-btn" onClick={clearCanvas} title="Clear your current drawing but keep scores">Clear</button>
        <button className="qz-btn qz-btn--primary" onClick={resetAll} title="Reset everything (scores & attempts)">Reset</button>
        <button className="qz-btn" onClick={() => setShowGrid(s => !s)} title="Toggle grid and sample logo">
          {showGrid ? 'Hide guide' : 'Show guide'}
        </button>
      </div>

      {/* Intro card */}
      {points.length === 0 && !result && (
        <div className="qz-intro">
          <h1>Draw the perfect logo</h1>
          <p>QualiZealots!! Please click and drag to draw the logo</p>
          <p>Tip: Use the grid and aim for smooth strokes</p>
          <p>Best score: {bestScore} | Attempts: {attempts}</p>
        </div>
      )}

      {/* Try again CTA */}
      {result && (
        <div className="qz-cta">
          <button className="qz-btn qz-btn--primary" onClick={clearCanvas}>Try again</button>
        </div>
      )}
    </div>
  );
}
