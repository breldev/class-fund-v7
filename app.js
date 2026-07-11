let paymentHistory =
JSON.parse(
  localStorage.getItem("paymentHistory")
) || [];

let archives =
JSON.parse(localStorage.getItem("archives")) || [];

let expenses =
JSON.parse(localStorage.getItem("expenses")) || [];


function renderUnidentifiedWidget(){
  var body = $("unidentifiedWidgetBody");
  if (!body) return;
  if (!unidentifiedFunds.length) {
    body.innerHTML = '<div class="uf-empty">No unidentified funds</div>';
    return;
  }
  var html = "";
  unidentifiedFunds.forEach(function(f){
    html += '<div class="uf-item">' +
      '<div class="uf-left">' +
        '<span class="uf-amount">₱' + toNumber(f.amount).toLocaleString() + '</span>' +
        '<span class="uf-meta">' + escHtml(f.date || "") + (f.note ? " — " + escHtml(f.note) : "") + '</span>' +
      '</div>' +
      '<div class="uf-actions">' +
        '<button class="uf-btn uf-btn-assign" onclick="showAssignUnidentifiedModal(\'' + f.id + '\')">Assign</button>' +
        '<button class="uf-btn uf-btn-delete" onclick="deleteUnidentifiedFund(\'' + f.id + '\')">Delete</button>' +
      '</div>' +
    '</div>';
  });
  body.innerHTML = html;
}

