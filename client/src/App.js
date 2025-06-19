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
import logo from "./assets/erasense-logo.png";

ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement);

export default function App() {
  const [tests, setTests] = useState([]);
  const [selectedTest, setSelectedTest] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterResult, setFilterResult] = useState("all");
  const [filterName, setFilterName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [showImage, setShowImage] = useState(false);
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
        setShowImage(false);
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
    const matchesSearch = name.includes(searchTerm.toLowerCase());
    const matchesName = !filterName || test.test_name === filterName;
    const matchesResult = filterResult === "all" || result === filterResult;
    const matchesDate = (!startDate || new Date(time) >= new Date(startDate)) &&
                        (!endDate || new Date(time) <= new Date(endDate));
    return matchesSearch && matchesResult && matchesDate && matchesName;
  });

  const uniqueTestNames = [...new Set(tests.map(test => test.test_name).filter(Boolean))];

  if (!loggedIn) {
    return (
          <div className="d-flex vh-100 bg-dark text-light align-items-center justify-content-center">
            <div className="card bg-secondary p-4 text-center w-100" style={{ maxWidth: "380px" }}>
              <img src={logo} alt="Logo" style={{ maxWidth: "180px", margin: "0 auto 10px" }} />
              <h4 className="mb-3"><span role="img" aria-label="lock">🔐</span> Giriş Yap</h4>
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
          <img src={logo} alt="Logo" style={{ height: "48px" }} />
          <span className="navbar-brand mb-0 h1">Test Yönetim Paneli</span>
        </div>
        <button className="btn btn-outline-light btn-sm" onClick={handleLogout}>Çıkış Yap</button>
      </nav>
      <div className="container-fluid p-3 overflow-auto">
     <div className="row">
          <div className="col-md-4">
            <input
              type="text"
              className="form-control mb-2"
              placeholder="🔍 Test Ara"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <select className="form-select mb-2" value={filterResult} onChange={(e) => setFilterResult(e.target.value)}>
              <option value="all">Tüm Sonuçlar</option>
              <option value="Pozitif">Pozitif</option>
              <option value="Negatif">Negatif</option>
            </select>
            <div className="d-flex gap-2 mb-2">
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
            <select className="form-select mb-2" value={filterName} onChange={(e) => setFilterName(e.target.value)}>
              <option value="">Tüm Testler</option>
              {uniqueTestNames.map((name, idx) => (
                <option key={idx} value={name}>{name}</option>
              ))}
            </select>

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
                    className="list-group-item bg-secondary text-light"
                    onClick={() => loadDetails(test._id)}
                    style={{ cursor: "pointer" }}
                  >
                    🧪 {test.test_name} - {new Date(test.timestamp).toLocaleString()}
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
              <div className="card bg-secondary text-light p-3">
                <h5>📄 Test Detayları</h5>
                <p><strong>Test Adı:</strong> {selectedTest.test_name}</p>
                <p><strong>Sonuç:</strong> {selectedTest.result}</p>
                <p><strong>Açıklama:</strong> {selectedTest.description}</p>
                <p><strong>Tarih:</strong> {new Date(selectedTest.timestamp).toLocaleString()}</p>

                {selectedTest.image_base64 && (
                  <button className="btn btn-outline-light btn-sm me-2" onClick={() => setShowImage(true)}>Görseli Göster</button>
                )}

                {selectedTest.profile && Array.isArray(selectedTest.profile) && (
                  <button className="btn btn-outline-info btn-sm" onClick={() => setShowChart(true)}>Yoğunluk Grafiği</button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Görsel popup */}
      {showImage && selectedTest?.image_base64 && (
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center bg-dark bg-opacity-75" onClick={() => setShowImage(false)}>
          <img src={selectedTest.image_base64} alt="Test Görseli" className="img-fluid rounded shadow" style={{ maxHeight: "90%" }} />
        </div>
      )}

      {/* Grafik popup */}
      {showChart && selectedTest?.profile && (
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center bg-dark bg-opacity-75" onClick={() => setShowChart(false)}>
          <div className="bg-secondary p-3 rounded shadow" style={{ width: "90%", height: "60%" }}>
            <Line
              data={{
                labels: selectedTest.profile.map((_, i) => i + 1),
                datasets: [
                  {
                    label: "Yoğunluk Profili",
                    data: selectedTest.profile,
                    fill: false,
                    borderColor: "#00ffff",
                    tension: 0.1,
                  },
                ],
              }}
              options={{
                responsive: true,
                plugins: { legend: { display: false } },
                scales: { x: { display: true }, y: { display: true } }
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}