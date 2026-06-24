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
    html2pdf().set(opt).from(element).save();
};

// Accepts the full results object (so we can label by mode and export the cash-flow breakdown)
window.exportToCSV = function(results) {
    if (!results || !results.yearlyData || results.yearlyData.length === 0) return;

    const housing = results.mode === 'housing';
    const round = n => Math.round(n);

    const headers = housing
        ? ['שנה', 'שווי נכס', 'יתרת משכנתא', 'שווי נקי - קנייה', 'תיק - שכירות+השקעה',
           'שכר דירה (שוכר)', 'עלות דיור (קונה)', 'מתוכו משכנתא', 'מושקע במדד', 'מצטבר מושקע']
        : ['שנה', 'שווי נכס', 'יתרת משכנתא', 'שווי נקי - נדלן', 'שווי תיק - מדד',
           'הכנסת שכירות', 'הוצאות', 'החזר משכנתא', 'תזרים נטו', 'מצטבר (מהכיס)'];

    const rows = results.yearlyData.map(d => {
        const cf = d.cf || {};
        const common = [d.year, round(d.propertyValue), round(d.mortgageBalance), round(d.reNetWorth), round(d.stockPortfolioValue)];
        return housing
            ? common.concat([round(cf.rent), round(cf.buyerCost), round(cf.mortgage), round(cf.invested), round(cf.cumulative)])
            : common.concat([round(cf.rent), round(cf.expenses), round(cf.mortgage), round(cf.net), round(cf.cumulative)]);
    });

    let csvContent = "﻿"; // BOM for UTF-8 Excel support (Hebrew)
    csvContent += headers.join(",") + "\n";
    rows.forEach(r => { csvContent += r.join(",") + "\n"; });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "investvision-data.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};
