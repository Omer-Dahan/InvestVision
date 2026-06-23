// js/monte-carlo.js

class MonteCarloSimulation {
    constructor(baseParams, baseResults) {
        this.params = baseParams;
        this.baseResults = baseResults; // We might need this for context, but mainly we use params
    }

    // Box-Muller transform for normal distribution
    randomNormal(mean = 0, stdev = 1) {
        const u = 1 - Math.random(); // Converting [0,1) to (0,1]
        const v = Math.random();
        const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
        return z * stdev + mean;
    }

    run(iterations = CONFIG.MONTE_CARLO.ITERATIONS) {
        const results = {
            reFinalValues: [],
            stockFinalValues: [],
            reWins: 0,
            stockWins: 0,
            percentiles: {
                re: {},
                stock: {}
            }
        };

        // Editable fee/tax/volatility assumptions (constant across iterations)
        const stockBuySellFee = (this.params.stockBuySellFee ?? CONFIG.STOCK_MARKET.BUY_SELL_FEE * 100) / 100;
        const currencyConversionFee = (this.params.currencyConversionFee ?? CONFIG.STOCK_MARKET.CURRENCY_CONVERSION_FEE * 100) / 100;
        const totalStockBuyFee = stockBuySellFee + currencyConversionFee;
        const stockGainsTax = (this.params.stockGainsTax ?? 25) / 100;
        const reGainsTax = (this.params.reGainsTax ?? 25) / 100;
        const rentalTaxRate = (this.params.rentalTax ?? 0) / 100;
        const saleCostRate = (this.params.saleCostPct ?? 0) / 100;
        const insuranceYearly = this.params.insuranceYearly ?? CONFIG.REAL_ESTATE.INSURANCE_YEARLY;
        const stockVol = (this.params.stockVolatility != null ? this.params.stockVolatility / 100 : CONFIG.MONTE_CARLO.STOCK_VOLATILITY);
        const reVol = (this.params.reVolatility != null ? this.params.reVolatility / 100 : CONFIG.MONTE_CARLO.RE_VOLATILITY);

        for (let i = 0; i < iterations; i++) {
            // Clone params for this iteration to add noise
            const iterParams = { ...this.params };
            
            // Generate randomized return sequences
            const years = iterParams.investmentYears;
            
            // We run a simplified simulation for speed inside the MC loop
            let stockPortfolioValue = iterParams.initialCapital;
            
            // Deduct initial buy fee
            stockPortfolioValue -= stockPortfolioValue * totalStockBuyFee;
            const stockInitialBasis = stockPortfolioValue;

            let currentPropertyValue = iterParams.propertyValue;
            const effectiveDownPayment = iterParams.initialCapital - this.calculateAcquisitionCosts(iterParams);
            let currentMortgageBalance = iterParams.propertyValue - effectiveDownPayment;
            let leftoverCapital = 0;
            
            if (currentMortgageBalance < 0) {
                 leftoverCapital = Math.abs(currentMortgageBalance);
                 currentMortgageBalance = 0;
            }
            // When effectiveDownPayment is negative, currentMortgageBalance already includes the fee shortfall.

            const mortgageYears = iterParams.mortgageYears || years;
            const pmt = this.calculateMortgagePayment(currentMortgageBalance, iterParams.mortgageRate, mortgageYears);
            let cumulativeReCashFlow = 0;
            const inflationMultiplier = 1 + (iterParams.inflationRate / 100);

            for (let year = 1; year <= years; year++) {
                // Add noise to returns
                // Clamp to -100%: an asset cannot lose more than its entire value in a single year.
                const stockYearReturn = Math.max(-1, this.randomNormal(iterParams.stockReturn / 100, stockVol));
                const reYearReturn = Math.max(-1, this.randomNormal(iterParams.propertyAppreciation / 100, reVol));

                // Stock update
                stockPortfolioValue *= (1 + stockYearReturn);
                stockPortfolioValue -= stockPortfolioValue * (iterParams.managementFee / 100);

                // RE update
                currentPropertyValue *= (1 + reYearReturn);
                const monthlyRentAdjusted = iterParams.monthlyRent * Math.pow(inflationMultiplier, year - 1);
                const yearlyRentIncome = monthlyRentAdjusted * (12 - iterParams.vacancyMonths);
                
                const maintenanceCost = currentPropertyValue * (iterParams.maintenanceYearly / 100);
                const insuranceCost = insuranceYearly * Math.pow(inflationMultiplier, year - 1);
                const rentalTaxCost = yearlyRentIncome * rentalTaxRate;

                let mortgageYearlyPayment = 0;
                if (currentMortgageBalance > 0) {
                    const monthlyRate = iterParams.mortgageRate / 100 / 12;
                    for (let m = 0; m < 12 && currentMortgageBalance > 0; m++) {
                        const interest = currentMortgageBalance * monthlyRate;
                        let principalPaid = pmt - interest;
                        let payment = pmt;
                        if (principalPaid >= currentMortgageBalance) {
                            principalPaid = currentMortgageBalance;
                            payment = interest + principalPaid;
                        }
                        currentMortgageBalance -= principalPaid;
                        mortgageYearlyPayment += payment;
                    }
                    if (currentMortgageBalance < 0) currentMortgageBalance = 0;
                }

                // Negative cash flow is a real out-of-pocket cost; positive cash flow is consumed (see calculator.js).
                cumulativeReCashFlow += Math.min(0, yearlyRentIncome - rentalTaxCost - maintenanceCost - insuranceCost - mortgageYearlyPayment);
            }

            // Final Taxes
            const totalInflationMultiplier = Math.max(1, Math.pow(inflationMultiplier, years));
            
            // RE Tax
            const saleCosts = currentPropertyValue * saleCostRate;
            const inflationAdjustedInitialProperty = iterParams.propertyValue * totalInflationMultiplier;
            let reRealProfit = currentPropertyValue - inflationAdjustedInitialProperty;
            reRealProfit -= (this.calculateAcquisitionCosts(iterParams) * totalInflationMultiplier);
            reRealProfit -= saleCosts;
            const masShevach = reRealProfit > 0 ? reRealProfit * reGainsTax : 0;
            const finalReNetWorth = currentPropertyValue - currentMortgageBalance + cumulativeReCashFlow + leftoverCapital - masShevach - saleCosts;

            // Stock Tax
            const finalStockSellFee = stockPortfolioValue * (stockBuySellFee + currencyConversionFee);
            const stockValueAfterFees = stockPortfolioValue - finalStockSellFee;
            const inflationAdjustedInitialStock = stockInitialBasis * totalInflationMultiplier;
            const stockRealProfit = stockValueAfterFees - inflationAdjustedInitialStock;
            const stockTax = stockRealProfit > 0 ? stockRealProfit * stockGainsTax : 0;
            const finalStockNetWorth = stockValueAfterFees - stockTax;

            results.reFinalValues.push(finalReNetWorth);
            results.stockFinalValues.push(finalStockNetWorth);

            if (finalReNetWorth > finalStockNetWorth) {
                results.reWins++;
            } else {
                results.stockWins++;
            }
        }

        // Sort for percentiles
        results.reFinalValues.sort((a, b) => a - b);
        results.stockFinalValues.sort((a, b) => a - b);

        results.percentiles = {
            re: {
                p5: results.reFinalValues[Math.floor(iterations * 0.05)],
                p50: results.reFinalValues[Math.floor(iterations * 0.5)],
                p95: results.reFinalValues[Math.floor(iterations * 0.95)],
            },
            stock: {
                p5: results.stockFinalValues[Math.floor(iterations * 0.05)],
                p50: results.stockFinalValues[Math.floor(iterations * 0.5)],
                p95: results.stockFinalValues[Math.floor(iterations * 0.95)],
            }
        };

        results.winRate = {
            re: (results.reWins / iterations) * 100,
            stock: (results.stockWins / iterations) * 100
        };

        return results;
    }

