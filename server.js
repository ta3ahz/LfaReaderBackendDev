const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const session = require("express-session");
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb");

const app = express();
const PORT = process.env.PORT || 3000;
const mongoUri = process.env.MONGO_URI || "mongodb+srv://lfareadererasenseDevice:ZQuBSWrnUu6ERYt@cluster0.wfnkxnz.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(bodyParser.json());
app.use(session({
  secret: "very-secret-session-key",
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

// MongoDB bağlantısı
let db;
MongoClient.connect(mongoUri)
  .then(client => {
    db = client.db("test_db");
    console.log("✅ MongoDB bağlantısı başarılı");
  })
  .catch(err => console.error("❌ MongoDB bağlantı hatası:", err));

// Giriş işlemi
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await db.collection("users").findOne({ username, password });
  if (user) {
    req.session.loggedIn = true;
    res.json({ success: true });
  } else {
    res.json({ success: false });
  }
});

// Oturum kontrolü
app.get("/api/session", (req, res) => {
  res.json({ loggedIn: req.session.loggedIn === true });
});

// Çıkış işlemi
app.post("/api/logout", (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

// Test listesi
app.get("/api/tests", async (req, res) => {
  if (!req.session.loggedIn) return res.status(401).json({ error: "Oturum gerekli" });
  const results = await db.collection("images").find().sort({ timestamp: -1 }).toArray();
  res.json(results.map(t => ({
    _id: t._id,
    test_name: t.test_name,
    timestamp: t.timestamp,
    result: t.result
  })));
});

// Test detayı
app.get("/api/tests/:id", async (req, res) => {
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
    ? `data:image/jpeg;base64,${data.image_blob.toString("base64")}`
    : null;

  res.json({
    ...data,
    image_base64: imageBase64
  });
});

// İlk kullanıcıyı ekle
app.get("/api/init-user", async (req, res) => {
  const user = await db.collection("users").findOne({ username: "admin" });
  if (!user) {
    await db.collection("users").insertOne({ username: "admin", password: "erasense" });
    res.send("✅ Kullanıcı eklendi.");
  } else {
    res.send("ℹ️ Kullanıcı zaten mevcut.");
  }
});

console.log(__dirname)
console.log(path.join(__dirname, "client", "build"))
console.log(path.join(__dirname, "client", "build", "index.html"))

// 📦 React statik dosyalarını sun
app.use(express.static(path.join(__dirname, "client", "build")));

// 🚀 Diğer tüm isteklerde React index.html gönder
app.get("*", (req, res, next) => {
  // Eğer /api ile başlıyorsa next() ile diğer middleware'e geçsin
  if (req.path.startsWith("/api")) return next();

  // Değilse React uygulamasını döndür
  res.sendFile(path.join(__dirname, "client", "build", "index.html"));
});



// Sunucuyu başlat
app.listen(PORT, () => {
  console.log(`🚀 Server çalışıyor: http://localhost:${PORT}`);
});
