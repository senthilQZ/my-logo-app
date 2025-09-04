import React, { useState, useRef, useEffect } from 'react';

export default function DrawPerfectLogo() {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [points, setPoints] = useState([]);
  const [result, setResult] = useState(null);
  const [showGrid, setShowGrid] = useState(true);
  const [bestScore, setBestScore] = useState(0);
  const [attempts, setAttempts] = useState(0);
  
  // Function to evaluate QualiZeal logo quality
  const evaluateLogo = (points) => {
    if (points.length < 15) {
      return { score: 0, message: "Draw the complete QualiZeal logo!" };
    }

    const canvas = canvasRef.current;
    if (!canvas) return { score: 0, message: "Error evaluating drawing" };
    
    const displayWidth = canvas.width / (window.devicePixelRatio || 1);
    const displayHeight = canvas.height / (window.devicePixelRatio || 1);

    // Calculate bounding box of the drawing
    let minX = Math.min(...points.map(p => p.x));
    let maxX = Math.max(...points.map(p => p.x));
    let minY = Math.min(...points.map(p => p.y));
    let maxY = Math.max(...points.map(p => p.y));
    
    const drawingWidth = maxX - minX;
    const drawingHeight = maxY - minY;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    // Check for circular elements (Q symbol) - more strict
    let circularityScore = 0;
    const expectedRadius = Math.min(drawingWidth, drawingHeight) / 3;
    let circularPoints = 0;
    let totalRadiusVariance = 0;
    
    for (const point of points) {
      const distFromCenter = Math.sqrt(
        Math.pow(point.x - centerX, 2) + 
        Math.pow(point.y - centerY, 2)
      );
      
      // More precise circular detection
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

    // Check for arrow/line elements - more demanding
    let arrowScore = 0;
    let straightSegments = 0;
    let diagonalSegments = 0;
    
    for (let i = 3; i < points.length - 3; i++) {
      const p1 = points[i - 3];
      const p2 = points[i];
      const p3 = points[i + 3];
      
      // Calculate straightness over longer segments
      const dist1 = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
      const dist2 = Math.sqrt(Math.pow(p3.x - p2.x, 2) + Math.pow(p3.y - p2.y, 2));
      const directDist = Math.sqrt(Math.pow(p3.x - p1.x, 2) + Math.pow(p3.y - p1.y, 2));
      
      // Check if it's a straight line (minimal deviation)
      const straightness = directDist / (dist1 + dist2);
      if (straightness > 0.95) {
        straightSegments++;
        
        // Check for diagonal lines (arrows)
        const angle = Math.atan2(p3.y - p1.y, p3.x - p1.x);
        if (Math.abs(angle) > Math.PI/6 && Math.abs(angle) < Math.PI*5/6) {
          diagonalSegments++;
        }
      }
    }
    
    arrowScore = Math.min(1, (straightSegments / (points.length * 0.15)) * (1 + diagonalSegments / 10));

    // Logo completeness - requires both circular and linear elements
    let completenessScore = 0;
    if (circularityScore > 0.2 && arrowScore > 0.1) {
      completenessScore = Math.min(circularityScore + arrowScore, 1);
    } else {
      completenessScore = Math.max(circularityScore, arrowScore) * 0.6; // Penalty for missing elements
    }

    // Size and proportion requirements - more strict
    const canvasArea = displayWidth * displayHeight;
    const drawingArea = drawingWidth * drawingHeight;
    const sizeRatio = drawingArea / canvasArea;
    const aspectRatio = drawingWidth / drawingHeight;
    
    let proportionScore = 1;
    
    // Size penalties
    if (sizeRatio < 0.02) {
      proportionScore *= sizeRatio / 0.02; // Too small
    } else if (sizeRatio > 0.4) {
      proportionScore *= 0.7; // Too big
    }
    
    // Aspect ratio (Q symbol should be roughly square)
    if (aspectRatio < 0.7 || aspectRatio > 1.4) {
      proportionScore *= 0.8; // Not square enough
    }

    // Precision bonus - smooth drawing gets extra points
    let smoothnessScore = 0;
    if (points.length > 20) {
      let totalDeviation = 0;
      for (let i = 1; i < points.length - 1; i++) {
        const p1 = points[i - 1];
        const p2 = points[i];
        const p3 = points[i + 1];
        
        // Calculate curvature/jerkiness
        const angle1 = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        const angle2 = Math.atan2(p3.y - p2.y, p3.x - p2.x);
        let angleDiff = Math.abs(angle2 - angle1);
        if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
        
        totalDeviation += angleDiff;
      }
      
      const avgDeviation = totalDeviation / (points.length - 2);
      smoothnessScore = Math.max(0, 1 - avgDeviation);
    }

    // Final score calculation with higher standards
    let totalScore = Math.round((
      completenessScore * 0.45 +
      circularityScore * 0.25 +
      arrowScore * 0.15 +
      proportionScore * 0.10 +
      smoothnessScore * 0.05
    ) * 100);

    // Remove easy bonus points, add precision bonus
    if (smoothnessScore > 0.8 && completenessScore > 0.7) {
      totalScore += 5; // Only for really good drawings
    }
    
    totalScore = Math.max(0, Math.min(100, totalScore));

    // Adjusted messages for new scoring
    let message;
    if (totalScore >= 95) {
      message = "Perfect! Master-level QualiZeal logo! 🏆";
    } else if (totalScore >= 85) {
      message = "Excellent! Nearly perfect logo! 🎯";
    } else if (totalScore >= 70) {
      message = "Great work! Very recognizable! 👏";
    } else if (totalScore >= 55) {
      message = "Good job! Nice logo elements! 💪";
    } else if (totalScore >= 40) {
      message = "Not bad! Keep practicing! 🖊️";
    } else if (totalScore >= 25) {
      message = "Getting there! Try the Q + arrow! 🔄";
    } else {
      message = "Keep trying! Focus on the Q symbol! 🎨";
    }

    return { score: totalScore, message };
  };

  useEffect(() => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      // Set canvas size and scale for high DPI displays
      const scale = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * scale;
      canvas.height = window.innerHeight * scale;
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
      ctx.scale(scale, scale);
      
      const handleResize = () => {
        const scale = window.devicePixelRatio || 1;
        canvas.width = window.innerWidth * scale;
        canvas.height = window.innerHeight * scale;
        canvas.style.width = window.innerWidth + 'px';
        canvas.style.height = window.innerHeight + 'px';
        ctx.scale(scale, scale);
        drawCanvas();
      };
      
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  useEffect(() => {
    drawCanvas();
  }, [points, showGrid, result]);

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const displayWidth = canvas.width / (window.devicePixelRatio || 1);
    const displayHeight = canvas.height / (window.devicePixelRatio || 1);
    
    // Clear canvas
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, displayWidth, displayHeight);
    
    // Draw reference logo outline (optional guide)
    if (showGrid && points.length === 0) {
      const centerX = displayWidth / 2;
      const centerY = displayHeight / 2;
      const logoWidth = Math.min(displayWidth, displayHeight) * 0.4;
      const logoHeight = logoWidth * 0.3;
      
      ctx.strokeStyle = '#e0e0e0';
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 10]);
      
      // Draw reference rectangle for logo placement
      ctx.strokeRect(
        centerX - logoWidth/2, 
        centerY - logoHeight/2, 
        logoWidth, 
        logoHeight
      );
      
      // Add QualiZeal Q symbol reference
      ctx.strokeStyle = '#d0d0d0';
      ctx.lineWidth = 2;
      
      // Draw the "Q" symbol hint (circular Q with arrow)
      const qX = centerX;
      const qY = centerY;
      
      // Draw circular Q
      ctx.beginPath();
      ctx.arc(qX, qY, 20, 0, 2 * Math.PI);
      ctx.stroke();
      
      // Draw arrow through Q
      ctx.beginPath();
      ctx.moveTo(qX - 10, qY + 10);
      ctx.lineTo(qX + 10, qY - 10);
      ctx.lineTo(qX + 7, qY - 7);
      ctx.moveTo(qX + 10, qY - 10);
      ctx.lineTo(qX + 7, qY - 13);
      ctx.stroke();
      
      ctx.setLineDash([]);
    }
    
    // Draw grid if enabled
    if (showGrid) {
      ctx.strokeStyle = '#f0f0f0';
      ctx.lineWidth = 1;
      const gridSize = 40;
      
      for (let x = 0; x < displayWidth; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, displayHeight);
        ctx.stroke();
      }
      
      for (let y = 0; y < displayHeight; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(displayWidth, y);
        ctx.stroke();
      }
    }
    
    // Draw the logo
    if (points.length > 1) {
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      
      ctx.stroke();
    }
    
    // Draw result overlay if exists
    if (result) {
      // Semi-transparent overlay
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fillRect(0, 0, displayWidth, displayHeight);
      
      // Score display
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 72px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      const scoreText = `${result.score}/100`;
      ctx.fillText(scoreText, displayWidth / 2, displayHeight / 2 - 50);
      
      // Message
      ctx.font = '24px system-ui, -apple-system, sans-serif';
      ctx.fillText(result.message, displayWidth / 2, displayHeight / 2 + 30);
      
      // Stats
      ctx.font = '18px system-ui, -apple-system, sans-serif';
      ctx.fillText(`Best score: ${bestScore} | Attempts: ${attempts}`, displayWidth / 2, displayHeight / 2 + 70);
    }
  };

  const getMousePos = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const getTouchPos = (e) => {
    if (e.touches.length === 0) return null;
    const canvas = canvasRef.current;
    if (!canvas) return null;
    
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.touches[0].clientX - rect.left,
      y: e.touches[0].clientY - rect.top
    };
  };

  const startDrawing = (pos) => {
    if (!pos) return;
    setIsDrawing(true);
    setPoints([pos]);
    setResult(null);
  };

  const draw = (pos) => {
    if (!pos || !isDrawing || result) return;
    setPoints(prev => [...prev, pos]);
  };

  const stopDrawing = () => {
    if (!isDrawing || result) return;
    setIsDrawing(false);
    
    const evaluation = evaluateLogo(points);
    setResult(evaluation);
    setAttempts(prev => prev + 1);
    
    if (evaluation.score > bestScore) {
      setBestScore(evaluation.score);
    }
  };

  const handleMouseDown = (e) => {
    e.preventDefault();
    startDrawing(getMousePos(e));
  };

  const handleMouseMove = (e) => {
    e.preventDefault();
    draw(getMousePos(e));
  };

  const handleMouseUp = (e) => {
    e.preventDefault();
    stopDrawing();
  };

  const handleTouchStart = (e) => {
    e.preventDefault();
    startDrawing(getTouchPos(e));
  };

  const handleTouchMove = (e) => {
    e.preventDefault();
    draw(getTouchPos(e));
  };

  const handleTouchEnd = (e) => {
    e.preventDefault();
    stopDrawing();
  };

  const clearCanvas = () => {
    setPoints([]);
    setResult(null);
  };

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
      />
      
      {/* Controls */}
      <div className="absolute top-4 left-4 flex gap-2">
        <button
          onClick={clearCanvas}
          className="px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
        >
          Clear
        </button>
        <button
          onClick={() => setShowGrid(!showGrid)}
          className="px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
        >
          {showGrid ? 'Hide guide' : 'Show guide'}
        </button>
      </div>
      
      {/* Instructions */}
      {points.length === 0 && !result && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
          <h1 className="text-4xl font-bold mb-4">Draw the perfect logo</h1>
          <p className="text-gray-600 text-lg">Click and drag to begin</p>
          <p className="text-gray-500 text-sm mt-2">Tip: Include both text and symbol elements</p>
          <p className="text-gray-500 text-sm mt-1">Best score: {bestScore} | Attempts: {attempts}</p>
        </div>
      )}
      
      {/* Try Again button */}
      {result && (
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
          <button
            onClick={clearCanvas}
            className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}