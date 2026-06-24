// js/monte-carlo.js

class MonteCarloSimulation {
    constructor(baseParams, baseResults) {
        this.params = baseParams;
        this.baseResults = baseResults;
    }

    randomNormal(mean = 0, stdev = 1) {
        const u = 1 - Math.random();
        const v = Math.random();
        const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
        return z * stdev + mean;
    }

    run(iterations = CONFIG.MONTE_CARLO.ITERATIONS) {
        const results = {
            reFinalValues: [], stockFinalValues: [], reWins: 0, stockWins: 0,
            percentiles: { re: {}, stock: {} }
        };

        const housing = this.params.mode === 'housing';
        const c = {
            stockBuySellFee: (this.params.stockBuySellFee ?? CONFIG.STOCK_MARKET.BUY_SELL_FEE * 100) / 100,
            currencyConversionFee: (this.params.currencyConversionFee ?? CONFIG.STOCK_MARKET.CURRENCY_CONVERSION_FEE * 100) / 100,
            stockGainsTax: (this.params.stockGainsTax ?? 25) / 100,
            reGainsTax: (this.params.reGainsTax ?? (housing ? 0 : 25)) / 100,
            rentalTaxRate: (this.params.rentalTax ?? 0) / 100,
            saleCostRate: (this.params.saleCostPct ?? 0) / 100,
            insuranceYearly: this.params.insuranceYearly ?? CONFIG.REAL_ESTATE.INSURANCE_YEARLY,
            stockVol: (this.params.stockVolatility != null ? this.params.stockVolatility / 100 : CONFIG.MONTE_CARLO.STOCK_VOLATILITY),
            reVol: (this.params.reVolatility != null ? this.params.reVolatility / 100 : CONFIG.MONTE_CARLO.RE_VOLATILITY),
            maxLtv: this.params.maxLtv ?? (housing ? CONFIG.FINANCING.MAX_LTV_RESIDENT : CONFIG.FINANCING.MAX_LTV_INVESTOR),
            extRate: this.params.externalLoanRate ?? CONFIG.FINANCING.EXTERNAL_LOAN_RATE,
            extYears: this.params.externalLoanYears ?? CONFIG.FINANCING.EXTERNAL_LOAN_YEARS,
            // tail risks
            contractorProb: this.params.offPlan ? (this.params.contractorRiskProb ?? 0) / 100 : 0,
            contractorLoss: (this.params.contractorLossPct ?? 0) / 100,
            disasterProb: (this.params.disasterProbYearly ?? 0) / 100,
            disasterLoss: (this.params.disasterLossPct ?? 0) / 100
        };
        c.totalStockBuyFee = c.stockBuySellFee + c.currencyConversionFee;

        for (let i = 0; i < iterations; i++) {
            const { re, stock } = housing
                ? this.simulateHousingIteration(this.params, c)
                : this.simulateInvestmentIteration(this.params, c);
            results.reFinalValues.push(re);
            results.stockFinalValues.push(stock);
            if (re > stock) results.reWins++; else results.stockWins++;
        }

        results.reFinalValues.sort((a, b) => a - b);
        results.stockFinalValues.sort((a, b) => a - b);
        const pick = (arr, q) => arr[Math.min(arr.length - 1, Math.floor(iterations * q))];
        results.percentiles = {
            re: { p5: pick(results.reFinalValues, 0.05), p50: pick(results.reFinalValues, 0.5), p95: pick(results.reFinalValues, 0.95) },
            stock: { p5: pick(results.stockFinalValues, 0.05), p50: pick(results.stockFinalValues, 0.5), p95: pick(results.stockFinalValues, 0.95) }
        };
        results.winRate = { re: (results.reWins / iterations) * 100, stock: (results.stockWins / iterations) * 100 };
        results.mode = housing ? 'housing' : 'investment';
        return results;
    }

