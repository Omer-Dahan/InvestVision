// js/wizard.js — landing mode pick + step-by-step wizard navigation

document.addEventListener('DOMContentLoaded', () => {
    const wizardEl = document.getElementById('view-wizard');
    const allSteps = Array.from(wizardEl.querySelectorAll('.wizard-step'));
    const backBtn = document.getElementById('wizard-back');
    const nextBtn = document.getElementById('wizard-next');
    const fill = document.getElementById('wizard-progress-fill');
    const progressLabel = document.getElementById('wizard-progress-label');
    const modeBadge = document.getElementById('wizard-mode-badge');

    let activeSteps = [];
    let stepIndex = 0;
    const touched = new Set(); // setup/arnona fields the user edited manually

    const S = CONFIG.SETUP_COSTS;
    const money = v => Math.round(v).toLocaleString('en-US');

    // ---- Mode handling ----

    function applyMode(mode) {
        document.body.dataset.mode = mode;
        modeBadge.textContent = mode === 'housing' ? 'מגורים' : 'השקעה';

        // Toggle visibility of mode-specific elements (rows and whole steps)
        wizardEl.querySelectorAll('[data-mode]').forEach(el => {
            el.style.display = (el.dataset.mode === mode) ? '' : 'none';
        });

        // Mas-shevach default differs: single residence usually exempt
        const reGains = document.getElementById('re-gains-tax');
        const reGainsNote = document.getElementById('re-gains-note');
        const reGainsLabel = document.getElementById('re-gains-label');
        const maxLtv = document.getElementById('max-ltv');
        if (mode === 'housing') {
            reGains.value = '0';
            reGainsLabel.textContent = 'מס שבח (%)';
            reGainsNote.textContent = 'דירה יחידה למגורים, לרוב פטורה';
            if (maxLtv) maxLtv.value = CONFIG.FINANCING.MAX_LTV_RESIDENT;
        } else {
            reGains.value = '25';
            reGainsLabel.textContent = 'מס שבח (%)';
            reGainsNote.textContent = 'נכס להשקעה: 25% על הרווח הריאלי';
            if (maxLtv) maxLtv.value = CONFIG.FINANCING.MAX_LTV_INVESTOR;
        }

        rebuildActiveSteps();
    }

    function rebuildActiveSteps() {
        const mode = document.body.dataset.mode;
        activeSteps = allSteps.filter(s => !s.dataset.mode || s.dataset.mode === mode);
    }

    // ---- Step navigation ----

    function showStep(i) {
        stepIndex = Math.max(0, Math.min(activeSteps.length - 1, i));
        allSteps.forEach(s => s.classList.remove('wizard-step--active'));
        const step = activeSteps[stepIndex];
        step.classList.add('wizard-step--active');

        const pct = ((stepIndex + 1) / activeSteps.length) * 100;
        fill.style.width = pct + '%';
        progressLabel.textContent = `שלב ${stepIndex + 1} מתוך ${activeSteps.length}`;

        backBtn.textContent = stepIndex === 0 ? '→ חזרה לבית' : '→ הקודם';
        nextBtn.textContent = stepIndex === activeSteps.length - 1 ? 'חשב והצג תוצאות ←' : 'הבא ←';

        if (step.dataset.step === 'property') updateMortgageReadout();
        if (step.dataset.step === 'setup') updateSetupReadout();
        window.scrollTo(0, 0);
    }

    function next() {
        if (stepIndex < activeSteps.length - 1) {
            showStep(stepIndex + 1);
        } else {
            window.IV.runAndShowResults();
        }
    }
    function back() {
        if (stepIndex === 0) {
            window.IV.showView('landing');
        } else {
            showStep(stepIndex - 1);
        }
    }

    function startWizard(mode) {
        applyMode(mode);
        window.IV.saveSettings();
        window.IV.showView('wizard');
        showStep(0);
    }

    // ---- Live readouts ----

    function num(id) {
        const el = document.getElementById(id);
        return el ? (parseFloat(el.value.toString().replace(/,/g, '')) || 0) : 0;
    }

    function updateMortgageReadout() {
        const p = window.IV.getParams();
        const fc = new FinancialCalculator(p);
        const brackets = p.mode === 'housing'
            ? CONFIG.REAL_ESTATE.PURCHASE_TAX_BRACKETS_RESIDENT
            : CONFIG.REAL_ESTATE.PURCHASE_TAX_BRACKETS_INVESTOR;
        const vat = (p.vat ?? 18) / 100;
        const tax = fc.calculatePurchaseTax(p.propertyValue, brackets);
        const fees = p.propertyValue * ((p.brokerFee + p.lawyerFee) / 100) * (1 + vat)
            + (p.appraiserFee + p.advisorFee) * (1 + vat);
        const acq = tax + fees;
        const setup = p.mode === 'housing' ? fc.calculateSetupCosts().total : 0;
        const maxLtv = p.maxLtv || (p.mode === 'housing' ? CONFIG.FINANCING.MAX_LTV_RESIDENT : CONFIG.FINANCING.MAX_LTV_INVESTOR);

        const fin = fc.planFinancing(p.propertyValue, p.initialCapital - acq - setup, maxLtv);
        const bankPmt = fc.calculateMortgagePayment(fin.bankLoan, p.mortgageRate, p.mortgageYears);
        const extPmt = fc.calculateMortgagePayment(fin.externalLoan, p.externalLoanRate, p.externalLoanYears);
        const requiredEquity = p.propertyValue * (1 - maxLtv / 100) + acq + setup;

        const fmt = window.IV.formatCurrency;
        document.getElementById('ro-required').textContent = fmt(requiredEquity);
        document.getElementById('ro-loan').textContent = fmt(fin.bankLoan);
        document.getElementById('ro-gap').textContent = fmt(fin.externalLoan);
        document.getElementById('ro-monthly').textContent = fmt(bankPmt + extPmt);

        const warn = document.getElementById('ltv-warning');
        if (fin.externalLoan > 0) {
            warn.hidden = false;
            warn.textContent = `⚠ ההון העצמי נמוך מדרישת הבנק (עד ${maxLtv}% מימון). נדרשת השלמה של ${fmt(fin.externalLoan)} בהלוואה חוץ-בנקאית/משפחתית.`;
        } else {
            warn.hidden = true;
        }
    }

    function updateSetupReadout() {
        const p = window.IV.getParams();
        const total = new FinancialCalculator(p).calculateSetupCosts().total;
        document.getElementById('ro-setup').textContent = window.IV.formatCurrency(total);
        const acUnits = Math.max(1, Math.ceil((num('apartment-sqm') || 1) / S.SQM_PER_AC_UNIT));
        document.getElementById('ac-note').textContent = `~${acUnits} יחידות (יחידה לכל ${S.SQM_PER_AC_UNIT} מ"ר)`;
    }

    // Recompute setup + arnona defaults from m² (only for fields the user hasn't edited)
    function deriveFromSqm() {
        const sqm = Math.max(1, num('apartment-sqm'));
        const setSafe = (id, value) => {
            if (touched.has(id)) return;
            const el = document.getElementById(id);
            if (el) el.value = money(value);
        };
        setSafe('renovation-cost', sqm * S.RENOVATION_PER_SQM);
        setSafe('electrical-cost', sqm * S.ELECTRICAL_PER_SQM);
        setSafe('furniture-cost', sqm * S.FURNITURE_PER_SQM);
        setSafe('kitchen-cost', S.KITCHEN_FIXED);
        const acUnits = Math.max(1, Math.ceil(sqm / S.SQM_PER_AC_UNIT));
        setSafe('ac-cost', acUnits * S.AC_UNIT_COST);
        if (!touched.has('arnona-yearly')) {
            const el = document.getElementById('arnona-yearly');
            if (el) el.value = Math.round(sqm * CONFIG.REAL_ESTATE.ARNONA_PER_SQM_YEARLY);
        }
    }

    // ---- Wire events ----

    document.querySelectorAll('.mode-card').forEach(card => {
        card.addEventListener('click', () => startWizard(card.dataset.mode));
    });

    document.getElementById('wizard-home').addEventListener('click', () => window.IV.showView('landing'));
    backBtn.addEventListener('click', back);
    nextBtn.addEventListener('click', next);

    // m² drives setup + arnona; also refresh mortgage readout
    document.getElementById('apartment-sqm').addEventListener('input', () => {
        deriveFromSqm();
        updateMortgageReadout();
        updateSetupReadout();
    });

    // Mark setup/arnona fields as user-edited so m² won't overwrite them
    ['renovation-cost', 'electrical-cost', 'ac-cost', 'furniture-cost', 'kitchen-cost', 'arnona-yearly'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', () => { touched.add(id); updateSetupReadout(); });
    });

    // Inputs that affect the mortgage preview
    ['initial-capital', 'property-value', 'mortgage-rate', 'mortgage-years', 'broker-fee', 'lawyer-fee', 'vat',
     'appraiser-fee', 'advisor-fee', 'external-loan-rate', 'external-loan-years', 'max-ltv']
        .forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', updateMortgageReadout);
        });

    // Initialize from any restored mode (app.js loadSettings set body.dataset.mode)
    rebuildActiveSteps();
});
