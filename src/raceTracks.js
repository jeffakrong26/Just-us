// ---------- Track geometry: rounded-polygon circuits ----------
// Each track is a closed polygon of corners with a per-corner rounding
// radius. A small radius produces a tight hairpin; a large radius produces
// a gentle sweeping curve. Straight lines connect the rounded corners. This
// gives exact control over which single corner is the mandatory hairpin
// without hoping spline smoothing happens to land somewhere sharp.

function sub(a, b) { return { x: a.x - b.x, y: a.y - b.y }; }
function add(a, b) { return { x: a.x + b.x, y: a.y + b.y }; }
function scale(a, s) { return { x: a.x * s, y: a.y * s }; }
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function norm(a) {
  const len = Math.hypot(a.x, a.y) || 1;
  return { x: a.x / len, y: a.y / len };
}

// Builds the SVG path `d` string, plus the entry/exit anchor point for each
// corner (needed later to measure arc-length fractions for that corner).
export function roundedPolygonPath(corners, radii) {
  const n = corners.length;
  const get = (i) => corners[((i % n) + n) % n];
  const radiusFor = (i) => radii[((i % n) + n) % n];

  const entryPoints = [];
  const exitPoints = [];
  for (let i = 0; i < n; i++) {
    const prev = get(i - 1);
    const cur = get(i);
    const next = get(i + 1);
    const toPrev = norm(sub(prev, cur));
    const toNext = norm(sub(next, cur));
    const r = Math.min(radiusFor(i), dist(prev, cur) * 0.45, dist(cur, next) * 0.45);
    entryPoints[i] = add(cur, scale(toPrev, r));
    exitPoints[i] = add(cur, scale(toNext, r));
  }

  let d = `M ${exitPoints[n - 1].x} ${exitPoints[n - 1].y} `;
  for (let i = 0; i < n; i++) {
    d += `L ${entryPoints[i].x} ${entryPoints[i].y} `;
    d += `Q ${get(i).x} ${get(i).y}, ${exitPoints[i].x} ${exitPoints[i].y} `;
  }
  d += "Z";
  return { d, entryPoints, exitPoints };
}

// Measures arc-length fraction (0-1) at each corner's entry/exit point using
// a mounted (possibly hidden) SVGPathElement as the geometry oracle. Called
// once when a track is selected, not during live gameplay.
export function measureCornerFractions(pathEl, corners, radii) {
  const n = corners.length;
  const { entryPoints, exitPoints } = roundedPolygonPath(corners, radii);
  const originalD = pathEl.getAttribute("d");

  const measureUpTo = (idx, atEntry) => {
    let d = `M ${exitPoints[n - 1].x} ${exitPoints[n - 1].y} `;
    for (let i = 0; i < n; i++) {
      d += `L ${entryPoints[i].x} ${entryPoints[i].y} `;
      if (i === idx && atEntry) break;
      d += `Q ${corners[i].x} ${corners[i].y}, ${exitPoints[i].x} ${exitPoints[i].y} `;
      if (i === idx && !atEntry) break;
    }
    pathEl.setAttribute("d", d);
    return pathEl.getTotalLength();
  };

  pathEl.setAttribute("d", roundedPolygonPath(corners, radii).d);
  const totalLength = pathEl.getTotalLength();

  const entryFractions = [];
  const exitFractions = [];
  for (let i = 0; i < n; i++) {
    entryFractions[i] = measureUpTo(i, true) / totalLength;
    exitFractions[i] = measureUpTo(i, false) / totalLength;
  }

  pathEl.setAttribute("d", originalD);
  return { entryFractions, exitFractions, totalLength };
}

export const VIEWBOX = { w: 1000, h: 650 };

export const TRACKS = [
  {
    id: "harbor",
    name: "Harbor Loop",
    corners: [
      { x: 150, y: 150 }, { x: 850, y: 150 }, { x: 950, y: 325 },
      { x: 850, y: 500 }, { x: 150, y: 500 }, { x: 50, y: 325 },
    ],
    radii: [110, 110, 130, 110, 110, 35],
    hairpinIndex: 5,
    softTurnIndices: [1, 3],
    maxSafeSpeed: 0.5,
  },
  {
    id: "canyon",
    name: "Canyon Switchback",
    corners: [
      { x: 120, y: 120 }, { x: 500, y: 90 }, { x: 880, y: 150 },
      { x: 920, y: 350 }, { x: 700, y: 520 }, { x: 350, y: 560 }, { x: 90, y: 400 },
    ],
    radii: [100, 90, 110, 30, 90, 100, 90],
    hairpinIndex: 3,
    softTurnIndices: [1, 5],
    maxSafeSpeed: 0.45,
  },
  {
    id: "rooftop",
    name: "Rooftop Octagon",
    corners: [
      { x: 200, y: 100 }, { x: 800, y: 100 }, { x: 920, y: 250 }, { x: 920, y: 450 },
      { x: 800, y: 560 }, { x: 200, y: 560 }, { x: 80, y: 450 }, { x: 80, y: 250 },
    ],
    radii: [120, 120, 120, 120, 35, 120, 120, 120],
    hairpinIndex: 4,
    softTurnIndices: [1, 3, 6],
    maxSafeSpeed: 0.5,
  },
  {
    id: "desert",
    name: "Desert Spiral",
    corners: [
      { x: 150, y: 300 }, { x: 400, y: 120 }, { x: 750, y: 140 },
      { x: 920, y: 320 }, { x: 650, y: 540 }, { x: 300, y: 520 },
    ],
    radii: [35, 90, 110, 100, 90, 100],
    hairpinIndex: 0,
    softTurnIndices: [2, 4],
    maxSafeSpeed: 0.48,
  },
  {
    id: "coastal",
    name: "Coastal Snake",
    corners: [
      { x: 120, y: 150 }, { x: 400, y: 110 }, { x: 680, y: 180 }, { x: 900, y: 140 },
      { x: 940, y: 350 }, { x: 760, y: 520 }, { x: 430, y: 560 }, { x: 150, y: 480 },
    ],
    radii: [90, 80, 90, 30, 110, 90, 90, 90],
    hairpinIndex: 3,
    softTurnIndices: [1, 5, 6],
    maxSafeSpeed: 0.45,
  },
];

export const CAR_COLOR_POOL = [
  { id: "coral", hex: "#FF6F5E", name: "Coral" },
  { id: "teal", hex: "#35C9C1", name: "Teal" },
  { id: "gold", hex: "#FFC15E", name: "Gold" },
  { id: "berry", hex: "#E85D9E", name: "Berry" },
  { id: "sky", hex: "#5B9BD5", name: "Sky" },
  { id: "lavender", hex: "#9B87F5", name: "Lavender" },
  { id: "mint", hex: "#6FE3A6", name: "Mint" },
  { id: "sunset", hex: "#FF9E5E", name: "Sunset" },
  { id: "grape", hex: "#B45DE8", name: "Grape" },
  { id: "steel", hex: "#8FA3D9", name: "Steel" },
];

export function pickRaceCars(count = 5) {
  const shuffled = [...CAR_COLOR_POOL].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