    calculateAcquisitionCosts(params) {
        // Simplified version of the one in calculator for MC speed
        let tax = 0;
        let remainingValue = params.propertyValue;
        let previousLimit = 0;
        for (const bracket of CONFIG.REAL_ESTATE.PURCHASE_TAX_BRACKETS_INVESTOR) {
            const bracketAmount = Math.min(Math.max(0, remainingValue), bracket.limit - previousLimit);
            tax += bracketAmount * bracket.rate;
            remainingValue -= bracketAmount;
            previousLimit = bracket.limit;
            if (remainingValue <= 0) break;
        }
        
        const brokerFee = params.propertyValue * (params.brokerFee / 100) * (1 + CONFIG.REAL_ESTATE.VAT);
        const lawyerFee = params.propertyValue * (params.lawyerFee / 100) * (1 + CONFIG.REAL_ESTATE.VAT);
        const appraiserFee = CONFIG.REAL_ESTATE.APPRAISER_FEE * (1 + CONFIG.REAL_ESTATE.VAT);
        const advisorFee = CONFIG.REAL_ESTATE.MORTGAGE_ADVISOR_FEE * (1 + CONFIG.REAL_ESTATE.VAT);
        
        return tax + brokerFee + lawyerFee + appraiserFee + advisorFee;
    }

    calculateMortgagePayment(principal, annualRate, years) {
        if (annualRate === 0) return principal / (years * 12);
        const monthlyRate = annualRate / 100 / 12;
        const numberOfPayments = years * 12;
        return (principal * monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) / 
               (Math.pow(1 + monthlyRate, numberOfPayments) - 1);
    }
}