function renderAnalytics(){

  if(!archives.length) return;

  const best = archives.reduce(
    (a,b)=>
    b.collected > a.collected
      ? b
      : a
  );

  const avg =
  archives.reduce(
    (sum,a)=>
    sum + a.collected,
    0
  ) / archives.length;

  $("bestMonth").innerText =
    best.month;

  $("highestCollection").innerText =
    "₱" +
    best.collected.toLocaleString();

  $("averageCollection").innerText =
    "₱" +
    Math.round(avg).toLocaleString();

  // Trend chart
  var canvas = $("trendChart");
  if(canvas && canvas.getContext){
    var ctx = canvas.getContext("2d");
    var W = canvas.width, H = canvas.height;
    ctx.clearRect(0,0,W,H);
    if(archives.length >= 2){
      var vals = archives.slice().reverse().map(function(a){ return a.collected; });
      var max = Math.max(...vals, 1);
      var pad = 20;
      var stepX = (W - pad*2) / (vals.length-1 || 1);
      ctx.beginPath();
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 2;
      vals.forEach(function(v,i){
        var x = pad + i * stepX;
        var y = H - pad - ((v / max) * (H - pad*2));
        i === 0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
      });
      ctx.stroke();
      ctx.lineTo(pad + (vals.length-1)*stepX, H - pad);
      ctx.lineTo(pad, H - pad);
      ctx.closePath();
      ctx.fillStyle = "rgba(56,189,248,.12)";
      ctx.fill();
    }
  }
}
// ================= SAFE STORAGE =================
function generateStudentCode(){
  var chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  var code = "";
  for(var i = 0; i < 5; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}

function loadStudents(){
  try{
    return JSON.parse(localStorage.getItem("students")) || [];
  }catch{
    return [];
  }
}

let students = loadStudents();
let startDate = localStorage.getItem("startDate") || null;
let skippedWeeks =
JSON.parse(localStorage.getItem("skippedWeeks")) || [];
let lastImportedStudentIds =
JSON.parse(localStorage.getItem("lastImportedStudentIds")) || [];
let manualWeekOverride =
localStorage.getItem("manualWeekOverride") || null;
let unidentifiedFunds =
JSON.parse(localStorage.getItem("unidentifiedFunds")) || [];

var _sortCol = null;
var _sortDir = 1;
var _statusFilter = "all";
var _expandedIds = new Set();
var _modalStudentId = null;
var _selectedStudentIds = new Set();
var _expenseCategoryFilter = "all";
var _expenseDateFrom = "", _expenseDateTo = "";
var _page = 0;
var _pageSize = 25;
var _lastSaveTime = Date.now();
var _autoBackupDate = localStorage.getItem("autoBackupDate") || "";
var _adminMode = false;

// ================= PREFERENCES =================
var _prefs = {
  accent: "indigo",
  density: "comfortable",
  widgets: {
    finance: { visible: true, order: 0, pinned: false },
    status: { visible: true, order: 1, pinned: false },
    insights: { visible: true, order: 2, pinned: false }
  }
};
function loadPrefs(){
  try{
    var saved = JSON.parse(localStorage.getItem("cfPrefs"));
    if(saved){
      if(saved.accent) _prefs.accent = saved.accent;
      if(saved.density) _prefs.density = saved.density;
      if(saved.widgets){
        Object.keys(_prefs.widgets).forEach(function(k){
          if(saved.widgets[k]){
            if(saved.widgets[k].visible !== undefined) _prefs.widgets[k].visible = saved.widgets[k].visible;
            if(saved.widgets[k].order !== undefined) _prefs.widgets[k].order = saved.widgets[k].order;
            if(saved.widgets[k].pinned !== undefined) _prefs.widgets[k].pinned = saved.widgets[k].pinned;
          }
        });
      }
    }
  }catch(e){}
}
function savePrefs(){
  localStorage.setItem("cfPrefs", JSON.stringify(_prefs));
}
function applyPrefs(){
  // Accent
  document.documentElement.setAttribute("data-accent", _prefs.accent);
  document.querySelectorAll(".accent-dot").forEach(function(d){
    d.classList.toggle("active", d.getAttribute("data-accent") === _prefs.accent);
  });
  // Density
  document.documentElement.setAttribute("data-density", _prefs.density);
  var densityBtns = document.querySelectorAll(".density-btn");
  densityBtns.forEach(function(b){
    b.classList.toggle("active", b.getAttribute("data-density") === _prefs.density);
  });
  // Theme
  var t = localStorage.getItem("cf-theme");
  if(t === "day") document.documentElement.setAttribute("data-theme", "day");
  else document.documentElement.removeAttribute("data-theme");
  updateThemeLabel();
  applyWidgetPrefs();
}
loadPrefs();

var EXPENSE_CATEGORIES = ["Supplies","Printing","Food","Transport","Project","Event","Misc"];

var weeklyFee = Number(localStorage.getItem("weeklyFee")) || 5;



// ================= SAFE HELPERS =================
function $(id){ return document.getElementById(id); }

function toNumber(v){
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

// ================= AVATAR COLOR =================
function getAvatarColor(name){
  var colors = [
    'linear-gradient(135deg,#6366f1,#818cf8)',
    'linear-gradient(135deg,#38bdf8,#22d3ee)',
    'linear-gradient(135deg,#34d399,#10b981)',
    'linear-gradient(135deg,#fbbf24,#f59e0b)',
    'linear-gradient(135deg,#fb7185,#f43f5e)',
    'linear-gradient(135deg,#a78bfa,#c084fc)',
    'linear-gradient(135deg,#f472b6,#ec4899)',
    'linear-gradient(135deg,#14b8a6,#0d9488)'
  ];
  var h = 0;
  for(var i=0;i<(name||'').length;i++){h=name.charCodeAt(i)+((h<<5)-h);}
  return colors[Math.abs(h)%colors.length];
}

// ================= SEARCH HIGHLIGHT =================
function highlightText(text, search){
  if(!search||!text) return text||'';
  try{
    var re = new RegExp('('+search.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','gi');
    return text.replace(re,'<mark class="hl">$1</mark>');
  }catch(e){return text;}
}

// ================= PAGINATION =================
function goToPage(p){
  _page = p;
  render();
}
function changePageSize(sz){
  _pageSize = Number(sz);
  _page = 0;
  render();
}

// ================= SAVE =================
function _saveStorage(){
  if (document.body.classList.contains("viewer-mode")) return;
  localStorage.setItem("students", JSON.stringify(students));
  localStorage.setItem("skippedWeeks", JSON.stringify(skippedWeeks));
  localStorage.setItem("expenses", JSON.stringify(expenses));
  localStorage.setItem("unidentifiedFunds", JSON.stringify(unidentifiedFunds));
  localStorage.setItem("_lastLocalSave", Date.now().toString());
}
function save(){
  _saveStorage();
  _lastSaveTime = Date.now();
  updateLastSaved();
  if (typeof firebaseData !== "undefined" && typeof cfAuth !== "undefined" && cfAuth.getCurrentUser && cfAuth.getCurrentUser()) {
    firebaseData.syncAllToFirestore().catch(function(err){
      console.error("Auto-sync failed:", err);
      showToast("Cloud sync failed: " + (err.message || err), "error");
    });
  }
}

// ================= SETTINGS =================
function saveSettings(){
  startDate = $("startDate").value;
  localStorage.setItem("startDate", startDate);

  var fee = toNumber($("weeklyFee")?.value);
  if(fee > 0){
    if (window.classSettings && window.classSettings.forceWeeklyFee && !_adminMode) {
      showToast("Weekly fee is controlled by admin", "error");
      return;
    }
    weeklyFee = fee;
    localStorage.setItem("weeklyFee", fee);
  }

  renderCalendar();
  render();
  showToast("Settings saved", "success");
}



// ================= WEEK =================
function getWeekForDate(date){
  if(!startDate) return 1;
  const start = new Date(startDate);
  start.setHours(0,0,0,0);
  const target = new Date(date);
  target.setHours(0,0,0,0);
  let weekdays = 0;
  const cursor = new Date(start);
  while(cursor <= target){
    const day = cursor.getDay();
    if(day !== 0 && day !== 6) weekdays++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return Math.max(1, Math.ceil(weekdays / 5));
}

function getCurrentWeek(){
  if(manualWeekOverride) return Number(manualWeekOverride);
  if(!startDate) return 1;
  return getWeekForDate(new Date());
}

function getMonthWeekCount(){
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const startWeek = getWeekForDate(monthStart);
  const curWeek = getCurrentWeek();
  let count = 0;
  for(let w = startWeek; w <= curWeek; w++){
    if(!isSkipped(w)) count++;
  }
  return count;
}

function getMonthPayments(student){
  const label = new Date().toLocaleString("en-US", {month:"long", year:"numeric"});
  return (student.payments||[])
    .filter(p => p.month === label)
    .reduce((s,p) => s + toNumber(p.amount), 0);
}

function getMonthDebt(student){
  const totalPaid = getTotal(student);
  const weeksCovered = Math.floor(totalPaid / weeklyFee);
  const cur = getCurrentWeek();
  let validWeeks = 0;
  for(let i = 1; i <= cur; i++){
    if(!isSkipped(i)) validWeeks++;
  }
  return Math.max(0, (validWeeks - weeksCovered) * weeklyFee);
}

function isStudentAdvanced(student){
  if (!(student.payments||[]).length) return false;
  var cur = getCurrentWeek();
  var validWeeks = 0;
  for(var i = 1; i <= cur; i++){
    if(!isSkipped(i)) validWeeks++;
  }
  return getTotal(student) > validWeeks * weeklyFee;
}

function setManualWeek(week){
  week = Number(week);
  if(!week || week < 1){ showToast("Enter a valid week (1+)", "error"); return; }
  manualWeekOverride = String(week);
  localStorage.setItem("manualWeekOverride", manualWeekOverride);
  render();
  renderCalendar();
  showToast("Week manually set to " + week, "success");
}

function clearManualWeek(){
  manualWeekOverride = null;
  localStorage.removeItem("manualWeekOverride");
  render();
  renderCalendar();
  showToast("Week override cleared, using auto-calculation", "success");
}

// ================= ADD STUDENT =================
function addStudent(){
  const name = $("studentName")?.value?.trim();
  if(!name) return;

  students.push({
    id: Date.now(),
    name,
    notes: "",
    payments:[],
    code: generateStudentCode()
  });

  $("studentName").value = "";
  save();
  render();
  showToast("Added " + name, "success");
}

function cleanImportedStudentName(line){
  return line
    .replace(/\b(MALE|FEMALE)\b/gi, " ")
    .replace(/\b(NO|NAME|STUDENT|STUDENTS|CLASS|SECTION|LIST|GRADE)\b/gi, " ")
    .replace(/^[\s\d.)-]+/g, "")
    .replace(/[^\p{L}\s.'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeImportedText(text){
  return text
    .replace(/[|]/g, " ")
    .replace(/[–—]/g, "-")
    .replace(/\t/g, "  ");
}

function splitNumberedStudentLine(line){
  const normalized = line
    .replace(/([A-Za-z])(\d{1,2}\s+[A-Z])/g, "$1 $2")
    .trim();

  const parts = normalized
    .split(/\s+(?=\d{1,2}[\s.)-]+[A-Z])/g)
    .map(part => part.trim());

  return parts.length ? parts : [line];
}

function looksLikeStudentName(name){
  const lowered = name.toLowerCase();
  const ignoredWords = new Set([
    "male",
    "female",
    "name",
    "student",
    "students",
    "class",
    "section",
    "list",
    "grade",
    "no",
    "number"
  ]);

  if(!name || name.length < 4) return false;
  if(ignoredWords.has(lowered)) return false;
  if(!/[a-z]/i.test(name)) return false;
  if(name.split(" ").length > 7) return false;
  if(/^\W+$/.test(name)) return false;

  return true;
}

function getImportedNames(text){
  const seen = new Set();
  const names = [];

  normalizeImportedText(text)
    .split(/\r?\n/)
    .flatMap(splitNumberedStudentLine)
    .map(cleanImportedStudentName)
    .filter(looksLikeStudentName)
    .forEach(name => {
      const key = name.toLowerCase();

      if(seen.has(key)) return;

      seen.add(key);
      names.push(name);
    });

  return names;
}

function setImportPreview(names){
  const preview = $("importPreview");
  const previewBox = $("importPreviewBox");

  if(!preview || !previewBox) return;

  preview.value = names.join("\n");
  previewBox.classList.toggle("show", names.length > 0);
}

function clearStudentImportPreview(){
  const preview = $("importPreview");
  const previewBox = $("importPreviewBox");
  const status = $("importStatus");

  if(preview) preview.value = "";
  if(previewBox) previewBox.classList.remove("show");
  if(status) status.innerText = "Ready to scan a student list.";
}

function addImportedStudents(names){
  const existing = new Set(
    students.map(s => (s.name || "").trim().toLowerCase())
  );

  const uniqueNames = [];
  const importedIds = [];

  names.forEach(name => {
    const key = name.toLowerCase();

    if(existing.has(key)) return;

    existing.add(key);
    uniqueNames.push(name);
  });

  uniqueNames.forEach((name,index) => {
    const id = Date.now() + index;

    students.push({
      id,
      name,
      payments:[]
    });

    importedIds.push(id);
  });

  if(uniqueNames.length){
    lastImportedStudentIds = importedIds;
    localStorage.setItem(
      "lastImportedStudentIds",
      JSON.stringify(lastImportedStudentIds)
    );

    save();
    render();
  }

  return uniqueNames.length;
}

async function importStudentsFromImage(event){
  const file = event.target.files?.[0];
  const status = $("importStatus");
  var spinner = $("ocrSpinner");

  if(!file) return;

  if(!window.Tesseract){
    if(status){
      status.innerText = "OCR library is still loading. Please try again in a moment.";
    }
    return;
  }

  try{
    if(status){
      status.innerText = "Scanning image... this can take a few seconds.";
    }
    if(spinner) spinner.style.display = "flex";

    const result = await Tesseract.recognize(file, "eng", {
      logger(progress){
        if(!status || progress.status !== "recognizing text") return;

        const percent = Math.round((progress.progress || 0) * 100);
        status.innerText = "Reading names... " + percent + "%";
      }
    });

    const names = getImportedNames(result.data.text || "");

    setImportPreview(names);

    if(status){
      status.innerText = names.length
        ? "Found " + names.length + " possible name" + (names.length === 1 ? "" : "s") + ". Review them below, then import."
        : "No names found. Try cropping only the student list or using a clearer image.";
    }
  }catch(error){
    console.error(error);

    if(status){
      status.innerText = "Could not scan this image. Try a clearer photo or screenshot.";
    }
  }finally{
    event.target.value = "";
    if(spinner) spinner.style.display = "none";
  }
}

function confirmStudentImport(){
  const preview = $("importPreview");
  const status = $("importStatus");

  if(!preview) return;

  const names = getImportedNames(preview.value);
  const added = addImportedStudents(names);

  if(status){
    status.innerText = added
      ? `Added ${added} reviewed student${added === 1 ? "" : "s"}.`
      : "No new students added. They may already exist or the preview is empty.";
  }

  if(added){
    clearStudentImportPreview();
  }
}

function undoLastStudentImport(){
  const status = $("importStatus");

  if(!lastImportedStudentIds.length){
    if(status){
      status.innerText = "There is no recent import to undo.";
    }
    return;
  }

  const ids = new Set(lastImportedStudentIds);
  const before = students.length;

  students = students.filter(function(student){ return !ids.has(student.id); });
  lastImportedStudentIds = [];

  localStorage.setItem(
    "lastImportedStudentIds",
    JSON.stringify(lastImportedStudentIds)
  );

  save();
  render();

  const removed = before - students.length;

  if(status){
    status.innerText = removed
      ? "Removed " + removed + " student" + (removed === 1 ? "" : "s") + " from the last import."
      : "No matching students from the last import were found.";
  }
}

// ================= CSV IMPORT =================
function toggleCSVImport(){
  var body = $("csvImportBody");
  var toggle = $("csvToggle");
  if(!body) return;
  var isOpen = body.style.display !== "none";
  body.style.display = isOpen ? "none" : "block";
  if(toggle) toggle.innerText = isOpen ? "▶" : "▼";
}

function getTextFromFile(file){
  return new Promise(function(resolve, reject){
    var reader = new FileReader();
    reader.onload = function(){ resolve(reader.result); };
    reader.onerror = function(){ reject(reader.error); };
    if(file.name.match(/\.(xlsx|xls)$/i)){
      reader.readAsArrayBuffer(file);
    }else{
      reader.readAsText(file);
    }
  });
}

function parseCSVText(text){
  var lines = text.split(/\r?\n/).filter(function(l){ return l.trim(); });
  if(!lines.length) return [];
  // Try to find a "Name" or "Student" column
  var header = lines[0].toLowerCase();
  var colIdx = -1;
  var cols = lines[0].split(/[,\t]/).map(function(c){ return c.trim().toLowerCase(); });
  var nameKeywords = ["name", "student", "fullname", "full name", "student name", "names", "students"];
  nameKeywords.forEach(function(kw){
    var idx = cols.indexOf(kw);
    if(idx !== -1) colIdx = idx;
  });
  if(colIdx !== -1){
    // Extract from that column (skip header)
    return lines.slice(1).map(function(line){
      var parts = line.split(/[,\t]/);
      return parts[colIdx] ? parts[colIdx].trim() : "";
    }).filter(function(n){ return n; });
  }
  // Otherwise treat each line as a name
  return lines;
}

function parseExcelFile(buffer){
  // Use a simple approach - read XLSX via SheetJS if available
  if(typeof XLSX !== "undefined"){
    var workbook = XLSX.read(new Uint8Array(buffer), {type:"array"});
    var firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    var json = XLSX.utils.sheet_to_json(firstSheet, {header:1});
    var lines = json.map(function(row){
      if(Array.isArray(row)) return row.filter(function(c){ return c; }).join("\t");
      return Object.values(row).join("\t");
    });
    return parseCSVText(lines.join("\n"));
  }
  return [];
}

async function importStudentsFromCSV(event){
  var file = event.target.files?.[0];
  var status = $("csvImportStatus");
  if(!file) return;
  try{
    if(status) status.innerText = "Reading file...";
    var text = await getTextFromFile(file);
    var names;
    if(file.name.match(/\.(xlsx|xls)$/i)){
      names = parseExcelFile(text);
    }else{
      names = parseCSVText(text);
    }
    // Clean names like OCR does
    var cleaned = [];
    names.forEach(function(n){
      var c = cleanImportedStudentName(n);
      if(c) cleaned.push(c);
    });
    // Deduplicate
    var unique = [];
    var seen = {};
    cleaned.forEach(function(n){
      if(!seen[n.toLowerCase()]){ seen[n.toLowerCase()] = true; unique.push(n); }
    });
    var preview = $("csvImportPreview");
    if(preview) preview.value = unique.join("\n");
    if(status){
      status.innerText = unique.length
        ? "Found " + unique.length + " name" + (unique.length === 1 ? "" : "s") + ". Review and import below."
        : "No names found in the file.";
    }
  }catch(error){
    console.error(error);
    if(status) status.innerText = "Error reading file: " + error.message;
  }finally{
    event.target.value = "";
  }
}

function confirmCSVImport(){
  var preview = $("csvImportPreview");
  var status = $("csvImportStatus");
  if(!preview) return;
  var names = preview.value.split("\n").map(function(l){ return l.trim(); }).filter(function(l){ return l; });
  var addedCount = 0;
  var nameSet = {};
  students.forEach(function(s){ nameSet[s.name.toLowerCase()] = true; });
  names.forEach(function(name){
    if(nameSet[name.toLowerCase()]) return;
    students.push({ id: Date.now() + Math.floor(Math.random() * 1000), name: name, notes: "", payments: [] });
    nameSet[name.toLowerCase()] = true;
    addedCount++;
  });
  if(addedCount){
    save();
    render();
    preview.value = "";
  }
  if(status){
    status.innerText = addedCount
      ? "Imported " + addedCount + " student" + (addedCount === 1 ? "" : "s") + "."
      : "No new students added. They may already exist.";
  }
}

// ================= ADD PAYMENT =================
function addPayment(){
  const id = toNumber($("studentSelect")?.value);
  const amount = toNumber($("paymentAmount")?.value);

  if(!id){
    alert("Please select a student first.");
    return;
  }

  if(amount <= 0){
    alert("Please enter a valid payment amount.");
    return;
  }

  const s = students.find(x=>x.id===id);
  if(!s){
    alert("Selected student not found. Please refresh the student list.");
    renderSelect();
    return;
  }

  const now = new Date();

  s.payments.push({
    amount,
    date: now.toLocaleString(),
    month: now.toLocaleString("en-US",{
      month:"long",
      year:"numeric"
    }),
    week: getCurrentWeek()
  });

  $("paymentAmount").value = "";
  save();
  render();
  showToast("₱" + amount + " added for " + s.name, "success");
}

function getTotalCollected(){
  return students.reduce((sum,student) => sum + getTotal(student),0);
}

function getTotalExpenses(){
  return expenses.reduce((sum,expense) => sum + toNumber(expense.amount),0);
}

function getTotalUnidentified(){
  return unidentifiedFunds.reduce(function(sum, f){ return sum + toNumber(f.amount); }, 0);
}

function addUnidentifiedFund(amount, date, note){
  if (!amount || amount <= 0) { showToast("Enter a valid amount", "error"); return; }
  unidentifiedFunds.push({
    id: "uf_" + Date.now() + "_" + Math.random().toString(36).slice(2,6),
    amount: toNumber(amount),
    date: date || new Date().toISOString().slice(0,10),
    note: note || "",
    createdAt: Date.now()
  });
  save();
  render();
  showToast("Unidentified fund added", "success");
}

function deleteUnidentifiedFund(id){
  unidentifiedFunds = unidentifiedFunds.filter(function(f){ return f.id !== id; });
  save();
  render();
}

function assignUnidentifiedFund(fundId, studentId, assignAmount){
  var fund = unidentifiedFunds.find(function(f){ return f.id === fundId; });
  if (!fund) { showToast("Fund not found", "error"); return; }
  var student = students.find(function(s){ return s.id === studentId; });
  if (!student) { showToast("Student not found", "error"); return; }

  assignAmount = toNumber(assignAmount);
  if (assignAmount <= 0 || assignAmount > fund.amount) {
    showToast("Invalid amount", "error");
    return;
  }

  if (!student.payments) student.payments = [];
  var week = getCurrentWeek();
  student.payments.push({
    week: week,
    amount: assignAmount,
    date: new Date().toISOString().slice(0,10)
  });

  var remaining = fund.amount - assignAmount;
  if (remaining <= 0) {
    unidentifiedFunds = unidentifiedFunds.filter(function(f){ return f.id !== fundId; });
  } else {
    fund.amount = remaining;
  }

  save();
  render();
  showToast("₱" + assignAmount.toLocaleString() + " assigned to " + student.name, "success");
}

function readReceiptImage(file){
  return new Promise((resolve,reject) => {
    if(!file){
      resolve(null);
      return;
    }

    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function toggleFundSplit(){
  const splitDiv = $("fundSplit");
  const amountField = $("expenseAmount");
  const fund = $("expenseFund")?.value;
  if(fund === "both"){
    if(splitDiv) splitDiv.style.display = "flex";
    if(amountField) amountField.value = "";
  }else{
    if(splitDiv) splitDiv.style.display = "none";
  }
}

function updateSplitTotal(){
  const eventVal = toNumber($("eventAmount")?.value);
  const reserveVal = toNumber($("reserveAmount")?.value);
  const amountField = $("expenseAmount");
  if(amountField) amountField.value = eventVal + reserveVal || "";
}

async function addExpense(){
  const title = $("expenseTitle")?.value?.trim();
  const fund = $("expenseFund")?.value || "event";
  let amount, eventAmount, reserveAmount;

  if(!title){
    var el = $("expenseTitle");
    if(el){ el.focus(); el.style.outline="2px solid var(--rose)"; setTimeout(function(){el.style.outline="";},1500); }
    showToast("Enter an expense description", "error");
    return;
  }

  if(fund === "both"){
    eventAmount = toNumber($("eventAmount")?.value);
    reserveAmount = toNumber($("reserveAmount")?.value);
    if(eventAmount <= 0 || reserveAmount <= 0){
      var el = $("eventAmount");
      if(el){ el.focus(); el.style.outline="2px solid var(--rose)"; setTimeout(function(){el.style.outline="";},1500); }
      showToast("Enter valid event and reserve amounts", "error");
      return;
    }
    amount = eventAmount + reserveAmount;
  }else{
    amount = toNumber($("expenseAmount")?.value);
    if(amount <= 0){
      var el = $("expenseAmount");
      if(el){ el.focus(); el.style.outline="2px solid var(--rose)"; setTimeout(function(){el.style.outline="";},1500); }
      showToast("Enter a valid expense amount", "error");
      return;
    }
  }

  const date = $("expenseDate")?.value || new Date().toISOString().slice(0,10);
  const receiptFile = $("expenseReceipt")?.files?.[0];

  let receipt = null;

  try{
    receipt = await readReceiptImage(receiptFile);
  }catch(error){
    console.error(error);
    alert("Could not read the receipt image. Try another image.");
    return;
  }

  const expense = {
    id: Date.now(),
    title,
    amount,
    date,
    fund,
    receipt
  };

  if(fund === "both"){
    expense.eventAmount = eventAmount;
    expense.reserveAmount = reserveAmount;
  }

  expenses.push(expense);

  $("expenseTitle").value = "";
  $("expenseAmount").value = "";
  if($("eventAmount")) $("eventAmount").value = "";
  if($("reserveAmount")) $("reserveAmount").value = "";
  $("expenseDate").value = "";
  if($("expenseFund")) $("expenseFund").value = "event";
  if($("fundSplit")) $("fundSplit").style.display = "none";
  if($("expenseReceipt")) $("expenseReceipt").value = "";

  save();
  render();
  showToast("Expense added: " + title, "success");
}

function deleteExpense(id){
  var idx = expenses.findIndex(function(e){ return e.id === id; });
  if(idx === -1) return;
  var backup = {...expenses[idx]};
  expenses = expenses.filter(function(e){ return e.id !== id; });
  save();
  render();
  showUndoToast("Expense deleted", function(){
    expenses.push(backup);
    save();
    render();
    showToast("Expense restored", "success");
  }, 4000);
}

function editExpense(id){
  var e = expenses.find(function(x){ return x.id === id; });
  if(!e) return;
  var body =
    '<div style="display:grid;gap:10px;">' +
      '<label style="font-size:13px;font-weight:700;">Description</label>' +
      '<input id="editExpTitle" value="' + (e.title||"").replace(/"/g,"&quot;") + '">' +
      '<label style="font-size:13px;font-weight:700;">Amount</label>' +
      '<input id="editExpAmount" type="number" value="' + e.amount + '">' +
      '<label style="font-size:13px;font-weight:700;">Date</label>' +
      '<input id="editExpDate" type="date" value="' + (e.date || "") + '">' +
      '<label style="font-size:13px;font-weight:700;">Category</label>' +
      '<select id="editExpCategory">' +
        EXPENSE_CATEGORIES.map(function(c){ return '<option value="' + c + '"' + (e.category === c ? " selected" : "") + ">" + c + "</option>"; }).join("") +
      "</select>" +
    "</div>";
  showConfirmDialog(body, function(){
    var newTitle = $("editExpTitle")?.value?.trim();
    var newAmount = toNumber($("editExpAmount")?.value);
    var newDate = $("editExpDate")?.value;
    var newCategory = $("editExpCategory")?.value;
    if(!newTitle || newAmount <= 0) return;
    e.title = newTitle;
    e.amount = newAmount;
    if(newDate) e.date = newDate;
    if(newCategory) e.category = newCategory;
    save();
    render();
    showToast("Expense updated", "success");
  });
}

function renderExpenses(){
  const tbody = $("expenseTable");
  if(tbody){
    var tblEl = tbody.closest("table");
    if(tblEl) tblEl.classList.add("table-upgraded", "exp-tbl");
  }
  const total = getTotalExpenses();
  const balance = getTotalCollected() + getTotalUnidentified() - total;

  if($("expenseTotal")) animateNumber($("expenseTotal"), total);
  if($("netBalance")) animateNumber($("netBalance"), balance);
  if($("expensesPageTotal")) animateNumber($("expensesPageTotal"), total);
  if($("expensesPageBalance")) animateNumber($("expensesPageBalance"), balance);

  const collected = getTotalCollected();
  const eventExpTotal = expenses.reduce((s,e) => {
    if(e.fund === "both") return s + toNumber(e.eventAmount || 0);
    if((e.fund || "event") === "event") return s + toNumber(e.amount);
    return s;
  }, 0);
  const reserveExpTotal = expenses.reduce((s,e) => {
    if(e.fund === "both") return s + toNumber(e.reserveAmount || 0);
    if(e.fund === "reserve") return s + toNumber(e.amount);
    return s;
  }, 0);
  const grossEvent = collected * 0.70;
  const grossReserve = collected * 0.30;
  if($("expensesPageEventAlloc")) animateNumber($("expensesPageEventAlloc"), grossEvent);
  if($("expensesPageReserveAlloc")) animateNumber($("expensesPageReserveAlloc"), grossReserve);
  if($("expensesPageEventSpent")) animateNumber($("expensesPageEventSpent"), eventExpTotal);
  if($("expensesPageReserveSpent")) animateNumber($("expensesPageReserveSpent"), reserveExpTotal);
  if($("expensesPageEventAvail")) animateNumber($("expensesPageEventAvail"), Math.max(0, grossEvent - eventExpTotal));
  if($("expensesPageReserveAvail")) animateNumber($("expensesPageReserveAvail"), Math.max(0, grossReserve - reserveExpTotal));

  if(!tbody) return;

  // Category totals
  var catTotalsEl = $("categoryTotals");
  if(catTotalsEl){
    var catTotals = getExpenseCategoryTotals();
    catTotalsEl.innerHTML = EXPENSE_CATEGORIES.filter(function(c){ return (catTotals[c]||0) > 0; }).map(function(c){
      return '<span class="cat-total-badge">' + c + ": ₱" + catTotals[c].toLocaleString() + "</span>";
    }).join("") || '<span class="muted-text">No expenses</span>';
  }

  // Page expense chart
  renderPageExpenseChart();

  tbody.innerHTML = "";

  // Filter by category + date range
  var filtered = expenses.filter(function(e){
    if(_expenseCategoryFilter !== "all" && e.category !== _expenseCategoryFilter) return false;
    if(_expenseDateFrom && e.date && e.date < _expenseDateFrom) return false;
    if(_expenseDateTo && e.date && e.date > _expenseDateTo) return false;
    return true;
  });

  if(!filtered.length){
    tbody.innerHTML =
      '<tr><td colspan="7"><div class="empty-state" style="text-align:center;padding:30px;color:var(--muted);">' +
      '<div class="empty-icon" style="font-size:28px;margin-bottom:6px;">📋</div>No expenses match your filters.</div></td></tr>';
    return;
  }

  tbody.innerHTML = filtered
    .slice()
    .sort((a,b) => new Date(b.date) - new Date(a.date))
    .map(expense => {
      const fund = expense.fund || "event";
      let fundLabel;
      if(fund === "both"){
        fundLabel = "🎉 ₱" + expense.eventAmount + " + 🏦 ₱" + expense.reserveAmount;
      }else{
        fundLabel = fund === "event" ? "🎉 Event" : "🏦 Reserve";
      }
      return `
        <tr>
          <td>${expense.date || "-"}</td>
          <td>${expense.title}</td>
          <td><span class="chip" style="background:rgba(99,102,241,.08);color:var(--accent-300);border-color:rgba(99,102,241,.12);padding:2px 10px;font-size:10px">${expense.category || "Misc"}</span></td>
          <td>₱${toNumber(expense.amount).toLocaleString()}</td>
          <td><span class="fund-badge fund-${fund}">${fundLabel}</span></td>
          <td>
            ${
              expense.receipt
                ? `<button class="receipt-link" onclick="openReceiptModal(${expense.id})">
                    <img class="receipt-thumb" src="${expense.receipt}" alt="Receipt for ${expense.title}">
                  </button>`
                : `<span class="muted-text" style="font-size:11px">No receipt</span>`
            }
          </td>
          <td style="white-space:nowrap">
            <button class="ghost-btn" style="min-height:30px;height:30px;padding:0 10px;font-size:11px" onclick="editExpense(${expense.id})" aria-label="Edit expense">✏</button>
            <button class="ghost-btn" style="min-height:30px;height:30px;padding:0 10px;font-size:11px" onclick="deleteExpense(${expense.id})" aria-label="Delete expense">🗑</button>
          </td>
        </tr>
      `;
    }).join("");
}

function openReceiptModal(id){
  const expense = expenses.find(item => item.id === id);
  const modal = $("receiptModal");
  const image = $("receiptPreviewImage");

  if(!expense?.receipt || !modal || !image) return;

  image.src = expense.receipt;
  modal.style.display = "flex";
}

function closeReceiptModal(){
  const modal = $("receiptModal");
  const image = $("receiptPreviewImage");
  if(!modal) return;
  const content = modal.querySelector(".modal-content");
  content && content.classList.add("closing");
  modal.classList.add("closing");
  setTimeout(function(){
    if(image) image.src = "";
    modal.style.display = "none";
    content && content.classList.remove("closing");
    modal.classList.remove("closing");
  }, 300);
}

// ================= COMPUTE =================
function getTotal(s){
  return (s.payments||[]).reduce((a,b)=>a + toNumber(b.amount),0);
}

// ================= DELETE =================
function deleteStudent(id){
  var s = students.find(function(x){return x.id===id;});
  if(!s) return;
  showConfirmDialog("Delete <strong>" + s.name + "</strong> and all their payments?", function(){
    students = students.filter(function(x){return x.id!==id;});
    save();
    render();
    showToast("Deleted " + s.name, "success");
  });
}

function deletePayment(id,i){
  const s = students.find(x=>x.id===id);
  if(!s || !s.payments[i]) return;
  const backup = {...s.payments[i]};
  s.payments.splice(i, 1);
  save();
  render();
  if(_modalStudentId && $("studentModal")?.style.display === "flex") viewStudent(_modalStudentId);
  showUndoToast("Payment deleted", function(){
    s.payments.splice(i, 0, backup);
    save();
    render();
    showToast("Payment restored", "success");
  }, 4000);
}

// ================= EDIT PAYMENT =================
function editPayment(studentId,index){
  var s = students.find(function(x){ return x.id===studentId; });
  if(!s || !s.payments[index]) return;
  var current = s.payments[index];
  var body =
    '<div style="display:grid;gap:10px;">' +
      '<label style="font-size:13px;font-weight:700;">Amount</label>' +
      '<input id="editPayAmount" type="number" value="' + current.amount + '">' +
      '<label style="font-size:13px;font-weight:700;">Date</label>' +
      '<input id="editPayDate" type="date" value="' + (current.date || "") + '">' +
      '<label style="font-size:13px;font-weight:700;">Month</label>' +
      '<input id="editPayMonth" value="' + (current.month || "") + '">' +
      '<label style="font-size:13px;font-weight:700;">Type</label>' +
      '<input id="editPayType" value="' + (current.type || "Cash") + '">' +
    "</div>";
  showConfirmDialog(body, function(){
    var amt = toNumber($("editPayAmount")?.value);
    if(amt <= 0) return;
    current.amount = amt;
    var d = $("editPayDate")?.value;
    if(d) current.date = d;
    var m = $("editPayMonth")?.value;
    if(m) current.month = m;
    var t = $("editPayType")?.value;
    if(t) current.type = t;
    save();
    render();
    showToast("Payment updated", "success");
  });
}

// ================= ANIMATION =================
function animateNumber(el,target){

  if(!el) return;

  target = toNumber(target);

  let start = performance.now();

  function run(now){
    let p = Math.min((now-start)/800,1);
    let val = Math.floor(p*target);

    el.innerText = "₱" + val.toLocaleString();

    if(p<1) requestAnimationFrame(run);
    else el.innerText = "₱" + target.toLocaleString();
  }

  requestAnimationFrame(run);
}

function animateNumberRaw(el,target,prefix){
  if(!el) return;
  target = toNumber(target);
  prefix = prefix || "";
  el.innerText = prefix + target.toLocaleString();
}

// ================= RENDER =================
function render(){

  const tbody = $("studentTable");
  if(!tbody) return;

  var tblEl = tbody.closest("table");
  if(tblEl) tblEl.classList.add("table-upgraded");

  tbody.innerHTML = "";

  const search = ($("studentSearch")?.value || $("searchInput")?.value || "").toLowerCase();
  const cur = getCurrentWeek();

  let totalCollected = 0;
  let totalDebtOwed = 0;
  var counts = { total: students.length, updated: 0, debt: 0, advanced: 0, none: 0 };

  var filtered = students.filter(function(s){
    return (s.name||"").toLowerCase().includes(search);
  });

  // Apply status filter
  if(_statusFilter !== "all"){
    filtered = filtered.filter(function(s){
      var md = getMonthDebt(s);
      if(_statusFilter === "updated") return md === 0 && (s.payments||[]).length > 0;
      if(_statusFilter === "debt") return md > 0;
      if(_statusFilter === "none") return !(s.payments||[]).length;
      if(_statusFilter === "advanced") return isStudentAdvanced(s);
      return true;
    });
  }

  // Apply sort
  if(_sortCol){
    filtered.sort(function(a,b){
      var va, vb;
      var ta = getTotal(a), tb = getTotal(b);
      var da = getMonthDebt(a), db = getMonthDebt(b);
      switch(_sortCol){
        case "name": va = (a.name||"").toLowerCase(); vb = (b.name||"").toLowerCase(); break;
        case "paid": va = ta; vb = tb; break;
        case "weeks": va = (a.payments||[]).length; vb = (b.payments||[]).length; break;
        case "debt": va = da; vb = db; break;
        case "status": va = da > 0 ? 0 : 1; vb = db > 0 ? 0 : 1; break;
        default: return 0;
      }
      return va < vb ? -_sortDir : va > vb ? _sortDir : 0;
    });
  }

  if(!filtered.length){
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:40px;color:var(--muted);font-size:14px;">' +
      (students.length ? 'No students match "' + search + '".' : 'No students yet. Add one above or import a list.') +
      '</td></tr>';
    var pagEl = document.querySelector(".pag");
    if(pagEl) pagEl.style.display = "none";
    return;
  }

  // Group by status
  var groups = { updated: [], debt: [], advanced: [], none: [] };
  filtered.forEach(function(s){
    var md = getMonthDebt(s);
    var pc = (s.payments||[]).length;
    if(isStudentAdvanced(s)) { groups.advanced.push(s); counts.advanced++; }
    else if(pc > 0 && md === 0) { groups.updated.push(s); counts.updated++; }
    else if(md > 0) { groups.debt.push(s); counts.debt++; }
    else { groups.none.push(s); counts.none++; }
    totalCollected += getTotal(s);
    totalDebtOwed += md;
  });

  // Update stats bar
  animateNumberRaw($("statTotal"), counts.total, "");
  animateNumberRaw($("statUpdated"), counts.updated, "");
  animateNumberRaw($("statDebt"), counts.debt, "");
  animateNumberRaw($("statAdvanced"), counts.advanced, "");
  animateNumberRaw($("statNone"), counts.none, "");
  animateNumberRaw($("statCollected"), totalCollected, "₱");
  animateNumberRaw($("statDebtOwed"), totalDebtOwed, "₱");

  // Pagination
  var totalFiltered = filtered.length;
  var totalPages = Math.ceil(totalFiltered / _pageSize) || 1;
  _page = Math.max(0, Math.min(_page, totalPages - 1));
  var pageStart = _page * _pageSize;
  var pageSlice = filtered.slice(pageStart, pageStart + _pageSize);
  var pageIdSet = {};
  pageSlice.forEach(function(s){ pageIdSet[s.id] = true; });

  var groupLabels = {
    advanced: "⭐ Advanced",
    updated: "🟢 Updated",
    debt: "🔴 With Debt",
    none: "⚪ No Payments"
  };

  var groupOrder = ["advanced", "updated", "debt", "none"];

  // Update sort indicators
  var headerCells = document.querySelectorAll("#page-students .sort-header th");
  headerCells.forEach(function(th){
    var onclick = th.getAttribute("onclick");
    if(!onclick) return;
    var col = onclick.replace("setSort('", "").replace("')", "");
    var base = (th.textContent || "").replace(/[ ▲▼]/g, "").trim();
    th.textContent = _sortCol === col ? base + (_sortDir === 1 ? " ▲" : " ▼") : base;
  });

  var html = "";
  var rowNum = 0;

  groupOrder.forEach(function(key){
    var group = groups[key].filter(function(s){ return pageIdSet[s.id]; });
    if(!group.length) return;
    html +=
      '<tr class="group-divider"><td colspan="10">' + groupLabels[key] + " (" + group.length + ")</td></tr>";

    group.forEach(function(s){
      var total = getTotal(s);
      var monthDebt = getMonthDebt(s);
      var payCount = (s.payments||[]).length;
      rowNum++;

      var statusClass = monthDebt > 0 ? "debt" : "ok";
      var statusLabel = monthDebt > 0 ? "🔴 DEBT" : "🟢 OK";

      // Progress bar (weeks covered vs current)
      var weeks = Math.floor(total / weeklyFee);
      var pct = cur > 0 ? Math.round((weeks / cur) * 100) : 0;
      var pctCap = Math.min(pct, 100);
      var progressBar =
        '<div class="stu-progress"><div class="stu-progress-fill" style="width:' + pctCap + '%"></div></div>' +
        '<span class="stu-progress-label">' + weeks + "/" + cur + "</span>";

      // Payment history (inline expand, grouped by month)
      var monthGroups = {};
      (s.payments||[]).forEach(function(p, i){
        var m = p.month || "Unknown";
        if(!monthGroups[m]) monthGroups[m] = [];
        monthGroups[m].push({ payment: p, index: i });
      });
      var historyItems = "";
      Object.keys(monthGroups).forEach(function(month){
        historyItems +=
          '<div class="hist-month-group">' +
            '<div class="hist-month-header" onclick="toggleMonthGroup(this)">' +
              '<span class="month-toggle">▼</span> ' + month +
            "</div>" +
            '<div class="hist-month-body">';
        monthGroups[month].forEach(function(item){
          var p = item.payment, i = item.index;
          historyItems +=
            '<div class="hist-item">' +
              "₱" + p.amount + " · " + (p.type || "Cash") + " · " + (p.date || "-") +
              ' <button class="hist-btn" onclick="event.stopPropagation();editPayment(' + s.id + "," + i + ')">✏</button>' +
              ' <button class="hist-btn" onclick="event.stopPropagation();deletePayment(' + s.id + "," + i + ')" aria-label="Delete payment">🗑</button>' +
            "</div>";
        });
        historyItems += "</div></div>";
      });

      var checked = _selectedStudentIds.has(s.id) ? " checked" : "";
      var monthWeeks = getMonthWeekCount ? getMonthWeekCount() : cur;
      var monthDisplay = "₱" + getMonthPayments(s) + " / ₱" + (monthWeeks * weeklyFee);

      html +=
        '<tr class="status-row-' + statusClass + '" data-student-id="' + s.id + '">' +
           "<td><label class=\"bulk-check-label\"><input type=\"checkbox\" class=\"bulk-check-input\" onchange=\"toggleSelectStudent(" + s.id + ")\"" + checked + "><span class=\"bulk-check-box\"></span></label></td>" +
          '<td class="row-num">' + rowNum + "</td>" +
          '<td><span class="av" style="background:' + getAvatarColor(s.name) + '">' + getInitials(s.name) + '</span><span class="student-link" onclick="viewStudent(' + s.id + ')">' + highlightText(s.name, search) + '</span> <button class="hist-btn" onclick="event.stopPropagation();editStudentName(' + s.id + ')" title="Edit name">✏</button></td>' +
          '<td data-label="Paid">₱' + total + "</td>" +
          '<td data-label="Month">' + monthDisplay + "</td>" +
          '<td data-label="Progress">' + progressBar + "</td>" +
          '<td data-label="Debt">₱' + monthDebt + "</td>" +
          '<td><span class="chip chip-' + statusClass + '">' + statusLabel + "</span></td>" +
          '<td data-label="History">' +
            '<span class="hist-toggle" onclick="toggleStudentHistory(' + s.id + ')">' +
              (_expandedIds.has(s.id) ? "▼" : "▶") + ' <span class="hist-count">' + payCount + "</span>" +
            "</span>" +
            '<div class="hist-detail" id="hist-' + s.id + '"' + (_expandedIds.has(s.id) ? "" : ' style="display:none"') + ">" +
              (historyItems || '<span class="muted-text">No payments</span>') +
            "</div>" +
          "</td>" +
          '<td><button onclick="deleteStudent(' + s.id + ')" class="ghost-btn">Delete</button></td>' +
          '<td data-label="Code"><span style="font-family:monospace;font-weight:700;color:var(--accent);letter-spacing:2px;font-size:12px;background:rgba(99,102,241,.1);padding:4px 8px;border-radius:6px;cursor:pointer" onclick="event.stopPropagation();copyStudentCode(\'' + (s.code || '') + '\')" title="Click to copy code">' + (s.code || '—') + '</span></td>' +
        "</tr>";
    });
  });
  tbody.innerHTML = html;

  // Batch bar
  var batchBar = $("batchBar");
  var batchCount = $("batchCount");
  if(batchBar && batchCount){
    batchBar.style.display = _selectedStudentIds.size > 0 ? "flex" : "none";
    batchCount.textContent = _selectedStudentIds.size + " selected";
  }

  // Pagination bar
  var pagBar = document.querySelector(".pag");
  if(!pagBar){
    var tblCard = document.querySelector(".table-card");
    if(tblCard){
      pagBar = document.createElement("div");
      pagBar.className = "pag";
      tblCard.appendChild(pagBar);
    }
  }
  if(pagBar){
    var showingFrom = totalFiltered ? pageStart + 1 : 0;
    var showingTo = Math.min(pageStart + _pageSize, totalFiltered);
    pagBar.style.display = "";
    pagBar.innerHTML =
      '<span class="pag-info">Showing ' + showingFrom + '\u2013' + showingTo + ' of ' + totalFiltered + ' students</span>' +
      '<div class="pag-ctrls">' +
        '<select class="pag-sel" onchange="changePageSize(this.value)">' +
          [10,25,50,100].map(function(sz){ return '<option value="' + sz + '"' + (_pageSize === sz ? " selected" : "") + ">" + sz + "</option>"; }).join("") +
        '</select>' +
        '<button class="pag-btn" onclick="goToPage(0)"' + (_page <= 0 ? " disabled" : "") + '\u00AB</button>' +
        '<button class="pag-btn" onclick="goToPage(' + (_page - 1) + ')"' + (_page <= 0 ? " disabled" : "") + '\u2039</button>' +
        (function(){
          var btns = "";
          var startP = Math.max(0, _page - 2);
          var endP = Math.min(totalPages - 1, _page + 2);
          if(startP > 0){ btns += '<button class="pag-btn" onclick="goToPage(0)">1</button>'; if(startP > 1) btns += '<span class="pag-info" style="padding:0 4px">...</span>'; }
          for(var p = startP; p <= endP; p++){
            btns += '<button class="pag-btn' + (p === _page ? " active" : "") + '" onclick="goToPage(' + p + ')">' + (p + 1) + "</button>";
          }
          if(endP < totalPages - 1){ if(endP < totalPages - 2) btns += '<span class="pag-info" style="padding:0 4px">...</span>'; btns += '<button class="pag-btn" onclick="goToPage(' + (totalPages - 1) + ')">' + totalPages + "</button>"; }
          return btns;
        })() +
        '<button class="pag-btn" onclick="goToPage(' + (_page + 1) + ')"' + (_page >= totalPages - 1 ? " disabled" : "") + '\u203A</button>' +
        '<button class="pag-btn" onclick="goToPage(' + (totalPages - 1) + ')"' + (_page >= totalPages - 1 ? " disabled" : "") + '\u00BB</button>' +
      '</div>';
  }

  let validWeeks = 0;

  for(let i = 1; i <= cur; i++){
    if(!isSkipped(i)) validWeeks++;
  }

  var monthWeeksCount = (typeof getMonthWeekCount === "function") ? getMonthWeekCount() : cur;
  const monthExpected =
  monthWeeksCount * weeklyFee * students.length;

  var monthTotalCollected = students.reduce(function(sum, s){ return sum + getMonthPayments(s); }, 0);

  var allTimeCollected = getTotalCollected();
  var allTimeExpected = validWeeks * weeklyFee * students.length;

  // ================= EXISTING DASHBOARD =================
  animateNumber($("collected"), allTimeCollected);
  animateNumber($("expected"), allTimeExpected);
  animateNumber($("remaining"), Math.max(0, allTimeExpected - allTimeCollected));

  if ($("dashUnidentified")) animateNumber($("dashUnidentified"), getTotalUnidentified());
  if ($("dashTotalExpenses")) animateNumber($("dashTotalExpenses"), getTotalExpenses());

  var dashUpdated = 0, dashDebt = 0, dashAdvanced = 0;
  students.forEach(function(s){
    var md = getMonthDebt(s);
    var pc = (s.payments||[]).length;
    if (isStudentAdvanced(s)) {
      dashAdvanced++;
    } else if(pc > 0 && md === 0) {
      dashUpdated++;
    } else if(md > 0) {
      dashDebt++;
    }
  });
  $("studentCount").innerText = students.length;
  $("updatedCount").innerText = dashUpdated;
  $("advancedCount").innerText = dashAdvanced;

  var pct = monthExpected > 0 ? (monthTotalCollected / monthExpected) * 100 : 0;
  var pctEl = $("dashProgressPct");
  if(pctEl) pctEl.textContent = pct.toFixed(1) + "%";
  var fillEl = $("progressFill");
  if(fillEl) fillEl.style.width = pct + "%";
  var labelEl = $("dashProgressLabel");
  if(labelEl) labelEl.textContent = "This month: PHP " + monthTotalCollected.toFixed(2) + " / PHP " + monthExpected.toFixed(2);
  var weekEl = $("dashWeekDisplay");
  var weekEl = $("dashWeekDisplay");
  if(weekEl) weekEl.textContent = getCurrentWeek();

  // ================= FUND BREAKDOWN (with expense tracking) =================
  const eventExpensesSum = expenses.reduce((s,e) => {
    if(e.fund === "both") return s + toNumber(e.eventAmount || 0);
    if((e.fund || "event") === "event") return s + toNumber(e.amount);
    return s;
  }, 0);
  const reserveExpensesSum = expenses.reduce((s,e) => {
    if(e.fund === "both") return s + toNumber(e.reserveAmount || 0);
    if(e.fund === "reserve") return s + toNumber(e.amount);
    return s;
  }, 0);
  var allCollected = getTotalCollected() + getTotalUnidentified();
  const grossEventFund = allCollected * 0.70;
  const grossReserveFund = allCollected * 0.30;
  const eventAvailable = Math.max(0, grossEventFund - eventExpensesSum);
  const reserveAvailable = Math.max(0, grossReserveFund - reserveExpensesSum);

  animateNumber($("eventAllocated"), grossEventFund);
  animateNumber($("reserveAllocated"), grossReserveFund);
  animateNumber($("eventAvailable"), eventAvailable);
  animateNumber($("reserveAvailable"), reserveAvailable);

  renderExpenses();

  var weekDisp = $("currentWeekDisplay");
  if(weekDisp){
    var w = getCurrentWeek();
    weekDisp.textContent = w;
    var label = $("weekOverrideLabel");
    if(label){
      if(manualWeekOverride){
        label.innerHTML = '🔧 Week <span id="currentWeekDisplay">' + w + '</span>';
      }else{
        label.innerHTML = '🤖 Week <span id="currentWeekDisplay">' + w + '</span>';
      }
    }
  }
  
  renderSelect();

  saveArchive();
  renderArchive();

  if(typeof renderAnalytics === "function"){
    renderAnalytics();
  }

  renderUnidentifiedWidget();

  if(typeof renderBulkTable === "function" && _bulkPayVisible){
    renderBulkTable();
  }
}

 // ================= DROPDOWN =================
function renderPaymentsForSelectedStudent(){
  const sel = $("studentSelect");
  const container = $("paymentTable");
  if(!sel || !container) return;

  const selectedId = toNumber(sel.value);
  const student = students.find(x => x.id === selectedId);

  if(!selectedId || !student){
    container.innerHTML = `
      <div class="muted-text" style="padding:12px 0 2px;">
        Select a student to view their payments.
      </div>
    `;
    return;
  }

  const payments = student.payments || [];

  if(!payments.length){
    container.innerHTML = `
      <div class="muted-text" style="padding:12px 0 2px;">
        No payments recorded for <strong>${student.name}</strong> yet.
      </div>
    `;
    return;
  }

  // Table UI (upgraded)
  const rows = payments
    .slice()
    .map((p, i) => `
      <tr>
        <td class="amt">₱${toNumber(p.amount).toLocaleString()}</td>
        <td>${p.date || "-"}</td>
        <td>${p.month || "-"}</td>
        <td style="text-align:right;white-space:nowrap">
          <button class="ghost-btn" style="min-height:30px;height:30px;padding:0 10px;font-size:11px" onclick="editPayment(${student.id},${i})">✏ Edit</button>
          <button class="ghost-btn" style="min-height:30px;height:30px;padding:0 10px;font-size:11px" onclick="deletePayment(${student.id},${i})">🗑 Delete</button>
        </td>
      </tr>
    `).join("");

  container.innerHTML = `
    <div class="tbl-wrap">
      <table class="table-upgraded pay-tbl">
        <thead>
          <tr>
            <th>Amount</th>
            <th>Date</th>
            <th>Month</th>
            <th style="text-align:right">Action</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;
}

function renderSelect(){

  const sel = $("studentSelect");
  if(!sel) return;

  const search = ($("paymentStudentSearch")?.value || "").toLowerCase();

  // Preserve selection across rebuild
  const prevSelectedId = toNumber(sel.value);

  sel.innerHTML = "";

  const filtered = students
    .filter(s => (s.name || "").toLowerCase().includes(search));

  if(!filtered.length){
    sel.innerHTML = `<option value="">No students found</option>`;
    // If we show placeholder, clear payments list
    if(typeof renderPaymentsForSelectedStudent === "function"){
      renderPaymentsForSelectedStudent();
    }
    return;
  }

  sel.innerHTML = filtered.map(s => `<option value="${s.id}">${s.name}</option>`).join("");

  // Restore previous selection if it still matches search; otherwise auto-select first
  const stillExists = filtered.some(s => s.id === prevSelectedId);

  if(stillExists){
    sel.value = String(prevSelectedId);
  }else{
    sel.value = String(filtered[0].id);
  }

  if(typeof renderPaymentsForSelectedStudent === "function"){
    renderPaymentsForSelectedStudent();
  }
}

// ================= BULK PAYMENT EDITOR =================
var _bulkPayVisible = true;

function toggleBulkPay(){
  _bulkPayVisible = !_bulkPayVisible;
  var section = $("bulkPaySection");
  var toggle = $("bulkToggle");
  if(section) section.style.display = _bulkPayVisible ? "" : "none";
  if(toggle) toggle.textContent = _bulkPayVisible ? "▼" : "▶";
  if(_bulkPayVisible) renderBulkTable();
}

function renderBulkTable(){
  var container = $("bulkTableContainer");
  if(!container) return;

  var search = ($("paymentStudentSearch")?.value || "").toLowerCase();
  var filtered = students
    .filter(s => (s.name || "").toLowerCase().includes(search))
    .slice()
    .sort(function(a,b){
      var na = (a.name||"").toLowerCase();
      var nb = (b.name||"").toLowerCase();
      return na < nb ? -1 : na > nb ? 1 : 0;
    });

  if(!filtered.length){
    container.innerHTML = '<p class="muted-text">No students found.</p>';
    return;
  }

  var html = "";

  filtered.forEach(function(s, i){
    var monthDebt = getMonthDebt(s);
    var debtClass = monthDebt > 0 ? "bulk-debt" : "bulk-ok";

    html +=
      '<tr>' +
        '<td><label class="bulk-check-label"><input type="checkbox" class="bulk-check-input" data-id="' + s.id + '" checked><span class="bulk-check-box"></span></label></td>' +
        '<td class="bulk-num">' + (i+1) + '</td>' +
        '<td class="bulk-name">' + s.name + '</td>' +
        '<td class="bulk-stat ' + debtClass + '">' + (monthDebt > 0 ? "🔴 ₱" + monthDebt : "✅") + '</td>' +
        '<td><input type="number" class="compact-input" data-id="' + s.id + '" value="' + weeklyFee + '"></td>' +
      '</tr>';
  });

  container.innerHTML =
    '<div class="bulk-count">' + filtered.length + ' student' + (filtered.length === 1 ? "" : "s") + ' shown</div>' +
    '<div class="tbl-wrap"><table class="table-upgraded bulk-tbl">' +
      '<thead><tr>' +
        '<th><label class="bulk-check-label"><input type="checkbox" class="bulk-check-input" onchange="bulkToggleAll(this.checked)" checked><span class="bulk-check-box"></span></label></th>' +
        '<th>#</th>' +
        '<th>Name</th>' +
        '<th>Status</th>' +
        '<th>Amount</th>' +
      '</tr></thead>' +
      '<tbody>' + html + '</tbody>' +
    '</table></div>';
}

function bulkFillAll(){
  var val = toNumber($("bulkDefaultAmount")?.value) || weeklyFee;
  document.querySelectorAll(".compact-input").forEach(function(inp){ inp.value = val; });
}

function bulkToggleAll(checked){
  document.querySelectorAll("#page-payments .bulk-check-input").forEach(function(cb){ cb.checked = checked; });
}

function bulkPayChecked(){
  var now = new Date();
  var date = now.toLocaleString();
  var month = now.toLocaleString("en-US", {month:"long", year:"numeric"});
  var count = 0;
  var studentMap = {};
  students.forEach(function(s){ studentMap[s.id] = s; });
  var inputMap = {};
  document.querySelectorAll(".compact-input").forEach(function(inp){
    inputMap[inp.getAttribute("data-id")] = inp;
  });

  document.querySelectorAll("#page-payments .bulk-check-input:checked").forEach(function(cb){
    var id = toNumber(cb.getAttribute("data-id"));
    var inp = inputMap[id];
    var amount = toNumber(inp?.value);
    if(amount <= 0) return;

    var s = studentMap[id];
    if(!s) return;

    s.payments.push({ amount: amount, type: "Cash", date: date, month: month, week: getCurrentWeek() });
    count++;
  });

  if(!count){ showToast("No students selected or invalid amounts", "error"); return; }

  save();
  render();
  renderBulkTable();
  showToast("Paid " + count + " student" + (count === 1 ? "" : "s"), "success");
}

function bulkPayAll(){
  showConfirmDialog("Pay ALL students in the table?", function(){
    var now = new Date();
    var date = now.toLocaleString();
    var month = now.toLocaleString("en-US", {month:"long", year:"numeric"});
    var count = 0;
    var studentMap = {};
    students.forEach(function(s){ studentMap[s.id] = s; });
    document.querySelectorAll(".compact-input").forEach(function(inp){
      var id = toNumber(inp.getAttribute("data-id"));
      var amount = toNumber(inp.value);
      if(amount <= 0) return;
      var s = studentMap[id];
      if(!s) return;
      s.payments.push({ amount: amount, type: "Cash", date: date, month: month, week: getCurrentWeek() });
      count++;
    });
    if(!count){ showToast("No valid amounts entered", "error"); return; }
    save();
    render();
    renderBulkTable();
    showToast("Paid " + count + " student" + (count === 1 ? "" : "s"), "success");
  });
}

function bulkClearAll(){
  document.querySelectorAll(".compact-input").forEach(function(inp){ inp.value = ""; });
  document.querySelectorAll("#page-payments .bulk-check-input").forEach(function(cb){ cb.checked = false; });
}

function skipWeek(week){
  week = Number(week);

  if(!week || skippedWeeks.includes(week))
    return;

  skippedWeeks.push(week);

  save();

  render();
  renderCalendar();
  showToast("Week " + week + " skipped", "success");
}

function isSkipped(week){
  return skippedWeeks.includes(week);
}

function unskipWeek(week){
  week = Number(week);

  skippedWeeks = skippedWeeks.filter(
    w => w !== week
  );

  save();

  render();
  renderCalendar();
  showToast("Week " + week + " unskipped", "success");
}

  




function copyReport(){

  if(!students) return;

  const cur = getCurrentWeek();

  let totalCollected = 0;

  // Compute expected/remaining (keep existing logic)
  let validWeeks = 0;
  for(let i = 1; i <= cur; i++){
    if(!isSkipped(i)) validWeeks++;
  }
  const expected = validWeeks * weeklyFee * students.length;

  // Sort students alphabetically
  const sorted = (students || []).slice().sort((a,b)=>{
    const na = (a?.name || "").toLowerCase();
    const nb = (b?.name || "").toLowerCase();
    if(na < nb) return -1;
    if(na > nb) return 1;
    return 0;
  });

  let updatedCount = 0;
  let advancedCount = 0;
  let debtCount = 0;

  const currentMonth = new Date().toLocaleString("en-US", { month: "long", year: "numeric" });
  let studentStatusSection = `\r\n📋 STUDENT PAYMENT STATUS (${currentMonth})\r\n`;

  const SEP = "\r\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\r\n";
  const studentEntries = [];

  sorted.forEach(s => {
    const totalPaid = getTotal(s);
    const monthDebt = getMonthDebt(s);

    totalCollected += totalPaid;

    let statusIcon = "";
    let statusLabel = "";

    if(monthDebt > 0){
      statusIcon = "🔴";
      statusLabel = "WITH DEBT";
      debtCount++;
    }else if(totalPaid > validWeeks * weeklyFee){
      statusIcon = "⭐";
      statusLabel = "ADVANCED";
      advancedCount++;
    }else{
      statusIcon = "🟢";
      statusLabel = "UPDATED";
      updatedCount++;
    }

    const weeksCovered = Math.floor(totalPaid / weeklyFee);
    const pairs = [
      { label: "Weeks Covered", value: weeksCovered + " of " + cur },
      { label: "Total Paid", value: "₱" + totalPaid },
      { label: "Remaining Debt", value: "₱" + monthDebt }
    ];
    const maxLabelLen = pairs.reduce(function(m, p){ return Math.max(m, p.label.length); }, 0);
    const lines = pairs.map(function(p){
      return p.label.padEnd(maxLabelLen) + " │ " + p.value;
    }).join("\r\n");

    studentEntries.push(statusIcon + " " + s.name + "\r\n\r\n" + lines);
  });

  studentStatusSection += studentEntries.join(SEP) + "\r\n";

  const remainingAfterCollected = expected - totalCollected;

  const expensesTotal = getTotalExpenses();
  const netBalance = totalCollected + getTotalUnidentified() - expensesTotal;

  const eventExpensesSum = expenses.reduce((s,e) => {
    if(e.fund === "both") return s + toNumber(e.eventAmount || 0);
    if((e.fund || "event") === "event") return s + toNumber(e.amount);
    return s;
  }, 0);
  const reserveExpensesSum = expenses.reduce((s,e) => {
    if(e.fund === "both") return s + toNumber(e.reserveAmount || 0);
    if(e.fund === "reserve") return s + toNumber(e.amount);
    return s;
  }, 0);
  const totalForDistribution = totalCollected + getTotalUnidentified();
  const grossEventFund = totalForDistribution * 0.70;
  const grossReserveFund = totalForDistribution * 0.30;
  const eventAvailable = Math.max(0, grossEventFund - eventExpensesSum);
  const reserveAvailable = Math.max(0, grossReserveFund - reserveExpensesSum);

  const expensesSectionParts = [];
  if(expenses && expenses.length){
    expenses
      .slice()
      .sort((a,b)=> new Date(b.date) - new Date(a.date))
      .forEach(expense => {
        const title = expense.title || "";
        const amt = toNumber(expense.amount);
        let fund;
        if(expense.fund === "both"){
          fund = `Event: ₱${expense.eventAmount}, Reserve: ₱${expense.reserveAmount}`;
        }else{
          fund = (expense.fund || "event") === "event" ? "Event" : "Reserve";
        }
        expensesSectionParts.push(`• ${title} - ₱${amt} (${fund})`);
      });
  }

  const expensesList = expensesSectionParts.length
    ? expensesSectionParts.join("\r\n")
    : "• No expenses recorded";

  const totalUnidentified = getTotalUnidentified();

  const report = `
CLASS FUND REPORT

Current Week: ${cur}
Students: ${students.length}

Total Collected (All Time): ₱${totalCollected}
Expected Collection (All Time): ₱${expected}
Remaining Collection (All Time): ₱${remainingAfterCollected}${totalUnidentified > 0 ? "\nUnidentified Funds: ₱" + totalUnidentified : ""}

⭐ Advanced: ${advancedCount}
🟢 Fully Updated: ${updatedCount}
🔴 With Remaining Weeks: ${debtCount}

${studentStatusSection}

SUMMARY
⭐ Advanced: ${advancedCount}
🟢 Fully Updated: ${updatedCount}
🔴 With Remaining Weeks: ${debtCount}

FUND BREAKDOWN
🎉 Event Fund Allocated: ₱${grossEventFund}
🎉 Event Fund Expenses: ₱${eventExpensesSum}
🎉 Event Fund Available: ₱${eventAvailable}
🏦 Reserve Fund Allocated: ₱${grossReserveFund}
🏦 Reserve Fund Expenses: ₱${reserveExpensesSum}
🏦 Reserve Fund Available: ₱${reserveAvailable}

EXPENSES SUMMARY
Total Expenses: ₱${expensesTotal}
Net Balance: ₱${netBalance}

EXPENSE LIST
${expensesList}

Generated: ${new Date().toLocaleString()}
`;

  navigator.clipboard.writeText(report)
    .then(()=> alert("nakopya na po. salamat ha :D"))
    .catch(()=> alert("Copy failed"));
}

// ================= NEW FEATURE: SHORT WEEKLY REPORT =================
function showToast(message, type){
  const container = $("toastContainer");
  if(!container){
    alert(message);
    return;
  }

  const toast = document.createElement("div");
  toast.className = "toast toast-" + (type || "success");

  const iconText =
    type === "error" ? "!" : "✓";

  toast.innerHTML = `
    <div class="toast-icon" aria-hidden="true">${iconText}</div>
    <div class="toast-msg">${message}</div>
  `;

  container.appendChild(toast);

  // Confetti chance for success toasts (1-in-4, visual delight)
  if(type !== "error" && Math.random() < .25 && typeof showConfetti === "function"){
    showConfetti();
  }

  // Remove after animation duration (matches CSS 0.24 + 0.28 + delay)
  const totalMs = 2400;
  setTimeout(()=>{
    try{
      toast.classList.add("show-hide");
      setTimeout(()=>{
        toast.remove();
      }, 310);
    }catch{
      toast.remove();
    }
  }, 2000);
}

function copyShortReport(){

  if(!students) return;

  const cur = getCurrentWeek();
  const generated = new Date().toLocaleString();

  let totalCollected = 0;

  let validWeeks = 0;
  for(let i = 1; i <= cur; i++){
    if(!isSkipped(i)) validWeeks++;
  }

  const expected = validWeeks * weeklyFee * students.length;

  const sorted = (students || []).slice().sort((a,b)=>{
    const na = (a?.name || "").toLowerCase();
    const nb = (b?.name || "").toLowerCase();
    if(na < nb) return -1;
    if(na > nb) return 1;
    return 0;
  });

  let updatedCount = 0;
  let advancedCount = 0;
  let debtCount = 0;

  sorted.forEach(s => {
    const totalPaid = getTotal(s);
    const monthDebt = getMonthDebt(s);

    totalCollected += totalPaid;

    if(monthDebt > 0){
      debtCount++;
    }else if(totalPaid > validWeeks * weeklyFee){
      advancedCount++;
    }else{
      updatedCount++;
    }
  });

  const remaining = expected - totalCollected;

  const totalUnidentified = getTotalUnidentified();
  const totalExpenses = getTotalExpenses();
  const netBalance = totalCollected + totalUnidentified - totalExpenses;

  var summaryParts = ["💰 Collected (Total): ₱" + totalCollected, "📉 Remaining (Total): ₱" + remaining];
  if (totalUnidentified > 0) summaryParts.push("❓ Unidentified Funds: ₱" + totalUnidentified);
  summaryParts.push("💸 Expenses: ₱" + totalExpenses, "🏦 Net Balance: ₱" + netBalance);

  const report = "📊 CLASS FUND UPDATE\n" +
"Week: " + cur + "\n\n" +
"⭐ Advanced: " + advancedCount + "\n" +
"🟢 Paid This Month: " + updatedCount + "\n" +
"🔴 With Debt This Month: " + debtCount + "\n\n" +
summaryParts.join("\n") + "\n\n" +
"Generated: " + generated;

  navigator.clipboard.writeText(report)
    .then(()=>{
      showToast("Short report copied!", "success");
    })
    .catch(()=> alert("Copy failed"));
}

// ================= GC REMINDER =================
function copyGCReminder(){
  if(!students || !students.length) return;

  var cur = getCurrentWeek();
  var validWeeks = 0;
  for(var i = 1; i <= cur; i++){
    if(!isSkipped(i)) validWeeks++;
  }
  var fee = weeklyFee;
  var totalExpected = validWeeks * fee * students.length;
  var totalCollected = 0;
  var unidentified = getTotalUnidentified();

  var advanced = [];
  var paid = [];
  var unpaid = [];
  var unpaidTotal = 0;

  var sorted = (students || []).slice().sort(function(a,b){
    var na = (a.name || "").toLowerCase();
    var nb = (b.name || "").toLowerCase();
    return na < nb ? -1 : na > nb ? 1 : 0;
  });

  sorted.forEach(function(s){
    var totalPaid = getTotal(s);
    var weeksCovered = Math.floor(totalPaid / fee);
    var md = getMonthDebt(s);
    totalCollected += totalPaid;

    if (md === 0 && totalPaid > validWeeks * fee) {
      advanced.push({ name: s.name, totalPaid: totalPaid, weeksCovered: weeksCovered });
    } else if (md === 0) {
      paid.push({ name: s.name, totalPaid: totalPaid, weeksCovered: weeksCovered });
    } else {
      unpaid.push({ name: s.name, debt: md, weeksCovered: weeksCovered });
      unpaidTotal += md;
    }
  });

  function fmt(arr, fn){
    if (!arr.length) return "  (none)";
    return arr.map(function(item, idx){ return "  " + (idx + 1) + ". " + fn(item); }).join("\n");
  }

  var pct = totalExpected > 0 ? Math.round(totalCollected / totalExpected * 100) : 0;

  var lines = [];
  lines.push("CLASS FUND REMINDER");
  lines.push("");
  lines.push("Week " + cur + " of " + validWeeks + " — PHP " + fee + "/week");
  lines.push("");
  lines.push("COLLECTION SUMMARY");
  lines.push("  Collected: PHP " + totalCollected.toLocaleString() + " / PHP " + totalExpected.toLocaleString() + " (" + pct + "%)");
  if (unidentified > 0) lines.push("  Unidentified: PHP " + unidentified.toLocaleString());
  lines.push("");
  lines.push("⭐ ADVANCED (" + advanced.length + ") — paid more than expected");
  lines.push(fmt(advanced, function(s){ return s.name + " — PHP " + s.totalPaid.toLocaleString() + " paid (" + s.weeksCovered + "/" + validWeeks + " weeks)"; }));
  lines.push("");
  lines.push("✅ PAID (" + paid.length + ") — fully paid");
  lines.push(fmt(paid, function(s){ return s.name + " — PHP " + s.totalPaid.toLocaleString() + " paid (" + s.weeksCovered + "/" + validWeeks + " weeks)"; }));
  lines.push("");
  lines.push("🔴 UNPAID (" + unpaid.length + ") — PHP " + unpaidTotal.toLocaleString() + " total owed");
  lines.push(fmt(unpaid, function(s){ return s.name + " — owe PHP " + s.debt.toLocaleString() + " (" + s.weeksCovered + "/" + validWeeks + " weeks)"; }));
  lines.push("");
  lines.push("Please settle your class fund contribution as soon as possible.");
  lines.push("");
  lines.push("Thank you!");

  navigator.clipboard.writeText(lines.join("\n"))
    .then(function(){ showToast("GC reminder copied!", "success"); })
    .catch(function(){ alert("Copy failed"); });
}


function exportBackup(){

  const data = {
    students: students || [],
    startDate: startDate || null,
    skippedWeeks: skippedWeeks || [],
    manualWeekOverride: manualWeekOverride || null,
    archives: archives || [],
    paymentHistory: paymentHistory || [],
    expenses: expenses || [],
    currentMonth: localStorage.getItem("currentMonth") || null,
    unidentifiedFunds: unidentifiedFunds || [],
    exportedAt: new Date().toISOString(),
    app: "class-fund-auditor"
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json"
  });

  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "class-fund-backup.json";
  a.click();

  URL.revokeObjectURL(url);
  showToast("Backup downloaded", "success");
}

function extractJSON(raw){
  // Strip BOM and trim
  var s = raw.replace(/^\uFEFF/, "").trim();
  // Find first { and last } — this handles extra content mobile browsers wrap around the file
  var start = s.indexOf("{");
  var end = s.lastIndexOf("}");
  if(start === -1 || end === -1 || end <= start) throw new Error("No valid JSON object found in file.");
  return JSON.parse(s.substring(start, end + 1));
}

function importBackup(event){
  var file = event.target.files?.[0];
  if(!file) return;
  showConfirmDialog("Import this backup? This will replace the current data saved in this browser.", function(){
      var reader = new FileReader();
    reader.onload = function(){
      try{
        var data = extractJSON(reader.result);
        if(!Array.isArray(data.students)){
          throw new Error("Backup is missing students data.");
        }
        students = data.students || [];
        startDate = data.startDate || null;
        skippedWeeks = Array.isArray(data.skippedWeeks) ? data.skippedWeeks : [];
        archives = Array.isArray(data.archives) ? data.archives : [];
        paymentHistory = Array.isArray(data.paymentHistory) ? data.paymentHistory : [];
        expenses = Array.isArray(data.expenses) ? data.expenses : [];
        unidentifiedFunds = Array.isArray(data.unidentifiedFunds) ? data.unidentifiedFunds : [];
        lastImportedStudentIds = [];
        manualWeekOverride = data.manualWeekOverride || null;
        localStorage.setItem("students", JSON.stringify(students));
        localStorage.setItem("startDate", startDate || "");
        localStorage.setItem("skippedWeeks", JSON.stringify(skippedWeeks));
        localStorage.setItem("manualWeekOverride", manualWeekOverride || "");
        localStorage.setItem("archives", JSON.stringify(archives));
        localStorage.setItem("paymentHistory", JSON.stringify(paymentHistory));
        localStorage.setItem("expenses", JSON.stringify(expenses));
        localStorage.setItem("unidentifiedFunds", JSON.stringify(unidentifiedFunds));
        localStorage.setItem("lastImportedStudentIds", JSON.stringify([]));
        if(data.currentMonth){
          localStorage.setItem("currentMonth", data.currentMonth);
        }
        if($("startDate")){
          $("startDate").value = startDate || "";
        }
        render();
        renderCalendar();
        renderArchive();
        renderHistory();
        renderExpenses();
        if(typeof renderAnalytics === "function"){
          renderAnalytics();
        }
        if (typeof firebaseData !== "undefined" && typeof cfAuth !== "undefined" && cfAuth.getCurrentUser && cfAuth.getCurrentUser()) {
          firebaseData.syncAllToFirestore();
        }
        showToast("Backup imported successfully", "success");
      }catch(error){
        console.error(error);
        var msg = error.message || String(error);
        alert("Could not import backup.\n" + msg);
      }finally{
        event.target.value = "";
      }
    };
    reader.readAsText(file);
  });
}

function animateVisibleUi(){
  const activePage = document.querySelector(".page.active");
  if(!activePage) return;

  // Re-trigger CSS animation by toggling a class on key containers.
  // (No changes to business logic—UI-only)
  const header = activePage.querySelector(".page-header");
  if(header){
    header.classList.remove("ui-animate");
    requestAnimationFrame(function(){
      requestAnimationFrame(function(){
        header.classList.add("ui-animate");
      });
    });
  }
}

function showPage(page){

  document.querySelectorAll(".page").forEach(p=>{
    p.classList.remove("active");
  });

  const selectedPage =
  document.getElementById("page-" + page);

  if(selectedPage){
    selectedPage.classList.add("active");
  }

  document.querySelectorAll(".nav-btn").forEach(btn=>{
    btn.classList.remove("active");
  });

  if(page === "history"){
    renderHistory();
  }

  if(page === "archive"){
    renderArchive();
  }

  if(page === "analytics"){
    renderAnalytics();
  }

  if(page === "expenses"){
    renderExpenses();
  }

  if(page === "payments" && typeof renderBulkTable === "function" && _bulkPayVisible){
    renderBulkTable();
  }

  // UI-only animation trigger
  animateVisibleUi();
}



function renderCalendar(){

  const container = $("calendarWeeks");

  if(!container) return;

  if(!startDate){

    container.innerHTML = `
      <p>
        Select a first collection date first.
      </p>
    `;

    return;
  }

  const start = new Date(startDate);

  let html = "";

  var overrideBadge = manualWeekOverride
    ? '<span style="font-size:12px;color:var(--amber);display:block;margin-bottom:12px;">🔧 Week manually set to ' + manualWeekOverride + ' — <a href="#" onclick="clearManualWeek();return false" style="color:var(--blue);">clear override</a></span>'
    : '<span style="font-size:12px;color:var(--muted);display:block;margin-bottom:12px;">🤖 Week auto-calculated from start date</span>';

  html += overrideBadge;

  for(let i=1;i<=5;i++){

    const weekStart = new Date(start);
    weekStart.setDate(
      start.getDate() + ((i-1)*7)
    );

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(
      weekStart.getDate() + 4
    );

    html += `
<div class="card">

  <strong>
    Week ${i}
  </strong>

  <br>

  ${weekStart.toLocaleDateString()}
  -
  ${weekEnd.toLocaleDateString()}

  <br><br>

  <span>
    ${
      isSkipped(i)
      ? "🚫 Skipped"
      : "✅ Active"
    }
  </span>

  <br><br>

  ${
    isSkipped(i)
    ?
    `<button onclick="unskipWeek(${i})">
      Remove Skip
    </button>`
    :
    `<button onclick="skipWeek(${i})">
      Skip Week
    </button>`
  }

</div>
`;
  }

  container.innerHTML = html;
}


function saveArchive(){

  const today = new Date();

  const monthKey =
  today.toLocaleString("en-US",{
    month:"long",
    year:"numeric"
  });

  const totalCollected = students.reduce(
    (sum,s)=>sum+getTotal(s),
    0
  );
  const totalUnidentified = getTotalUnidentified();
  const totalForDistribution = totalCollected + totalUnidentified;

  const eventExpensesSum = expenses.reduce((s,e) => {
    if(e.fund === "both") return s + toNumber(e.eventAmount || 0);
    if((e.fund || "event") === "event") return s + toNumber(e.amount);
    return s;
  }, 0);
  const reserveExpensesSum = expenses.reduce((s,e) => {
    if(e.fund === "both") return s + toNumber(e.reserveAmount || 0);
    if(e.fund === "reserve") return s + toNumber(e.amount);
    return s;
  }, 0);

  const archive = {
    month: monthKey,
    collected: totalCollected,
    unidentified: totalUnidentified,
    eventFund: totalForDistribution * 0.70,
    reserveFund: totalForDistribution * 0.30,
    eventExpenses: eventExpensesSum,
    reserveExpenses: reserveExpensesSum,
    students: students.length,
    date: new Date().toLocaleString()
  };

  const existing =
  archives.find(a=>a.month===monthKey);

  if(existing){

    existing.collected =
    archive.collected;

    existing.eventFund =
    archive.eventFund;

    existing.reserveFund =
    archive.reserveFund;

    existing.eventExpenses =
    archive.eventExpenses;

    existing.reserveExpenses =
    archive.reserveExpenses;

    existing.students =
    archive.students;

    existing.date =
    archive.date;

  }else{

    archives.push(archive);

  }

  localStorage.setItem(
    "archives",
    JSON.stringify(archives)
  );

}

function renderArchive(){

  const container =
  document.getElementById("archiveContainer");

  if(!container) return;

  container.innerHTML = "";

  if(archives.length === 0){

    container.innerHTML = `
      <div class="card">
        No archived months yet.
      </div>
    `;

    return;
  }

  container.innerHTML = archives
  .slice()
  .reverse()
  .map(a=>{
    const archiveTotal = a.collected + (a.unidentified || 0);
    const eventAvailable = Math.max(0, archiveTotal * 0.70 - (a.eventExpenses || 0));
    const reserveAvailable = Math.max(0, archiveTotal * 0.30 - (a.reserveExpenses || 0));

    return `
      <div class="hero-card" style="padding:24px;margin-bottom:0">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <h3 style="margin:0;font-size:18px;font-weight:800">${a.month}</h3>
          <span class="chip" style="background:rgba(99,102,241,.1);color:var(--accent-300);border-color:rgba(99,102,241,.15);font-size:10px">${a.date}</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px">
          <div class="stat-card"><span class="stat-label">Collected</span><span class="stat-value" style="color:var(--green)">₱${a.collected}</span></div>
          <div class="stat-card"><span class="stat-label">Event Fund</span><span class="stat-value" style="color:#93c5fd">₱${a.eventFund}</span><span class="kpi-sub">Available: ₱${eventAvailable}</span></div>
          <div class="stat-card"><span class="stat-label">Reserve Fund</span><span class="stat-value" style="color:var(--green)">₱${a.reserveFund}</span><span class="kpi-sub">Available: ₱${reserveAvailable}</span></div>
          <div class="stat-card"><span class="stat-label">Expenses</span><span class="stat-value" style="color:var(--rose)">₱${(a.eventExpenses||0)+(a.reserveExpenses||0)}</span><span class="kpi-sub">👥 ${a.students} students</span></div>
        </div>
      </div>
    `;
  }).join("");

}


function renderHistory(){

  const container =
  $("historyContainer");

  if(!container) return;

  const search =
  ($("historySearch")?.value || "")
  .toLowerCase();

  let html = "";

  paymentHistory.forEach(function(record, i){

    if(
      !record.student
      .toLowerCase()
      .includes(search)
    ) return;

    html +=
    '<div class="card history-card" style="padding:16px 20px;display:flex;align-items:center;justify-content:space-between;margin-bottom:0" data-hidx="' + i + '">' +
      '<div style="display:flex;align-items:center;gap:14px;min-width:0">' +
        '<span class="av" style="background:' + getAvatarColor(record.student) + ';width:40px;height:40px;font-size:15px;border-radius:50%">' + getInitials(record.student) + '</span>' +
        '<div style="min-width:0">' +
          "<strong style=\"font-size:15px\">" + record.student + "</strong>" +
          "<div style=\"display:flex;gap:12px;font-size:12px;color:var(--muted);margin-top:2px\">" +
            "<span>💰 ₱" + record.amount + "</span>" +
            "<span>📅 " + record.date + "</span>" +
            "<span>📁 " + record.month + "</span>" +
          "</div>" +
        "</div>" +
      "</div>" +
      '<button class="ghost-btn" style="min-height:34px;height:34px;padding:0 12px;font-size:12px;flex-shrink:0" onclick="deleteHistoryPayment(' + i + ')" title="Delete record">🗑</button>' +
    "</div>";
  });

  container.innerHTML =
  html ||
  `<div class="card">
    No payment records found.
  </div>`;
}

function deleteHistoryPayment(index){
  var record = paymentHistory[index];
  if(!record) return;
  var backup = {...record};
  paymentHistory.splice(index, 1);
  localStorage.setItem("paymentHistory", JSON.stringify(paymentHistory));
  renderHistory();
  showUndoToast("Payment record deleted", function(){
    paymentHistory.splice(index, 0, backup);
    localStorage.setItem("paymentHistory", JSON.stringify(paymentHistory));
    renderHistory();
    showToast("Payment record restored", "success");
  }, 4000);
}

function checkMonthReset(){

  const currentMonth =
  new Date().toLocaleString("en-US",{
    month:"long",
    year:"numeric"
  });

  const savedMonth =
  localStorage.getItem("currentMonth");

  if(!savedMonth){

    localStorage.setItem(
      "currentMonth",
      currentMonth
    );

    return;
  }

  if(savedMonth === currentMonth){
    return;
  }

  // Save old payments to permanent history (audit trail only — balances persist)
  students.forEach(student=>{

    student.payments.forEach(payment=>{

      paymentHistory.push({

        student: student.name,

        amount: payment.amount,

        date: payment.date,

        month:
        payment.month ||
        savedMonth

      });

    });

  });

  localStorage.setItem(
    "paymentHistory",
    JSON.stringify(paymentHistory)
  );

  localStorage.setItem(
    "currentMonth",
    currentMonth
  );

  save();

  showToast(
    "New month: " + currentMonth + " — collecting for " + currentMonth,
    "success"
  );
}
function viewStudent(id){

  _modalStudentId = id;

  const student =
  students.find(s => s.id === id);

  if(!student) return;

  const total =
  getTotal(student);

  const monthPaid =
  getMonthPayments(student);

  const monthDebt =
  getMonthDebt(student);

  const cur = getCurrentWeek();
  const weeks = Math.floor(total / weeklyFee);
  var pct = cur > 0 ? Math.round((weeks / cur) * 100) : 0;
  var pctCap = Math.min(pct, 100);

  var statusClass = monthDebt > 0 ? "debt" : "ok";
  var statusLabel = monthDebt > 0 ? "🔴 DEBT" : "🟢 OK";

  // Student info header
  $("studentInfo").innerHTML =
    '<div class="modal-student-header">' +
      "<h2>" + student.name + "</h2>" +
      '<span class="status-badge status-' + statusClass + '">' + statusLabel + "</span>" +
    "</div>" +

    '<div class="modal-student-stats">' +
      '<div class="modal-stat"><span class="modal-stat-label">Total Paid</span><span class="modal-stat-value">₱' + total + "</span></div>" +
      '<div class="modal-stat"><span class="modal-stat-label">Weeks Covered</span><span class="modal-stat-value">' + weeks + " / " + cur + "</span></div>" +
      '<div class="modal-stat"><span class="modal-stat-label">Debt</span><span class="modal-stat-value">₱' + monthDebt + "</span></div>" +
    "</div>" +
    '<div class="modal-notes">' +
      '<textarea class="modal-notes-input" id="notes-' + student.id + '" placeholder="Notes about this student..." onchange="saveStudentNotes(' + student.id + ')">' + (student.notes || "") + "</textarea>" +
    "</div>" +

    '<div class="stu-progress stu-progress-lg">' +
      '<div class="stu-progress-fill" style="width:' + pctCap + '%"></div>' +
    "</div>" +
    '<span class="stu-progress-label" style="text-align:center;display:block;margin-bottom:12px;">' + weeks + "/" + cur + " weeks (" + pct + "%)</span>";

  // Payment list + inline add
  var paymentHtml =
    '<div class="modal-payments">' +
      "<h3>Payments</h3>" +
      '<div class="modal-pay-form">' +
        '<input id="modalPayAmount" type="number" placeholder="Amount" value="' + weeklyFee + '" style="width:100px;">' +
        "<button onclick=\"addModalPayment(" + student.id + ')\">Add</button>' +
      "</div>" +
      '<div id="modalPayList">';

  if(!student.payments.length){
    paymentHtml += '<div class="muted-text">No payments recorded.</div>';
  } else {
    student.payments.forEach(function(p,i){
      paymentHtml +=
        '<div class="modal-pay-row">' +
          "<span>₱" + p.amount + " · " + (p.date || "-") + "</span>" +
          "<span>" +
            '<button class="hist-btn" onclick="editPayment(' + student.id + "," + i + ')" aria-label="Edit payment">✏</button>' +
            '<button class="hist-btn" onclick="deletePayment(' + student.id + "," + i + ");viewStudent(" + student.id + ')" aria-label="Delete payment">🗑</button>' +
          "</span>" +
        "</div>";
    });
  }

  paymentHtml += "</div></div>";

  $("modalPaymentArea").innerHTML = paymentHtml;

  $("studentModal").style.display =
  "flex";
}

function saveStudentNotes(id){
  var s = students.find(function(x){ return x.id === id; });
  if(!s) return;
  var el = $("notes-" + id);
  if(!el) return;
  s.notes = el.value;
  save();
}

function closeModal(){
  _modalStudentId = null;
  var modal = $("studentModal");
  if(!modal) return;
  var content = modal.querySelector(".modal-content");
  content && content.classList.add("closing");
  modal.classList.add("closing");
  setTimeout(function(){
    modal.style.display = "none";
    content && content.classList.remove("closing");
    modal.classList.remove("closing");
  }, 300);
}
// ================= VIEWER MODE =================
function applyViewerMode(){
  if (_adminMode) {
    document.body.classList.remove("viewer-mode");
    return;
  }
  document.body.classList.add("viewer-mode");
}

// ================= AUTH UI =================
function showLoginModal(){
  var modal = $("loginModal");
  if (modal) {
    $("loginEmail").value = "";
    $("loginPassword").value = "";
    $("loginError").style.display = "none";
    modal.style.display = "flex";
  }
}
function closeLoginModal(){
  var modal = $("loginModal");
  if (modal) modal.style.display = "none";
}
function handleLogin(){
  var email = $("loginEmail")?.value?.trim();
  var pwd = $("loginPassword")?.value;
  if (!email || !pwd) {
    $("loginError").textContent = "Enter email and password";
    $("loginError").style.display = "block";
    return;
  }
  $("loginSubmitBtn").disabled = true;
  $("loginSubmitBtn").textContent = "Signing in...";
  if (typeof cfAuth !== "undefined") {
    cfAuth.signIn(email, pwd).then(function(){
      closeLoginModal();
      updateAuthUI();
      if (cfAuth.isAdmin()) {
        showToast("Signed in as admin", "success");
      } else {
        showToast("Signed in as auditor", "success");
      }
    }).catch(function(err){
      $("loginError").textContent = err.message || "Login failed";
      $("loginError").style.display = "block";
    }).finally(function(){
      $("loginSubmitBtn").disabled = false;
      $("loginSubmitBtn").textContent = "Sign In";
    });
  }
}
function handleLogout(){
  if (typeof cfAuth !== "undefined") {
    cfAuth.signOut().then(function(){ location.reload(); });
  }
}

// ================= REGISTRATION =================
function showRegisterModal(){
  var modal = $("registerModal");
  if (modal) {
    $("registerName").value = "";
    $("registerEmail").value = "";
    $("registerPassword").value = "";
    $("registerMessage").value = "";
    $("registerError").style.display = "none";
    $("registerSuccess").style.display = "none";
    $("registerSubmitBtn").disabled = false;
    $("registerSubmitBtn").textContent = "Submit Registration";
    modal.style.display = "flex";
  }
}
function closeRegisterModal(){
  var modal = $("registerModal");
  if (modal) modal.style.display = "none";
}
function handleRegister(){
  var classId = (typeof window.CLASS_ID !== "undefined") ? window.CLASS_ID : null;
  if (!classId) {
    $("registerError").textContent = "No class selected";
    $("registerError").style.display = "block";
    return;
  }
  var name = $("registerName")?.value?.trim();
  var email = $("registerEmail")?.value?.trim();
  var password = $("registerPassword")?.value;
  var message = $("registerMessage")?.value?.trim();

  if (!name || !email || !password) {
    $("registerError").textContent = "Name, email and password are required";
    $("registerError").style.display = "block";
    return;
  }
  if (password.length < 6) {
    $("registerError").textContent = "Password must be at least 6 characters";
    $("registerError").style.display = "block";
    return;
  }

  $("registerSubmitBtn").disabled = true;
  $("registerSubmitBtn").textContent = "Submitting...";

  fetch("/api/" + classId + "/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: name, email: email, password: password, message: message })
  })
  .then(function(r) { return r.json(); })
  .then(function(data) {
    if (data.error) {
      $("registerError").textContent = data.error;
      $("registerError").style.display = "block";
    } else {
      $("registerSuccess").textContent = data.message || "Registration submitted. Waiting for admin approval.";
      $("registerSuccess").style.display = "block";
      $("registerError").style.display = "none";
      $("registerName").value = "";
      $("registerEmail").value = "";
      $("registerPassword").value = "";
      $("registerMessage").value = "";
    }
  })
  .catch(function(err) {
    $("registerError").textContent = "Network error: " + err.message;
    $("registerError").style.display = "block";
  })
  .finally(function() {
    $("registerSubmitBtn").disabled = false;
    $("registerSubmitBtn").textContent = "Submit Registration";
  });
}

// ================= STUDENT CODE VIEW =================
function showStudentCodeModal(){
  var modal = $("studentCodeModal");
  if (modal) {
    $("studentCodeInput").value = "";
    $("studentCodeError").style.display = "none";
    $("studentCodeSubmitBtn").disabled = false;
    $("studentCodeSubmitBtn").textContent = "View My Status";
    modal.style.display = "flex";
    $("studentCodeInput").focus();
  }
}
function closeStudentCodeModal(){
  var modal = $("studentCodeModal");
  if (modal) modal.style.display = "none";
}
function showStudentViewModal(){
  var modal = $("studentViewModal");
  if (modal) modal.style.display = "flex";
}
function closeStudentViewModal(){
  var modal = $("studentViewModal");
  if (modal) modal.style.display = "none";
}

function closeModalById(id){
  var modal = $(id);
  if (modal) modal.style.display = "none";
}

function showAddUnidentifiedModal(){
  var modal = $("addUnidentifiedModal");
  if (!modal) return;
  $("ufAmount").value = "";
  $("ufDate").value = new Date().toISOString().slice(0,10);
  $("ufNote").value = "";
  modal.style.display = "flex";
  $("ufAmount").focus();
}

function handleAddUnidentifiedFund(){
  var amount = toNumber($("ufAmount")?.value);
  var date = $("ufDate")?.value || "";
  var note = ($("ufNote")?.value || "").trim();
  if (!amount || amount <= 0) { showToast("Enter a valid amount", "error"); return; }
  unidentifiedFunds.push({
    id: "uf_" + Date.now() + "_" + Math.random().toString(36).slice(2,6),
    amount: amount,
    date: date || new Date().toISOString().slice(0,10),
    note: note,
    createdAt: Date.now()
  });
  save();
  render();
  closeModalById("addUnidentifiedModal");
  showToast("Unidentified fund added", "success");
}

var _assignFundId = null;

function showAssignUnidentifiedModal(fundId){
  var fund = unidentifiedFunds.find(function(f){ return f.id === fundId; });
  if (!fund) return;
  _assignFundId = fundId;
  $("assignFundInfo").textContent = "Assigning ₱" + toNumber(fund.amount).toLocaleString() + " — remaining: ₱" + toNumber(fund.amount).toLocaleString();
  var select = $("assignStudentSelect");
  if (!select) return;
  select.innerHTML = '<option value="">Select student...</option>';
  students.forEach(function(s){
    select.innerHTML += '<option value="' + s.id + '">' + escHtml(s.name) + '</option>';
  });
  $("assignAmount").value = toNumber(fund.amount);
  closeModalById("addUnidentifiedModal");
  $("assignUnidentifiedModal").style.display = "flex";
}

function handleAssignUnidentifiedFund(){
  var fundId = _assignFundId;
  var studentId = $("assignStudentSelect")?.value;
  var assignAmount = toNumber($("assignAmount")?.value);
  if (!studentId) { showToast("Select a student", "error"); return; }
  assignUnidentifiedFund(fundId, studentId, assignAmount);
  closeModalById("assignUnidentifiedModal");
  _assignFundId = null;
}

function handleStudentCodeSubmit(){
  var code = ($("studentCodeInput")?.value || "").trim().toUpperCase();
  if (!code || code.length !== 5) {
    $("studentCodeError").textContent = "Please enter a valid 5-character code";
    $("studentCodeError").style.display = "block";
    return;
  }

  $("studentCodeSubmitBtn").disabled = true;
  $("studentCodeSubmitBtn").textContent = "Looking up...";

  // Find student by code in local data
  var found = students.find(function(s) {
    return s.code && s.code.toUpperCase() === code;
  });

  if (!found) {
    $("studentCodeError").textContent = "No student found with this code";
    $("studentCodeError").style.display = "block";
    $("studentCodeSubmitBtn").disabled = false;
    $("studentCodeSubmitBtn").textContent = "View My Status";
    return;
  }

  // Calculate student stats
  var totalPaid = (found.payments || []).reduce(function(sum, p) { return sum + (p.amount || 0); }, 0);
  var currentWeek = getCurrentWeek();
  var totalExpected = currentWeek * weeklyFee;
  var balance = totalExpected - totalPaid;
  var weeksPaid = Math.floor(totalPaid / weeklyFee);

  // Build student view HTML
  var html = '<h2 style="margin:0 0 4px;font-size:22px;font-weight:800">Welcome, ' + escHtml(found.name) + '</h2>';
  html += '<p style="color:var(--text-secondary);font-size:13px;margin-bottom:20px">Your payment status for this class</p>';

  // Stats cards
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">';
  html += '<div style="background:rgba(99,102,241,.15);border:1px solid rgba(99,102,241,.2);border-radius:12px;padding:16px;text-align:center">';
  html += '<div style="font-size:11px;color:var(--text-secondary);margin-bottom:4px">Total Paid</div>';
  html += '<div style="font-size:24px;font-weight:800;color:var(--accent)">₱' + totalPaid.toLocaleString() + '</div>';
  html += '</div>';
  html += '<div style="background:rgba(' + (balance > 0 ? '239,68,68' : '34,197,94') + ',.15);border:1px solid rgba(' + (balance > 0 ? '239,68,68' : '34,197,94') + ',.2);border-radius:12px;padding:16px;text-align:center">';
  html += '<div style="font-size:11px;color:var(--text-secondary);margin-bottom:4px">' + (balance > 0 ? 'Balance Due' : 'Fully Paid') + '</div>';
  html += '<div style="font-size:24px;font-weight:800;color:' + (balance > 0 ? 'var(--rose)' : 'var(--green)') + '">₱' + Math.abs(balance).toLocaleString() + '</div>';
  html += '</div>';
  html += '</div>';

  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">';
  html += '<div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:16px;text-align:center">';
  html += '<div style="font-size:11px;color:var(--text-secondary);margin-bottom:4px">Weeks Paid</div>';
  html += '<div style="font-size:20px;font-weight:700">' + weeksPaid + ' / ' + currentWeek + '</div>';
  html += '</div>';
  html += '<div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:16px;text-align:center">';
  html += '<div style="font-size:11px;color:var(--text-secondary);margin-bottom:4px">Expected Total</div>';
  html += '<div style="font-size:20px;font-weight:700">₱' + totalExpected.toLocaleString() + '</div>';
  html += '</div>';
  html += '</div>';

  // Payment history
  var payments = (found.payments || []).slice().reverse();
  if (payments.length > 0) {
    html += '<h3 style="font-size:14px;font-weight:700;margin-bottom:10px">Payment History</h3>';
    html += '<div style="max-height:200px;overflow-y:auto">';
    html += '<table class="table" style="width:100%"><thead><tr><th>Date</th><th>Week</th><th style="text-align:right">Amount</th></tr></thead><tbody>';
    payments.forEach(function(p) {
      html += '<tr><td style="font-size:13px">' + (p.date || '—') + '</td><td style="font-size:13px">' + (p.week || '—') + '</td><td style="text-align:right;font-weight:600;color:var(--green)">₱' + (p.amount || 0).toLocaleString() + '</td></tr>';
    });
    html += '</tbody></table>';
    html += '</div>';
  } else {
    html += '<div style="text-align:center;padding:20px;color:var(--text-secondary)">No payments recorded yet</div>';
  }

  html += '<p style="text-align:center;margin-top:20px;font-size:12px;color:var(--text-secondary)">Your code: <strong style="color:var(--accent);letter-spacing:2px">' + (found.code || '—') + '</strong></p>';

  $("studentViewContent").innerHTML = html;
  closeStudentCodeModal();
  showStudentViewModal();
}



function escHtml(s){
  if(!s) return "";
  var d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function copyStudentCode(code){
  if (!code) return;
  navigator.clipboard.writeText(code).then(function(){
    showToast("Code " + code + " copied!", "success");
  }).catch(function(){
    showToast("Code: " + code, "success");
  });
}

function pushToCloud(){
  if (typeof firebaseData === "undefined" || typeof cfAuth === "undefined" || !cfAuth.getCurrentUser()) {
    showToast("Please log in to sync data", "error");
    return;
  }
  var btn = $("pushToCloudBtn");
  if (btn) { btn.disabled = true; btn.textContent = "Uploading..."; }
  firebaseData.syncAllToFirestore().then(function(){
    showToast("Data uploaded to cloud successfully!", "success");
  }).catch(function(err){
    showToast("Upload failed: " + err.message, "error");
  }).finally(function(){
    if (btn) { btn.disabled = false; btn.textContent = "☁️ Push Data to Cloud"; }
  });
}
function updateAuthUI(){
  var user = typeof cfAuth !== "undefined" && cfAuth.getCurrentUser && cfAuth.getCurrentUser();
  var isAdmin = typeof cfAuth !== "undefined" && cfAuth.isAdmin && cfAuth.isAdmin();
  var isLoggedIn = !!user;

  var loginBtn = $("loginBtn");
  var logoutBtn = $("logoutBtn");
  var tLogin = $("topbarLoginBtn");
  var tLogout = $("topbarLogoutBtn");

  // Hide login / show logout when ANY user is logged in
  if (loginBtn) loginBtn.style.display = isLoggedIn ? "none" : "";
  if (logoutBtn) logoutBtn.style.display = isLoggedIn ? "" : "none";
  if (tLogin) tLogin.style.display = isLoggedIn ? "none" : "";
  if (tLogout) tLogout.style.display = isLoggedIn ? "" : "none";

  // Admin vs auditor vs visitor
  if (isLoggedIn) {
    _adminMode = isAdmin;
    document.body.classList.remove("viewer-mode");
  } else {
    _adminMode = false;
    document.body.classList.add("viewer-mode");
  }
  render();
}

// ================= INIT =================
function initFromStorage(){
  students = loadStudents();
  startDate = localStorage.getItem("startDate") || null;
  weeklyFee = Number(localStorage.getItem("weeklyFee")) || 5;
  skippedWeeks = JSON.parse(localStorage.getItem("skippedWeeks")) || [];
  lastImportedStudentIds = JSON.parse(localStorage.getItem("lastImportedStudentIds")) || [];
  manualWeekOverride = localStorage.getItem("manualWeekOverride") || null;
  unidentifiedFunds = JSON.parse(localStorage.getItem("unidentifiedFunds")) || [];
  finishInit();
}
window.onload = () => {
  if (typeof firebaseData !== "undefined") {
    var hasLocalStudents = localStorage.getItem("students") !== null;
    var user = typeof cfAuth !== "undefined" && cfAuth.getCurrentUser && cfAuth.getCurrentUser();

    if (hasLocalStudents && user) {
      firebaseData.syncAllToFirestore().then(function(){
        return firebaseData.syncAllFromFirestore();
      }).then(function(){
        initFromStorage();
      }).catch(function(){
        initFromStorage();
      });
    } else {
      firebaseData.syncAllFromFirestore().then(function(){
        initFromStorage();
      }).catch(function(){ initFromStorage(); });
    }
  } else {
    initFromStorage();
  }
};
function finishInit(){
  document.body.classList.add("viewer-mode");

  // Apply class settings from Firestore (loaded by data-provider-firebase.js)
  if (window.classSettings) {
    if (window.classSettings.categories) {
      EXPENSE_CATEGORIES = window.classSettings.categories;
    }
    if (window.classSettings.forceWeeklyFee && window.classSettings.weeklyFee) {
      weeklyFee = window.classSettings.weeklyFee;
      localStorage.setItem("weeklyFee", weeklyFee);
    }
  }

  // Assign codes to existing students that don't have one
  var codesChanged = false;
  students.forEach(function(s) {
    if (!s.code) {
      s.code = generateStudentCode();
      codesChanged = true;
    }
  });
  if (codesChanged) save();

  if($("startDate")){
    $("startDate").value = startDate || "";
  }
  if($("weeklyFee")){
    $("weeklyFee").value = weeklyFee || 5;
    if (window.classSettings && window.classSettings.forceWeeklyFee) {
      $("weeklyFee").disabled = true;
    }
  }

  // Update sidebar with class name from URL
  var classId = (typeof window.CLASS_ID !== "undefined") ? window.CLASS_ID : null;
  if (classId) {
    var sidebarName = document.querySelector(".sidebar-name");
    var sidebarRole = document.querySelector(".sidebar-role");
    if (sidebarName) sidebarName.textContent = classId.replace(/-/g, " ").replace(/\b\w/g, function(c) { return c.toUpperCase(); });
    if (sidebarRole) {
      var _isAdmin = typeof cfAuth !== "undefined" && cfAuth.isAdmin && cfAuth.isAdmin();
      sidebarRole.textContent = _isAdmin ? "Admin" : "Auditor";
    }
    document.title = classId.replace(/-/g, " ").replace(/\b\w/g, function(c) { return c.toUpperCase(); }) + " — Class Fund";
    console.log("Class ID:", classId);
  }

  // Restore theme & preferences
  applyPrefs();

  renderHistory();
  renderSelect();
  renderCalendar();
  renderArchive();
  renderAnalytics();
  checkMonthReset();
  render();

  // Bind Excel export safe wrapper (must exist after scripts load)
  if(typeof window.exportExcelBackup === "function"){
    window.exportExcelBackupSafe = window.exportExcelBackupSafe;
  }

  // Show/hide PDF export button based on feature flag
  var pdfBtn = document.getElementById("exportPdfBtn");
  if (pdfBtn) {
    var pdfEnabled = window.classSettings && window.classSettings.features && window.classSettings.features.pdfExport === true;
    pdfBtn.style.display = pdfEnabled ? "" : "none";
  }

  render();

  // Sparkline charts on dashboard
  renderSparkline();
  renderExpenseTrendChart();

  // Auto-backup reminder
  checkAutoBackup();

  // Update "last saved" timestamp every 30s
  setInterval(updateLastSaved, 30000);
  updateLastSaved();

  // Keyboard shortcuts
  document.addEventListener("keydown", function(e){
    if(e.ctrlKey || e.metaKey){
      switch(e.key){
        case "n": e.preventDefault(); showPage("students"); var sn = $("studentName"); if(sn) sn.focus(); break;
        case "f": e.preventDefault(); var inp = document.querySelector(".page.active input"); if(inp) inp.focus(); break;
        case "p": e.preventDefault(); showPage("payments"); break;
        case "e": e.preventDefault(); showPage("expenses"); break;
        case "r": e.preventDefault(); showPage("reports"); break;
      }
    }
    if(e.key === "Escape"){
      if($("loginModal")?.style.display === "flex") closeLoginModal();
      if($("registerModal")?.style.display === "flex") closeRegisterModal();
      if($("studentCodeModal")?.style.display === "flex") closeStudentCodeModal();
      if($("studentViewModal")?.style.display === "flex") closeStudentViewModal();
      if($("customizeModal")?.style.display === "flex") closeCustomizeModal();
      if($("confirmModal")?.style.display === "flex") closeConfirmModal();
      if($("studentModal")?.style.display === "flex") closeModal();
      if($("receiptModal")?.style.display === "flex") closeReceiptModal();
      if($("addUnidentifiedModal")?.style.display === "flex") closeModalById("addUnidentifiedModal");
      if($("assignUnidentifiedModal")?.style.display === "flex") closeModalById("assignUnidentifiedModal");
    }
  }, { passive: true });

  // Backdrop click close
  $("studentModal").addEventListener("click", function(e){
    if(e.target === this) closeModal();
  }, { passive: true });
  $("receiptModal").addEventListener("click", function(e){
    if(e.target === this) closeReceiptModal();
  }, { passive: true });
  $("confirmModal").addEventListener("click", function(e){
    if(e.target === this) closeConfirmModal();
  }, { passive: true });
  $("customizeModal").addEventListener("click", function(e){
    if(e.target === this) closeCustomizeModal();
  }, { passive: true });
  $("loginModal").addEventListener("click", function(e){
    if(e.target === this) closeLoginModal();
  }, { passive: true });
  $("registerModal").addEventListener("click", function(e){
    if(e.target === this) closeRegisterModal();
  }, { passive: true });
  $("studentCodeModal").addEventListener("click", function(e){
    if(e.target === this) closeStudentCodeModal();
  }, { passive: true });
  $("studentViewModal").addEventListener("click", function(e){
    if(e.target === this) closeStudentViewModal();
  }, { passive: true });
  $("addUnidentifiedModal").addEventListener("click", function(e){
    if(e.target === this) closeModalById("addUnidentifiedModal");
  }, { passive: true });
  $("assignUnidentifiedModal").addEventListener("click", function(e){
    if(e.target === this) closeModalById("assignUnidentifiedModal");
  }, { passive: true });

  // Hide skeleton, show content
  var skel = $("dashSkeleton");
  var content = $("dashContent");
  if(skel) skel.style.display = "none";
  if(content) content.style.display = "";

  showPage("dashboard");

  // Auth listener
  if (typeof cfAuth !== "undefined") {
    _adminMode = cfAuth.isAdmin();
    cfAuth.onAuthChanged(function(user, isAdmin){
      _adminMode = isAdmin;
      updateAuthUI();
    });
    updateAuthUI();
  }
}

// Excel export wrapper with error handling + success notification.
// This wrapper is the only part that UI will call.
function exportExcelBackupSafe(){
  try{
    if(typeof window.exportExcelBackup !== "function"){
      alert("Excel export failed: export function not available.");
      return;
    }

    const provider = window.localStorageExcelDataProvider;
    if(!provider){
      alert("Excel export failed: data provider not found.");
      return;
    }

    exportExcelBackup(provider)
      .then(()=>{
        alert("Excel backup exported successfully.");
      })
      .catch((err)=>{
        console.error(err);
        alert("Excel export failed: " + (err?.message || String(err)));
      });
  }catch(err){
    console.error(err);
    alert("Excel export failed: " + (err?.message || String(err)));
  }
}

function exportPDFBackupSafe(){
  try{
    if(typeof window.exportPDFBackup !== "function"){
      alert("PDF export failed: export function not available.");
      return;
    }

    const provider = window.localStorageExcelDataProvider;
    if(!provider){
      alert("PDF export failed: data provider not found.");
      return;
    }

    window.exportPDFBackup(provider)
      .catch((err)=>{
        console.error(err);
        alert("PDF export failed: " + (err?.message || String(err)));
      });
  }catch(err){
    console.error(err);
    alert("PDF export failed: " + (err?.message || String(err)));
  }
}

// ================= THEME =================
function updateThemeLabel(){
  var btn = document.querySelector(".theme-toggle");
  if(!btn) return;
  btn.textContent = document.documentElement.getAttribute("data-theme") === "day" ? "🌙 Dark" : "☀️ Light";
}
function toggleTheme(){
  var html = document.documentElement;
  if(html.getAttribute("data-theme") === "day"){
    html.removeAttribute("data-theme");
    localStorage.setItem("cf-theme", "night");
  }else{
    html.setAttribute("data-theme", "day");
    localStorage.setItem("cf-theme", "day");
  }
  updateThemeLabel();
}
function restoreTheme(){
  var t = localStorage.getItem("cf-theme");
  if(t === "day") document.documentElement.setAttribute("data-theme", "day");
  updateThemeLabel();
}

// ================= CUSTOMIZATION =================
function applyWidgetPrefs(){
  var widgets = _prefs.widgets;
  var sorted = Object.keys(widgets).sort(function(a,b){ return widgets[a].order - widgets[b].order; });
  var container = document.querySelector(".dash-widgets");
  if(!container) return;
  var els = {
    finance: container.querySelector(".dash-widget-finance"),
    status: container.querySelector(".dash-widget-status"),
    insights: container.querySelector(".dash-widget-insights")
  };
  // Reorder DOM elements
  sorted.forEach(function(key){
    var el = els[key];
    if(!el || el.parentNode !== container) return;
    container.appendChild(el);
  });
  // Apply visibility and pin state
  Object.keys(widgets).forEach(function(key){
    var el = els[key];
    if(!el) return;
    el.classList.toggle("hidden-widget", !widgets[key].visible);
    el.classList.toggle("pinned", widgets[key].pinned);
  });
}

function setAccent(name){
  _prefs.accent = name;
  savePrefs();
  document.documentElement.setAttribute("data-accent", name);
  document.querySelectorAll(".accent-dot").forEach(function(d){
    d.classList.toggle("active", d.getAttribute("data-accent") === name);
  });
  var swatches = document.querySelectorAll(".cust-accent-swatch");
  swatches.forEach(function(s){
    s.classList.toggle("active", s.getAttribute("data-accent") === name);
  });
}

function setDensity(mode){
  _prefs.density = mode;
  savePrefs();
  document.documentElement.setAttribute("data-density", mode);
  document.querySelectorAll(".density-btn").forEach(function(b){
    b.classList.toggle("active", b.getAttribute("data-density") === mode);
  });
  showToast("Density: " + mode, "success");
}

function openCustomizeModal(){
  var modal = $("customizeModal");
  if(!modal) return;
  renderCustomizeBody();
  modal.style.display = "flex";
}

function closeCustomizeModal(){
  var modal = $("customizeModal");
  if(!modal) return;
  modal.style.display = "none";
}

function renderCustomizeBody(){
  var body = $("customizeBody");
  if(!body) return;

  var accentNames = { indigo:"Indigo", blue:"Blue", green:"Green", amber:"Amber", rose:"Rose" };
  var accentColors = {
    indigo: "linear-gradient(135deg,#6366f1,#818cf8)",
    blue: "linear-gradient(135deg,#38bdf8,#22d3ee)",
    green: "linear-gradient(135deg,#34d399,#10b981)",
    amber: "linear-gradient(135deg,#fbbf24,#f59e0b)",
    rose: "linear-gradient(135deg,#fb7185,#f43f5e)"
  };

  var accentSwatches = Object.keys(accentColors).map(function(k){
    return '<span class="cust-accent-swatch' + (_prefs.accent === k ? " active" : "") + '" style="background:' + accentColors[k] + '" onclick="setAccent(\'' + k + '\')" data-accent="' + k + '" title="' + accentNames[k] + '"></span>';
  }).join("");

  var widgetKeys = ["finance","status","insights"];
  var widgetLabels = { finance:"Finance Overview", status:"Class Status", insights:"Quick Insights" };
  var widgetIcons = { finance:"wallet", status:"users", insights:"pie-chart" };

  var widgetItems = widgetKeys.map(function(key, idx){
    var w = _prefs.widgets[key];
    return '<div class="widget-config-item">' +
      '<span class="drag-handle">⠿</span>' +
      '<span class="widget-name">' + widgetLabels[key] + '</span>' +
      '<button class="widget-order-btn" onclick="widgetMoveUp(\'' + key + '\')"' + (idx === 0 ? " disabled" : "") + '>▲</button>' +
      '<button class="widget-order-btn" onclick="widgetMoveDown(\'' + key + '\')"' + (idx === widgetKeys.length - 1 ? " disabled" : "") + '>▼</button>' +
      '<button class="widget-toggle' + (w.visible ? " on" : "") + '" onclick="toggleWidgetVis(\'' + key + '\')" title="Toggle visibility">' + (w.visible ? "👁" : "🙈") + '</button>' +
      '<button class="widget-pin' + (w.pinned ? " pinned" : "") + '" onclick="toggleWidgetPin(\'' + key + '\')" title="Pin widget">📌</button>' +
    '</div>';
  }).join("");

  body.innerHTML =
    '<h2 style="margin:0 0 20px;font-size:22px;font-weight:800">Customize Interface</h2>' +

    '<div class="cust-section">' +
      '<div class="cust-section-title">Accent Color</div>' +
      '<div class="cust-accent-grid">' + accentSwatches + '</div>' +
    '</div>' +

    '<div class="cust-section">' +
      '<div class="cust-section-title">Density</div>' +
      '<div class="density-group">' +
        '<button class="density-btn' + (_prefs.density === "compact" ? " active" : "") + '" data-density="compact" onclick="setDensity(\'compact\')">' +
          '<i data-lucide="compress" style="width:16px;height:16px"></i> Compact' +
        '</button>' +
        '<button class="density-btn' + (_prefs.density === "comfortable" ? " active" : "") + '" data-density="comfortable" onclick="setDensity(\'comfortable\')">' +
          '<i data-lucide="maximize-2" style="width:16px;height:16px"></i> Comfortable' +
        '</button>' +
      '</div>' +
    '</div>' +

    '<div class="cust-section">' +
      '<div class="cust-section-title">Dashboard Widgets</div>' +
      widgetItems +
    '</div>';

  setTimeout(function(){
    if(window.lucide) lucide.createIcons();
  }, 50);
}

function toggleWidgetVis(key){
  _prefs.widgets[key].visible = !_prefs.widgets[key].visible;
  savePrefs();
  applyWidgetPrefs();
  renderCustomizeBody();
}

function toggleWidgetPin(key){
  _prefs.widgets[key].pinned = !_prefs.widgets[key].pinned;
  savePrefs();
  applyWidgetPrefs();
  renderCustomizeBody();
}

function widgetMoveUp(key){
  var widgets = _prefs.widgets;
  var order = widgets[key].order;
  if(order <= 0) return;
  var other = Object.keys(widgets).find(function(k){ return widgets[k].order === order - 1; });
  if(other){
    widgets[other].order = order;
    widgets[key].order = order - 1;
    savePrefs();
    applyWidgetPrefs();
    renderCustomizeBody();
  }
}

function widgetMoveDown(key){
  var widgets = _prefs.widgets;
  var order = widgets[key].order;
  if(order >= Object.keys(widgets).length - 1) return;
  var other = Object.keys(widgets).find(function(k){ return widgets[k].order === order + 1; });
  if(other){
    widgets[other].order = order;
    widgets[key].order = order + 1;
    savePrefs();
    applyWidgetPrefs();
    renderCustomizeBody();
  }
}

// ================= STUDENT HELPERS =================
function getInitials(name){
  return (name||"").split(" ").map(function(w){ return w[0]; }).filter(Boolean).slice(0,2).join("").toUpperCase() || "?";
}
function editStudentName(id){
  var s = students.find(function(x){ return x.id === id; });
  if(!s) return;
  var newName = prompt("Edit student name:", s.name);
  if(newName && newName.trim()){
    s.name = newName.trim();
    save();
    render();
  }
}

function toggleImport(){
  var body = document.querySelector(".import-body");
  var toggle = document.querySelector(".import-toggle");
  if(!body) return;
  var isOpen = body.style.display !== "none";
  body.style.display = isOpen ? "none" : "";
  if(toggle) toggle.textContent = isOpen ? "▶" : "▼";
}

function toggleStudentHistory(id){
  if(_expandedIds.has(id)) _expandedIds.delete(id);
  else _expandedIds.add(id);
  render();
}

function toggleMonthGroup(header){
  var body = header.nextElementSibling;
  var toggle = header.querySelector(".month-toggle");
  if(!body || !toggle) return;
  var isHidden = body.style.display === "none";
  body.style.display = isHidden ? "" : "none";
  toggle.textContent = isHidden ? "▼" : "▶";
}

// ================= SORT & FILTER =================
function setSort(col){
  if(_sortCol === col) _sortDir *= -1;
  else { _sortCol = col; _sortDir = 1; }
  render();
}
function setFilter(f){
  _statusFilter = f;
  var btns = document.querySelectorAll("#page-students .filter-btn");
  btns.forEach(function(b){ b.classList.remove("active"); });
  var btn = document.querySelector("#page-students .filter-btn[onclick*=\"'" + f + "'\"]");
  if(btn) btn.classList.add("active");
  render();
}

// ================= SELECTABLE ROWS =================
function toggleSelectStudent(id){
  if(_selectedStudentIds.has(id)) _selectedStudentIds.delete(id);
  else _selectedStudentIds.add(id);
  render();
}
function selectAllStudents(){
  students.forEach(function(s){ _selectedStudentIds.add(s.id); });
  render();
}
function clearSelection(){
  _selectedStudentIds.clear();
  render();
}
function exportSelectedStudents(){
  var sel = students.filter(function(s){ return _selectedStudentIds.has(s.id); });
  if(!sel.length){ showToast("No students selected", "error"); return; }
  var cur = getCurrentWeek();
  var report = "Selected Students Report\n\n";
  sel.forEach(function(s){
    var total = getTotal(s);
    var w = getMonthWeekCount ? getMonthWeekCount() : cur;
    var debt = getMonthDebt ? getMonthDebt(s) : 0;
    report += s.name + " - Paid: ₱" + total + " - Debt: ₱" + debt + "\n";
  });
  navigator.clipboard.writeText(report).then(function(){ showToast("Copied " + sel.length + " students", "success"); });
}
function exportSelectedCSV(){
  var sel = students.filter(function(s){ return _selectedStudentIds.has(s.id); });
  if(!sel.length){ showToast("No students selected", "error"); return; }
  var cur = getCurrentWeek();
  var csv = "Name,Paid,Debt,Status\n";
  sel.forEach(function(s){
    var total = getTotal(s);
    var debt = getMonthDebt ? getMonthDebt(s) : 0;
    var status = debt > 0 ? "Debt" : "OK";
    csv += '"' + s.name + '",' + total + ',' + debt + ',' + status + '\n';
  });
  var blob = new Blob([csv], {type:"text/csv"});
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a"); a.href = url; a.download = "selected-students.csv"; a.click();
  URL.revokeObjectURL(url);
}

// ================= BULK PAYMENT =================
function payAll(amount){
  amount = Number(amount);
  if(!amount || amount <= 0) return;
  showConfirmDialog('Pay all students <strong>₱' + amount + '</strong> each?', function(){
    var now = new Date();
    var date = now.toLocaleString();
    var month = now.toLocaleString("en-US",{month:"long",year:"numeric"});
    students.forEach(function(student){
      student.payments.push({ amount: amount, type: "Cash", date: date, month: month, week: getCurrentWeek() });
    });
    save();
    render();
    showToast("Paid all students ₱" + amount, "success");
  });
}
function resetAllPayments(){
  showConfirmDialog("<strong>WARNING:</strong> Delete ALL payment records? This cannot be undone.", function(){
      students.forEach(function(student){ student.payments = []; });
    save();
    render();
    showToast("All payments reset", "success");
  });
}

// ================= EXPENSE CATEGORIES =================
function setExpenseCategoryFilter(val){
  _expenseCategoryFilter = val || "all";
  renderExpenses();
}
function setExpenseDateFilter(){
  _expenseDateFrom = $("expenseDateFrom")?.value || "";
  _expenseDateTo = $("expenseDateTo")?.value || "";
  renderExpenses();
}
function getExpenseCategoryTotals(){
  var totals = {};
  EXPENSE_CATEGORIES.forEach(function(c){ totals[c] = 0; });
  expenses.forEach(function(e){
    var cat = e.category || "Misc";
    totals[cat] = (totals[cat]||0) + toNumber(e.amount);
  });
  return totals;
}

// ================= RECEIPT GALLERY =================
function toggleReceiptGallery(){
  var el = $("receiptGallery");
  if(!el) return;
  var isOpen = el.style.display !== "none";
  el.style.display = isOpen ? "none" : "grid";
  if(!isOpen){
    el.innerHTML = expenses.filter(function(e){ return e.receipt; }).map(function(e){
      return '<div class="receipt-gallery-item" onclick="openReceiptModal(' + e.id + ')">' +
        '<img src="' + e.receipt + '" alt="' + e.title + '">' +
        '<span>' + e.title + '</span></div>';
    }).join("") || '<p class="muted-text">No receipts uploaded yet.</p>';
  }
}

// ================= CONFIRM DIALOG =================
function showConfirmDialog(body, onConfirm){
  var modal = $("confirmModal");
  var bodyEl = $("confirmModalBody");
  var btn = $("confirmModalBtn");
  if(!modal || !bodyEl || !btn) return;
  bodyEl.innerHTML = body;
  btn.onclick = function(){
    closeConfirmModal();
    if(onConfirm) onConfirm();
  };
  modal.style.display = "flex";
}
function closeConfirmModal(){
  var modal = $("confirmModal");
  if(!modal) return;
  var content = modal.querySelector(".modal-content");
  content && content.classList.add("closing");
  modal.classList.add("closing");
  setTimeout(function(){
    modal.style.display = "none";
    content && content.classList.remove("closing");
    modal.classList.remove("closing");
  }, 300);
}

// ================= MODAL PAYMENT =================
function addModalPayment(id){
  var input = $("modalPayAmount");
  var amount = toNumber(input?.value);
  if(!amount || amount <= 0) return;
  var s = students.find(function(x){ return x.id === id; });
  if(!s) return;
  var now = new Date();
  s.payments.push({ amount: amount, type: "Cash", date: now.toLocaleString(), month: now.toLocaleString("en-US",{month:"long",year:"numeric"}), week: getCurrentWeek() });
  save();
  render();
  viewStudent(id);
}

// ================= UNDO TOAST =================
function showUndoToast(message, onUndo, timeoutMs){
  var container = $("toastContainer");
  if(!container) return;
  var toast = document.createElement("div");
  toast.className = "toast toast-undo";
  toast.innerHTML = '<span class="toast-msg">' + message + '</span><button class="toast-undo-btn">Undo</button>';
  container.appendChild(toast);
  var undoTimeout = setTimeout(function(){
    toast.classList.add("show-hide");
    setTimeout(function(){ toast.remove(); }, 310);
  }, timeoutMs || 4000);
  toast.querySelector(".toast-undo-btn").addEventListener("click", function(){
    clearTimeout(undoTimeout);
    if(onUndo) onUndo();
    toast.classList.add("show-hide");
    setTimeout(function(){ toast.remove(); }, 310);
  });
}

// ================= LAST SAVED =================
function updateLastSaved(){
  var el = $("lastSaved");
  if(!el) return;
  var diff = Math.floor((Date.now() - _lastSaveTime) / 1000);
  if(diff < 60) el.textContent = "Just now";
  else if(diff < 3600) el.textContent = Math.floor(diff/60) + "m ago";
  else el.textContent = Math.floor(diff/3600) + "h ago";
}

// ================= AUTO-BACKUP REMINDER =================
function checkAutoBackup(){
  var today = new Date().toDateString();
  if(!_autoBackupDate){
    _autoBackupDate = today;
    localStorage.setItem("autoBackupDate", today);
    return;
  }
  var last = new Date(_autoBackupDate);
  var diff = Math.floor((Date.now() - last.getTime()) / (1000*60*60*24));
  if(diff >= 7) showToast("Remember to export a backup!", "success");
}

// ================= FAB =================
// ================= FAB SPEED DIAL =================
function getFabActions(){
  var active = document.querySelector(".page.active");
  if(!active) return [];
  var id = active.id;
  if(id === "page-students"){
    return [
      { icon: "👤", label: "Add Student", action: function(){ focusInput("studentName"); closeFabMenu(); } },
      { icon: "📷", label: "Import from Image", action: function(){ var inp = document.getElementById("studentImageImport"); if(inp){ inp.click(); } closeFabMenu(); } }
    ];
  }
  if(id === "page-payments"){
    return [
      { icon: "💰", label: "Record Payment", action: function(){ focusInput("paymentAmount"); closeFabMenu(); } },
      { icon: "📋", label: "Bulk Pay All", action: function(){ if(typeof bulkPayAll === "function"){ closeFabMenu(); bulkPayAll(); } } }
    ];
  }
  if(id === "page-expenses"){
    return [
      { icon: "📋", label: "Add Expense", action: function(){ focusInput("expenseTitle"); closeFabMenu(); } }
    ];
  }
  return [
    { icon: "👤", label: "Go to Students", action: function(){ showPage("students"); closeFabMenu(); } }
  ];
}

function focusInput(id){
  var el = $(id);
  if(el){ el.focus(); el.scrollIntoView({ behavior: "smooth", block: "center" }); }
}

var _fabActions = [];

function renderFabMenu(){
  var container = $("fabActions");
  if(!container) return;
  _fabActions = getFabActions();
  container.innerHTML = _fabActions.map(function(item, i){
    return '<button class="fab-action" data-fab-index="' + i + '">' +
      '<span class="fab-icon">' + item.icon + '</span>' +
      '<span class="fab-label">' + item.label + '</span>' +
    '</button>';
  }).join("");
}

document.addEventListener("click", function(e){
  var btn = e.target.closest(".fab-action");
  if(!btn) return;
  var idx = parseInt(btn.getAttribute("data-fab-index"));
  var action = _fabActions[idx];
  if(action && action.action) action.action();
});

var fabOpen = false;

function toggleFabMenu(){
  var c = $("fabContainer");
  if(!c) return;
  fabOpen = !c.classList.contains("open");
  c.classList.toggle("open", fabOpen);
  if(fabOpen) renderFabMenu();
}

function closeFabMenu(){
  var c = $("fabContainer");
  if(c) c.classList.remove("open");
}

// Close FAB on Escape
document.addEventListener("keydown", function(e){
  if(e.key === "Escape") closeFabMenu();
});

// ================= PULL-TO-REFRESH =================
(function(){
  var startY = 0;
  var pulling = false;
  var threshold = 80;
  var mainEl = document.querySelector(".main");
  var indicator = null;

  function createIndicator(){
    indicator = document.createElement("div");
    indicator.className = "pull-indicator";
    indicator.innerHTML = "↓";
    document.body.appendChild(indicator);
  }
  createIndicator();

  function resetIndicator(){
    if(indicator){
      indicator.classList.remove("visible", "spinning");
      indicator.innerHTML = "↓";
    }
    pulling = false;
  }

  function handleTouchStart(e){
    if(window.scrollY > 0) return;
    if(e.touches.length !== 1) return;
    if(document.querySelector(".fab-container.open")) return;
    startY = e.touches[0].clientY;
    pulling = true;
  }

  function handleTouchMove(e){
    if(!pulling) return;
    var dy = e.touches[0].clientY - startY;
    if(dy <= 0){ resetIndicator(); return; }
    if(indicator){
      indicator.classList.add("visible");
      if(dy >= threshold){
        indicator.innerHTML = "↻";
        indicator.classList.add("spinning");
      } else {
        indicator.innerHTML = "↓";
        indicator.classList.remove("spinning");
      }
    }
  }

  function handleTouchEnd(e){
    if(!pulling) return;
    var dy = e.changedTouches[0].clientY - startY;
    if(dy >= threshold){
      if(indicator){
        indicator.innerHTML = "↻";
        indicator.classList.add("spinning");
      }
      render();
      renderCalendar && renderCalendar();
      renderArchive && renderArchive();
      renderHistory && renderHistory();
      setTimeout(resetIndicator, 800);
    } else {
      resetIndicator();
    }
    pulling = false;
  }

  document.addEventListener("touchstart", handleTouchStart, { passive: true });
  document.addEventListener("touchmove", handleTouchMove, { passive: true });
  document.addEventListener("touchend", handleTouchEnd);
})();



// ================= DEBOUNCE =================
function debounce(fn, ms){
  var timer;
  return function(){
    clearTimeout(timer);
    timer = setTimeout(fn, ms);
  };
}
var debouncedRender = debounce(render, 150);
var debouncedPaymentSearch = debounce(function(){
  renderSelect();
  renderBulkTable();
}, 150);

// ================= SPARKLINE CHARTS =================
function renderSparkline(){
  var canvas = $("sparkline");
  if(!canvas || !canvas.getContext || !archives.length) return;
  var ctx = canvas.getContext("2d");
  var W = canvas.width, H = canvas.height;
  ctx.clearRect(0,0,W,H);
  if(archives.length < 2) return;
  var vals = archives.slice().reverse().map(function(a){ return a.collected; });
  var max = Math.max(...vals, 1);
  var pad = 0;
  var stepX = (W - pad*2) / (vals.length-1 || 1);
  ctx.strokeStyle = "#38bdf8";
  ctx.lineWidth = 1.5;
  var idx = 1;
  var dots = new Array(vals.length);
  for(var i = 0; i < vals.length; i++){
    dots[i] = { x: pad + i * stepX, y: H - pad - ((vals[i] / max) * (H - pad*2)) };
  }
  function animate(){
    if(idx >= vals.length) return;
    ctx.clearRect(0,0,W,H);
    ctx.beginPath();
    for(var j = 0; j <= idx && j < vals.length; j++){
      j === 0 ? ctx.moveTo(dots[j].x, dots[j].y) : ctx.lineTo(dots[j].x, dots[j].y);
    }
    ctx.stroke();
    idx++;
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
}
function renderExpenseTrendChart(){
  var canvas = $("expenseChart");
  if(!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext("2d");
  var W = canvas.width, H = canvas.height;
  ctx.clearRect(0,0,W,H);
  if(expenses.length < 2){ ctx.fillStyle = "#9fb2cc"; ctx.font = "12px sans-serif"; ctx.textAlign = "center"; ctx.fillText("More data needed",W/2,H/2); return; }
  var months = {};
  expenses.forEach(function(e){
    var m = e.date ? e.date.slice(0,7) : "unknown";
    months[m] = (months[m]||0) + toNumber(e.amount);
  });
  var keys = Object.keys(months).sort();
  var vals = keys.map(function(k){ return months[k]; });
  var max = Math.max(...vals, 1);
  var pad = 10;
  var barW = (W - pad*2) / keys.length * 0.7;
  var gap = (W - pad*2) / keys.length;
  ctx.fillStyle = "#fb7185";
  vals.forEach(function(v,i){
    var barH = (v/max) * (H - pad*2);
    ctx.fillRect(pad + i*gap + gap*0.15, H - pad - barH, barW, barH);
  });
}
function renderPageExpenseChart(){
  var canvas = $("expenseChartPage");
  if(!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext("2d");
  var W = canvas.width, H = canvas.height;
  ctx.clearRect(0,0,W,H);
  if(expenses.length < 2){ ctx.fillStyle = "#9fb2cc"; ctx.font = "12px sans-serif"; ctx.textAlign = "center"; ctx.fillText("More data needed",W/2,H/2); return; }
  var months = {};
  expenses.forEach(function(e){
    var m = e.date ? e.date.slice(0,7) : "unknown";
    months[m] = (months[m]||0) + toNumber(e.amount);
  });
  var keys = Object.keys(months).sort();
  var vals = keys.map(function(k){ return months[k]; });
  var max = Math.max(...vals, 1);
  var pad = 10;
  var barW = (W - pad*2) / keys.length * 0.7;
  var gap = (W - pad*2) / keys.length;
  ctx.fillStyle = "#fb7185";
  vals.forEach(function(v,i){
    var barH = (v/max) * (H - pad*2);
    ctx.fillRect(pad + i*gap + gap*0.15, H - pad - barH, barW, barH);
  });
}

// ================= CONFETTI =================
function showConfetti(){
  var container = document.createElement("div");
  container.className = "confetti-container";
  document.body.appendChild(container);
  var colors = ["#6366f1","#818cf8","#a78bfa","#38bdf8","#34d399","#fbbf24","#fb7185","#f472b6"];
  for(var i = 0; i < 50; i++){
    var piece = document.createElement("div");
    piece.className = "confetti-piece";
    piece.style.left = Math.random() * 100 + "%";
    piece.style.top = "-10px";
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.width = (Math.random() * 6 + 4) + "px";
    piece.style.height = (Math.random() * 6 + 4) + "px";
    piece.style.borderRadius = Math.random() > .5 ? "50%" : "2px";
    piece.style.setProperty("--d", (Math.random() * 2 + 1.5) + "s");
    piece.style.animationDelay = (Math.random() * .5) + "s";
    container.appendChild(piece);
  }
  setTimeout(function(){ container.remove(); }, 4000);
}

// ================= INSTALL APP =================
(function(){
  var installEvent = null;
  var installBtn = document.getElementById("installBtn");

  function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  }

  function isStandalone() {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
  }

  if (isStandalone()) return;

  window.addEventListener("beforeinstallprompt", function(e) {
    e.preventDefault();
    installEvent = e;
    if (installBtn) {
      installBtn.style.display = "flex";
      installBtn.onclick = function() {
        if (installEvent) {
          installEvent.prompt();
          installEvent.userChoice.then(function(result) {
            if (result.outcome === "accepted") {
              installBtn.style.display = "none";
            }
            installEvent = null;
          });
        }
      };
    }
  });

  if (isIOS() && installBtn) {
    installBtn.style.display = "flex";
    installBtn.querySelector("i").setAttribute("data-lucide", "apple");
    installBtn.onclick = function() {
      showToast("Tap Share \u2192 Add to Home Screen", "success");
    };
  }

  window.addEventListener("appinstalled", function() {
    installEvent = null;
    if (installBtn) installBtn.style.display = "none";
  });
})();

// ================= SCROLL PROGRESS =================
(function(){
  var bar = document.createElement("div");
  bar.id = "scrollProgress";
  document.body.appendChild(bar);
  var ticking = false;
  window.addEventListener("scroll", function(){
    if(!ticking){
      requestAnimationFrame(function(){
        var winScroll = document.documentElement.scrollTop || document.body.scrollTop;
        var height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        bar.style.width = height > 0 ? (winScroll / height * 100) + "%" : "0%";
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });
})();

// ================= CONNECTION MONITORING =================
(function(){
  var indicator = document.getElementById("connIndicator");
  if (!indicator) return;
  var dot = indicator.querySelector(".conn-dot");
  function setOnline(){
    dot.className = "conn-dot conn-online";
    indicator.title = "Online";
  }
  function setOffline(){
    dot.className = "conn-dot conn-offline";
    indicator.title = "Offline - changes saved locally";
  }
  if (!navigator.onLine) setOffline();
  window.addEventListener("online", function(){
    setOnline();
    showToast("Back online - syncing changes...", "success");
    if (typeof firebaseData !== "undefined" && typeof cfAuth !== "undefined" && cfAuth.getCurrentUser && cfAuth.getCurrentUser()) {
      firebaseData.syncAllToFirestore().catch(function(err){
        console.error("Auto-sync on reconnect failed:", err);
      });
    }
  });
  window.addEventListener("offline", function(){
    setOffline();
    showToast("You are offline - changes will sync when connection returns", "info");
  });
})();

console.log("Students Loaded:", students);

