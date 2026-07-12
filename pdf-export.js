(function () {
  function toNumber(v) {
    var n = Number(v);
    return isNaN(n) ? 0 : n;
  }

  function safeString(v) {
    if (v === null || v === undefined) return "";
    return String(v);
  }

  function getCurrentWeekFromProvider(provider) {
    try { return provider.getCurrentWeek(); } catch { return 1; }
  }

  async function exportPDFBackup(dataProvider) {
    if (typeof window.jspdf === "undefined") {
      throw new Error("jsPDF library is not loaded.");
    }

    var data = dataProvider.getAllData();
    var students = Array.isArray(data.students) ? data.students : [];
    var paymentHistory = Array.isArray(data.paymentHistory) ? data.paymentHistory : [];
    var expenses = Array.isArray(data.expenses) ? data.expenses : [];
    var archives = Array.isArray(data.archives) ? data.archives : [];
    var startDate = data.startDate || null;

    var cur = getCurrentWeekFromProvider({ getCurrentWeek: dataProvider.getCurrentWeek.bind(dataProvider) });
    var fee = dataProvider.getWeeklyFee ? dataProvider.getWeeklyFee() : 5;
    var generatedDate = new Date();
    var { jsPDF } = window.jspdf;
    var doc = new jsPDF({ unit: "mm", format: "a4" });

    var pageW = 210;
    var margin = 15;
    var y = margin;
    var lineH = 6;
    var col1 = margin;
    var col2 = margin + 60;

    function text(t, x, y, opts) {
      doc.text(String(t), x, y, opts || {});
    }

    function bold(t, x, y, opts) {
      doc.setFont("helvetica", "bold");
      doc.text(String(t), x, y, opts || {});
      doc.setFont("helvetica", "normal");
    }

    // Title
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    text("Class Fund Report", margin, y);
    y += 10;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    text("Generated: " + generatedDate.toLocaleString(), margin, y);
    y += 8;

    // Divider
    doc.setDrawColor(99, 102, 241);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageW - margin, y);
    y += 8;

    // Summary
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    text("Summary", margin, y);
    y += 7;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    text("Current Week:", col1, y);
    text(String(cur), col2, y);
    y += lineH;
    text("Weekly Fee:", col1, y);
    text("₱" + fee.toLocaleString(), col2, y);
    y += lineH;
    text("Total Students:", col1, y);
    text(String(students.length), col2, y);
    y += lineH;
    text("Start Date:", col1, y);
    text(startDate || "Not set", col2, y);
    y += lineH;

    // Total collected
    var totalCollected = 0;
    students.forEach(function(s) {
      var paid = (s.payments||[]).reduce(function(sum, p) { return sum + toNumber(p.amount); }, 0);
      totalCollected += paid;
    });
    var totalUnidentified = 0;
    if (data.unidentifiedFunds) {
      totalUnidentified = data.unidentifiedFunds.reduce(function(sum, f) { return sum + toNumber(f.amount); }, 0);
    }
    var totalCollectedWithUnidentified = totalCollected + totalUnidentified;
    text("Total Collected:", col1, y);
    doc.setFont("helvetica", "bold");
    text("₱" + totalCollectedWithUnidentified.toLocaleString(), col2, y);
    doc.setFont("helvetica", "normal");
    if (totalUnidentified > 0) {
      y += 4;
      text("(₱" + totalCollected.toLocaleString() + " identified + ₱" + totalUnidentified.toLocaleString() + " unidentified)", col1, y);
    }
    y += 10;

    // Divider
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageW - margin, y);
    y += 8;

    // Student list
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    text("Students", margin, y);
    y += 7;

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    text("Name", margin, y);
    text("Paid", margin + 70, y);
    text("Debt", margin + 95, y);
    text("Status", margin + 120, y);
    y += lineH;

    doc.setDrawColor(180, 180, 180);
    doc.line(margin, y - 1, pageW - margin, y - 1);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);

    students.forEach(function(s) {
      if (y > 270) { doc.addPage(); y = margin + 10; }

      var paid = (s.payments||[]).reduce(function(sum, p) { return sum + toNumber(p.amount); }, 0);
      var weeks = Math.floor(paid / (fee || 1));
      var validWeeksCount = 0;
      for (var w = 1; w <= cur; w++) {
        if (data.skippedWeeks && data.skippedWeeks.indexOf(w) === -1) validWeeksCount++;
      }
      var debt = Math.max(0, (validWeeksCount - weeks) * fee);

      text(s.name, margin, y);
      text("₱" + paid.toLocaleString(), margin + 70, y);
      text("₱" + debt.toLocaleString(), margin + 95, y);
      text(debt > 0 ? "Has debt" : "Updated", margin + 120, y);
      y += lineH;
    });

    y += 4;

    // Expenses
    if (expenses.length > 0 && y > 200) { doc.addPage(); y = margin + 10; }
    doc.setDrawColor(99, 102, 241);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageW - margin, y);
    y += 8;

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    text("Expenses", margin, y);
    y += 7;

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    text("Description", margin, y);
    text("Category", margin + 80, y);
    text("Amount", margin + 130, y);
    y += lineH;
    doc.setDrawColor(180, 180, 180);
    doc.line(margin, y - 1, pageW - margin, y - 1);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    var totalExpenses = 0;
    expenses.forEach(function(e) {
      if (y > 270) { doc.addPage(); y = margin + 10; }
      text(e.title || "(no title)", margin, y);
      text(e.category || "—", margin + 80, y);
      var amt = toNumber(e.amount);
      text("₱" + amt.toLocaleString(), margin + 130, y);
      totalExpenses += amt;
      y += lineH;
    });

    doc.setFont("helvetica", "bold");
    text("Total Expenses:", margin, y);
    text("₱" + totalExpenses.toLocaleString(), margin + 130, y);
    doc.setFont("helvetica", "normal");
    y += 8;

    // Balance
    var balance = totalCollectedWithUnidentified - totalExpenses;
    y += 2;
    doc.setFont("helvetica", "bold");
    text("Net Balance:", margin, y);
    doc.setTextColor(balance >= 0 ? 34 : 239);
    text("₱" + balance.toLocaleString(), margin + 50, y);
    doc.setTextColor(0);
    y += 10;

    // Archives
    if (archives.length > 0) {
      if (y > 220) { doc.addPage(); y = margin + 10; }
      doc.setDrawColor(99, 102, 241);
      doc.setLineWidth(0.5);
      doc.line(margin, y, pageW - margin, y);
      y += 8;

      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      text("Monthly Archives", margin, y);
      y += 7;

      var best = archives.reduce(function(a, b) { return b.collected > a.collected ? b : a; }, archives[0]);
      var avg = archives.reduce(function(s, a) { return s + a.collected; }, 0) / archives.length;

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      text("Best Month:", margin, y);
      doc.setFont("helvetica", "bold");
      text(best.month + " (₱" + best.collected.toLocaleString() + ")", margin + 40, y);
      doc.setFont("helvetica", "normal");
      y += lineH;
      text("Average Collection:", margin, y);
      text("₱" + Math.round(avg).toLocaleString(), margin + 60, y);
      y += 10;
    }

    // Save
    var filename = "class-fund-report-" +
      generatedDate.getFullYear() + "-" +
      String(generatedDate.getMonth() + 1).padStart(2, "0") + "-" +
      String(generatedDate.getDate()).padStart(2, "0") + ".pdf";
    doc.save(filename);
  }

  window.exportPDFBackup = exportPDFBackup;
})();
