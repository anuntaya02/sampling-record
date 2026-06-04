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

const CLOUD_NAME = "dcb3uszd0";
const UPLOAD_PRESET = "yejmrz4d";
const CLOUDINARY_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;
const ADMIN_PIN = "1166";

const fbApp = initializeApp(firebaseConfig);
const db = getFirestore(fbApp);
let records = [];
let pendingAction = null;

// ===== CLOUDINARY UPLOAD =====
async function uploadToCloudinary(base64data) {
  const blob = await fetch(base64data).then(r => r.blob());
  const formData = new FormData();
  formData.append('file', blob);
  formData.append('upload_preset', UPLOAD_PRESET);
  formData.append('folder', 'qap-sampling');
  const res = await fetch(CLOUDINARY_URL, { method: 'POST', body: formData });
  if (!res.ok) throw new Error('Cloudinary upload failed');
  const data = await res.json();
  return data.secure_url;
}

// ===== VALIDATION (Code only - no first digit restriction) =====
window.validateCode = function(input) {
  const val = input.value;
  const hint = document.getElementById('hint-code');
  input.classList.remove('invalid','valid');
  hint.className = 'field-hint';
  if (!val) { hint.textContent = ''; return; }
  hint.className = 'field-hint ok';
  hint.textContent = `${val.length} digits`;
};

// ===== PIN MODAL =====
function showPinModal(action) {
  pendingAction = action;
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
    document.getElementById("pin-modal").classList.remove("open");
    if (pendingAction) pendingAction();
    pendingAction = null;
  } else {
    document.getElementById("pin-error").style.display = "block";
    document.getElementById("pin-input").value = "";
    document.getElementById("pin-input").focus();
  }
};
window.pinKeydown = function(e) { if (e.key === "Enter") window.submitPin(); };

// ===== REALTIME =====
function startListener() {
  const q = query(collection(db, "samples"), orderBy("createdAt", "desc"));
  onSnapshot(q, (snapshot) => {
    records = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderList();
    setSync(true);
  }, (err) => { console.error(err); setSync(false); });
}
function setSync(ok) {
  document.getElementById("sync-dot").className = "dot " + (ok ? "online" : "error");
  document.getElementById("sync-txt").textContent = ok ? "Connected" : "Disconnected";
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
  if (!date || !code || !batch || !name) { toast("Please fill in all required fields"); return; }

  const btn = document.querySelector(".btn-primary");
  btn.textContent = "Uploading...";
  btn.disabled = true;

  try {
    const photoURLs = [];
    for (let n = 1; n <= 3; n++) {
      const data = document.getElementById("d" + n).value;
      if (data) {
        btn.textContent = `Uploading photo ${n}...`;
        const url = await uploadToCloudinary(data);
        photoURLs.push(url);
      }
    }
    btn.textContent = "Saving...";
    await addDoc(collection(db, "samples"), {
      date, code, batch, name,
      photos: photoURLs,
      createdAt: new Date().toISOString()
    });
    toast("Saved successfully ✓");
    clearForm();
  } catch (err) {
    console.error(err);
    toast("Error: " + err.message);
  } finally {
    btn.textContent = "💾 Save";
    btn.disabled = false;
  }
};

