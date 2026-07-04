// js/calculator.js

class FinancialCalculator {
    constructor(params) {
        this.params = params;
    }

    // --- Helper Functions ---

    calculatePurchaseTax(propertyValue, brackets = CONFIG.REAL_ESTATE.PURCHASE_TAX_BRACKETS_INVESTOR) {
        let tax = 0;
        let remainingValue = propertyValue;
        let previousLimit = 0;
        for (const bracket of brackets) {
            const bracketAmount = Math.min(Math.max(0, remainingValue), bracket.limit - previousLimit);
            tax += bracketAmount * bracket.rate;
            remainingValue -= bracketAmount;
            previousLimit = bracket.limit;
            if (remainingValue <= 0) break;
        }
        return tax;
    }

    calculateMortgagePayment(principal, annualRate, years) {
        if (principal <= 0 || years <= 0) return 0;
        if (annualRate === 0) return principal / (years * 12);
        const monthlyRate = annualRate / 100 / 12;
        const numberOfPayments = years * 12;
        return (principal * monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) /
               (Math.pow(1 + monthlyRate, numberOfPayments) - 1);
    }

    // One year of amortization; returns amount paid, its interest/principal split, and the new balance (stops at payoff).
    amortizeYear(balance, annualRate, pmt) {
        let paid = 0;
        let interestPaid = 0;
        if (balance > 0 && pmt > 0) {
            const monthlyRate = annualRate / 100 / 12;
            for (let m = 0; m < 12 && balance > 0; m++) {
                const interest = balance * monthlyRate;
                let principalPaid = pmt - interest;
                let payment = pmt;
                if (principalPaid >= balance) { principalPaid = balance; payment = interest + principalPaid; }
                balance -= principalPaid;
                paid += payment;
                interestPaid += interest;
            }
            if (balance < 0) balance = 0;
        }
        return { paid, interestPaid, balance };
    }

    // Split the required loan into a bank mortgage (capped by LTV) and a non-bank / family gap loan.
    planFinancing(propertyValue, cashForProperty, maxLtvPct) {
        const maxBankLoan = propertyValue * (maxLtvPct / 100);
        const desiredLoan = Math.max(0, propertyValue - cashForProperty);
        const bankLoan = Math.min(desiredLoan, maxBankLoan);
        const externalLoan = Math.max(0, desiredLoan - maxBankLoan);
        const leftover = Math.max(0, cashForProperty - propertyValue);
        return { bankLoan, externalLoan, leftover, maxBankLoan };
    }

    // One-time setup costs when moving into a home, auto-estimated from size (m²), each overridable
    calculateSetupCosts() {
        const sqm = this.params.apartmentSqm || CONFIG.DEFAULTS.apartmentSqm;
        const S = CONFIG.SETUP_COSTS;
        const renovation = this.params.renovationCost ?? sqm * S.RENOVATION_PER_SQM;
        const electrical = this.params.electricalCost ?? sqm * S.ELECTRICAL_PER_SQM;
        const furniture  = this.params.furnitureCost ?? sqm * S.FURNITURE_PER_SQM;
        const kitchen    = this.params.kitchenCost ?? S.KITCHEN_FIXED;
        const acUnits    = Math.max(1, Math.ceil(sqm / S.SQM_PER_AC_UNIT));
        const ac         = this.params.acCost ?? acUnits * S.AC_UNIT_COST;
        return { renovation, electrical, furniture, kitchen, ac, acUnits, total: renovation + electrical + furniture + kitchen + ac };
    }

    // Building committee + decade renovation for a given year (inflation-adjusted)
    propertyPeriodicCosts(year, inflationMultiplier) {
        const buildingFees = (this.params.buildingFeesMonthly ?? 0) * 12 * Math.pow(inflationMultiplier, year - 1);
        const pYears = this.params.periodicRenovationYears || 0;
        const reno = (pYears > 0 && year % pYears === 0)
            ? (this.params.periodicRenovationCost ?? 0) * Math.pow(inflationMultiplier, year - 1)
            : 0;
        return { buildingFees, reno, total: buildingFees + reno };
    }

    // --- Dispatcher ---

    runSimulation() {
        return this.params.mode === 'housing'
            ? this.runHousingSimulation()
            : this.runInvestmentSimulation();
    }

