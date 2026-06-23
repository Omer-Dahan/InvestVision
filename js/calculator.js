// js/calculator.js

class FinancialCalculator {
    constructor(params) {
        this.params = params;
    }

    // --- Helper Functions ---

    calculatePurchaseTax(propertyValue) {
        let tax = 0;
        let remainingValue = propertyValue;
        let previousLimit = 0;

        for (const bracket of CONFIG.REAL_ESTATE.PURCHASE_TAX_BRACKETS_INVESTOR) {
            const bracketAmount = Math.min(Math.max(0, remainingValue), bracket.limit - previousLimit);
            tax += bracketAmount * bracket.rate;
            remainingValue -= bracketAmount;
            previousLimit = bracket.limit;
            if (remainingValue <= 0) break;
        }
        return tax;
    }

    calculateMortgagePayment(principal, annualRate, years) {
        if (annualRate === 0) return principal / (years * 12);
        const monthlyRate = annualRate / 100 / 12;
        const numberOfPayments = years * 12;
        return (principal * monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) / 
               (Math.pow(1 + monthlyRate, numberOfPayments) - 1);
    }

    // --- Main Simulation ---

    runSimulation() {
        const years = this.params.investmentYears;
        const results = {
            yearlyData: [],
            summary: {}
        };

        // --- Initial State: Real Estate ---
        const propertyValueInitial = this.params.propertyValue;
        const initialCapital = this.params.initialCapital;
        
        // Editable assumptions (fall back to sensible defaults if not supplied)
        const vat = (this.params.vat ?? 18) / 100;
        const reGainsTax = (this.params.reGainsTax ?? 25) / 100;
        const rentalTaxRate = (this.params.rentalTax ?? 0) / 100;
        const saleCostRate = (this.params.saleCostPct ?? 0) / 100;
        const insuranceYearly = this.params.insuranceYearly ?? CONFIG.REAL_ESTATE.INSURANCE_YEARLY;
        const mortgageYears = this.params.mortgageYears || years;

        // Calculate Acquisition Costs
        const purchaseTax = this.calculatePurchaseTax(propertyValueInitial);
        const brokerFee = propertyValueInitial * (this.params.brokerFee / 100) * (1 + vat);
        const lawyerFee = propertyValueInitial * (this.params.lawyerFee / 100) * (1 + vat);
        const appraiserFee = (this.params.appraiserFee ?? CONFIG.REAL_ESTATE.APPRAISER_FEE) * (1 + vat);
        const advisorFee = (this.params.advisorFee ?? CONFIG.REAL_ESTATE.MORTGAGE_ADVISOR_FEE) * (1 + vat);

        const totalAcquisitionCosts = purchaseTax + brokerFee + lawyerFee + appraiserFee + advisorFee;
        
        // Mortgage Amount = Property Value - (Initial Capital - Acquisition Costs)
        const effectiveDownPayment = initialCapital - totalAcquisitionCosts;
        let mortgagePrincipal = propertyValueInitial - effectiveDownPayment;
        let leftoverCapital = 0;

        if (mortgagePrincipal < 0) {
            // User has more than enough cash to buy without a mortgage; the excess stays as idle cash.
            leftoverCapital = Math.abs(mortgagePrincipal);
            mortgagePrincipal = 0;
        }
        // Note: when capital doesn't even cover the fees, effectiveDownPayment is negative and
        // mortgagePrincipal (= propertyValue - effectiveDownPayment) already includes that shortfall.
        
        const pmt = this.calculateMortgagePayment(mortgagePrincipal, this.params.mortgageRate, mortgageYears);

        // --- Initial State: Stock Market ---
        // Assuming the same initial capital is invested in the stock market
        let stockPortfolioValue = initialCapital;
        
        // Deduct initial buy fee and conversion fee
        const stockBuySellFee = (this.params.stockBuySellFee ?? CONFIG.STOCK_MARKET.BUY_SELL_FEE * 100) / 100;
        const currencyConversionFee = (this.params.currencyConversionFee ?? CONFIG.STOCK_MARKET.CURRENCY_CONVERSION_FEE * 100) / 100;
        const stockGainsTax = (this.params.stockGainsTax ?? 25) / 100;
        const totalStockBuyFee = stockBuySellFee + currencyConversionFee;
        stockPortfolioValue -= stockPortfolioValue * totalStockBuyFee;
        const stockInitialBasis = stockPortfolioValue;

        // --- Simulation Loop ---
        let currentPropertyValue = propertyValueInitial;
        let currentMortgageBalance = mortgagePrincipal;
        
        let cumulativeReCashFlow = 0;
        let cumulativeStockMgmtFees = 0;
        let cumulativeRentalTax = 0;
        const inflationMultiplier = 1 + (this.params.inflationRate / 100);

        for (let year = 1; year <= years; year++) {
            // 1. Update Real Estate
            currentPropertyValue *= (1 + (this.params.propertyAppreciation / 100));
            
            // Rent calculation (adjusted for inflation)
            const monthlyRentAdjusted = this.params.monthlyRent * Math.pow(inflationMultiplier, year - 1);
            const activeMonths = 12 - this.params.vacancyMonths;
            const yearlyRentIncome = monthlyRentAdjusted * activeMonths;
            
            // Expenses
            const maintenanceCost = currentPropertyValue * (this.params.maintenanceYearly / 100);
            const insuranceCost = insuranceYearly * Math.pow(inflationMultiplier, year - 1);
            const rentalTaxCost = yearlyRentIncome * rentalTaxRate;
            cumulativeRentalTax += rentalTaxCost;

            // Calculate the actual mortgage payments for the year. Payments stop once the loan is
            // paid off, so a mortgage term shorter than the investment horizon frees up cash flow afterwards.
            let mortgageYearlyPayment = 0;
            if (currentMortgageBalance > 0) {
                const monthlyRate = this.params.mortgageRate / 100 / 12;
                for (let m = 0; m < 12 && currentMortgageBalance > 0; m++) {
                    const interest = currentMortgageBalance * monthlyRate;
                    let principalPaid = pmt - interest;
                    let payment = pmt;
                    if (principalPaid >= currentMortgageBalance) {
                        // Final (partial) payment — don't overpay past the remaining balance
                        principalPaid = currentMortgageBalance;
                        payment = interest + principalPaid;
                    }
                    currentMortgageBalance -= principalPaid;
                    mortgageYearlyPayment += payment;
                }
                if (currentMortgageBalance < 0) currentMortgageBalance = 0;
            }

            // Cash flow for the year (Rent - Rental Tax - Expenses - Mortgage Payment)
            const yearlyReCashFlow = yearlyRentIncome - rentalTaxCost - maintenanceCost - insuranceCost - mortgageYearlyPayment;
            // Lifestyle comparison (RE believer vs. stock believer):
            // - Negative cash flow is paid out of pocket — a real cost of holding the property, so it reduces net worth.
            // - Positive cash flow is treated as consumed (quality of life), so it is NOT added to net worth.
            cumulativeReCashFlow += Math.min(0, yearlyReCashFlow);

            // 2. Update Stock Market
            // The stock investor puts the same initial capital into the market and lets it compound.
            // We intentionally do NOT cross-invest the RE cash-flow difference into stocks — we are
            // comparing two distinct lifestyles, not the same cash stream routed two ways.

            stockPortfolioValue *= (1 + (this.params.stockReturn / 100));
            const yearlyMgmtFee = stockPortfolioValue * (this.params.managementFee / 100);
            cumulativeStockMgmtFees += yearlyMgmtFee;
            stockPortfolioValue -= yearlyMgmtFee; // Apply management fee

            // 3. Save Yearly Data
            results.yearlyData.push({
                year,
                propertyValue: currentPropertyValue,
                mortgageBalance: currentMortgageBalance,
                reNetWorth: currentPropertyValue - currentMortgageBalance + cumulativeReCashFlow + leftoverCapital,
                stockPortfolioValue: stockPortfolioValue,
                cumulativeReCashFlow: cumulativeReCashFlow,
                yearlyRentIncome: yearlyRentIncome,
                inflationAdjustedReNetWorth: (currentPropertyValue - currentMortgageBalance + cumulativeReCashFlow + leftoverCapital) / Math.pow(inflationMultiplier, year),
                inflationAdjustedStockValue: stockPortfolioValue / Math.pow(inflationMultiplier, year)
            });
        }

        // --- End of Simulation: Tax Calculations ---
        
        // Deflation indexation floor is 1.0 (cannot increase profit due to negative inflation)
        const totalInflationMultiplier = Math.max(1, Math.pow(inflationMultiplier, years));
        
        // RE Capital Gains Tax (Mas Shevach)
        const saleCosts = currentPropertyValue * saleCostRate; // selling fees (broker/lawyer), paid at sale
        const inflationAdjustedInitialProperty = propertyValueInitial * totalInflationMultiplier;
        let reRealProfit = currentPropertyValue - inflationAdjustedInitialProperty;
        const deductibleExpenses = totalAcquisitionCosts * totalInflationMultiplier;
        reRealProfit -= deductibleExpenses;
        reRealProfit -= saleCosts; // selling costs are deductible from the taxable gain

        const masShevach = reRealProfit > 0 ? reRealProfit * reGainsTax : 0;
        const finalReNetWorth = currentPropertyValue - currentMortgageBalance + cumulativeReCashFlow + leftoverCapital - masShevach - saleCosts;

        // Stock Capital Gains Tax
        // Selling incurs a broker fee and a currency-conversion fee back to ILS
        const finalStockSellFee = stockPortfolioValue * (stockBuySellFee + currencyConversionFee);
        const stockValueAfterFees = stockPortfolioValue - finalStockSellFee;
        const inflationAdjustedInitialStock = stockInitialBasis * totalInflationMultiplier;

        const stockRealProfit = stockValueAfterFees - inflationAdjustedInitialStock;
        const stockTax = stockRealProfit > 0 ? stockRealProfit * stockGainsTax : 0;

        const finalStockNetWorth = stockValueAfterFees - stockTax;

        // --- Summarize Results ---
        results.summary = {
            finalReNetWorth,
            finalStockNetWorth,
            totalReTaxes: purchaseTax + masShevach + cumulativeRentalTax,
            totalStockTaxes: stockTax,
            totalReFees: (totalAcquisitionCosts - purchaseTax) + saleCosts, // acquisition + selling fees
            totalStockFees: (initialCapital * totalStockBuyFee) + finalStockSellFee + cumulativeStockMgmtFees,
            reROI: initialCapital > 0 ? ((finalReNetWorth - initialCapital) / initialCapital) * 100 : 0,
            stockROI: initialCapital > 0 ? ((finalStockNetWorth - initialCapital) / initialCapital) * 100 : 0,
            winner: finalReNetWorth > finalStockNetWorth ? 'real-estate' : 'stock',
            difference: Math.abs(finalReNetWorth - finalStockNetWorth)
        };

        return results;
    }
}
