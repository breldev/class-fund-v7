// Offline Excel export helper for Class Fund Auditor.
// Uses SheetJS (xlsx) which must be loaded globally as `XLSX`.

(function () {
  function toNumber(v) {
    const n = Number(v);
    return isNaN(n) ? 0 : n;
  }

  function safeString(v) {
    if (v === null || v === undefined) return "";
    return String(v);
  }

  function formatMoneyPHP(n) {
    return toNumber(n);
  }

  function getCurrentWeekFromProvider(provider) {
    try {
      return provider.getCurrentWeek();
    } catch {
      return 1;
    }
  }

  function getStatusLabel(weeks, debt, cur) {
    if (weeks > cur) return "\u2B50 Advanced";
    if (debt > 0) return "\uD83D\uDD34 With Remaining Weeks";
    return "\uD83D\uDFE2 Fully Updated";
  }

  async function exportExcelBackup(dataProvider) {
    if (typeof XLSX === "undefined") {
      throw new Error("SheetJS (XLSX) is not loaded.");
    }

    if (!dataProvider || typeof dataProvider.getAllData !== "function") {
      throw new Error("Missing data provider for Excel export.");
    }

    const data = dataProvider.getAllData();

    const students = Array.isArray(data.students) ? data.students : [];
    const paymentHistory = Array.isArray(data.paymentHistory) ? data.paymentHistory : [];
    const expenses = Array.isArray(data.expenses) ? data.expenses : [];
    const archives = Array.isArray(data.archives) ? data.archives : [];
    const skippedWeeks = Array.isArray(data.skippedWeeks) ? data.skippedWeeks : [];

    const cur = getCurrentWeekFromProvider({ getCurrentWeek: dataProvider.getCurrentWeek.bind(dataProvider) });
    const WEEKLY_FEE = dataProvider.getWeeklyFee ? dataProvider.getWeeklyFee() : 5;

    function isSkipped(week) { return skippedWeeks.includes(week); }

    function getWeeksCovered(totalPaid) {
      return Math.floor(toNumber(totalPaid) / WEEKLY_FEE);
    }

    function getDebt(weeks) {
      let validWeeks = 0;
      for (let i = 1; i <= cur; i++) {
        if (!isSkipped(i)) validWeeks++;
      }
      return Math.max(0, (validWeeks - toNumber(weeks)) * WEEKLY_FEE);
    }

    function getTotalPaidForStudent(s) {
      return (Array.isArray(s.payments) ? s.payments : []).reduce((sum, p) => sum + toNumber(p.amount), 0);
    }

    // Compute valid weeks once
    let validWeeks = 0;
    for (let i = 1; i <= cur; i++) {
      if (!isSkipped(i)) validWeeks++;
    }

    const studentsSorted = students.slice().sort((a, b) => {
      const na = safeString(a.name).toLowerCase();
      const nb = safeString(b.name).toLowerCase();
      if (na < nb) return -1;
      if (na > nb) return 1;
      return 0;
    });

    // ===== Compute aggregates =====
    let totalPaidAll = 0;
    let totalDebtAll = 0;
    let fullyUpdatedCount = 0;
    let withRemainingCount = 0;

    const studentRows = [];
    for (const s of studentsSorted) {
      const totalPaid = getTotalPaidForStudent(s);
      const weeks = getWeeksCovered(totalPaid);
      const debt = getDebt(weeks);
      totalPaidAll += totalPaid;
      totalDebtAll += debt;

      const status = getStatusLabel(weeks, debt, cur);
      if (debt > 0) {
        withRemainingCount++;
      } else {
        fullyUpdatedCount++;
      }

      studentRows.push({
        "Student Name": safeString(s.name),
        "Username": safeString(s.username),
        "Weeks Covered": weeks,
        "Current Week": cur,
        "Progress": weeks + " / " + cur,
        "Total Paid": formatMoneyPHP(totalPaid),
        "Remaining Debt": formatMoneyPHP(debt),
        "Status": status
      });
    }

    studentRows.push({
      "Student Name": "TOTALS",
      "Username": "",
      "Weeks Covered": "",
      "Current Week": "",
      "Progress": "",
      "Total Paid": formatMoneyPHP(totalPaidAll),
      "Remaining Debt": formatMoneyPHP(totalDebtAll),
      "Status": ""
    });

    // ===== Workbook =====
    const wb = XLSX.utils.book_new();
    const CURR = '#,##0.00';
    const generatedDate = new Date();

    function applyCurrency(ws, col, startRow, endRow) {
      for (let r = startRow; r <= endRow; r++) {
        const addr = XLSX.utils.encode_cell({ r: r, c: col });
        if (ws[addr] && ws[addr].t === 'n') {
          ws[addr].z = CURR;
        }
      }
    }

    // ===== Sheet 1: Dashboard =====
    const totalCollected = totalPaidAll;
    const expected = validWeeks * WEEKLY_FEE * students.length;
    const remainingCollection = expected - totalCollected;
    const totalExpenses = expenses.reduce((sum, e) => sum + toNumber(e.amount), 0);
    const netBalance = totalCollected - totalExpenses;
    const eventAllocated = totalCollected * 0.7;
    const reserveAllocated = totalCollected * 0.3;
    const eventExpenses = expenses.reduce((s, e) => {
      if (e.fund === "both") return s + toNumber(e.eventAmount || 0);
      return s + (e.fund === "reserve" ? 0 : toNumber(e.amount));
    }, 0);
    const reserveExpensesAmt = expenses.reduce((s, e) => {
      if (e.fund === "both") return s + toNumber(e.reserveAmount || 0);
      return s + (e.fund === "reserve" ? toNumber(e.amount) : 0);
    }, 0);
    const eventAvailable = Math.max(0, eventAllocated - eventExpenses);
    const reserveAvailable = Math.max(0, reserveAllocated - reserveExpensesAmt);

    const startDate = safeString(data.startDate);

    const dashboardAoa = [
      ["CLASS FUND AUDITOR - FINANCIAL REPORT"],
      [],
      ["SUMMARY"],
      ["Current Week", cur],
      ["Student Count", students.length],
      ["Weekly Fee", WEEKLY_FEE],
      ["Total Collected", totalCollected],
      ["Expected Collection", expected],
      ["Remaining Collection", remainingCollection],
      ["Fully Updated", fullyUpdatedCount],
      ["With Remaining Weeks", withRemainingCount],
      ["Total Expenses", totalExpenses],
      ["Net Balance", netBalance],
      [],
      ["FUND BREAKDOWN"],
      [],
      ["Event Fund"],
      ["  Allocated", eventAllocated],
      ["  Expenses", eventExpenses],
      ["  Available", eventAvailable],
      [],
      ["Reserve Fund"],
      ["  Allocated", reserveAllocated],
      ["  Expenses", reserveExpensesAmt],
      ["  Available", reserveAvailable],
    ];
    const wsDashboard = XLSX.utils.aoa_to_sheet(dashboardAoa);
    wsDashboard['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 1 } },
      { s: { r: 14, c: 0 }, e: { r: 14, c: 1 } },
    ];
    const moneyRows = [6, 7, 8, 11, 12, 17, 18, 19, 22, 23, 24];
    for (const r of moneyRows) {
      const addr = XLSX.utils.encode_cell({ r: r, c: 1 });
      if (wsDashboard[addr] && wsDashboard[addr].t === 'n') wsDashboard[addr].z = CURR;
    }
    wsDashboard['!cols'] = [{ wch: 24 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, wsDashboard, "Dashboard");

    // ===== Sheet 2: Students =====
    const wsStudents = XLSX.utils.json_to_sheet(studentRows, { skipHeader: false });
    wsStudents['!cols'] = [
      { wch: 28 },
      { wch: 20 },
      { wch: 14 },
      { wch: 13 },
      { wch: 14 },
      { wch: 14 },
      { wch: 16 },
      { wch: 24 },
    ];
    for (let r = 1; r <= studentRows.length; r++) {
      for (const c of [5, 6]) {
        const addr = XLSX.utils.encode_cell({ r: r, c: c });
        if (wsStudents[addr] && wsStudents[addr].t === 'n') wsStudents[addr].z = CURR;
      }
    }
    if (studentRows.length > 1) {
      wsStudents['!autofilter'] = { ref: "A1:H" + studentRows.length };
    }
    XLSX.utils.book_append_sheet(wb, wsStudents, "Students");

    // ===== Sheet 3: Payments =====
    const paymentsRows = [];
    for (const s of students) {
      const studentName = safeString(s.name);
      for (const p of (Array.isArray(s.payments) ? s.payments : [])) {
        paymentsRows.push({
          "Student": studentName,
          "Amount": formatMoneyPHP(p.amount),
          "Date": safeString(p.date),
          "Month": safeString(p.month)
        });
      }
    }
    for (const r of paymentHistory) {
      paymentsRows.push({
        "Student": safeString(r.student),
        "Amount": formatMoneyPHP(r.amount),
        "Date": safeString(r.date),
        "Month": safeString(r.month)
      });
    }
    const wsPayments = XLSX.utils.json_to_sheet(paymentsRows, { skipHeader: false });
    wsPayments['!cols'] = [{ wch: 28 }, { wch: 14 }, { wch: 18 }, { wch: 18 }];
    for (let r = 1; r <= paymentsRows.length; r++) {
      const addr = XLSX.utils.encode_cell({ r: r, c: 1 });
      if (wsPayments[addr] && wsPayments[addr].t === 'n') wsPayments[addr].z = CURR;
    }
    if (paymentsRows.length > 0) {
      wsPayments['!autofilter'] = { ref: "A1:D" + paymentsRows.length };
    }
    XLSX.utils.book_append_sheet(wb, wsPayments, "Payments");

    // ===== Sheet 4: Expenses =====
    const expensesSorted = expenses.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
    const expenseRows = [];
    let totalExpensesAll = 0;
    for (const e of expensesSorted) {
      const amt = toNumber(e.amount);
      totalExpensesAll += amt;
      let fund;
      if (e.fund === "both") {
        fund = "Event: \u20B1" + toNumber(e.eventAmount).toLocaleString() + " + Reserve: \u20B1" + toNumber(e.reserveAmount).toLocaleString();
      } else if (e.fund === "reserve") {
        fund = "Reserve";
      } else {
        fund = "Event";
      }
      expenseRows.push({
        "Date": safeString(e.date),
        "Title": safeString(e.title),
        "Amount": formatMoneyPHP(amt),
        "Fund": fund
      });
    }
    expenseRows.push({
      "Date": "TOTALS",
      "Title": "",
      "Amount": formatMoneyPHP(totalExpensesAll),
      "Fund": ""
    });
    const wsExpenses = XLSX.utils.json_to_sheet(expenseRows, { skipHeader: false });
    wsExpenses['!cols'] = [{ wch: 16 }, { wch: 32 }, { wch: 14 }, { wch: 32 }];
    for (let r = 1; r <= expenseRows.length; r++) {
      const addr = XLSX.utils.encode_cell({ r: r, c: 2 });
      if (wsExpenses[addr] && wsExpenses[addr].t === 'n') wsExpenses[addr].z = CURR;
    }
    if (expenseRows.length > 0) {
      wsExpenses['!autofilter'] = { ref: "A1:D" + expenseRows.length };
    }
    XLSX.utils.book_append_sheet(wb, wsExpenses, "Expenses");

    // ===== Sheet 5: Monthly Archives =====
    const archiveRows = [];
    for (const a of (Array.isArray(archives) ? archives : [])) {
      archiveRows.push({
        "Month": safeString(a.month),
        "Collected": formatMoneyPHP(a.collected),
        "Event Fund": formatMoneyPHP(a.eventFund),
        "Reserve Fund": formatMoneyPHP(a.reserveFund),
        "Event Expenses": formatMoneyPHP(toNumber(a.eventExpenses)),
        "Reserve Expenses": formatMoneyPHP(toNumber(a.reserveExpenses)),
        "Students": safeString(a.students),
        "Date Archived": safeString(a.date)
      });
    }
    const wsArchives = XLSX.utils.json_to_sheet(archiveRows, { skipHeader: false });
    wsArchives['!cols'] = [
      { wch: 20 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
      { wch: 16 }, { wch: 16 }, { wch: 10 }, { wch: 18 }
    ];
    for (let r = 1; r <= archiveRows.length; r++) {
      for (const c of [1, 2, 3, 4, 5]) {
        const addr = XLSX.utils.encode_cell({ r: r, c: c });
        if (wsArchives[addr] && wsArchives[addr].t === 'n') wsArchives[addr].z = CURR;
      }
    }
    if (archiveRows.length > 0) {
      wsArchives['!autofilter'] = { ref: "A1:H" + archiveRows.length };
    }
    XLSX.utils.book_append_sheet(wb, wsArchives, "Monthly Archives");

    // ===== Sheet 6: Report Information =====
    const infoAoa = [
      ["Report Information"],
      [],
      ["Application", "Class Fund Auditor"],
      ["Version", "1.0"],
      [],
      ["Generation Date", generatedDate.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })],
      ["Generation Time", generatedDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })],
      [],
      ["Current Week", cur],
      ["Weekly Fee", WEEKLY_FEE],
      ["Student Count", students.length],
      ["Start Date", startDate || "Not set"],
    ];
    const wsInfo = XLSX.utils.aoa_to_sheet(infoAoa);
    wsInfo['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }
    ];
    wsInfo['!cols'] = [{ wch: 18 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, wsInfo, "Report Information");

    // ===== Filename =====
    const y = generatedDate.getFullYear();
    const m = String(generatedDate.getMonth() + 1).padStart(2, "0");
    const d = String(generatedDate.getDate()).padStart(2, "0");
    const filename = "class-fund-report-" + y + "-" + m + "-" + d + ".xlsx";

    // ===== Save =====
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });

    const blob = new Blob([wbout], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  window.exportExcelBackup = exportExcelBackup;
})();
