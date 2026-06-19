import { useRef, useEffect } from 'react';
import type { GPXPoint } from '../types';

interface ElevationProfileProps {
  points: GPXPoint[];
  hoveredPoint: GPXPoint | null;
  onHoverPoint: (pt: GPXPoint | null) => void;
}

export default function ElevationProfile({ points, hoveredPoint, onHoverPoint }: ElevationProfileProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || points.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI displays
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = 100 * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = 100;
    const padding = { top: 10, right: 10, bottom: 20, left: 35 };

    ctx.clearRect(0, 0, width, height);

    // Find min/max values
    const minEle = Math.min(...points.map(p => p.ele));
    const maxEle = Math.max(...points.map(p => p.ele));
    const maxDist = points[points.length - 1].dist;

    const eleRange = maxEle - minEle || 1;

    // Helper to map GPX point to canvas coords
    const getX = (dist: number) => {
      return padding.left + (dist / maxDist) * (width - padding.left - padding.right);
    };
    const getY = (ele: number) => {
      return height - padding.bottom - ((ele - minEle) / eleRange) * (height - padding.top - padding.bottom);
    };

    // Draw background grid lines (y-axis)
    ctx.strokeStyle = '#1e1e24';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#6b7280';
    ctx.font = '9px Outfit';
    
    // Draw 3 horizontal helper lines
    const yGridCount = 3;
    for (let i = 0; i < yGridCount; i++) {
      const val = minEle + (eleRange / (yGridCount - 1)) * i;
      const y = getY(val);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
      ctx.fillText(`${Math.round(val)}m`, 5, y + 3);
    }

    // Draw cumulative distance markers on x-axis
    const xMarkerCount = 4;
    for (let i = 0; i < xMarkerCount; i++) {
      const distVal = (maxDist / (xMarkerCount - 1)) * i;
      const x = getX(distVal);
      ctx.fillText(`${Math.round(distVal)}km`, x - 10, height - 5);
    }

    // Draw elevation area gradient
    const gradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
    gradient.addColorStop(0, 'rgba(163, 230, 53, 0.3)');
    gradient.addColorStop(1, 'rgba(163, 230, 53, 0.0)');

    ctx.beginPath();
    ctx.moveTo(getX(points[0].dist), getY(points[0].ele));
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(getX(points[i].dist), getY(points[i].ele));
    }
    ctx.lineTo(getX(points[points.length - 1].dist), height - padding.bottom);
    ctx.lineTo(getX(points[0].dist), height - padding.bottom);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw line
    ctx.beginPath();
    ctx.moveTo(getX(points[0].dist), getY(points[0].ele));
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(getX(points[i].dist), getY(points[i].ele));
    }
    ctx.strokeStyle = '#a3e635';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Draw hovered point indicator
    if (hoveredPoint) {
      const x = getX(hoveredPoint.dist);
      const y = getY(hoveredPoint.ele);

      // Vertical line
      ctx.strokeStyle = '#a3e635';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, height - padding.bottom);
      ctx.stroke();
      ctx.setLineDash([]); // Reset dash

      // Highlight dot
      ctx.fillStyle = '#a3e635';
      ctx.strokeStyle = '#0a0a0c';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }, [points, hoveredPoint]);

  // Handle canvas mouse move to select nearest GPX point
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || points.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const paddingLeft = 35;
    const paddingRight = 10;
    const maxDist = points[points.length - 1].dist;

    // Calculate distance on route corresponding to mouse X
    const innerWidth = rect.width - paddingLeft - paddingRight;
    const pct = Math.max(0, Math.min(1, (mouseX - paddingLeft) / innerWidth));
    const targetDist = pct * maxDist;

    // Find closest point in points array
    let closest = points[0];
    let minDiff = Infinity;
    for (const pt of points) {
      const diff = Math.abs(pt.dist - targetDist);
      if (diff < minDiff) {
        minDiff = diff;
        closest = pt;
      }
    }
    onHoverPoint(closest);
  };

  const handleMouseLeave = () => {
    onHoverPoint(null);
  };

  return (
    <div className="gpx-elevation-profile-container" style={{ margin: '1rem 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Route Elevation Profile</span>
        {hoveredPoint && (
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-lime)' }}>
            {hoveredPoint.dist} km | {Math.round(hoveredPoint.ele)}m
          </span>
        )}
      </div>
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ width: '100%', height: '100px', cursor: 'crosshair', backgroundColor: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}
      />
    </div>
  );
}
