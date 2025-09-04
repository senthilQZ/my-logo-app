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

  const lastAddRef = useRef<number>(0);
  const ADD_POINT_EVERY_MS = 10;

 const evaluateLogo = (pts: Point[]): EvaluationResult => {
  if (pts.length < 15) return { score: 0, message: 'Draw the complete logo!' };
  const canvas = canvasRef.current;
  if (!canvas) return { score: 0, message: 'Error evaluating drawing' };

  const dpr = window.devicePixelRatio || 1;
  const displayWidth = canvas.width / dpr;
  const displayHeight = canvas.height / dpr;

  // --- bounds / center ---
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const drawingWidth = maxX - minX, drawingHeight = maxY - minY;
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;

  // --- RING detection (coverage + consistency) ---
  const expectedR = Math.min(drawingWidth, drawingHeight) / 3;
  const tolLow = expectedR * 0.75;
  const tolHigh = expectedR * 1.25;

  let onRing: number[] = [];        // distances close to ring
  let totalVar = 0;
  let ringCount = 0;

  // angular coverage buckets
  const BUCKETS = 36;               // 10° per bucket
  const bucketHasPoint = new Array(BUCKETS).fill(0);

  for (const p of pts) {
    const dx = p.x - cx, dy = p.y - cy;
    const r = Math.hypot(dx, dy);
    if (r >= tolLow && r <= tolHigh) {
      ringCount++;
      totalVar += Math.abs(r - expectedR);
      onRing.push(r);
      // angle 0..2π -> bucket
      let ang = Math.atan2(dy, dx);
      if (ang < 0) ang += Math.PI * 2;
      const b = Math.min(BUCKETS - 1, Math.floor((ang / (Math.PI * 2)) * BUCKETS));
      bucketHasPoint[b] = 1;
    }
  }

  let ringCoverage = 0, ringConsistency = 0;
  if (ringCount > 0) {
    ringCoverage = bucketHasPoint.reduce((a, b) => a + b, 0) / BUCKETS;            // 0..1
    const avgVar = totalVar / ringCount;
    ringConsistency = Math.max(0, 1 - (avgVar / expectedR));                        // 0..1
  }
  // ring score needs both coverage & consistency
  const ringScore = Math.min(1, ringCoverage * (0.5 + 0.5 * ringConsistency));

  // --- ARROW detection (straight segments + sharp corners) ---
  // straightness via 3-point windows (i-2, i, i+2)
  let straightSegments = 0;
  let diagonalish = 0;
  const STRAIGHT_THRESHOLD = 0.98;  // stricter than before
  for (let i = 2; i < pts.length - 2; i++) {
    const a = pts[i - 2], b = pts[i], c = pts[i + 2];
    const d1 = Math.hypot(b.x - a.x, b.y - a.y);
    const d2 = Math.hypot(c.x - b.x, c.y - b.y);
    const direct = Math.hypot(c.x - a.x, c.y - a.y);
    const straightness = direct / (d1 + d2 + 1e-6);
    if (straightness > STRAIGHT_THRESHOLD) {
      straightSegments++;
      const ang = Math.atan2(c.y - a.y, c.x - a.x);
      // diagonal: ~30°..150° or -30°..-150° (avoid perfectly horizontal/vertical)
      if (Math.abs(ang) > Math.PI / 6 && Math.abs(ang) < Math.PI * 5 / 6) diagonalish++;
    }
  }
  const straightScore = Math.min(1, straightSegments / (pts.length * 0.12));
  const diagonalScore = Math.min(1, diagonalish / Math.max(1, straightSegments));

  // corner count (a circle has low/steady curvature; an arrow has ≥1 sharp turn)
  let sharpCorners = 0;
  for (let i = 2; i < pts.length - 2; i++) {
    const p0 = pts[i - 1], p1 = pts[i], p2 = pts[i + 1];
    const a1 = Math.atan2(p1.y - p0.y, p1.x - p0.x);
    const a2 = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    let diff = Math.abs(a2 - a1);
    if (diff > Math.PI) diff = 2 * Math.PI - diff;
    if (diff > 0.9) sharpCorners++; // ~> 50° turn qualifies as a corner
  }
  // normalize corners (>=2 corners feels like an arrow shaft+head)
  const cornerScore = Math.min(1, sharpCorners / 3);

  // Arrow requires BOTH straight lines and at least one sharp corner
  let arrowScore = 0;
  if (straightScore > 0.2 && cornerScore > 0.2) {
    arrowScore = (straightScore * 0.5) + (cornerScore * 0.35) + (diagonalScore * 0.15);
  } else {
    arrowScore = Math.max(straightScore, cornerScore) * 0.3; // weak signal if only one present
  }

  // --- completeness gating ---
  const hasGoodRing = ringScore >= 0.4;
  const hasGoodArrow = arrowScore >= 0.35;

  // completeness rewards having BOTH
  let completeness = 0;
  if (hasGoodRing && hasGoodArrow) completeness = Math.min(1, (ringScore + arrowScore) / 1.6);
  else completeness = Math.max(ringScore, arrowScore) * 0.5;

  // --- proportion & size (kept light; not a path to high scores alone) ---
  const canvasArea = displayWidth * displayHeight;
  const drawingArea = drawingWidth * drawingHeight;
  const sizeRatio = drawingArea / canvasArea;
  const aspectRatio = drawingWidth / Math.max(1e-6, drawingHeight);
  let proportion = 1;
  if (sizeRatio < 0.02) proportion *= sizeRatio / 0.02;
  else if (sizeRatio > 0.4) proportion *= 0.8;
  if (aspectRatio < 0.7 || aspectRatio > 1.4) proportion *= 0.85;

  // --- smoothness (small influence; prevents jagged scribbles winning) ---
  let smooth = 0;
  if (pts.length > 20) {
    let dev = 0;
    for (let i = 1; i < pts.length - 1; i++) {
      const a1 = Math.atan2(pts[i].y - pts[i - 1].y, pts[i].x - pts[i - 1].x);
      const a2 = Math.atan2(pts[i + 1].y - pts[i].y, pts[i + 1].x - pts[i].x);
      let diff = Math.abs(a2 - a1);
      if (diff > Math.PI) diff = 2 * Math.PI - diff;
      dev += diff;
    }
    const avg = dev / (pts.length - 2);
    smooth = Math.max(0, 1 - avg);
  }

  // --- final score ---
  let total = (
    completeness * 0.5 +
    ringScore   * 0.25 +
    arrowScore  * 0.15 +
    proportion  * 0.07 +
    smooth      * 0.03
  ) * 100;

  // hard caps to prevent circle-only or arrow-only from ranking high
  if (hasGoodRing && !hasGoodArrow) total = Math.min(total, 50); // circle-only cap
  if (!hasGoodRing && hasGoodArrow) total = Math.min(total, 60); // arrow-only cap

  // bonus for really solid both
  if (hasGoodRing && hasGoodArrow && completeness > 0.7 && smooth > 0.7) total += 3;

  const score = Math.max(0, Math.min(100, Math.round(total)));

  let message = 'Keep trying! Make the ring and arrow.';
  if (hasGoodRing && !hasGoodArrow) message = 'Nice ring! Add a clear arrow.';
  if (!hasGoodRing && hasGoodArrow) message = 'Arrow spotted! Add a proper ring.';
  if (hasGoodRing && hasGoodArrow) {
    if (score >= 95) message = 'Perfect! Master-level logo! 🏆';
    else if (score >= 85) message = 'Excellent! Nearly perfect logo! 🎯';
    else if (score >= 70) message = 'Great work! Very recognizable! 👏';
    else if (score >= 55) message = 'Good job! Nice logo elements! 💪';
    else message = 'Getting there! Strengthen ring + arrow! 🔄';
  }

  return { score, message };
};

  // Canvas sizing (no skew; mobile-safe)
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

        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        canvas.width = Math.max(1, Math.floor(width * dpr));
        canvas.height = Math.max(1, Math.floor(height * dpr));

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);

        drawCanvas();
      }
    });

    ro.observe(container);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Preload SVG
  useEffect(() => {
    const img = new Image();
    img.src = QualiZealLogo;
    img.onload = () => { logoImgRef.current = img; drawCanvas(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard shortcuts
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

  // Redraw on state changes
  useEffect(() => { drawCanvas(); /* eslint-disable-next-line */ }, [points, showGrid, result]);

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);

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

    if (points.length > 1) {
      ctx.strokeStyle = '#111827';
      ctx.lineWidth = 4;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
      ctx.stroke();
    }

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

  const getMousePos = (e: React.MouseEvent): Point | null => {
    const canvas = canvasRef.current; if (!canvas) return null;
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const getTouchPos = (e: React.TouchEvent): Point | null => {
    const canvas = canvasRef.current; if (!canvas || e.touches.length === 0) return null;
    const r = canvas.getBoundingClientRect();
    return { x: e.touches[0].clientX - r.left, y: e.touches[0].clientY - r.top };
  };

  const startDrawing = (pos: Point | null) => { if (!pos) return; setIsDrawing(true); setResult(null); setPoints([pos]); };
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

      <div className="qz-controls">
        <button className="qz-btn" onClick={clearCanvas} title="Clear your current drawing but keep scores">Clear</button>
        <button className="qz-btn qz-btn--primary" onClick={resetAll} title="Reset everything (scores & attempts)">Reset</button>
        <button className="qz-btn" onClick={() => setShowGrid(s => !s)} title="Toggle grid and sample logo">
          {showGrid ? 'Hide guide' : 'Show guide'}
        </button>
      </div>

      {points.length === 0 && !result && (
        <div className="qz-intro">
          <h1>Draw the perfect logo</h1>
          <p>QualiZealots!! Please click and drag to draw the logo</p>
          <p>Tip: Use the grid and aim for smooth strokes</p>
          <p>Best score: {bestScore} | Attempts: {attempts}</p>
        </div>
      )}

      {result && (
        <div className="qz-cta">
          <button className="qz-btn qz-btn--primary" onClick={clearCanvas}>Try again</button>
        </div>
      )}
    </div>
  );
}
