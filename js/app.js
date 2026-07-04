// js/app.js

document.addEventListener('DOMContentLoaded', () => {

    const chartManager = new ChartManager();
    let currentResults = null;
    let currentMcResults = null;

    const STORAGE_KEY = 'investvision_v2';

    // --- Helpers ---

    function numFromField(id) {
        const el = document.getElementById(id);
        if (!el) return 0;
        return parseFloat(el.value.toString().replace(/,/g, '')) || 0;
    }

    function getMode() {
        return document.body.dataset.mode === 'investment' ? 'investment' : 'housing';
    }

    function formatCurrency(value) {
        return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(value || 0);
    }

    function getParamsFromForm() {
        const mode = getMode();
        return {
            mode,
            initialCapital: numFromField('initial-capital'),
            investmentYears: Math.min(50, Math.max(1, parseInt(document.getElementById('investment-years').value) || 30)),
            inflationRate: numFromField('inflation-rate'),

            propertyValue: numFromField('property-value'),
            apartmentSqm: Math.max(1, numFromField('apartment-sqm')),
            mortgageRate: numFromField('mortgage-rate'),
            mortgageYears: Math.min(40, Math.max(1, parseInt(document.getElementById('mortgage-years').value) || 30)),
            propertyAppreciation: numFromField('property-appreciation'),

            // Rent means different things per mode (same engine field)
            monthlyRent: mode === 'housing' ? numFromField('living-rent') : numFromField('monthly-rent'),
            rentGrowth: numFromField('rent-growth'),
            vacancyMonths: Math.min(12, Math.max(0, numFromField('vacancy-months'))),
            rentalTax: Math.max(0, numFromField('rental-tax')),

            maintenanceYearly: Math.max(0, numFromField('maintenance-yearly')),
            insuranceYearly: Math.max(0, numFromField('insurance-yearly')),
            arnonaYearly: Math.max(0, numFromField('arnona-yearly')),

            // One-time setup (housing) — already absolute ₪ in the form
            renovationCost: Math.max(0, numFromField('renovation-cost')),
            electricalCost: Math.max(0, numFromField('electrical-cost')),
            acCost: Math.max(0, numFromField('ac-cost')),
            furnitureCost: Math.max(0, numFromField('furniture-cost')),
            kitchenCost: Math.max(0, numFromField('kitchen-cost')),

            stockReturn: numFromField('stock-return'),
            managementFee: Math.max(0, numFromField('management-fee')),

            // Advanced
            vat: Math.max(0, numFromField('vat')),
            brokerFee: Math.max(0, numFromField('broker-fee')),
            lawyerFee: Math.max(0, numFromField('lawyer-fee')),
            appraiserFee: Math.max(0, numFromField('appraiser-fee')),
            advisorFee: Math.max(0, numFromField('advisor-fee')),
            saleCostPct: Math.max(0, numFromField('sale-cost-pct')),
            reGainsTax: Math.max(0, numFromField('re-gains-tax')),
            stockGainsTax: Math.max(0, numFromField('stock-gains-tax')),
            stockBuySellFee: Math.max(0, numFromField('stock-buy-sell-fee')),
            currencyConversionFee: Math.max(0, numFromField('currency-conversion-fee')),
            stockVolatility: Math.max(0, numFromField('stock-volatility')),
            reVolatility: Math.max(0, numFromField('re-volatility')),

            // Financing (bank LTV cap + non-bank / family gap loan)
            maxLtv: Math.max(0, numFromField('max-ltv')),
            externalLoanRate: Math.max(0, numFromField('external-loan-rate')),
            externalLoanYears: Math.min(30, Math.max(1, parseInt(document.getElementById('external-loan-years').value) || 7)),

            // Ongoing / periodic property costs
            buildingFeesMonthly: Math.max(0, numFromField('building-fees')),
            periodicRenovationCost: Math.max(0, numFromField('periodic-reno-cost')),
            periodicRenovationYears: Math.max(0, parseInt(document.getElementById('periodic-reno-years').value) || 0),

            // Tail risks (used in the Monte Carlo simulation)
            offPlan: !!(document.getElementById('off-plan') && document.getElementById('off-plan').checked),
            contractorRiskProb: Math.max(0, numFromField('contractor-prob')),
            contractorLossPct: Math.max(0, numFromField('contractor-loss')),
            disasterProbYearly: Math.max(0, numFromField('disaster-prob')),
            disasterLossPct: Math.max(0, numFromField('disaster-loss'))
        };
    }

    // --- Views ---

    function showView(name) {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('view--active'));
        const el = document.getElementById('view-' + name);
        if (el) el.classList.add('view--active');
        window.scrollTo(0, 0);
    }

    // --- Simulation + Results ---

    function runFullSimulation() {
        const params = getParamsFromForm();
        saveSettings(params);

        const calc = new FinancialCalculator(params);
        currentResults = calc.runSimulation();

        const mc = new MonteCarloSimulation(params, currentResults);
        currentMcResults = mc.run();

        const summary = currentResults.summary;
        const labels = summary.labels || { re: 'נדל"ן', stock: 'שוק ההון' };

        updateDashboard(summary, labels);
        renderCashflowTable(currentResults);
        renderBreakdown(currentResults);

        chartManager.renderNetWorthChart('netWorthChart', currentResults.yearlyData, labels);
        chartManager.renderMonteCarloChart('monteCarloChart', currentMcResults, labels);
        chartManager.renderFeesChart('feesChart', summary, labels);
    }

    function runAndShowResults() {
        showView('results');
        document.getElementById('results-mode-tagline').textContent =
            getMode() === 'housing' ? 'מגורים · קנייה מול שכירות והשקעה' : 'השקעה · נכס מול שוק ההון';
        // Defer so the results view has layout before charts size themselves
        setTimeout(runFullSimulation, 30);
    }

    function updateDashboard(summary, labels) {
        document.getElementById('label-re').innerHTML = `${labels.re} <span class="path__dot" style="--c:var(--re)"></span>`;
        document.getElementById('label-stock').innerHTML = `${labels.stock} <span class="path__dot" style="--c:var(--stock)"></span>`;

        document.getElementById('final-re-net-worth').textContent = formatCurrency(summary.finalReNetWorth);
        document.getElementById('re-roi').textContent = `תשואה כוללת: ${summary.reROI.toFixed(1)}%`;
        document.getElementById('final-stock-net-worth').textContent = formatCurrency(summary.finalStockNetWorth);
        document.getElementById('stock-roi').textContent = `תשואה כוללת: ${summary.stockROI.toFixed(1)}%`;

        const winnerEl = document.getElementById('winner-text');
        const winLabel = summary.winner === 'real-estate' ? labels.re : labels.stock;
        winnerEl.textContent = winLabel;
        winnerEl.className = summary.winner === 'real-estate' ? 'real-estate-color' : 'stock-color';

        document.getElementById('winner-diff').textContent = `פער של ${formatCurrency(summary.difference)}`;

        const reVal = Math.max(0, summary.finalReNetWorth);
        const stockVal = Math.max(0, summary.finalStockNetWorth);
        const total = reVal + stockVal;
        const rePct = total > 0 ? (reVal / total) * 100 : 50;
        document.getElementById('balance-re').style.flexBasis = `${rePct}%`;
        document.getElementById('balance-stock').style.flexBasis = `${100 - rePct}%`;

        document.getElementById('verdict-explain').textContent = buildExplanation(summary, labels);
    }

    function buildExplanation(summary, labels) {
        const winLabel = summary.winner === 'real-estate' ? labels.re : labels.stock;
        const diff = formatCurrency(summary.difference);
        const winRate = currentMcResults
            ? (summary.winner === 'real-estate' ? currentMcResults.winRate.re : currentMcResults.winRate.stock)
            : null;
        let txt = `על פי ההנחות שהזנת, מסלול "${winLabel}" צפוי להוביל בפער של ${diff} בתום התקופה.`;
        if (winRate != null) {
            txt += ` בסימולציית הסיכון (Monte Carlo) מסלול זה ניצח ב-${winRate.toFixed(0)}% מהתרחישים.`;
        }
        if (getMode() === 'housing') {
            txt += ' שים לב: התוצאה רגישה מאוד לתשואת שוק ההון. הורד אותה כדי לראות מתי קנייה משתלמת יותר.';
        }
        return txt;
    }

    // --- Per-year cash-flow table (the transparency the user asked for) ---

    function renderCashflowTable(results) {
        const head = document.getElementById('cashflow-head');
        const body = document.getElementById('cashflow-body');
        const title = document.getElementById('cashflow-title');
        const help = document.getElementById('cashflow-help');
        const round = n => Math.round(n).toLocaleString('he-IL');

        let cols;
        if (results.mode === 'housing') {
            title.textContent = 'תזרים שנתי: קנייה מול שכירות';
            help.textContent = 'כל שנה: עלות הדיור של הקונה מול שכר הדירה, וההפרש שהשוכר משקיע במדד. בשנים הראשונות ההפרש גדול, בדיוק הכסף שהקונה "מזרים" למשכנתא.';
            cols = ['שנה', 'שכר דירה (שוכר)', 'עלות דיור (קונה)', 'מתוכו משכנתא', 'מושקע במדד', 'מצטבר מושקע'];
            head.innerHTML = '<tr>' + cols.map(c => `<th>${c}</th>`).join('') + '</tr>';
            body.innerHTML = results.yearlyData.map(d => {
                const cf = d.cf;
                const cls = cf.invested >= 0 ? '' : ' class="neg"';
                return `<tr><td>${d.year}</td><td>${round(cf.rent)}</td><td>${round(cf.buyerCost)}</td>` +
                       `<td>${round(cf.mortgage)}</td><td${cls}>${round(cf.invested)}</td><td>${round(cf.cumulative)}</td></tr>`;
            }).join('');
        } else {
            title.textContent = 'תזרים שנתי: נכס להשקעה';
            help.textContent = 'כל שנה: הכנסת שכירות פחות הוצאות והחזר משכנתא. תזרים שלילי = כסף שאתה מזרים מהכיס; תזרים חיובי נצבר כמזומן. שים לב איך המצטבר הופך מחיסרון להכנסה לאורך השנים.';
            cols = ['שנה', 'הכנסת שכירות', 'הוצאות', 'החזר משכנתא', 'תזרים נטו', 'תזרים מצטבר'];
            head.innerHTML = '<tr>' + cols.map(c => `<th>${c}</th>`).join('') + '</tr>';
            body.innerHTML = results.yearlyData.map(d => {
                const cf = d.cf;
                const cls = cf.net >= 0 ? '' : ' class="neg"';
                return `<tr><td>${d.year}</td><td>${round(cf.rent)}</td><td>${round(cf.expenses)}</td>` +
                       `<td>${round(cf.mortgage)}</td><td${cls}>${round(cf.net)}</td><td>${round(cf.cumulative)}</td></tr>`;
            }).join('');
        }
    }

    // --- Transparency breakdown: what actually built each side's final number ---

    function renderBreakdownTable(tbodyId, rows, finalValue) {
        const tbody = document.getElementById(tbodyId);
        const fmt = window.IV.formatCurrency;
        tbody.innerHTML = rows.map(r => {
            const cls = r.amount < 0 ? ' class="neg"' : '';
            const sign = r.amount >= 0 ? '+' : '−';
            return `<tr><td>${r.label}</td><td${cls}>${sign}${fmt(Math.abs(r.amount))}</td></tr>`;
        }).join('') + `<tr class="breakdown-total"><td>סה"כ</td><td>${fmt(finalValue)}</td></tr>`;
    }

    function buildBreakdownInsight(summary) {
        const bd = summary.breakdown;
        if (!bd) return '';
        const fmt = window.IV.formatCurrency;
        const items = [];
        bd.re.forEach(r => { if (r.label !== 'הון עצמי התחלתי') items.push({ label: `${r.label} (${summary.labels.re})`, amount: r.amount }); });
        bd.stock.forEach(r => { if (r.label !== 'הון עצמי התחלתי') items.push({ label: `${r.label} (${summary.labels.stock})`, amount: r.amount }); });
        items.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
        const top = items.slice(0, 3).map(it => `${it.label}: ${it.amount >= 0 ? '+' : '−'}${fmt(Math.abs(it.amount))}`);
        let txt = `הגורמים המשמעותיים ביותר: ${top.join(' · ')}.`;
        if (bd.leverage && bd.leverage.loanAmount > 0) {
            const lev = bd.leverage;
            txt += lev.net >= 0
                ? ` המינוף (${fmt(lev.loanAmount)} מהבנק) היה משתלם: עליית הערך על הכסף שהבנק מימן (${fmt(lev.gainOnLoan)}) עלתה על הריבית ששולמה (${fmt(lev.interestPaid)}) — נטו ${fmt(lev.net)}+.`
                : ` המינוף (${fmt(lev.loanAmount)} מהבנק) עלה יותר משהוא תרם: הריבית ששולמה (${fmt(lev.interestPaid)}) עלתה על עליית הערך שיוחסה לכסף הבנק (${fmt(lev.gainOnLoan)}) — נטו ${fmt(Math.abs(lev.net))}−.`;
        }
        return txt;
    }

    function renderBreakdown(results) {
        const summary = results.summary;
        const bd = summary.breakdown;
        if (!bd) return;
        document.getElementById('breakdown-label-re').textContent = summary.labels.re;
        document.getElementById('breakdown-label-stock').textContent = summary.labels.stock;
        renderBreakdownTable('breakdown-body-re', bd.re, summary.finalReNetWorth);
        renderBreakdownTable('breakdown-body-stock', bd.stock, summary.finalStockNetWorth);
        document.getElementById('breakdown-insight').textContent = buildBreakdownInsight(summary);
    }

    // --- Money inputs (thousands separators) ---

    const moneyFormatter = new Intl.NumberFormat('en-US');
    function formatMoneyField(el, preserveCaret) {
        const digits = el.value.replace(/[^\d]/g, '');
        const caretFromEnd = preserveCaret ? el.value.length - el.selectionStart : 0;
        el.value = digits ? moneyFormatter.format(parseInt(digits, 10)) : '';
        if (preserveCaret) {
            const pos = Math.max(0, el.value.length - caretFromEnd);
            try { el.setSelectionRange(pos, pos); } catch (e) { /* ignore */ }
        }
    }
    function setupMoneyInputs() {
        document.querySelectorAll('.money-input').forEach(el => {
            formatMoneyField(el, false);
            el.addEventListener('input', () => formatMoneyField(el, true));
        });
    }

    // --- Theme ---

    function initTheme() {
        const saved = localStorage.getItem('investvision_theme');
        if (saved === 'light') {
            document.body.classList.remove('dark-mode');
            document.body.classList.add('light-mode');
        }
    }
    function toggleTheme() {
        const isDark = document.body.classList.contains('dark-mode');
        document.body.classList.toggle('dark-mode', !isDark);
        document.body.classList.toggle('light-mode', isDark);
        localStorage.setItem('investvision_theme', isDark ? 'light' : 'dark');
        chartManager.updateTheme();
    }

    // --- Storage ---

    function wizardInputs() {
        return Array.from(document.querySelectorAll('#view-wizard input[id]'));
    }
    function saveSettings() {
        const data = { mode: getMode(), fields: {} };
        wizardInputs().forEach(el => { data.fields[el.id] = el.type === 'checkbox' ? el.checked : el.value; });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
    function loadSettings() {
        try {
            const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
            if (!data) return;
            if (data.mode) document.body.dataset.mode = data.mode;
            if (data.fields) {
                Object.keys(data.fields).forEach(id => {
                    const el = document.getElementById(id);
                    if (!el) return;
                    if (el.type === 'checkbox') el.checked = !!data.fields[id];
                    else el.value = data.fields[id];
                });
            }
        } catch (e) {
            console.error('Failed to load settings', e);
        }
    }

    // --- Events ---

    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
    document.getElementById('theme-toggle-landing').addEventListener('click', toggleTheme);

    document.getElementById('edit-answers-btn').addEventListener('click', () => showView('wizard'));
    document.getElementById('restart-btn').addEventListener('click', () => showView('landing'));

    document.getElementById('export-pdf-btn').addEventListener('click', () => {
        if (window.exportToPDF) window.exportToPDF();
    });
    document.getElementById('export-csv-btn').addEventListener('click', () => {
        if (window.exportToCSV && currentResults) window.exportToCSV(currentResults);
    });

    // --- Init ---

    loadSettings();
    initTheme();
    setupMoneyInputs();

    // Public API for wizard.js
    window.IV = {
        showView,
        runAndShowResults,
        getParams: getParamsFromForm,
        getMode,
        formatCurrency,
        saveSettings
    };
});
