/**
 * AS Boys PG — Backend API
 * ------------------------
 * Express REST API with two storage modes:
 *
 *  1. MongoDB (recommended for production) — set MONGODB_URI and data
 *     survives restarts/redeploys forever. Use a free MongoDB Atlas
 *     cluster (see README.md for setup steps).
 *
 *  2. Local JSON file (data.json) — used automatically if MONGODB_URI
 *     is not set. Fine for local testing, but on free hosts like
 *     Render the disk is wiped on restart/redeploy, so admin changes
 *     (room seats, reviews, gallery) will randomly reset. Set
 *     MONGODB_URI to fix this permanently.
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 4000;
const DATA_FILE = path.join(__dirname, 'data.json');
const MONGODB_URI = process.env.MONGODB_URI || '';
const USE_MONGO = !!MONGODB_URI;

// ── Admin credentials (change these!) ──────────────────────────
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@asboyspg.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// ── CORS ────────────────────────────────────────────────────────
const rawOrigins = process.env.ALLOWED_ORIGIN || '*';
const allowedOrigins = rawOrigins.split(',').map(o => o.trim().replace(/\/$/, ''));

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes('*')) return callback(null, true);
    const normalized = origin.replace(/\/$/, '');
    if (allowedOrigins.includes(normalized)) return callback(null, true);
    callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
}));

app.use(express.json({ limit: '15mb' }));

function nextId() {
  return Date.now() + Math.floor(Math.random() * 1000);
}

const SEED_DATA = {
  rooms: [
    {id:1,name:"Single Cabin",type:"Private",price:6500,total:5,occupied:3,feats:["AC","Attached Washroom","Study Table","Wardrobe","WiFi"],img:"🛏",bg:"linear-gradient(135deg,#FFF5EE,#FFE8D6)",popular:true},
    {id:2,name:"Single Room",type:"Private Room",price:7000,total:4,occupied:2,feats:["AC","Attached Washroom","Study Table","Wardrobe","Extra Storage"],img:"🏠",bg:"linear-gradient(135deg,#F0FDF4,#DCFCE7)",popular:false},
    {id:3,name:"Double Sharing",type:"Shared",price:6000,total:8,occupied:5,feats:["AC","Shared Washroom","Study Table","Wardrobe","WiFi"],img:"👥",bg:"linear-gradient(135deg,#EFF6FF,#DBEAFE)",popular:false},
    {id:4,name:"Triple Sharing",type:"Shared",price:6000,total:9,occupied:9,feats:["AC","Shared Washroom","Study Table","Wardrobe"],img:"👥",bg:"linear-gradient(135deg,#F5F5F5,#EBEBEB)",popular:false}
  ],
  enquiries: [],
  reviews: [
    {id:1,name:"Rahul Sharma",course:"UPSC Preparation",rating:5,text:"\"Best PG near Mukherjee Nagar. Food is amazing and staff is very helpful. Highly recommend to all UPSC aspirants!\""},
    {id:2,name:"Pradeep Yadav",course:"UPSC Preparation",rating:5,text:"\"Staying here for 8 months. Management is responsive and meals are home-like. Best value for money in this area.\""},
    {id:3,name:"Vikas Singh",course:"Bank PO",rating:4,text:"\"Clean rooms, CCTV security, just 5 minutes walk from coaching. WiFi is fast — online mock tests run perfectly.\""},
    {id:4,name:"Amit Kumar",course:"SSC CGL",rating:5,text:"\"AC room, fast WiFi, 3 meals daily — all included in price. Perfect study environment.\""},
    {id:5,name:"Deepak Patel",course:"Delhi Police",rating:5,text:"\"Security is excellent — feels safe even at night. Felt comfortable from day one. Highly recommended!\""}
  ],
  media: []
};

/* ═══════════════════ STORAGE LAYER ═══════════════════ */
let SiteData;
if (USE_MONGO) {
  const dataSchema = new mongoose.Schema({ _id: String }, { strict: false, collection: 'site_data' });
  SiteData = mongoose.model('SiteData', dataSchema);
}

async function readData() {
  if (USE_MONGO) {
    let doc = await SiteData.findById('main').lean();
    if (!doc) {
      doc = { _id: 'main', ...SEED_DATA };
      await SiteData.create(doc);
    }
    return doc;
  }
  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  return JSON.parse(raw);
}

