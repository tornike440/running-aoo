const express = require('express');
const bodyParser = require('body-parser');
const h3 = require('h3-js');
const Database = require('better-sqlite3');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'db', 'territory.db');
const H3_RES = 9;

if (!fs.existsSync(path.join(__dirname, 'db'))) {
  fs.mkdirSync(path.join(__dirname, 'db'));
}
const db = new Database(DB_PATH);
db.exec(`
CREATE TABLE IF NOT EXISTS hex_control (
  h3_index TEXT PRIMARY KEY,
  owner_user_id TEXT,
  control_score INTEGER DEFAULT 0,
  last_defended_at TEXT
);
`);

const upsertStmt = db.prepare(`
INSERT INTO hex_control (h3_index, owner_user_id, control_score, last_defended_at)
VALUES (@h3_index, @owner_user_id, @control_score, datetime('now'))
ON CONFLICT(h3_index) DO UPDATE SET
  control_score = hex_control.control_score + excluded.control_score,
  owner_user_id = excluded.owner_user_id,
  last_defended_at = datetime('now')
;
`);

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

app.get('/health', (req, res) => res.json({status: 'ok'}));

app.post('/runs', (req, res) => {
  try {
    const payload = req.body;
    if (!payload || !payload.user_id || !Array.isArray(payload.points) || payload.points.length < 3) {
      return res.status(400).json({error: 'Invalid payload'});
    }
    const indexes = payload.points.map(p => h3.geoToH3(p.latitude, p.longitude, H3_RES));
    const unique = Array.from(new Set(indexes));
    const controlsAdded = [];
    for (const idx of unique) {
      upsertStmt.run({h3_index: idx, owner_user_id: payload.user_id, control_score: 10});
      controlsAdded.push(idx);
    }
    return res.json({status: 'ok', hexes_captured: controlsAdded.length, hexes: controlsAdded});
  } catch (err) {
    console.error(err);
    return res.status(500).json({error: 'server_error', detail: String(err)});
  }
});

app.get('/hexes', (req, res) => {
  const rows = db.prepare('SELECT * FROM hex_control ORDER BY last_defended_at DESC LIMIT 500').all();
  res.json(rows);
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log('Server listening on port', port);
});


// capture polygon endpoint
app.post('/capturePolygon', (req, res) => {
  try {
    const { user_id, polygon } = req.body;
    if (!user_id || !polygon) return res.status(400).json({ error: 'need user_id and polygon' });

    // store geojson as TEXT in sqlite
    const stmt = db.prepare(`INSERT INTO polygons (id, user_id, polygon_json, created_at) VALUES (?, ?, ?, datetime('now'))`);
    const id = 'poly_' + Date.now();
    stmt.run(id, user_id, JSON.stringify(polygon));
    stmt.finalize();
    res.json({ status: 'ok', id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: String(err) });
  }
});



db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS hex_control (
      h3_index TEXT PRIMARY KEY,
      owner_user_id TEXT,
      control_score INTEGER DEFAULT 0,
      last_defended_at TEXT
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS polygons (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      polygon_json TEXT,
      created_at TEXT
    )
  `);
});



app.get('/polygons', (req, res) => {
  db.all('SELECT * FROM polygons ORDER BY created_at DESC LIMIT 500', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.map(r => ({ id: r.id, user_id: r.user_id, polygon: JSON.parse(r.polygon_json), created_at: r.created_at })));
  });
});
