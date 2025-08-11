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

// Test listesi - güncellenmiş versiyon
app.get("/api/tests", async (req, res) => {
  if (!req.session.loggedIn) return res.status(401).json({ error: "Oturum gerekli" });
  
  const results = await db.collection("images").find().sort({ timestamp: -1 }).toArray();
  
  res.json(results.map(t => ({
    _id: t._id,
    test_name: t.test_name,
    timestamp: t.timestamp,
    result: t.result,
    qr_read_success: t.qr_read_success || false,
    experiment_id1: t.experiment_id1 || null,
    experiment_id2: t.experiment_id2 || null,
    qr_code_from_command: t.qr_code_from_command || null,
    user_info: t.user_info || null,
    user_description: t.user_description || null
  })));
});

// Test detayı - güncellenmiş versiyon
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

  // Görsel dönüşümleri
  let image_original = data.image_original || null;
  let image_cropped = data.image_cropped || null;
  
  // Eğer eski formatsa (image_blob), onu image_original olarak dönüştür
  if (data.image_blob && !image_original) {
    image_original = `data:image/jpeg;base64,${data.image_blob.toString("base64")}`;
  }
  
  // Debug image'ı da kontrol et
  if (data.debug_image_blob && !image_cropped) {
    image_cropped = `data:image/jpeg;base64,${data.debug_image_blob.toString("base64")}`;
  }

  // Yeni veri yapısını döndür
  res.json({
    _id: data._id,
    test_name: data.test_name,
    timestamp: data.timestamp,
    result: data.result,
    description: data.description,
    profile: data.profile,
    
    // İki görsel
    image_original: image_original,
    image_cropped: image_cropped,
    
    // QR verileri
    qr_data: data.qr_data || null,
    qr_read_success: data.qr_read_success || false,
    
    // Yoğunluk değerleri
    control_intensity: data.control_intensity || null,
    test_intensity: data.test_intensity || null,
    background_intensity: data.background_intensity || null,
    
    // Yeni alanlar
    experiment_id1: data.experiment_id1 || null,
    experiment_id2: data.experiment_id2 || null,
    qr_code_from_command: data.qr_code_from_command || null,
    
    // Açıklama alanları
    user_description: data.user_description || null,
    description_updated_at: data.description_updated_at || null,
    
    // Kullanıcı bilgileri (eski veriler için)
    user_info: data.user_info || null
  });
});

// Test açıklaması güncelleme endpoint'i
app.put("/api/tests/:id/description", async (req, res) => {
  if (!req.session.loggedIn) return res.status(401).json({ error: "Oturum gerekli" });
  
  let id;
  try {
    id = new ObjectId(req.params.id);
  } catch (err) {
    return res.status(400).json({ error: "Geçersiz ID" });
  }
  
  const { description } = req.body;
  
  try {
    const result = await db.collection("images").updateOne(
      { _id: id },
      { $set: { user_description: description, description_updated_at: new Date() } }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "Test bulunamadı" });
    }
    
    res.json({ success: true, message: "Açıklama güncellendi" });
  } catch (err) {
    console.error("Açıklama güncelleme hatası:", err);
    res.status(500).json({ error: "Güncelleme başarısız" });
  }
});

// İstatistikler endpoint'i (opsiyonel)
app.get("/api/stats", async (req, res) => {
  if (!req.session.loggedIn) return res.status(401).json({ error: "Oturum gerekli" });
  
  const tests = await db.collection("images").find().toArray();
  
  const stats = {
    total: tests.length,
    qr_success: tests.filter(t => t.qr_read_success === true).length,
    qr_failed: tests.filter(t => t.qr_read_success === false).length,
    positive: tests.filter(t => t.result === "Pozitif").length,
    negative: tests.filter(t => t.result === "Negatif").length,
    with_description: tests.filter(t => t.user_description).length,
    experiments: {
      unique_exp1: [...new Set(tests.map(t => t.experiment_id1).filter(Boolean))].length,
      unique_exp2: [...new Set(tests.map(t => t.experiment_id2).filter(Boolean))].length
    }
  };
  
  res.json(stats);
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

// React statik dosyalarını sun
app.use(express.static(path.join(__dirname, "client", "build")));

// Diğer tüm isteklerde React index.html gönder
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