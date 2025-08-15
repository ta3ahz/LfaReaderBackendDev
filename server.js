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

// MongoDB bağlantısı ve index oluşturma
let db;
MongoClient.connect(mongoUri)
  .then(async client => {
    db = client.db("test_db");
    console.log("✅ MongoDB bağlantısı başarılı");
    
    // Index'leri oluştur (performans için kritik)
    try {
      await db.collection("images").createIndex({ timestamp: -1 });
      await db.collection("images").createIndex({ test_name: 1 });
      await db.collection("images").createIndex({ result: 1 });
      await db.collection("images").createIndex({ qr_read_success: 1 });
      // Compound index for sorting and filtering
      await db.collection("images").createIndex({ timestamp: -1, _id: 1 });
      console.log("✅ MongoDB index'leri oluşturuldu");
    } catch (err) {
      console.error("⚠️ Index oluşturma hatası (zaten mevcut olabilir):", err.message);
    }
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

// Test listesi - SAYFALAMA VE OPTİMİZASYON EKLENDİ
app.get("/api/tests", async (req, res) => {
  if (!req.session.loggedIn) return res.status(401).json({ error: "Oturum gerekli" });
  
  try {
    // Sayfalama parametreleri
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50; // Varsayılan 50 kayıt
    const skip = (page - 1) * limit;
    
    // Filtreleme parametreleri
    const filter = {};
    if (req.query.result) filter.result = req.query.result;
    if (req.query.qr_success !== undefined) filter.qr_read_success = req.query.qr_success === 'true';
    if (req.query.experiment_id1) filter.experiment_id1 = req.query.experiment_id1;
    if (req.query.experiment_id2) filter.experiment_id2 = req.query.experiment_id2;
    
    // Toplam kayıt sayısını al
    const totalCount = await db.collection("images").countDocuments(filter);
    
    // Verileri getir - allowDiskUse ile
    const results = await db.collection("images")
      .find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .allowDiskUse(true) // Bellek limitini aşarsa disk kullan
      .project({
        _id: 1,
        test_name: 1,
        timestamp: 1,
        result: 1,
        qr_read_success: 1,
        experiment_id1: 1,
        experiment_id2: 1,
        qr_code_from_command: 1,
        user_info: 1,
        user_description: 1
      })
      .toArray();
    
    res.json({
      data: results.map(t => ({
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
      })),
      pagination: {
        total: totalCount,
        page: page,
        limit: limit,
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (err) {
    console.error("Test listesi hatası:", err);
    res.status(500).json({ error: "Veri alınamadı", details: err.message });
  }
});

// Tüm testleri dışa aktarma endpoint'i (büyük veri setleri için)
app.get("/api/tests/export", async (req, res) => {
  if (!req.session.loggedIn) return res.status(401).json({ error: "Oturum gerekli" });
  
  try {
    // Stream olarak gönder
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="tests_export.json"');
    
    const cursor = db.collection("images")
      .find({})
      .sort({ timestamp: -1 })
      .allowDiskUse(true)
      .project({
        _id: 1,
        test_name: 1,
        timestamp: 1,
        result: 1,
        qr_read_success: 1,
        experiment_id1: 1,
        experiment_id2: 1,
        qr_code_from_command: 1,
        user_description: 1
      });
    
    res.write('[');
    let first = true;
    
    for await (const doc of cursor) {
      if (!first) res.write(',');
      res.write(JSON.stringify(doc));
      first = false;
    }
    
    res.write(']');
    res.end();
  } catch (err) {
    console.error("Export hatası:", err);
    res.status(500).json({ error: "Export başarısız", details: err.message });
  }
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
  
  try {
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
  } catch (err) {
    console.error("Test detayı hatası:", err);
    res.status(500).json({ error: "Veri alınamadı", details: err.message });
  }
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

// İstatistikler endpoint'i - OPTİMİZE EDİLDİ
app.get("/api/stats", async (req, res) => {
  if (!req.session.loggedIn) return res.status(401).json({ error: "Oturum gerekli" });
  
  try {
    // Aggregation pipeline kullanarak verimli istatistikler
    const stats = await db.collection("images").aggregate([
      {
        $facet: {
          counts: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                qr_success: { $sum: { $cond: [{ $eq: ["$qr_read_success", true] }, 1, 0] } },
                qr_failed: { $sum: { $cond: [{ $eq: ["$qr_read_success", false] }, 1, 0] } },
                positive: { $sum: { $cond: [{ $eq: ["$result", "Pozitif"] }, 1, 0] } },
                negative: { $sum: { $cond: [{ $eq: ["$result", "Negatif"] }, 1, 0] } },
                with_description: { $sum: { $cond: [{ $ne: ["$user_description", null] }, 1, 0] } }
              }
            }
          ],
          exp1: [
            { $match: { experiment_id1: { $ne: null } } },
            { $group: { _id: "$experiment_id1" } },
            { $count: "unique_exp1" }
          ],
          exp2: [
            { $match: { experiment_id2: { $ne: null } } },
            { $group: { _id: "$experiment_id2" } },
            { $count: "unique_exp2" }
          ]
        }
      }
    ], { allowDiskUse: true }).toArray();
    
    const result = stats[0];
    const counts = result.counts[0] || {
      total: 0,
      qr_success: 0,
      qr_failed: 0,
      positive: 0,
      negative: 0,
      with_description: 0
    };
    
    res.json({
      ...counts,
      experiments: {
        unique_exp1: result.exp1[0]?.unique_exp1 || 0,
        unique_exp2: result.exp2[0]?.unique_exp2 || 0
      }
    });
  } catch (err) {
    console.error("İstatistik hatası:", err);
    res.status(500).json({ error: "İstatistikler alınamadı", details: err.message });
  }
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