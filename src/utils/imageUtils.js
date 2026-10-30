/**
 * Utility to generate fallback SVG product placeholders
 */
export function getImageSVG(name) {
  const initial = (name || '').replace(/[^a-zA-Z0-9]/g, '').charAt(0).toUpperCase() || 'F';
  const colors = [
    ['#6257f5', '#8b7cf7'],
    ['#f59e0b', '#fbbf24'],
    ['#10b981', '#34d399'],
    ['#ef4444', '#f87171'],
    ['#8b5cf6', '#a78bfa'],
    ['#ec4899', '#f472b6'],
    ['#06b6d4', '#22d3ee'],
    ['#f97316', '#fb923c'],
  ];
  const [start, end] = colors[(name || '').length % colors.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${start}" stop-opacity="0.15"/><stop offset="100%" stop-color="${end}" stop-opacity="0.28"/></linearGradient></defs><rect width="400" height="400" fill="url(#g)" rx="40"/><circle cx="200" cy="200" r="112" fill="white" fill-opacity="0.42"/><text x="200" y="225" font-size="128" text-anchor="middle" fill="${start}" font-family="Arial" font-weight="bold">${initial}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