    // ----- Investment: buy-to-rent vs. index -----
    simulateInvestmentIteration(p, c) {
        const years = p.investmentYears;
        let stockPortfolioValue = p.initialCapital - p.initialCapital * c.totalStockBuyFee;
        const stockInitialBasis = stockPortfolioValue;

        const acq = this.calculateAcquisitionCosts(p, CONFIG.REAL_ESTATE.PURCHASE_TAX_BRACKETS_INVESTOR);
        const fin = this.planFinancing(p.propertyValue, p.initialCapital - acq, c.maxLtv);
        let bankBalance = fin.bankLoan, extBalance = fin.externalLoan;
        const bankPmt = this.calculateMortgagePayment(bankBalance, p.mortgageRate, p.mortgageYears || years);
        const extPmt = this.calculateMortgagePayment(extBalance, c.extRate, c.extYears);

        let currentPropertyValue = p.propertyValue;
        if (this.contractorHit(c)) currentPropertyValue *= (1 - c.contractorLoss);
        let cumulativeReCashFlow = 0;
        const inflationMultiplier = 1 + (p.inflationRate / 100);

        for (let year = 1; year <= years; year++) {
            const stockYearReturn = Math.max(-1, this.randomNormal(p.stockReturn / 100, c.stockVol));
            const reYearReturn = Math.max(-1, this.randomNormal(p.propertyAppreciation / 100, c.reVol));

            stockPortfolioValue *= (1 + stockYearReturn);
            stockPortfolioValue -= stockPortfolioValue * (p.managementFee / 100);

            currentPropertyValue *= (1 + reYearReturn);
            if (Math.random() < c.disasterProb) currentPropertyValue *= (1 - c.disasterLoss);

            const yearlyRentIncome = p.monthlyRent * Math.pow(inflationMultiplier, year - 1) * (12 - p.vacancyMonths);
            const maintenanceCost = currentPropertyValue * (p.maintenanceYearly / 100);
            const insuranceCost = c.insuranceYearly * Math.pow(inflationMultiplier, year - 1);
            const rentalTaxCost = yearlyRentIncome * c.rentalTaxRate;
            const periodic = this.propertyPeriodicCosts(p, year, inflationMultiplier);

            const bank = this.amortizeYear(bankBalance, p.mortgageRate, bankPmt); bankBalance = bank.balance;
            const ext = this.amortizeYear(extBalance, c.extRate, extPmt); extBalance = ext.balance;

            cumulativeReCashFlow += Math.min(0, yearlyRentIncome - rentalTaxCost - maintenanceCost - insuranceCost - periodic.total - bank.paid - ext.paid);
        }

        const totalInflationMultiplier = Math.max(1, Math.pow(inflationMultiplier, years));
        const saleCosts = currentPropertyValue * c.saleCostRate;
        let reRealProfit = currentPropertyValue - p.propertyValue * totalInflationMultiplier - acq * totalInflationMultiplier - saleCosts;
        const masShevach = reRealProfit > 0 ? reRealProfit * c.reGainsTax : 0;
        const re = currentPropertyValue - (bankBalance + extBalance) + cumulativeReCashFlow + fin.leftover - masShevach - saleCosts;

        const finalStockSellFee = stockPortfolioValue * (c.stockBuySellFee + c.currencyConversionFee);
        const stockValueAfterFees = stockPortfolioValue - finalStockSellFee;
        const stockRealProfit = stockValueAfterFees - stockInitialBasis * totalInflationMultiplier;
        const stockTax = stockRealProfit > 0 ? stockRealProfit * c.stockGainsTax : 0;
        const stock = stockValueAfterFees - stockTax;
        return { re, stock };
    }

