// js/export.js

window.exportToPDF = function() {
    const element = document.querySelector('.results-dashboard');
    const opt = {
        margin:       10,
        filename:     'investvision-report.pdf',
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, logging: false },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    // Temporarily adjust styles for better PDF output if needed
    // The html2pdf library will render the element as it looks on screen.
    // If it's in dark mode, it will print dark mode.
    
    html2pdf().set(opt).from(element).save();
};

window.exportToCSV = function(yearlyData) {
    if (!yearlyData || yearlyData.length === 0) return;

    const headers = [
        "שנה",
        "שווי נכס נדלן",
        "יתרת משכנתא",
        "שווי נקי נדלן",
        "שווי תיק שוק ההון",
        "תזרים נדלן מצטבר",
        "הכנסה משכירות שנתית",
        "שווי נקי נדלן (מותאם אינפלציה)",
        "שווי תיק שוק ההון (מותאם אינפלציה)"
    ];

    const rows = yearlyData.map(d => [
        d.year,
        Math.round(d.propertyValue),
        Math.round(d.mortgageBalance),
        Math.round(d.reNetWorth),
        Math.round(d.stockPortfolioValue),
        Math.round(d.cumulativeReCashFlow),
        Math.round(d.yearlyRentIncome),
        Math.round(d.inflationAdjustedReNetWorth),
        Math.round(d.inflationAdjustedStockValue)
    ]);

    let csvContent = "\uFEFF"; // BOM for UTF-8 Excel support (Hebrew)
    csvContent += headers.join(",") + "\n";

    rows.forEach(rowArray => {
        let row = rowArray.join(",");
        csvContent += row + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "investvision-data.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};
