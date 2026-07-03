/**
 * AS Boys PG — Backend API
 * ------------------------
 * Simple Express + JSON-file backed REST API.
 * Deploy this separately (Render / Railway / Cyclic / a VPS, etc).
 * The frontend (index.html) talks to this via fetch() calls.
 *
 * Data is stored in data.json on disk, so changes made from the
 * admin panel PERSIST across refreshes and server restarts
 * (as long as the disk isn't wiped — see README for notes on
 * free-tier hosts with ephemeral filesystems).
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;
const DATA_FILE = path.join(__dirname, 'data.json');

// ── Admin credentials (change these!) ──────────────────────────
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@asboyspg.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// ── CORS ────────────────────────────────────────────────────────
// Set ALLOWED_ORIGIN in your environment to your frontend's domain
// e.g. https://dreamy-manatee-da2391.netlify.app/ . Use "*" to allow everyone
// (fine for quick testing, not recommended for production).
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
app.use(cors({ origin: ALLOWED_ORIGIN }));

// Allow large base64 media uploads
app.use(express.json({ limit: '15mb' }));

// ── Tiny JSON "database" helpers ───────────────────────────────
function readData() {
  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  return JSON.parse(raw);
}
function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}
function nextId() {
  return Date.now() + Math.floor(Math.random() * 1000);
}

// ── Health check ────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ ok: true }));

/* ═══════════════════ ROOMS ═══════════════════ */
app.get('/api/rooms', (req, res) => {
  const data = readData();
  res.json(data.rooms);
});

// Update occupied beds for a room (used by admin "Save & Update Website")
app.patch('/api/rooms/:id', (req, res) => {
  const data = readData();
  const id = parseInt(req.params.id, 10);
  const room = data.rooms.find(r => r.id === id);
  if (!room) return res.status(404).json({ error: 'Room not found' });

  if (typeof req.body.occupied === 'number') {
    room.occupied = Math.max(0, Math.min(req.body.occupied, room.total));
  }
  writeData(data);
  res.json(room);
});

/* ═══════════════════ REVIEWS ═══════════════════ */
app.get('/api/reviews', (req, res) => {
  const data = readData();
  res.json(data.reviews);
});

app.post('/api/reviews', (req, res) => {
  const { name, course, rating, text } = req.body;
  if (!name || !text) return res.status(400).json({ error: 'name and text are required' });

  const data = readData();
  const review = {
    id: nextId(),
    name,
    course: course || 'Student',
    rating: rating || 5,
    text: text.startsWith('"') ? text : `"${text}"`,
  };
  data.reviews.unshift(review);
  writeData(data);
  res.status(201).json(review);
});

app.delete('/api/reviews/:id', (req, res) => {
  const data = readData();
  const id = parseInt(req.params.id, 10);
  data.reviews = data.reviews.filter(r => r.id !== id);
  writeData(data);
  res.json({ success: true });
});

/* ═══════════════════ MEDIA / GALLERY ═══════════════════ */
app.get('/api/media', (req, res) => {
  const data = readData();
  res.json(data.media);
});

// NOTE: media is stored as base64 data URLs directly in data.json,
// matching the original in-browser behaviour. Fine for a handful of
// images, but for a real production gallery you should switch this
// to real file storage (e.g. Cloudinary, S3) — see README.
app.post('/api/media', (req, res) => {
  const { type, src, cap } = req.body;
  if (!type || !src) return res.status(400).json({ error: 'type and src are required' });

  const data = readData();
  const item = { id: nextId(), type, src, cap: cap || '' };
  data.media.push(item);
  writeData(data);
  res.status(201).json(item);
});

app.delete('/api/media/:id', (req, res) => {
  const data = readData();
  data.media = data.media.filter(m => String(m.id) !== String(req.params.id));
  writeData(data);
  res.json({ success: true });
});

/* ═══════════════════ ENQUIRIES (LEADS) ═══════════════════ */
app.get('/api/enquiries', (req, res) => {
  const data = readData();
  res.json(data.enquiries);
});

app.post('/api/enquiries', (req, res) => {
  const { name, phone, email, room, date, msg } = req.body;
  if (!name || !phone || !room) {
    return res.status(400).json({ error: 'name, phone and room are required' });
  }
  if (!/^[6-9]\d{9}$/.test(phone)) {
    return res.status(400).json({ error: 'Invalid Indian mobile number' });
  }

  const data = readData();
  const enquiry = {
    id: nextId(),
    name,
    phone,
    email: email || '',
    room,
    date: date || '',
    msg: msg || '',
    notes: '',
    status: 'new',
    source: 'website',
    time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
  };
  data.enquiries.unshift(enquiry);
  writeData(data);
  res.status(201).json(enquiry);
});

app.patch('/api/enquiries/:id', (req, res) => {
  const data = readData();
  const id = parseInt(req.params.id, 10);
  const enquiry = data.enquiries.find(e => e.id === id);
  if (!enquiry) return res.status(404).json({ error: 'Enquiry not found' });

  if (typeof req.body.status === 'string') enquiry.status = req.body.status;
  if (typeof req.body.notes === 'string') enquiry.notes = req.body.notes;
  writeData(data);
  res.json(enquiry);
});

app.delete('/api/enquiries/:id', (req, res) => {
  const data = readData();
  const id = parseInt(req.params.id, 10);
  data.enquiries = data.enquiries.filter(e => e.id !== id);
  writeData(data);
  res.json({ success: true });
});

/* ═══════════════════ ADMIN LOGIN ═══════════════════ */
app.post('/api/admin/login', (req, res) => {
  const { email, password } = req.body;
  if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, error: 'Invalid credentials' });
  }
});

app.listen(PORT, () => {
  console.log(`AS Boys PG backend running on http://localhost:${PORT}`);
});
