import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, addDoc, deleteDoc, doc, query, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBwSimE7uwNvGnJOyM-lXDyVjeA6RSRTSY",
  authDomain: "packtrace-incoming-b6489.firebaseapp.com",
  projectId: "packtrace-incoming-b6489",
  storageBucket: "packtrace-incoming-b6489.firebasestorage.app",
  messagingSenderId: "483858402515",
  appId: "1:483858402515:web:15faecde56d7bd9a341826"
};

const ADMIN_PIN = "1166";
const fbApp = initializeApp(firebaseConfig);
const db = getFirestore(fbApp);
let records = [];
let pinVerified = false;
let pendingAction = null;

// ===== PIN MODAL =====
function showPinModal(action) {
  pendingAction = action;
  pinVerified = false;
  document.getElementById("pin-input").value = "";
  document.getElementById("pin-error").style.display = "none";
  document.getElementById("pin-modal").classList.add("open");
  setTimeout(() => document.getElementById("pin-input").focus(), 100);
}

window.closePinModal = function() {
  document.getElementById("pin-modal").classList.remove("open");
  pendingAction = null;
};

window.submitPin = function() {
  const val = document.getElementById("pin-input").value;
  if (val === ADMIN_PIN) {
    pinVerified = true;
    document.getElementById("pin-modal").classList.remove("open");
    if (pendingAction) pendingAction();
    pendingAction = null;
  } else {
    document.getElementById("pin-error").style.display = "block";
    document.getElementById("pin-input").value = "";
    document.getElementById("pin-input").focus();
  }
};

window.pinKeydown = function(e) {
  if (e.key === "Enter") window.submitPin();
};

// ===== REALTIME =====
function startListener() {
  const q = query(collection(db, "samples"), orderBy("createdAt", "desc"));
  onSnapshot(q, (snapshot) => {
    records = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderList();
    setSync(true);
  }, (err) => {
    console.error(err);
    setSync(false);
  });
}

function setSync(ok) {
  const dot = document.getElementById("sync-dot");
  const txt = document.getElementById("sync-txt");
  dot.className = "dot " + (ok ? "online" : "error");
  txt.textContent = ok ? "เชื่อมต่อแล้ว — ข้อมูลแชร์ร่วมกัน" : "ขาดการเชื่อมต่อ";
}

// ===== TABS =====
window.switchTab = function(id) {
  document.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b.dataset.tab === id));
  document.querySelectorAll(".pane").forEach(p => p.classList.toggle("active", p.id === "pane-" + id));
  if (id === "history") renderList();
};

// ===== PHOTO PREVIEW =====
window.previewPhoto = function(input, boxId, dataId) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX = 800;
      let w = img.width, h = img.height;
      if (w > MAX) { h = h * MAX / w; w = MAX; }
      if (h > MAX) { w = w * MAX / h; h = MAX; }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      const data = canvas.toDataURL('image/jpeg', 0.7);
      document.getElementById(dataId).value = data;
      const box = document.getElementById(boxId);
      const fid = input.id;
      box.innerHTML = `<img src="${data}" alt="preview"><input type="file" id="${fid}" accept="image/*" onchange="previewPhoto(this,'${boxId}','${dataId}')">`;
      document.getElementById(fid).style.display = "none";
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
};

// ===== SAVE =====
window.saveRecord = async function() {
  const date = document.getElementById("f-date").value;
  const code = document.getElementById("f-code").value.trim();
  const batch = document.getElementById("f-batch").value.trim();
  const name = document.getElementById("f-name").value.trim();
  if (!date || !code || !batch || !name) { toast("กรุณากรอกข้อมูลที่จำเป็นให้ครบ"); return; }

  const btn = document.querySelector(".btn-primary");
  btn.textContent = "กำลังบันทึก...";
  btn.disabled = true;

  try {
    const photos = ['d1','d2','d3'].map(id => document.getElementById(id).value).filter(Boolean);
    await addDoc(collection(db, "samples"), {
      date, code, batch, name, photos,
      createdAt: new Date().toISOString()
    });
    toast("บันทึกสำเร็จ ✓");
    clearForm();
  } catch (err) {
    toast("เกิดข้อผิดพลาด: " + err.message);
  } finally {
    btn.textContent = "💾 บันทึก";
    btn.disabled = false;
  }
};

