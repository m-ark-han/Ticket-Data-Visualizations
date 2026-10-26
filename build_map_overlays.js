// Extract the four geographic figure layers from the plotted-value source.
// Run with: node build_map_overlays.js
const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const specs = JSON.parse(fs.readFileSync(path.join(root, 'data', 'figure-values.json'), 'utf8'));
const result = {};
for (const id of ['F16', 'F24', 'F25', 'F26']) {
  result[id] = specs[id].data.map(trace => ({
    name: trace.name,
    points: trace.x.map((lon, i) => ({
      lon,
      lat: trace.y[i],
      value: Array.isArray(trace.marker?.color) ? trace.marker.color[i] : null,
      size: Array.isArray(trace.marker?.size) ? trace.marker.size[i] : trace.marker?.size || null,
      detail: (trace.customdata?.[i] || trace.text?.[i] || '').replace(/<br\s*\/?\s*>/gi, '\n').replace(/<[^>]+>/g, '')
    }))
  }));
}
fs.writeFileSync(path.join(root, 'data', 'map-overlays.json'), JSON.stringify(result));