    // ----- Housing: buy-to-live vs. rent + invest the difference -----
    simulateHousingIteration(p, c) {
        const years = p.investmentYears;
        let portfolio = p.initialCapital - p.initialCapital * c.totalStockBuyFee;
        const stockInitialBasis = portfolio;
        let cumulativeContrib = 0;

        const acq = this.calculateAcquisitionCosts(p, CONFIG.REAL_ESTATE.PURCHASE_TAX_BRACKETS_RESIDENT);
        const setupTotal = this.calculateSetupCosts(p).total;
        const fin = this.planFinancing(p.propertyValue, p.initialCapital - acq - setupTotal, c.maxLtv);
        let bankBalance = fin.bankLoan, extBalance = fin.externalLoan;
        const bankPmt = this.calculateMortgagePayment(bankBalance, p.mortgageRate, p.mortgageYears || years);
        const extPmt = this.calculateMortgagePayment(extBalance, c.extRate, c.extYears);

        const inflationMultiplier = 1 + (p.inflationRate / 100);
        const sqm = p.apartmentSqm || CONFIG.DEFAULTS.apartmentSqm;
        const arnonaBase = p.arnonaYearly ?? (sqm * CONFIG.REAL_ESTATE.ARNONA_PER_SQM_YEARLY);

        let currentPropertyValue = p.propertyValue;
        if (this.contractorHit(c)) currentPropertyValue *= (1 - c.contractorLoss);

        for (let year = 1; year <= years; year++) {
            const stockYearReturn = Math.max(-1, this.randomNormal(p.stockReturn / 100, c.stockVol));
            const reYearReturn = Math.max(-1, this.randomNormal(p.propertyAppreciation / 100, c.reVol));
            const monthlyReturn = Math.pow(1 + stockYearReturn, 1 / 12) - 1;

            currentPropertyValue *= (1 + reYearReturn);
            if (Math.random() < c.disasterProb) currentPropertyValue *= (1 - c.disasterLoss);

            const maintenanceCost = currentPropertyValue * (p.maintenanceYearly / 100);
            const insuranceCost = c.insuranceYearly * Math.pow(inflationMultiplier, year - 1);
            const arnonaCost = arnonaBase * Math.pow(inflationMultiplier, year - 1);
            const periodic = this.propertyPeriodicCosts(p, year, inflationMultiplier);

            const bank = this.amortizeYear(bankBalance, p.mortgageRate, bankPmt); bankBalance = bank.balance;
            const ext = this.amortizeYear(extBalance, c.extRate, extPmt); extBalance = ext.balance;

            const buyerMonthly = (bank.paid + ext.paid + maintenanceCost + insuranceCost + arnonaCost + periodic.total) / 12;
            const renterMonthly = (p.monthlyRent || CONFIG.DEFAULTS.livingRentMonthly) * Math.pow(inflationMultiplier, year - 1);
            const contribution = buyerMonthly - renterMonthly;

            for (let m = 0; m < 12; m++) { portfolio *= (1 + monthlyReturn); portfolio += contribution; }
            cumulativeContrib += contribution * 12;
            portfolio -= portfolio * (p.managementFee / 100);
        }

        const totalInflationMultiplier = Math.max(1, Math.pow(inflationMultiplier, years));
        const saleCosts = currentPropertyValue * c.saleCostRate;
        let reRealProfit = currentPropertyValue - p.propertyValue * totalInflationMultiplier - acq * totalInflationMultiplier - saleCosts;
        const masShevach = reRealProfit > 0 ? reRealProfit * c.reGainsTax : 0;
        const re = currentPropertyValue - (bankBalance + extBalance) + fin.leftover - saleCosts - masShevach;

        const finalStockSellFee = portfolio * (c.stockBuySellFee + c.currencyConversionFee);
        const portfolioAfterFees = portfolio - finalStockSellFee;
        const costBasis = stockInitialBasis + Math.max(0, cumulativeContrib);
        const stockRealProfit = portfolioAfterFees - costBasis;
        const stockTax = stockRealProfit > 0 ? stockRealProfit * c.stockGainsTax : 0;
        const stock = portfolioAfterFees - stockTax;
        return { re, stock };
    }

    contractorHit(c) {
        return c.contractorProb > 0 && Math.random() < c.contractorProb;
    }