async function writeData(data) {
  if (USE_MONGO) {
    await SiteData.findByIdAndUpdate('main', data, { upsert: true });
    return;
  }
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// Wrap async route handlers so thrown errors don't crash the process
function h(fn) {
  return (req, res) => fn(req, res).catch(err => {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  });
}

// ── Health check ────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ ok: true, storage: USE_MONGO ? 'mongodb' : 'local-file' }));

/* ═══════════════════ ROOMS ═══════════════════ */
app.get('/api/rooms', h(async (req, res) => {
  const data = await readData();
  res.json(data.rooms);
}));

app.patch('/api/rooms/:id', h(async (req, res) => {
  const data = await readData();
  const id = parseInt(req.params.id, 10);
  const room = data.rooms.find(r => r.id === id);
  if (!room) return res.status(404).json({ error: 'Room not found' });

  if (typeof req.body.occupied === 'number') {
    room.occupied = Math.max(0, Math.min(req.body.occupied, room.total));
  }
  await writeData(data);
  res.json(room);
}));

/* ═══════════════════ REVIEWS ═══════════════════ */
app.get('/api/reviews', h(async (req, res) => {
  const data = await readData();
  res.json(data.reviews);
}));

app.post('/api/reviews', h(async (req, res) => {
  const { name, course, rating, text } = req.body;
  if (!name || !text) return res.status(400).json({ error: 'name and text are required' });

  const data = await readData();
  const review = {
    id: nextId(),
    name,
    course: course || 'Student',
    rating: rating || 5,
    text: text.startsWith('"') ? text : `"${text}"`,
  };
  data.reviews.unshift(review);
  await writeData(data);
  res.status(201).json(review);
}));

app.delete('/api/reviews/:id', h(async (req, res) => {
  const data = await readData();
  const id = parseInt(req.params.id, 10);
  data.reviews = data.reviews.filter(r => r.id !== id);
  await writeData(data);
  res.json({ success: true });
}));

/* ═══════════════════ MEDIA / GALLERY ═══════════════════ */
app.get('/api/media', h(async (req, res) => {
  const data = await readData();
  res.json(data.media);
}));

app.post('/api/media', h(async (req, res) => {
  const { type, src, cap } = req.body;
  if (!type || !src) return res.status(400).json({ error: 'type and src are required' });

  const data = await readData();
  const item = { id: nextId(), type, src, cap: cap || '' };
  data.media.push(item);
  await writeData(data);
  res.status(201).json(item);
}));

app.delete('/api/media/:id', h(async (req, res) => {
  const data = await readData();
  data.media = data.media.filter(m => String(m.id) !== String(req.params.id));
  await writeData(data);
  res.json({ success: true });
}));

/* ═══════════════════ ENQUIRIES (LEADS) ═══════════════════ */
app.get('/api/enquiries', h(async (req, res) => {
  const data = await readData();
  res.json(data.enquiries);
}));

app.post('/api/enquiries', h(async (req, res) => {
  const { name, phone, email, room, date, msg } = req.body;
  if (!name || !phone || !room) {
    return res.status(400).json({ error: 'name, phone and room are required' });
  }
  if (!/^[6-9]\d{9}$/.test(phone)) {
    return res.status(400).json({ error: 'Invalid Indian mobile number' });
  }

  const data = await readData();
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
  await writeData(data);
  res.status(201).json(enquiry);
}));

app.patch('/api/enquiries/:id', h(async (req, res) => {
  const data = await readData();
  const id = parseInt(req.params.id, 10);
  const enquiry = data.enquiries.find(e => e.id === id);
  if (!enquiry) return res.status(404).json({ error: 'Enquiry not found' });

  if (typeof req.body.status === 'string') enquiry.status = req.body.status;
  if (typeof req.body.notes === 'string') enquiry.notes = req.body.notes;
  await writeData(data);
  res.json(enquiry);
}));

app.delete('/api/enquiries/:id', h(async (req, res) => {
  const data = await readData();
  const id = parseInt(req.params.id, 10);
  data.enquiries = data.enquiries.filter(e => e.id !== id);
  await writeData(data);
  res.json({ success: true });
}));

/* ═══════════════════ ADMIN LOGIN ═══════════════════ */
app.post('/api/admin/login', (req, res) => {
  const { email, password } = req.body;
  if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, error: 'Invalid credentials' });
  }
});

/* ═══════════════════ STARTUP ═══════════════════ */
async function start() {
  if (USE_MONGO) {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB — data will persist across restarts.');
  } else {
    console.log('⚠️  No MONGODB_URI set — using local data.json. This WILL reset on Render restarts/redeploys. Set MONGODB_URI to fix (see README.md).');
  }
  app.listen(PORT, () => {
    console.log(`AS Boys PG backend running on http://localhost:${PORT}`);
  });
}

start();
