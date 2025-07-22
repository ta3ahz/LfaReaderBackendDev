import React, { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
} from "chart.js";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";

ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement);

export default function App() {
  const [tests, setTests] = useState([]);
  const [selectedTest, setSelectedTest] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterResult, setFilterResult] = useState("all");
  const [filterName, setFilterName] = useState("");
  const [filterGender, setFilterGender] = useState("all");
  const [filterSmoking, setFilterSmoking] = useState("all");
  const [filterQRStatus, setFilterQRStatus] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [showOriginalImage, setShowOriginalImage] = useState(false);
  const [showCroppedImage, setShowCroppedImage] = useState(false);
  const [showChart, setShowChart] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const loadTests = () => {
    setLoading(true);
    fetch("/api/tests", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        setTests(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("🔥 HATA:", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetch("/api/session", { credentials: "include" })
      .then(res => res.json())
      .then(data => {
        if (data.loggedIn) {
          setLoggedIn(true);
          loadTests();
        }
      });
  }, []);

  const loadDetails = (id) => {
    setLoadingDetails(true);
    fetch(`/api/tests/${id}`, { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        setSelectedTest(data);
        setShowOriginalImage(false);
        setShowCroppedImage(false);
        setShowChart(false);
        setLoadingDetails(false);
      })
      .catch((err) => {
        console.error("🔥 Detay hatası:", err);
        setLoadingDetails(false);
      });
  };

  const handleLogin = () => {
    fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username, password })
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setLoggedIn(true);
          setLoginError("");
          loadTests();
        } else {
          setLoginError("Hatalı kullanıcı adı veya şifre");
        }
      })
      .catch(() => setLoginError("Giriş işlemi başarısız"));
  };

  const handleLogout = () => {
    fetch("/api/logout", { method: "POST", credentials: "include" })
      .then(() => {
        setLoggedIn(false);
        setUsername("");
        setPassword("");
        setTests([]);
        setSelectedTest(null);
      });
  };

  const filteredTests = tests.filter((test) => {
    const name = test.test_name?.toLowerCase() || "";
    const result = test.result || "";
    const time = test.timestamp || 0;
    const qrStatus = test.qr_read_success;
    const gender = test.user_info?.gender || "";
    const smoking = test.user_info?.smoking || "";

    const matchesSearch = name.includes(searchTerm.toLowerCase());
    const matchesName = !filterName || test.test_name === filterName;
    const matchesResult = filterResult === "all" || result === filterResult;
    const matchesQRStatus = filterQRStatus === "all" || 
                           (filterQRStatus === "success" && qrStatus === true) ||
                           (filterQRStatus === "failed" && qrStatus === false);
    const matchesGender = filterGender === "all" || gender === filterGender;
    const matchesSmoking = filterSmoking === "all" || smoking === filterSmoking;
    const matchesDate = (!startDate || new Date(time) >= new Date(startDate)) &&
                        (!endDate || new Date(time) <= new Date(endDate));
    
    return matchesSearch && matchesResult && matchesDate && matchesName && 
           matchesQRStatus && matchesGender && matchesSmoking;
  });

  const uniqueTestNames = [...new Set(tests.map(test => test.test_name).filter(Boolean))];

  const formatIntensity = (value) => {
    return value ? value.toFixed(4) : 'N/A';
  };

  if (!loggedIn) {
    return (
      <div className="d-flex vh-100 bg-dark text-light align-items-center justify-content-center">
        <div className="card bg-secondary p-4 text-center w-100" style={{ maxWidth: "380px" }}>
          <h4 className="mb-3">🔐 Giriş Yap</h4>
          <input
            type="text"
            className="form-control mb-2"
            placeholder="Kullanıcı Adı"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            type="password"
            className="form-control mb-3"
            placeholder="Şifre"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {loginError && <div className="text-danger mb-2">{loginError}</div>}
          <button className="btn btn-light w-100" onClick={handleLogin}>Giriş Yap</button>
        </div>
      </div>
    );
  }

  return (
    <div className="d-flex flex-column vh-100 bg-dark text-light">
      <nav className="navbar navbar-dark bg-secondary px-3 d-flex justify-content-between align-items-center">
        <div className="d-flex align-items-center gap-2">
          <span className="navbar-brand mb-0 h1">Test Yönetim Paneli</span>
        </div>
        <button className="btn btn-outline-light btn-sm" onClick={handleLogout}>Çıkış Yap</button>
      </nav>
      
      <div className="container-fluid p-3 overflow-auto">
        <div className="row">
          <div className="col-md-4">
            {/* Arama ve Filtreler */}
            <div className="mb-3">
              <input
                type="text"
                className="form-control mb-2"
                placeholder="🔍 Test Ara"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              
              <div className="row g-2">
                <div className="col-6">
                  <select className="form-select" value={filterResult} onChange={(e) => setFilterResult(e.target.value)}>
                    <option value="all">Tüm Sonuçlar</option>
                    <option value="Pozitif">Pozitif</option>
                    <option value="Negatif">Negatif</option>
                  </select>
                </div>
                <div className="col-6">
                  <select className="form-select" value={filterQRStatus} onChange={(e) => setFilterQRStatus(e.target.value)}>
                    <option value="all">QR Durumu</option>
                    <option value="success">QR Başarılı</option>
                    <option value="failed">QR Başarısız</option>
                  </select>
                </div>
              </div>
              
              <div className="row g-2 mt-2">
                <div className="col-6">
                  <select className="form-select" value={filterGender} onChange={(e) => setFilterGender(e.target.value)}>
                    <option value="all">Cinsiyet</option>
                    <option value="Kadın">Kadın</option>
                    <option value="Erkek">Erkek</option>
                  </select>
                </div>
                <div className="col-6">
                  <select className="form-select" value={filterSmoking} onChange={(e) => setFilterSmoking(e.target.value)}>
                    <option value="all">Sigara</option>
                    <option value="Evet">Sigara İçiyor</option>
                    <option value="Hayır">Sigara İçmiyor</option>
                  </select>
                </div>
              </div>
              
              <div className="d-flex gap-2 mt-2">
                <input
                  type="date"
                  className="form-control"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
                <input
                  type="date"
                  className="form-control"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              
              <select className="form-select mt-2" value={filterName} onChange={(e) => setFilterName(e.target.value)}>
                <option value="">Tüm Testler</option>
                {uniqueTestNames.map((name, idx) => (
                  <option key={idx} value={name}>{name}</option>
                ))}
              </select>
            </div>

            {/* Test Listesi */}
            {loading ? (
              <div className="text-center py-4 text-muted">
                <div className="spinner-border text-light" role="status"></div>
                <div className="mt-2">Testler yükleniyor...</div>
              </div>
            ) : (
              <ul className="list-group list-group-flush bg-dark">
                {filteredTests.map((test) => (
                  <li
                    key={test._id}
                    className="list-group-item bg-secondary text-light d-flex justify-content-between align-items-center"
                    onClick={() => loadDetails(test._id)}
                    style={{ cursor: "pointer" }}
                  >
                    <div>
                      <div>🧪 {test.test_name}</div>
                      <small className="text-muted">
                        {new Date(test.timestamp).toLocaleString('tr-TR')}
                      </small>
                    </div>
                    <div>
                      {test.qr_read_success ? (
                        <span className="badge bg-success">QR ✓</span>
                      ) : (
                        <span className="badge bg-danger">QR ✗</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="col-md-8">
            {loadingDetails ? (
              <div className="text-center py-4 text-muted">
                <div className="spinner-border text-light" role="status"></div>
                <div className="mt-2">Detaylar yükleniyor...</div>
              </div>
            ) : selectedTest && (
              <div className="card bg-secondary text-light p-4">
                <h5 className="mb-4">📄 Test Detayları</h5>
                
                {/* Temel Bilgiler */}
                <div className="row mb-4">
                  <div className="col-md-6">
                    <p><strong>Test Adı:</strong> {selectedTest.test_name}</p>
                    <p><strong>Sonuç:</strong> {selectedTest.result}</p>
                    <p><strong>Tarih:</strong> {new Date(selectedTest.timestamp).toLocaleString('tr-TR')}</p>
                  </div>
                  <div className="col-md-6">
                    <p><strong>QR Durumu:</strong> 
                      {selectedTest.qr_read_success ? 
                        <span className="badge bg-success ms-2">Başarılı</span> : 
                        <span className="badge bg-danger ms-2">Başarısız</span>
                      }
                    </p>
                    <p><strong>QR Data:</strong> {selectedTest.qr_data || 'N/A'}</p>
                  </div>
                </div>

                {/* Yoğunluk Değerleri */}
                <div className="card bg-dark p-3 mb-4">
                  <h6 className="text-info mb-3">Yoğunluk Değerleri</h6>
                  <div className="row">
                    <div className="col-md-4">
                      <p className="mb-2"><span className="text-light">Kontrol:</span> <code className="text-warning">{formatIntensity(selectedTest.control_intensity)}</code></p>
                    </div>
                    <div className="col-md-4">
                      <p className="mb-2"><span className="text-light">Test:</span> <code className="text-warning">{formatIntensity(selectedTest.test_intensity)}</code></p>
                    </div>
                    <div className="col-md-4">
                      <p className="mb-2"><span className="text-light">Arkaplan:</span> <code className="text-warning">{formatIntensity(selectedTest.background_intensity)}</code></p>
                    </div>
                  </div>
                </div>

                {/* Kullanıcı Bilgileri */}
                {selectedTest.user_info && (
                  <div className="card bg-dark p-3 mb-4">
                    <h6 className="text-info mb-3">Kullanıcı Bilgileri</h6>
                    <div className="row">
                      <div className="col-md-6">
                        <p className="mb-2"><span className="text-light">Yaş:</span> <span className="text-white">{selectedTest.user_info.age}</span></p>
                        <p className="mb-2"><span className="text-light">Boy:</span> <span className="text-white">{selectedTest.user_info.height} cm</span></p>
                        <p className="mb-2"><span className="text-light">Kilo:</span> <span className="text-white">{selectedTest.user_info.weight} kg</span></p>
                      </div>
                      <div className="col-md-6">
                        <p className="mb-2"><span className="text-light">Cinsiyet:</span> <span className="text-white">{selectedTest.user_info.gender}</span></p>
                        <p className="mb-2"><span className="text-light">Sigara:</span> <span className="text-white">{selectedTest.user_info.smoking}</span></p>
                        <p className="mb-2"><span className="text-light">Çalışma Ortamı:</span> <span className="text-white">{selectedTest.user_info.work_environment}</span></p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Görsel Butonları */}
                <div className="d-flex gap-2 mb-3">
                  {selectedTest.image_original && (
                    <button className="btn btn-outline-light" onClick={() => setShowOriginalImage(true)}>
                      📷 Orijinal Görsel
                    </button>
                  )}
                  {selectedTest.image_cropped && (
                    <button className="btn btn-outline-light" onClick={() => setShowCroppedImage(true)}>
                      ✂️ Kırpılmış Görsel
                    </button>
                  )}
                  {/* Debug görsel varsa onu da göster */}
                  {!selectedTest.image_cropped && selectedTest.debug_image_blob && (
                    <button className="btn btn-outline-light" onClick={() => setShowCroppedImage(true)}>
                      🔍 Debug Görsel
                    </button>
                  )}
                  {selectedTest.profile && Array.isArray(selectedTest.profile) && (
                    <button className="btn btn-outline-info" onClick={() => setShowChart(true)}>
                      📊 Yoğunluk Grafiği
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Orijinal Görsel Popup */}
      {showOriginalImage && selectedTest?.image_original && (
        <div 
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" 
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.9)', zIndex: 1050 }}
          onClick={() => setShowOriginalImage(false)}
        >
          <div className="position-relative" style={{ maxWidth: '90%', maxHeight: '90%' }}>
            <img 
              src={selectedTest.image_original} 
              alt="Orijinal Test Görseli" 
              className="img-fluid rounded shadow" 
              style={{ maxHeight: '85vh', maxWidth: '100%', objectFit: 'contain' }} 
            />
            <span className="position-absolute top-0 start-0 badge bg-primary m-2" style={{ fontSize: '1rem' }}>Orijinal</span>
            <button 
              className="position-absolute top-0 end-0 btn btn-close btn-close-white m-2" 
              onClick={(e) => { e.stopPropagation(); setShowOriginalImage(false); }}
              aria-label="Close"
            ></button>
          </div>
        </div>
      )}

      {/* Kırpılmış Görsel Popup */}
      {showCroppedImage && selectedTest?.image_cropped && (
        <div 
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" 
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.9)', zIndex: 1050 }}
          onClick={() => setShowCroppedImage(false)}
        >
          <div className="position-relative" style={{ maxWidth: '90%', maxHeight: '90%' }}>
            <img 
              src={selectedTest.image_cropped} 
              alt="Kırpılmış Test Görseli" 
              className="img-fluid rounded shadow" 
              style={{ maxHeight: '85vh', maxWidth: '100%', objectFit: 'contain' }} 
            />
            <span className="position-absolute top-0 start-0 badge bg-success m-2" style={{ fontSize: '1rem' }}>Kırpılmış</span>
            <button 
              className="position-absolute top-0 end-0 btn btn-close btn-close-white m-2" 
              onClick={(e) => { e.stopPropagation(); setShowCroppedImage(false); }}
              aria-label="Close"
            ></button>
          </div>
        </div>
      )}

      {/* Grafik Popup */}
      {showChart && selectedTest?.profile && (
        <div 
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" 
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.9)', zIndex: 1050 }}
          onClick={() => setShowChart(false)}
        >
          <div className="bg-secondary p-4 rounded shadow position-relative" style={{ width: "90%", maxWidth: "800px", height: "60%" }}>
            <button 
              className="position-absolute top-0 end-0 btn btn-close btn-close-white m-2" 
              onClick={(e) => { e.stopPropagation(); setShowChart(false); }}
              aria-label="Close"
            ></button>
            <h5 className="text-light mb-3">Yoğunluk Profili</h5>
            <div style={{ height: 'calc(100% - 40px)' }}>
              <Line
                data={{
                  labels: selectedTest.profile.map((_, i) => i + 1),
                  datasets: [
                    {
                      label: "Yoğunluk Profili",
                      data: selectedTest.profile,
                      fill: false,
                      borderColor: "#00ffff",
                      backgroundColor: "#00ffff",
                      tension: 0.1,
                      pointRadius: 3,
                      pointHoverRadius: 5,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { 
                    legend: { 
                      display: true,
                      labels: { color: '#fff' }
                    } 
                  },
                  scales: { 
                    x: { 
                      display: true,
                      ticks: { color: '#fff' },
                      grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    }, 
                    y: { 
                      display: true,
                      ticks: { color: '#fff' },
                      grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    } 
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}