    // ===== Investment mode: buy a property to rent out vs. invest the capital in the index =====
    runInvestmentSimulation() {
        const years = this.params.investmentYears;
        const results = { yearlyData: [], summary: {}, mode: 'investment' };

        const propertyValueInitial = this.params.propertyValue;
        const initialCapital = this.params.initialCapital;

        const vat = (this.params.vat ?? 18) / 100;
        const reGainsTax = (this.params.reGainsTax ?? 25) / 100;
        const rentalTaxRate = (this.params.rentalTax ?? 0) / 100;
        const saleCostRate = (this.params.saleCostPct ?? 0) / 100;
        const insuranceYearly = this.params.insuranceYearly ?? CONFIG.REAL_ESTATE.INSURANCE_YEARLY;
        const mortgageYears = this.params.mortgageYears || years;
        const maxLtv = this.params.maxLtv ?? CONFIG.FINANCING.MAX_LTV_INVESTOR;
        const extRate = this.params.externalLoanRate ?? CONFIG.FINANCING.EXTERNAL_LOAN_RATE;
        const extYears = this.params.externalLoanYears ?? CONFIG.FINANCING.EXTERNAL_LOAN_YEARS;
        const rentGrowthRate = this.params.rentGrowth ?? this.params.propertyAppreciation;

        const purchaseTax = this.calculatePurchaseTax(propertyValueInitial, CONFIG.REAL_ESTATE.PURCHASE_TAX_BRACKETS_INVESTOR);
        const brokerFee = propertyValueInitial * (this.params.brokerFee / 100) * (1 + vat);
        const lawyerFee = propertyValueInitial * (this.params.lawyerFee / 100) * (1 + vat);
        const appraiserFee = (this.params.appraiserFee ?? CONFIG.REAL_ESTATE.APPRAISER_FEE) * (1 + vat);
        const advisorFee = (this.params.advisorFee ?? CONFIG.REAL_ESTATE.MORTGAGE_ADVISOR_FEE) * (1 + vat);
        const acquisitionFees = brokerFee + lawyerFee + appraiserFee + advisorFee;
        const totalAcquisitionCosts = purchaseTax + acquisitionFees;

        const fin = this.planFinancing(propertyValueInitial, initialCapital - totalAcquisitionCosts, maxLtv);
        const leftoverCapital = fin.leftover;
        const initialLoanAmount = fin.bankLoan + fin.externalLoan;
        let bankBalance = fin.bankLoan;
        let extBalance = fin.externalLoan;
        const bankPmt = this.calculateMortgagePayment(bankBalance, this.params.mortgageRate, mortgageYears);
        const extPmt = this.calculateMortgagePayment(extBalance, extRate, extYears);

        // Stock side
        const stockBuySellFee = (this.params.stockBuySellFee ?? CONFIG.STOCK_MARKET.BUY_SELL_FEE * 100) / 100;
        const currencyConversionFee = (this.params.currencyConversionFee ?? CONFIG.STOCK_MARKET.CURRENCY_CONVERSION_FEE * 100) / 100;
        const stockGainsTax = (this.params.stockGainsTax ?? 25) / 100;
        const totalStockBuyFee = stockBuySellFee + currencyConversionFee;
        const initialStockBuyFeeAmount = initialCapital * totalStockBuyFee;
        let stockPortfolioValue = initialCapital - initialStockBuyFeeAmount;
        const stockInitialBasis = stockPortfolioValue;

        let currentPropertyValue = propertyValueInitial;
        let cumulativeReCashFlow = 0;
        let cumulativeStockMgmtFees = 0;
        let cumulativeStockGrowth = 0;
        let cumulativeRentalTax = 0;
        let cumulativeRentIncome = 0;
        let cumulativeOperatingExpenses = 0;
        let cumulativeInterestPaid = 0;
        const inflationMultiplier = 1 + (this.params.inflationRate / 100);
        const rentGrowthMultiplier = 1 + (rentGrowthRate / 100);

        for (let year = 1; year <= years; year++) {
            currentPropertyValue *= (1 + (this.params.propertyAppreciation / 100));

            const monthlyRentAdjusted = this.params.monthlyRent * Math.pow(rentGrowthMultiplier, year - 1);
            const yearlyRentIncome = monthlyRentAdjusted * (12 - this.params.vacancyMonths);
            cumulativeRentIncome += yearlyRentIncome;

            const maintenanceCost = currentPropertyValue * (this.params.maintenanceYearly / 100);
            const insuranceCost = insuranceYearly * Math.pow(inflationMultiplier, year - 1);
            const rentalTaxCost = yearlyRentIncome * rentalTaxRate;
            cumulativeRentalTax += rentalTaxCost;
            // Building-committee fees are the tenant's expense in a rental; only the periodic refresh stays on the owner.
            const periodic = this.propertyPeriodicCosts(year, inflationMultiplier);
            cumulativeOperatingExpenses += maintenanceCost + insuranceCost + periodic.reno;

            const bank = this.amortizeYear(bankBalance, this.params.mortgageRate, bankPmt); bankBalance = bank.balance;
            const ext = this.amortizeYear(extBalance, extRate, extPmt); extBalance = ext.balance;
            const mortgageYearlyPayment = bank.paid + ext.paid;
            cumulativeInterestPaid += bank.interestPaid + ext.interestPaid;
            const debt = bankBalance + extBalance;

            const expenses = maintenanceCost + insuranceCost + rentalTaxCost + periodic.reno;
            const yearlyReCashFlow = yearlyRentIncome - expenses - mortgageYearlyPayment;
            cumulativeReCashFlow += yearlyReCashFlow;

            const prevStockValue = stockPortfolioValue;
            stockPortfolioValue *= (1 + (this.params.stockReturn / 100));
            cumulativeStockGrowth += stockPortfolioValue - prevStockValue;
            const yearlyMgmtFee = stockPortfolioValue * (this.params.managementFee / 100);
            cumulativeStockMgmtFees += yearlyMgmtFee;
            stockPortfolioValue -= yearlyMgmtFee;

            const reNetWorth = currentPropertyValue - debt + cumulativeReCashFlow + leftoverCapital;
            results.yearlyData.push({
                year,
                propertyValue: currentPropertyValue,
                mortgageBalance: debt,
                reNetWorth,
                stockPortfolioValue,
                cumulativeReCashFlow,
                yearlyRentIncome,
                inflationAdjustedReNetWorth: reNetWorth / Math.pow(inflationMultiplier, year),
                inflationAdjustedStockValue: stockPortfolioValue / Math.pow(inflationMultiplier, year),
                cf: { rent: yearlyRentIncome, expenses, mortgage: mortgageYearlyPayment, net: yearlyReCashFlow, cumulative: cumulativeReCashFlow }
            });
        }

        const totalInflationMultiplier = Math.max(1, Math.pow(inflationMultiplier, years));
        const finalDebt = bankBalance + extBalance;
        const saleCosts = currentPropertyValue * saleCostRate;
        let reRealProfit = currentPropertyValue - propertyValueInitial * totalInflationMultiplier
            - totalAcquisitionCosts * totalInflationMultiplier - saleCosts;
        const masShevach = reRealProfit > 0 ? reRealProfit * reGainsTax : 0;
        const finalReNetWorth = currentPropertyValue - finalDebt + cumulativeReCashFlow + leftoverCapital - masShevach - saleCosts;

        const finalStockSellFee = stockPortfolioValue * (stockBuySellFee + currencyConversionFee);
        const stockValueAfterFees = stockPortfolioValue - finalStockSellFee;
        const stockRealProfit = stockValueAfterFees - stockInitialBasis * totalInflationMultiplier;
        const stockTax = stockRealProfit > 0 ? stockRealProfit * stockGainsTax : 0;
        const finalStockNetWorth = stockValueAfterFees - stockTax;

        const appreciation = currentPropertyValue - propertyValueInitial;
        const gainOnLoanPortion = propertyValueInitial > 0 ? initialLoanAmount * (currentPropertyValue / propertyValueInitial - 1) : 0;

        // Each row's `amount` sums exactly to finalReNetWorth / finalStockNetWorth — this is the transparency report.
        const reBreakdown = [
            { label: 'הון עצמי התחלתי', amount: initialCapital },
            { label: 'מס רכישה', amount: -purchaseTax },
            { label: 'עלויות רכישה (תיווך, עו"ד, שמאי, יועץ)', amount: -acquisitionFees },
            { label: 'עליית ערך הנכס', amount: appreciation },
            { label: 'הכנסות שכירות מצטברות', amount: cumulativeRentIncome },
            { label: 'הוצאות שוטפות (תחזוקה, ביטוח, שיפוצים)', amount: -cumulativeOperatingExpenses },
            { label: 'מס על הכנסות שכירות', amount: -cumulativeRentalTax },
            { label: 'ריבית משכנתא ששולמה', amount: -cumulativeInterestPaid },
            { label: 'מס שבח במכירה', amount: -masShevach },
            { label: 'עלויות מכירה', amount: -saleCosts }
        ];
        const stockBreakdown = [
            { label: 'הון עצמי התחלתי', amount: initialCapital },
            { label: 'עמלת קנייה ראשונית', amount: -initialStockBuyFeeAmount },
            { label: 'רווחי שוק ברוטו', amount: cumulativeStockGrowth },
            { label: 'דמי ניהול מצטברים', amount: -cumulativeStockMgmtFees },
            { label: 'עמלת מכירה', amount: -finalStockSellFee },
            { label: 'מס רווחי הון', amount: -stockTax }
        ];

        results.summary = {
            mode: 'investment',
            labels: { re: 'נדל"ן (השכרה)', stock: 'שוק ההון' },
            finalReNetWorth, finalStockNetWorth,
            financing: { bankLoan: fin.bankLoan, externalLoan: fin.externalLoan },
            totalReTaxes: purchaseTax + masShevach + cumulativeRentalTax,
            totalStockTaxes: stockTax,
            totalReFees: acquisitionFees + saleCosts,
            totalStockFees: initialStockBuyFeeAmount + finalStockSellFee + cumulativeStockMgmtFees,
            reROI: initialCapital > 0 ? ((finalReNetWorth - initialCapital) / initialCapital) * 100 : 0,
            stockROI: initialCapital > 0 ? ((finalStockNetWorth - initialCapital) / initialCapital) * 100 : 0,
            winner: finalReNetWorth > finalStockNetWorth ? 'real-estate' : 'stock',
            difference: Math.abs(finalReNetWorth - finalStockNetWorth),
            breakdown: {
                re: reBreakdown,
                stock: stockBreakdown,
                leverage: {
                    loanAmount: initialLoanAmount,
                    gainOnLoan: gainOnLoanPortion,
                    interestPaid: cumulativeInterestPaid,
                    net: gainOnLoanPortion - cumulativeInterestPaid
                }
            }
        };
        return results;
    }