// ===== CLEAR FORM =====
window.clearForm = function() {
  ["f-date","f-code","f-batch","f-name","d1","d2","d3"].forEach(id => document.getElementById(id).value = "");
  for (let n = 1; n <= 3; n++) {
    const box = document.getElementById("pb" + n);
    box.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg><span>เลือกรูป</span><input type="file" id="fi${n}" accept="image/*" onchange="previewPhoto(this,'pb${n}','d${n}')">`;
    document.getElementById("fi" + n).style.display = "none";
  }
};

// ===== RENDER LIST =====
window.renderList = function() {
  const q = (document.getElementById("sq")?.value || "").toLowerCase();
  const d = document.getElementById("sd")?.value || "";
  const filtered = records.filter(r => {
    const mq = !q || [r.code, r.batch, r.name].some(v => (v || "").toLowerCase().includes(q));
    const md = !d || r.date === d;
    return mq && md;
  });

  document.getElementById("st-total").textContent = records.length;
  document.getElementById("st-found").textContent = filtered.length;

  const el = document.getElementById("list-container");
  if (!filtered.length) {
    el.innerHTML = `<div class="empty">ไม่พบข้อมูล</div>`;
    return;
  }
  el.innerHTML = filtered.map(r => `
    <div class="rec">
      <div class="rec-top">
        <div>
          <div class="rec-name">${esc(r.name)}</div>
          <div class="badges">
            <span class="badge">📅 ${r.date}</span>
            <span class="badge blue">🏷 ${esc(r.code)}</span>
            <span class="badge">📦 ${esc(r.batch)}</span>
            ${r.photos?.length ? `<span class="badge">🖼 ${r.photos.length} รูป</span>` : ""}
          </div>
        </div>
        <button class="btn-del" onclick="confirmDelete('${r.id}')" aria-label="ลบ">🗑</button>
      </div>
      ${r.photos?.length ? `<div class="rec-photos">${r.photos.map(p => `<img src="${p}" alt="photo" onclick="openLightbox('${p}')">`).join("")}</div>` : ""}
    </div>
  `).join("");
};

// ===== DELETE WITH PIN =====
window.confirmDelete = function(id) {
  showPinModal(async () => {
    try {
      await deleteDoc(doc(db, "samples", id));
      toast("ลบเรียบร้อย");
    } catch (err) {
      toast("เกิดข้อผิดพลาด");
    }
  });
};

// ===== EXPORT =====
window.doExport = async function() {
  const q = (document.getElementById("sq")?.value || "").toLowerCase();
  const d = document.getElementById("sd")?.value || "";
  const filtered = records.filter(r => {
    const mq = !q || [r.code, r.batch, r.name].some(v => (v || "").toLowerCase().includes(q));
    const md = !d || r.date === d;
    return mq && md;
  });
  if (!filtered.length) { toast("ไม่มีข้อมูล"); return; }

  const { utils, writeFile } = await import("https://cdn.sheetjs.com/xlsx-0.20.0/package/xlsx.mjs");
  const rows = filtered.map(r => ({
    "Date": r.date, "Code": r.code, "Batch No.": r.batch, "Sampling Name": r.name,
    "มีรูป Photo 1": r.photos?.[0] ? "มี" : "-",
    "มีรูป Photo 2": r.photos?.[1] ? "มี" : "-",
    "มีรูป Photo 3": r.photos?.[2] ? "มี" : "-",
    "บันทึกเมื่อ": r.createdAt ? new Date(r.createdAt).toLocaleString("th-TH") : "-"
  }));
  const ws = utils.json_to_sheet(rows);
  ws["!cols"] = [{wch:12},{wch:14},{wch:16},{wch:30},{wch:12},{wch:12},{wch:12},{wch:20}];
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, "Sampling");
  writeFile(wb, "sampling_records.xlsx");
  toast("Export สำเร็จ ✓");
};

// ===== LIGHTBOX =====
window.openLightbox = function(src) {
  document.getElementById("lb-img").src = src;
  document.getElementById("lightbox").classList.add("open");
};
window.closeLightbox = function() {
  document.getElementById("lightbox").classList.remove("open");
};

function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2800);
}

function esc(s) {
  return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

startListener();
