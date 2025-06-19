const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const session = require('express-session');
const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const mongoUri = process.env.MONGO_URI || "mongodb+srv://lfareadererasenseDevice:ZQuBSWrnUu6ERYt@cluster0.wfnkxnz.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

app.use(cors({
  origin: true,
  credentials: true
}));
app.use(bodyParser.json());
app.use(session({
  secret: 'very-secret-session-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

let db;
MongoClient.connect(mongoUri)
  .then(client => {
    db = client.db("test_db");
    console.log("✅ MongoDB bağlantısı başarılı");
  })
  .catch(err => console.error("❌ MongoDB bağlantı hatası:", err));

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await db.collection("users").findOne({ username, password });
  if (user) {
    req.session.loggedIn = true;
    res.json({ success: true });
  } else {
    res.json({ success: false });
  }
});

app.get('/api/session', (req, res) => {
  res.json({ loggedIn: req.session.loggedIn === true });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

app.get('/api/tests', async (req, res) => {
  if (!req.session.loggedIn) return res.status(401).json({ error: "Oturum gerekli" });
  const results = await db.collection("images").find().sort({ timestamp: -1 }).toArray();
  res.json(results.map(t => ({
    _id: t._id,
    test_name: t.test_name,
    timestamp: t.timestamp,
    result: t.result
  })));
});

app.get('/api/tests/:id', async (req, res) => {
  if (!req.session.loggedIn) return res.status(401).json({ error: "Oturum gerekli" });

  let id;
  try {
    id = new ObjectId(req.params.id);
  } catch (err) {
    return res.status(400).json({ error: "Geçersiz ID" });
  }

  const data = await db.collection("images").findOne({ _id: id });
  if (!data) return res.status(404).json({ error: "Bulunamadı" });

  const imageBase64 = data.image_blob
    ? `data:image/jpeg;base64,${data.image_blob.toString('base64')}`
    : null;

  res.json({
    ...data,
    image_base64: imageBase64
  });
});

app.get("/api/init-user", async (req, res) => {
  const user = await db.collection("users").findOne({ username: "admin" });
  if (!user) {
    await db.collection("users").insertOne({ username: "admin", password: "erasense" });
    res.send("✅ Kullanıcı eklendi.");
  } else {
    res.send("ℹ️ Kullanıcı zaten mevcut.");
  }
});

// React build klasörünü sun
app.use(express.static(path.join(__dirname, "client/build")));

// Tüm GET isteklerini React uygulamasına yönlendir



app.listen(PORT, () => {
  console.log(`🚀 Server çalışıyor: http://localhost:${PORT}`);
});