    // ===== Housing mode: buy a home to live in vs. rent a home and invest the difference =====
    runHousingSimulation() {
        const years = this.params.investmentYears;
        const results = { yearlyData: [], summary: {}, mode: 'housing' };

        const propertyValueInitial = this.params.propertyValue;
        const initialCapital = this.params.initialCapital;

        const vat = (this.params.vat ?? 18) / 100;
        const reGainsTax = (this.params.reGainsTax ?? 0) / 100; // single residence is usually exempt
        const saleCostRate = (this.params.saleCostPct ?? 0) / 100;
        const insuranceYearly = this.params.insuranceYearly ?? CONFIG.REAL_ESTATE.INSURANCE_YEARLY;
        const mortgageYears = this.params.mortgageYears || years;
        const maxLtv = this.params.maxLtv ?? CONFIG.FINANCING.MAX_LTV_RESIDENT;
        const extRate = this.params.externalLoanRate ?? CONFIG.FINANCING.EXTERNAL_LOAN_RATE;
        const extYears = this.params.externalLoanYears ?? CONFIG.FINANCING.EXTERNAL_LOAN_YEARS;
        const rentGrowthRate = this.params.rentGrowth ?? this.params.propertyAppreciation;

        const purchaseTax = this.calculatePurchaseTax(propertyValueInitial, CONFIG.REAL_ESTATE.PURCHASE_TAX_BRACKETS_RESIDENT);
        const brokerFee = propertyValueInitial * (this.params.brokerFee / 100) * (1 + vat);
        const lawyerFee = propertyValueInitial * (this.params.lawyerFee / 100) * (1 + vat);
        const appraiserFee = (this.params.appraiserFee ?? CONFIG.REAL_ESTATE.APPRAISER_FEE) * (1 + vat);
        const advisorFee = (this.params.advisorFee ?? CONFIG.REAL_ESTATE.MORTGAGE_ADVISOR_FEE) * (1 + vat);
        const acquisitionFees = brokerFee + lawyerFee + appraiserFee + advisorFee;
        const totalAcquisitionCosts = purchaseTax + acquisitionFees;
        const setup = this.calculateSetupCosts();

        const fin = this.planFinancing(propertyValueInitial, initialCapital - totalAcquisitionCosts - setup.total, maxLtv);
        const leftoverCapital = fin.leftover;
        const initialLoanAmount = fin.bankLoan + fin.externalLoan;
        let bankBalance = fin.bankLoan;
        let extBalance = fin.externalLoan;
        const bankPmt = this.calculateMortgagePayment(bankBalance, this.params.mortgageRate, mortgageYears);
        const extPmt = this.calculateMortgagePayment(extBalance, extRate, extYears);

        const stockBuySellFee = (this.params.stockBuySellFee ?? CONFIG.STOCK_MARKET.BUY_SELL_FEE * 100) / 100;
        const currencyConversionFee = (this.params.currencyConversionFee ?? CONFIG.STOCK_MARKET.CURRENCY_CONVERSION_FEE * 100) / 100;
        const stockGainsTax = (this.params.stockGainsTax ?? 25) / 100;
        const totalStockBuyFee = stockBuySellFee + currencyConversionFee;
        const initialStockBuyFeeAmount = initialCapital * totalStockBuyFee;
        let portfolio = initialCapital - initialStockBuyFeeAmount;
        const stockInitialBasis = portfolio;
        let cumulativeContrib = 0;
        let cumulativeContribBasis = 0; // inflation-adjusted cost basis of contributions, for real capital-gains tax
        let cumulativeStockMgmtFees = 0;
        let cumulativeStockGrowth = 0;
        let cumulativeInterestPaid = 0;

        let currentPropertyValue = propertyValueInitial;
        const inflationMultiplier = 1 + (this.params.inflationRate / 100);
        const rentGrowthMultiplier = 1 + (rentGrowthRate / 100);
        const monthlyReturn = Math.pow(1 + this.params.stockReturn / 100, 1 / 12) - 1;

        for (let year = 1; year <= years; year++) {
            currentPropertyValue *= (1 + (this.params.propertyAppreciation / 100));

            const maintenanceCost = currentPropertyValue * (this.params.maintenanceYearly / 100);
            const insuranceCost = insuranceYearly * Math.pow(inflationMultiplier, year - 1);
            // Arnona + building committee fees would be paid by a renter too — they cancel out of the buy-vs-rent comparison.
            const periodic = this.propertyPeriodicCosts(year, inflationMultiplier);

            const bank = this.amortizeYear(bankBalance, this.params.mortgageRate, bankPmt); bankBalance = bank.balance;
            const ext = this.amortizeYear(extBalance, extRate, extPmt); extBalance = ext.balance;
            const mortgageYearlyPayment = bank.paid + ext.paid;
            cumulativeInterestPaid += bank.interestPaid + ext.interestPaid;
            const debt = bankBalance + extBalance;

            const buyerYearlyHousingCost = mortgageYearlyPayment + maintenanceCost + insuranceCost + periodic.reno;
            const buyerMonthly = buyerYearlyHousingCost / 12;

            const renterMonthly = (this.params.monthlyRent || CONFIG.DEFAULTS.livingRentMonthly) * Math.pow(rentGrowthMultiplier, year - 1);
            const renterYearlyRent = renterMonthly * 12;
            const monthlyContribution = buyerMonthly - renterMonthly;

            for (let m = 0; m < 12; m++) {
                const prevPortfolio = portfolio;
                portfolio *= (1 + monthlyReturn);
                cumulativeStockGrowth += portfolio - prevPortfolio;
                portfolio += monthlyContribution;
            }
            const yearlyContribution = monthlyContribution * 12;
            cumulativeContrib += yearlyContribution;
            if (yearlyContribution > 0) {
                cumulativeContribBasis += yearlyContribution * Math.pow(inflationMultiplier, years - year);
            }
            const yearlyMgmtFee = portfolio * (this.params.managementFee / 100);
            cumulativeStockMgmtFees += yearlyMgmtFee;
            portfolio -= yearlyMgmtFee;

            const buyNetWorth = currentPropertyValue - debt + leftoverCapital;
            results.yearlyData.push({
                year,
                propertyValue: currentPropertyValue,
                mortgageBalance: debt,
                reNetWorth: buyNetWorth,
                stockPortfolioValue: portfolio,
                cumulativeReCashFlow: cumulativeContrib,
                yearlyRentIncome: renterYearlyRent,
                inflationAdjustedReNetWorth: buyNetWorth / Math.pow(inflationMultiplier, year),
                inflationAdjustedStockValue: portfolio / Math.pow(inflationMultiplier, year),
                cf: { rent: renterYearlyRent, buyerCost: buyerYearlyHousingCost, mortgage: mortgageYearlyPayment, invested: yearlyContribution, cumulative: cumulativeContrib }
            });
        }

        const totalInflationMultiplier = Math.max(1, Math.pow(inflationMultiplier, years));
        const finalDebt = bankBalance + extBalance;
        const saleCosts = currentPropertyValue * saleCostRate;
        let reRealProfit = currentPropertyValue - propertyValueInitial * totalInflationMultiplier
            - totalAcquisitionCosts * totalInflationMultiplier - saleCosts;
        const masShevach = reRealProfit > 0 ? reRealProfit * reGainsTax : 0;
        const finalReNetWorth = currentPropertyValue - finalDebt + leftoverCapital - saleCosts - masShevach;

        const finalStockSellFee = portfolio * (stockBuySellFee + currencyConversionFee);
        const portfolioAfterFees = portfolio - finalStockSellFee;
        const costBasis = stockInitialBasis * totalInflationMultiplier + cumulativeContribBasis;
        const stockRealProfit = portfolioAfterFees - costBasis;
        const stockTax = stockRealProfit > 0 ? stockRealProfit * stockGainsTax : 0;
        const finalStockNetWorth = portfolioAfterFees - stockTax;

        const appreciation = currentPropertyValue - propertyValueInitial;
        const totalPrincipalPaid = initialLoanAmount - finalDebt;
        const gainOnLoanPortion = propertyValueInitial > 0 ? initialLoanAmount * (currentPropertyValue / propertyValueInitial - 1) : 0;

        // Each row's `amount` sums exactly to finalReNetWorth / finalStockNetWorth — this is the transparency report.
        const reBreakdown = [
            { label: 'הון עצמי התחלתי', amount: initialCapital },
            { label: 'מס רכישה', amount: -purchaseTax },
            { label: 'עלויות רכישה (תיווך, עו"ד, שמאי, יועץ)', amount: -acquisitionFees },
            { label: 'עלויות כניסה לדירה (שיפוץ, ריהוט, מטבח...)', amount: -setup.total },
            { label: 'עליית ערך הנכס', amount: appreciation },
            { label: 'הון שנצבר דרך החזרי קרן המשכנתא', amount: totalPrincipalPaid },
            { label: 'עלויות מכירה', amount: -saleCosts },
            { label: 'מס שבח במכירה', amount: -masShevach }
        ];
        const stockBreakdown = [
            { label: 'הון עצמי התחלתי', amount: initialCapital },
            { label: 'עמלת קנייה ראשונית', amount: -initialStockBuyFeeAmount },
            { label: 'רווחי שוק ברוטו', amount: cumulativeStockGrowth },
            { label: 'הפרש שכ"ד מול עלות דיור שהושקע', amount: cumulativeContrib },
            { label: 'דמי ניהול מצטברים', amount: -cumulativeStockMgmtFees },
            { label: 'עמלת מכירה', amount: -finalStockSellFee },
            { label: 'מס רווחי הון', amount: -stockTax }
        ];

        results.summary = {
            mode: 'housing',
            labels: { re: 'קניית בית', stock: 'שכירות + השקעה' },
            finalReNetWorth, finalStockNetWorth, setup,
            financing: { bankLoan: fin.bankLoan, externalLoan: fin.externalLoan },
            totalReTaxes: purchaseTax + masShevach,
            totalStockTaxes: stockTax,
            totalReFees: acquisitionFees + saleCosts + setup.total,
            totalStockFees: initialStockBuyFeeAmount + finalStockSellFee + cumulativeStockMgmtFees,
            reROI: initialCapital > 0 ? ((finalReNetWorth - initialCapital) / initialCapital) * 100 : 0,
            stockROI: initialCapital > 0 ? ((finalStockNetWorth - initialCapital) / initialCapital) * 100 : 0,
            winner: finalReNetWorth > finalStockNetWorth ? 'real-estate' : 'stock',
            difference: Math.abs(finalReNetWorth - finalStockNetWorth),
            breakdown: {
                re: reBreakdown,
                stock: stockBreakdown,
                leverage: {
                    loanAmount: initialLoanAmount,
                    gainOnLoan: gainOnLoanPortion,
                    interestPaid: cumulativeInterestPaid,
                    net: gainOnLoanPortion - cumulativeInterestPaid
                }
            }
        };
        return results;
    }
}