// ===== CLEAR FORM =====
window.clearForm = function() {
  ["f-date","f-code","f-batch","f-name","d1","d2","d3"].forEach(id => document.getElementById(id).value = "");
  document.getElementById("f-code").classList.remove('valid','invalid');
  const hint = document.getElementById("hint-code");
  if (hint) { hint.textContent = ''; hint.className = 'field-hint'; }
  for (let n = 1; n <= 3; n++) {
    const box = document.getElementById("pb" + n);
    box.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg><span>Add Picture</span><input type="file" id="fi${n}" accept="image/*" onchange="previewPhoto(this,'pb${n}','d${n}')">`;
    document.getElementById("fi" + n).style.display = "none";
  }
};

// ===== DATE FILTER =====
window.clearDateFilter = function() {
  document.getElementById("fd-day").value = "";
  document.getElementById("fd-month").value = "";
  document.getElementById("fd-year").value = "";
  renderList();
};

// ===== TOGGLE ACCORDION =====
window.toggleRec = function(id) {
  const body = document.getElementById('body-' + id);
  const arrow = document.getElementById('arrow-' + id);
  if (!body) return;
  const isOpen = body.classList.contains('open');
  body.classList.toggle('open', !isOpen);
  arrow.classList.toggle('open', !isOpen);
};

// ===== RENDER LIST =====
window.renderList = function() {
  const q = (document.getElementById("sq")?.value || "").toLowerCase();
  const fDay = document.getElementById("fd-day")?.value || "";
  const fMonth = document.getElementById("fd-month")?.value || "";
  const fYear = document.getElementById("fd-year")?.value || "";

  const filtered = records.filter(r => {
    const mq = !q || [r.code, r.batch, r.name].some(v => (v || "").toLowerCase().includes(q));
    // date format: YYYY-MM-DD
    const parts = (r.date || "").split("-");
    const rYear = parts[0] || "";
    const rMonth = parts[1] || "";
    const rDay = parts[2] || "";
    const mDay = !fDay || rDay === fDay;
    const mMonth = !fMonth || rMonth === fMonth;
    const mYear = !fYear || rYear === fYear;
    return mq && mDay && mMonth && mYear;
  });

  document.getElementById("st-total").textContent = records.length;
  document.getElementById("st-found").textContent = filtered.length;

  const el = document.getElementById("list-container");
  if (!filtered.length) {
    el.innerHTML = `<div class="empty">No records found</div>`;
    return;
  }

  el.innerHTML = filtered.map(r => `
    <div class="rec">
      <div class="rec-header" onclick="toggleRec('${r.id}')">
        <div class="rec-header-left">
          <div style="font-weight:500;font-size:14px">${esc(r.name)}</div>
          <div class="badges">
            <span class="badge">📅 ${r.date}</span>
            <span class="badge blue">🏷 ${esc(r.code)}</span>
            <span class="badge">📦 ${esc(r.batch)}</span>
            ${r.photos?.length ? `<span class="badge">🖼 ${r.photos.length} pic</span>` : ""}
          </div>
        </div>
        <div class="rec-header-right">
          <button class="btn-del" onclick="event.stopPropagation();confirmDelete('${r.id}')" aria-label="Delete">🗑</button>
          <span class="rec-toggle" id="arrow-${r.id}">▼</span>
        </div>
      </div>
      <div class="rec-body" id="body-${r.id}">
        <div class="rec-meta">
          <span><strong>Date:</strong> ${r.date}</span>
          <span><strong>Code:</strong> ${esc(r.code)}</span>
          <span><strong>Batch No.:</strong> ${esc(r.batch)}</span>
          <span><strong>Inspector:</strong> ${esc(r.name)}</span>
          <span><strong>Recorded:</strong> ${r.createdAt ? new Date(r.createdAt).toLocaleString('en-GB') : '-'}</span>
        </div>
        ${r.photos?.length ? `<div class="rec-photos" style="margin-top:10px">${r.photos.map(p => `<img src="${p}" alt="photo" onclick="openLightbox('${p}')">`).join("")}</div>` : '<div style="font-size:12px;color:var(--text-muted);margin-top:8px">No pictures attached</div>'}
      </div>
    </div>
  `).join("");
};

// ===== DELETE WITH PIN =====
window.confirmDelete = function(id) {
  showPinModal(async () => {
    try {
      await deleteDoc(doc(db, "samples", id));
      toast("Deleted successfully");
    } catch (err) { toast("Error deleting record"); }
  });
};

// ===== EXPORT =====
window.doExport = async function() {
  const q = (document.getElementById("sq")?.value || "").toLowerCase();
  const fDay = document.getElementById("fd-day")?.value || "";
  const fMonth = document.getElementById("fd-month")?.value || "";
  const fYear = document.getElementById("fd-year")?.value || "";

  const filtered = records.filter(r => {
    const mq = !q || [r.code, r.batch, r.name].some(v => (v || "").toLowerCase().includes(q));
    const parts = (r.date || "").split("-");
    const mDay = !fDay || (parts[2] || "") === fDay;
    const mMonth = !fMonth || (parts[1] || "") === fMonth;
    const mYear = !fYear || (parts[0] || "") === fYear;
    return mq && mDay && mMonth && mYear;
  });
  if (!filtered.length) { toast("No data to export"); return; }

  const { utils, writeFile } = await import("https://cdn.sheetjs.com/xlsx-0.20.0/package/xlsx.mjs");
  const ws = utils.aoa_to_sheet([["Date","Code","Batch No.","Inspector","Picture 1","Picture 2","Picture 3","Recorded At"]]);

  filtered.forEach((r, i) => {
    const row = i + 2;
    utils.sheet_add_aoa(ws, [[
      r.date, r.code, r.batch, r.name,
      r.photos?.[0] || "-",
      r.photos?.[1] || "-",
      r.photos?.[2] || "-",
      r.createdAt ? new Date(r.createdAt).toLocaleString('en-GB') : "-"
    ]], { origin: `A${row}` });

    ['E','F','G'].forEach((col, ci) => {
      const url = r.photos?.[ci];
      if (url) {
        const cellRef = `${col}${row}`;
        if (!ws[cellRef]) ws[cellRef] = { t: 's', v: url };
        ws[cellRef].l = { Target: url, Tooltip: `Click to view Picture ${ci+1}` };
      }
    });
  });

  ws["!cols"] = [{wch:12},{wch:16},{wch:14},{wch:20},{wch:12},{wch:12},{wch:12},{wch:22}];
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, "Sampling");
  writeFile(wb, "sampling_records_v2.xlsx");
  toast("Export successful ✓ — Photos are clickable links");
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
