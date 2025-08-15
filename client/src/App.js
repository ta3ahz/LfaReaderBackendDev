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
  
  // Sayfalama state'leri
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalTests, setTotalTests] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  
  // Tab ve WiFi QR state'leri
  const [activeTab, setActiveTab] = useState("tests");
  const [wifiSSID, setWifiSSID] = useState("");
  const [wifiPassword, setWifiPassword] = useState("");
  const [wifiSecurity, setWifiSecurity] = useState("WPA");
  const [qrCodeData, setQrCodeData] = useState("");
  
  // Açıklama düzenleme state'leri
  const [editingDescription, setEditingDescription] = useState(false);
  const [tempDescription, setTempDescription] = useState("");
  const [savingDescription, setSavingDescription] = useState(false);
  
  // İstatistik state'i
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const loadTests = (page = 1) => {
    setLoading(true);
    
    // Query parametrelerini oluştur
    const params = new URLSearchParams({
      page: page,
      limit: pageSize
    });
    
    // Filtreleri ekle
    if (filterResult !== "all") params.append("result", filterResult);
    if (filterQRStatus !== "all") params.append("qr_success", filterQRStatus === "success");
    
    fetch(`/api/tests?${params}`, { credentials: "include" })
      .then((res) => res.json())
      .then((response) => {
        if (response.data) {
          setTests(response.data);
          setCurrentPage(response.pagination.page);
          setTotalPages(response.pagination.pages);
          setTotalTests(response.pagination.total);
        } else {
          // Eski format için fallback
          setTests(response);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("🔥 HATA:", err);
        setLoading(false);
      });
  };

  const loadStats = () => {
    setLoadingStats(true);
    fetch("/api/stats", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        setStats(data);
        setLoadingStats(false);
      })
      .catch((err) => {
        console.error("İstatistik hatası:", err);
        setLoadingStats(false);
      });
  };

  useEffect(() => {
    fetch("/api/session", { credentials: "include" })
      .then(res => res.json())
      .then(data => {
        if (data.loggedIn) {
          setLoggedIn(true);
          loadTests();
          loadStats();
        }
      });
  }, []);

  // Filtre değişikliklerinde yeniden yükle
  useEffect(() => {
    if (loggedIn) {
      loadTests(1); // Filtre değiştiğinde ilk sayfaya dön
    }
  }, [filterResult, filterQRStatus, pageSize]);

  const loadDetails = (id) => {
    setLoadingDetails(true);
    fetch(`/api/tests/${id}`, { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        setSelectedTest(data);
        setTempDescription(data.user_description || "");
        setShowOriginalImage(false);
        setShowCroppedImage(false);
        setShowChart(false);
        setEditingDescription(false);
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
          loadStats();
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

  // Açıklama kaydetme fonksiyonu
  const saveDescription = async () => {
    if (!selectedTest) return;
    
    setSavingDescription(true);
    
    try {
      const response = await fetch(`/api/tests/${selectedTest._id}/description`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ description: tempDescription })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSelectedTest({
          ...selectedTest,
          user_description: tempDescription,
          description_updated_at: new Date()
        });
        setEditingDescription(false);
        loadTests(currentPage); // Mevcut sayfayı yenile
        loadStats(); // İstatistikleri güncelle
        alert("Açıklama başarıyla güncellendi!");
      } else {
        alert("Güncelleme başarısız: " + (data.error || "Bilinmeyen hata"));
      }
    } catch (err) {
      console.error("Açıklama güncelleme hatası:", err);
      alert("Güncelleme sırasında hata oluştu!");
    } finally {
      setSavingDescription(false);
    }
  };

  // Export fonksiyonu
  const handleExport = () => {
    if (confirm("Tüm test verilerini indirmek istediğinize emin misiniz?")) {
      window.location.href = "/api/tests/export";
    }
  };

  // WiFi QR kod oluşturma fonksiyonu
  const generateWifiQR = () => {
    if (!wifiSSID) {
      alert("Lütfen WiFi adını girin!");
      return;
    }

    // WiFi QR kod formatı
    const wifiString = `WIFI:T:${wifiSecurity};S:${wifiSSID};P:${wifiPassword};;`;
    
    // QR Server API kullan
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(wifiString)}`;
    
    // Image olarak set et
    setQrCodeData(qrApiUrl);
  };

  // Client-side filtreleme (arama için)
  const filteredTests = tests.filter((test) => {
    const name = test.test_name?.toLowerCase() || "";
    const matchesSearch = name.includes(searchTerm.toLowerCase()) || 
                         (test.experiment_id1 && test.experiment_id1.toString().includes(searchTerm)) ||
                         (test.experiment_id2 && test.experiment_id2.toString().includes(searchTerm)) ||
                         (test.qr_code_from_command && test.qr_code_from_command.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesSearch;
  });

  const formatIntensity = (value) => {
    return value ? value.toFixed(4) : 'N/A';
  };

  // Sayfalama component'i
  const Pagination = () => {
    const maxVisible = 5;
    const pages = [];
    
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    
    return (
      <div className="d-flex justify-content-between align-items-center mt-3">
        <div className="text-muted">
          Toplam {totalTests} test ({currentPage}/{totalPages} sayfa)
        </div>
        <nav>
          <ul className="pagination mb-0">
            <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
              <button className="page-link" onClick={() => loadTests(1)}>İlk</button>
            </li>
            <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
              <button className="page-link" onClick={() => loadTests(currentPage - 1)}>Önceki</button>
            </li>
            {pages.map(page => (
              <li key={page} className={`page-item ${page === currentPage ? 'active' : ''}`}>
                <button className="page-link" onClick={() => loadTests(page)}>{page}</button>
              </li>
            ))}
            <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
              <button className="page-link" onClick={() => loadTests(currentPage + 1)}>Sonraki</button>
            </li>
            <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
              <button className="page-link" onClick={() => loadTests(totalPages)}>Son</button>
            </li>
          </ul>
        </nav>
      </div>
    );
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
            onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
          />
          <input
            type="password"
            className="form-control mb-3"
            placeholder="Şifre"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
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
          {stats && (
            <span className="badge bg-info">
              Toplam: {stats.total} | Pozitif: {stats.positive} | Negatif: {stats.negative}
            </span>
          )}
        </div>
        <div className="d-flex gap-2">
          <button className="btn btn-outline-warning btn-sm" onClick={handleExport}>
            📥 Tümünü İndir
          </button>
          <button className="btn btn-outline-light btn-sm" onClick={handleLogout}>
            Çıkış Yap
          </button>
        </div>
      </nav>
      
      {/* Tab Navigation */}
      <ul className="nav nav-tabs bg-dark">
        <li className="nav-item">
          <button 
            className={`nav-link ${activeTab === 'tests' ? 'active' : ''}`}
            onClick={() => setActiveTab('tests')}
          >
            Test Listesi
          </button>
        </li>
        <li className="nav-item">
          <button 
            className={`nav-link ${activeTab === 'wifi' ? 'active' : ''}`}
            onClick={() => setActiveTab('wifi')}
          >
            WiFi QR Oluştur
          </button>
        </li>
        <li className="nav-item">
          <button 
            className={`nav-link ${activeTab === 'stats' ? 'active' : ''}`}
            onClick={() => setActiveTab('stats')}
          >
            İstatistikler
          </button>
        </li>
      </ul>

      {/* Tab İçerikleri */}
      {activeTab === 'tests' ? (
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
                
                <div className="d-flex gap-2 mt-2">
                  <select 
                    className="form-select"
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                  >
                    <option value="20">20 kayıt</option>
                    <option value="50">50 kayıt</option>
                    <option value="100">100 kayıt</option>
                  </select>
                </div>
              </div>

              {/* Test Listesi */}
              {loading ? (
                <div className="text-center py-4 text-muted">
                  <div className="spinner-border text-light" role="status"></div>
                  <div className="mt-2">Testler yükleniyor...</div>
                </div>
              ) : (
                <>
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
                          {(test.experiment_id1 || test.experiment_id2) && (
                            <div>
                              <small className="text-info">
                                Exp: {test.experiment_id1 || 'N/A'} / {test.experiment_id2 || 'N/A'}
                              </small>
                            </div>
                          )}
                        </div>
                        <div className="d-flex gap-1 align-items-center">
                          {test.user_description && (
                            <span className="badge bg-info" title="Açıklama var">📝</span>
                          )}
                          {test.qr_read_success ? (
                            <span className="badge bg-success">QR ✓</span>
                          ) : (
                            <span className="badge bg-danger">QR ✗</span>
                          )}
                          <span className={`badge ${test.result === 'Pozitif' ? 'bg-warning' : 'bg-primary'}`}>
                            {test.result}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                  {totalPages > 1 && <Pagination />}
                </>
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
                      <p><strong>QR Data (Görüntüden):</strong> {selectedTest.qr_data || 'N/A'}</p>
                    </div>
                  </div>

                  {/* Açıklama Bölümü */}
                  <div className="card bg-dark p-3 mb-4">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <h6 className="text-info mb-0">Açıklama / Notlar</h6>
                      {!editingDescription ? (
                        <button 
                          className="btn btn-sm btn-outline-info"
                          onClick={() => {
                            setEditingDescription(true);
                            setTempDescription(selectedTest.user_description || "");
                          }}
                        >
                          ✏️ Düzenle
                        </button>
                      ) : (
                        <div className="d-flex gap-2">
                          <button 
                            className="btn btn-sm btn-success"
                            onClick={saveDescription}
                            disabled={savingDescription}
                          >
                            {savingDescription ? "Kaydediliyor..." : "💾 Kaydet"}
                          </button>
                          <button 
                            className="btn btn-sm btn-danger"
                            onClick={() => {
                              setEditingDescription(false);
                              setTempDescription(selectedTest.user_description || "");
                            }}
                            disabled={savingDescription}
                          >
                            ❌ İptal
                          </button>
                        </div>
                      )}
                    </div>
                    
                    {!editingDescription ? (
                      <p className="mb-0 text-light">
                        {selectedTest.user_description || <span className="text-muted fst-italic">Henüz açıklama eklenmemiş</span>}
                      </p>
                    ) : (
                      <textarea
                        className="form-control bg-secondary text-light"
                        rows="4"
                        value={tempDescription}
                        onChange={(e) => setTempDescription(e.target.value)}
                        placeholder="Test hakkında notlar, gözlemler veya açıklamalar ekleyin..."
                        disabled={savingDescription}
                      />
                    )}
                    
                    {selectedTest.description_updated_at && (
                      <small className="text-muted mt-2 d-block">
                        Son güncelleme: {new Date(selectedTest.description_updated_at).toLocaleString('tr-TR')}
                      </small>
                    )}
                  </div>

                  {/* Experiment Bilgileri */}
                  {(selectedTest.experiment_id1 || selectedTest.experiment_id2 || selectedTest.qr_code_from_command) && (
                    <div className="card bg-dark p-3 mb-4">
                      <h6 className="text-info mb-3">Experiment Bilgileri</h6>
                      <div className="row">
                        <div className="col-md-4">
                          <p className="mb-2"><span className="text-light">Experiment ID 1:</span> <code className="text-warning">{selectedTest.experiment_id1 || 'N/A'}</code></p>
                        </div>
                        <div className="col-md-4">
                          <p className="mb-2"><span className="text-light">Experiment ID 2:</span> <code className="text-warning">{selectedTest.experiment_id2 || 'N/A'}</code></p>
                        </div>
                        <div className="col-md-4">
                          <p className="mb-2"><span className="text-light">QR (Komut):</span> <code className="text-warning">{selectedTest.qr_code_from_command || 'N/A'}</code></p>
                        </div>
                      </div>
                    </div>
                  )}

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

                  {/* Eski kullanıcı bilgileri (varsa) */}
                  {selectedTest.user_info && (
                    <div className="card bg-dark p-3 mb-4">
                      <h6 className="text-info mb-3">Kullanıcı Bilgileri (Eski Format)</h6>
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
      ) : activeTab === 'wifi' ? (
        // WiFi QR Tab İçeriği
        <div className="container-fluid p-4">
          <div className="row justify-content-center">
            <div className="col-md-6">
              <div className="card bg-secondary text-light p-4">
                <h5 className="mb-4">📶 WiFi QR Kod Oluşturucu</h5>
                
                <div className="mb-3">
                  <label className="form-label">WiFi Adı (SSID)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Örn: MyWiFi"
                    value={wifiSSID}
                    onChange={(e) => setWifiSSID(e.target.value)}
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label">Şifre</label>
                  <input
                    type="password"
                    className="form-control"
                    placeholder="WiFi şifresi"
                    value={wifiPassword}
                    onChange={(e) => setWifiPassword(e.target.value)}
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label">Güvenlik Türü</label>
                  <select 
                    className="form-select"
                    value={wifiSecurity}
                    onChange={(e) => setWifiSecurity(e.target.value)}
                  >
                    <option value="WPA">WPA/WPA2</option>
                    <option value="WEP">WEP</option>
                    <option value="nopass">Şifresiz</option>
                  </select>
                </div>

                <button 
                  className="btn btn-primary w-100 mb-3"
                  onClick={generateWifiQR}
                >
                  QR Kod Oluştur
                </button>

                {qrCodeData && (
                  <div className="text-center">
                    <img 
                      src={qrCodeData} 
                      alt="WiFi QR Code" 
                      className="img-fluid rounded shadow mb-3"
                      style={{ maxWidth: '300px' }}
                    />
                    <div className="d-flex gap-2 justify-content-center">
                      <a 
                        href={qrCodeData} 
                        download={`WiFi_${wifiSSID}_QR.png`}
                        className="btn btn-success"
                      >
                        💾 İndir
                      </a>
                      <button 
                        className="btn btn-warning"
                        onClick={() => {
                          setWifiSSID('');
                          setWifiPassword('');
                          setWifiSecurity('WPA');
                          setQrCodeData('');
                        }}
                      >
                        🔄 Temizle
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        // İstatistikler Tab İçeriği
        <div className="container-fluid p-4">
          <div className="row justify-content-center">
            <div className="col-md-8">
              {loadingStats ? (
                <div className="text-center py-4 text-muted">
                  <div className="spinner-border text-light" role="status"></div>
                  <div className="mt-2">İstatistikler yükleniyor...</div>
                </div>
              ) : stats && (
                <div className="card bg-secondary text-light p-4">
                  <h5 className="mb-4">📊 Test İstatistikleri</h5>
                  
                  <div className="row">
                    <div className="col-md-4 mb-3">
                      <div className="card bg-dark p-3 text-center">
                        <h3 className="text-info">{stats.total}</h3>
                        <p className="mb-0">Toplam Test</p>
                      </div>
                    </div>
                    
                    <div className="col-md-4 mb-3">
                      <div className="card bg-dark p-3 text-center">
                        <h3 className="text-warning">{stats.positive}</h3>
                        <p className="mb-0">Pozitif Sonuç</p>
                      </div>
                    </div>
                    
                    <div className="col-md-4 mb-3">
                      <div className="card bg-dark p-3 text-center">
                        <h3 className="text-primary">{stats.negative}</h3>
                        <p className="mb-0">Negatif Sonuç</p>
                      </div>
                    </div>
                    
                    <div className="col-md-4 mb-3">
                      <div className="card bg-dark p-3 text-center">
                        <h3 className="text-success">{stats.qr_success}</h3>
                        <p className="mb-0">QR Başarılı</p>
                      </div>
                    </div>
                    
                    <div className="col-md-4 mb-3">
                      <div className="card bg-dark p-3 text-center">
                        <h3 className="text-danger">{stats.qr_failed}</h3>
                        <p className="mb-0">QR Başarısız</p>
                      </div>
                    </div>
                    
                    <div className="col-md-4 mb-3">
                      <div className="card bg-dark p-3 text-center">
                        <h3 className="text-info">{stats.with_description}</h3>
                        <p className="mb-0">Açıklamalı Test</p>
                      </div>
                    </div>
                  </div>
                  
                  {stats.experiments && (
                    <div className="mt-4">
                      <h6 className="text-info mb-3">Deney İstatistikleri</h6>
                      <div className="row">
                        <div className="col-md-6">
                          <p><strong>Farklı Experiment ID 1:</strong> {stats.experiments.unique_exp1}</p>
                        </div>
                        <div className="col-md-6">
                          <p><strong>Farklı Experiment ID 2:</strong> {stats.experiments.unique_exp2}</p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="mt-4">
                    <div className="progress" style={{ height: '30px' }}>
                      <div 
                        className="progress-bar bg-warning" 
                        style={{ width: `${(stats.positive / stats.total * 100).toFixed(1)}%` }}
                      >
                        Pozitif {(stats.positive / stats.total * 100).toFixed(1)}%
                      </div>
                      <div 
                        className="progress-bar bg-primary" 
                        style={{ width: `${(stats.negative / stats.total * 100).toFixed(1)}%` }}
                      >
                        Negatif {(stats.negative / stats.total * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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