    propertyPeriodicCosts(p, year, inflationMultiplier) {
        const buildingFees = (p.buildingFeesMonthly ?? 0) * 12 * Math.pow(inflationMultiplier, year - 1);
        const pYears = p.periodicRenovationYears || 0;
        const reno = (pYears > 0 && year % pYears === 0)
            ? (p.periodicRenovationCost ?? 0) * Math.pow(inflationMultiplier, year - 1) : 0;
        return { total: buildingFees + reno };
    }

    planFinancing(propertyValue, cashForProperty, maxLtvPct) {
        const maxBankLoan = propertyValue * (maxLtvPct / 100);
        const desiredLoan = Math.max(0, propertyValue - cashForProperty);
        const bankLoan = Math.min(desiredLoan, maxBankLoan);
        const externalLoan = Math.max(0, desiredLoan - maxBankLoan);
        const leftover = Math.max(0, cashForProperty - propertyValue);
        return { bankLoan, externalLoan, leftover };
    }

    amortizeYear(balance, annualRate, pmt) {
        let paid = 0;
        if (balance > 0 && pmt > 0) {
            const monthlyRate = annualRate / 100 / 12;
            for (let m = 0; m < 12 && balance > 0; m++) {
                const interest = balance * monthlyRate;
                let principalPaid = pmt - interest;
                let payment = pmt;
                if (principalPaid >= balance) { principalPaid = balance; payment = interest + principalPaid; }
                balance -= principalPaid;
                paid += payment;
            }
            if (balance < 0) balance = 0;
        }
        return { paid, balance };
    }

    calculateSetupCosts(params) {
        const sqm = params.apartmentSqm || CONFIG.DEFAULTS.apartmentSqm;
        const S = CONFIG.SETUP_COSTS;
        const renovation = params.renovationCost ?? sqm * S.RENOVATION_PER_SQM;
        const electrical = params.electricalCost ?? sqm * S.ELECTRICAL_PER_SQM;
        const furniture  = params.furnitureCost ?? sqm * S.FURNITURE_PER_SQM;
        const kitchen    = params.kitchenCost ?? S.KITCHEN_FIXED;
        const acUnits    = Math.max(1, Math.ceil(sqm / S.SQM_PER_AC_UNIT));
        const ac         = params.acCost ?? acUnits * S.AC_UNIT_COST;
        return { total: renovation + electrical + furniture + kitchen + ac };
    }

    calculateAcquisitionCosts(params, brackets = CONFIG.REAL_ESTATE.PURCHASE_TAX_BRACKETS_INVESTOR) {
        let tax = 0, remainingValue = params.propertyValue, previousLimit = 0;
        for (const bracket of brackets) {
            const bracketAmount = Math.min(Math.max(0, remainingValue), bracket.limit - previousLimit);
            tax += bracketAmount * bracket.rate;
            remainingValue -= bracketAmount;
            previousLimit = bracket.limit;
            if (remainingValue <= 0) break;
        }
        const vat = (params.vat ?? 18) / 100;
        const brokerFee = params.propertyValue * (params.brokerFee / 100) * (1 + vat);
        const lawyerFee = params.propertyValue * (params.lawyerFee / 100) * (1 + vat);
        const appraiserFee = (params.appraiserFee ?? CONFIG.REAL_ESTATE.APPRAISER_FEE) * (1 + vat);
        const advisorFee = (params.advisorFee ?? CONFIG.REAL_ESTATE.MORTGAGE_ADVISOR_FEE) * (1 + vat);
        return tax + brokerFee + lawyerFee + appraiserFee + advisorFee;
    }

    calculateMortgagePayment(principal, annualRate, years) {
        if (principal <= 0 || years <= 0) return 0;
        if (annualRate === 0) return principal / (years * 12);
        const monthlyRate = annualRate / 100 / 12;
        const numberOfPayments = years * 12;
        return (principal * monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) /
               (Math.pow(1 + monthlyRate, numberOfPayments) - 1);
    }
}
