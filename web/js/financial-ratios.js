/**
 * Financial Ratio Calculator & Interpreter
 * Ported from analyzing-financial-statements skill (Python → JavaScript)
 * Provides: ratio calculations, health scoring, interpretations, DuPont analysis
 */

const FinancialAnalysis = (() => {
    // --- Manufacturing Industry Benchmarks ---
    const BENCHMARKS = {
        current_ratio: { excellent: 2.2, good: 1.7, acceptable: 1.3, poor: 1.0 },
        quick_ratio: { excellent: 1.5, good: 1.2, acceptable: 0.8, poor: 0.5 },
        cash_ratio: { excellent: 0.8, good: 0.5, acceptable: 0.3, poor: 0.1 },
        debt_to_equity: { excellent: 0.4, good: 0.7, acceptable: 1.2, poor: 2.0 },
        roe: { excellent: 0.18, good: 0.14, acceptable: 0.10, poor: 0.06 },
        roa: { excellent: 0.12, good: 0.08, acceptable: 0.05, poor: 0.03 },
        gross_margin: { excellent: 0.35, good: 0.25, acceptable: 0.18, poor: 0.12 },
        operating_margin: { excellent: 0.20, good: 0.12, acceptable: 0.08, poor: 0.04 },
        net_margin: { excellent: 0.15, good: 0.10, acceptable: 0.06, poor: 0.03 },
        asset_turnover: { excellent: 1.8, good: 1.4, acceptable: 1.0, poor: 0.6 },
        inventory_turnover: { excellent: 8.0, good: 6.0, acceptable: 4.0, poor: 2.0 },
        pe_ratio: { undervalued: 14, fair: 20, growth: 28, expensive: 40 },
    };

    // --- Ratio Display Config ---
    const RATIO_CONFIG = {
        roe: { label: 'ROE', format: 'pct', category: 'profitability', vi: 'Tỷ suất sinh lời trên vốn chủ sở hữu' },
        roa: { label: 'ROA', format: 'pct', category: 'profitability', vi: 'Tỷ suất sinh lời trên tổng tài sản' },
        gross_margin: { label: 'Gross Margin', format: 'pct', category: 'profitability', vi: 'Biên lợi nhuận gộp' },
        operating_margin: { label: 'Operating Margin', format: 'pct', category: 'profitability', vi: 'Biên lợi nhuận hoạt động' },
        net_margin: { label: 'Net Margin', format: 'pct', category: 'profitability', vi: 'Biên lợi nhuận ròng' },
        current_ratio: { label: 'Current Ratio', format: 'times', category: 'liquidity', vi: 'Hệ số thanh toán ngắn hạn' },
        quick_ratio: { label: 'Quick Ratio', format: 'times', category: 'liquidity', vi: 'Hệ số thanh toán nhanh' },
        cash_ratio: { label: 'Cash Ratio', format: 'times', category: 'liquidity', vi: 'Hệ số thanh toán tiền mặt' },
        debt_to_equity: { label: 'D/E Ratio', format: 'times', category: 'leverage', vi: 'Tỷ lệ nợ trên vốn chủ sở hữu' },
        equity_multiplier: { label: 'Equity Multiplier', format: 'times', category: 'leverage', vi: 'Hệ số đòn bẩy tài chính' },
        asset_turnover: { label: 'Asset Turnover', format: 'times', category: 'efficiency', vi: 'Vòng quay tổng tài sản' },
        inventory_turnover: { label: 'Inventory Turnover', format: 'times', category: 'efficiency', vi: 'Vòng quay hàng tồn kho' },
        receivables_turnover: { label: 'Receivables Turnover', format: 'times', category: 'efficiency', vi: 'Vòng quay khoản phải thu' },
        pe_ratio: { label: 'P/E Ratio', format: 'times', category: 'valuation', vi: 'Hệ số giá trên lợi nhuận' },
        pb_ratio: { label: 'P/B Ratio', format: 'times', category: 'valuation', vi: 'Hệ số giá trên giá trị sổ sách' },
        ev_ebitda: { label: 'EV/EBITDA', format: 'times', category: 'valuation', vi: 'Giá trị doanh nghiệp trên EBITDA' },
    };

    // --- Safe Division ---
    function safeDiv(num, den, def = 0) {
        return den === 0 ? def : num / den;
    }

    // --- Calculate All Ratios for a Given Year Index ---
    function calculateAllRatios(data, yearIdx) {
        const bs = data.balance_sheet;
        const is = data.income_statement;
        const yr = data.years[yearIdx];

        const revenue = is.revenue[yearIdx];
        const cogs = is.cogs[yearIdx];
        const grossProfit = is.gross_profit[yearIdx];
        const operatingIncome = is.operating_income[yearIdx];
        const netIncome = is.net_income[yearIdx];
        const ebitda = is.ebitda[yearIdx];

        const currentAssets = bs.current_assets[yearIdx];
        const inventory = bs.inventory[yearIdx];
        const cashEquiv = bs.cash_and_equivalents[yearIdx] + bs.short_term_investments[yearIdx];
        const totalAssets = bs.total_assets[yearIdx];
        const currentLiabilities = bs.current_liabilities[yearIdx];
        const totalLiabilities = bs.total_liabilities[yearIdx];
        const equity = bs.shareholders_equity[yearIdx];
        const accountsReceivable = bs.accounts_receivable[yearIdx];

        const sharesOutstanding = data.shares_outstanding; // millions
        const sharePrice = data.market_data.share_price; // VND
        const marketCap = sharePrice * sharesOutstanding / 1000; // Bn VND
        const totalDebt = totalLiabilities;
        const cash = cashEquiv;
        const ev = marketCap + totalDebt - cash;

        return {
            year: yr,
            // Profitability
            roe: safeDiv(netIncome, equity),
            roa: safeDiv(netIncome, totalAssets),
            gross_margin: safeDiv(grossProfit, revenue),
            operating_margin: safeDiv(operatingIncome, revenue),
            net_margin: safeDiv(netIncome, revenue),
            // Liquidity
            current_ratio: safeDiv(currentAssets, currentLiabilities),
            quick_ratio: safeDiv(currentAssets - inventory, currentLiabilities),
            cash_ratio: safeDiv(cashEquiv, currentLiabilities),
            // Leverage
            debt_to_equity: safeDiv(totalLiabilities, equity),
            equity_multiplier: safeDiv(totalAssets, equity),
            // Efficiency
            asset_turnover: safeDiv(revenue, totalAssets),
            inventory_turnover: safeDiv(cogs, inventory),
            receivables_turnover: safeDiv(revenue, accountsReceivable),
            // Valuation (only meaningful for latest year with market price)
            pe_ratio: safeDiv(sharePrice, (is.eps[yearIdx])),
            pb_ratio: safeDiv(marketCap, equity),
            ev_ebitda: safeDiv(ev, ebitda),
            // Raw values for DuPont
            _netIncome: netIncome,
            _revenue: revenue,
            _totalAssets: totalAssets,
            _equity: equity,
        };
    }

    // --- Calculate Ratios for All Years ---
    function calculateAllYears(data) {
        return data.years.map((_, i) => calculateAllRatios(data, i));
    }

    // --- Rating Interpretation ---
    function interpretRatio(name, value) {
        const benchmark = BENCHMARKS[name];
        if (!benchmark) return { rating: 'N/A', color: '#8b949e', message: '' };

        // PE ratio has different logic
        if (name === 'pe_ratio') {
            if (value <= 0) return { rating: 'N/A', color: '#8b949e', message: 'Earnings âm' };
            if (value < benchmark.undervalued) return { rating: 'Undervalued', color: '#3fb950', message: 'Định giá thấp hơn trung bình ngành' };
            if (value < benchmark.fair) return { rating: 'Fair Value', color: '#58a6ff', message: 'Định giá hợp lý' };
            if (value < benchmark.growth) return { rating: 'Growth', color: '#d29922', message: 'Thị trường kỳ vọng tăng trưởng' };
            return { rating: 'Expensive', color: '#f85149', message: 'Định giá cao' };
        }

        // For D/E: lower is better
        if (name === 'debt_to_equity') {
            if (value <= benchmark.excellent) return { rating: 'Excellent', color: '#3fb950', message: 'Cơ cấu vốn rất bảo thủ' };
            if (value <= benchmark.good) return { rating: 'Good', color: '#58a6ff', message: 'Đòn bẩy lành mạnh' };
            if (value <= benchmark.acceptable) return { rating: 'Acceptable', color: '#d29922', message: 'Đòn bẩy trung bình' };
            return { rating: 'Poor', color: '#f85149', message: 'Đòn bẩy cao — rủi ro' };
        }

        // For most ratios: higher is better
        if (value >= benchmark.excellent) return { rating: 'Excellent', color: '#3fb950', message: 'Vượt chuẩn ngành' };
        if (value >= benchmark.good) return { rating: 'Good', color: '#58a6ff', message: 'Trên trung bình' };
        if (value >= benchmark.acceptable) return { rating: 'Acceptable', color: '#d29922', message: 'Đạt chuẩn' };
        return { rating: 'Poor', color: '#f85149', message: 'Dưới chuẩn — cần cải thiện' };
    }

    // --- Health Score (0-100) ---
    function calculateHealthScore(ratios) {
        const scoreMap = { 'Excellent': 100, 'Good': 75, 'Acceptable': 50, 'Poor': 25, 'N/A': 50, 'Undervalued': 90, 'Fair Value': 75, 'Growth': 50, 'Expensive': 25 };

        const weights = {
            profitability: { weight: 0.30, ratios: ['roe', 'gross_margin', 'net_margin'] },
            liquidity: { weight: 0.25, ratios: ['current_ratio', 'quick_ratio', 'cash_ratio'] },
            leverage: { weight: 0.20, ratios: ['debt_to_equity'] },
            efficiency: { weight: 0.15, ratios: ['asset_turnover', 'inventory_turnover'] },
            valuation: { weight: 0.10, ratios: ['pe_ratio', 'ev_ebitda'] },
        };

        let totalScore = 0;
        const categoryScores = {};

        for (const [cat, config] of Object.entries(weights)) {
            let catScore = 0;
            let count = 0;
            for (const r of config.ratios) {
                if (ratios[r] !== undefined) {
                    const interp = interpretRatio(r, ratios[r]);
                    catScore += scoreMap[interp.rating] || 50;
                    count++;
                }
            }
            const avg = count > 0 ? catScore / count : 50;
            categoryScores[cat] = avg;
            totalScore += avg * config.weight;
        }

        return { total: Math.round(totalScore), categories: categoryScores };
    }

    // --- DuPont Analysis ---
    function calculateDuPont(ratios) {
        const netMargin = ratios.net_margin;
        const assetTurnover = ratios.asset_turnover;
        const equityMultiplier = ratios.equity_multiplier;
        const roe = netMargin * assetTurnover * equityMultiplier;

        return {
            net_margin: netMargin,
            asset_turnover: assetTurnover,
            equity_multiplier: equityMultiplier,
            calculated_roe: roe,
            actual_roe: ratios.roe,
        };
    }

    // --- Radar Chart Data (normalized 0-100) ---
    // --- Radar Chart Data (consistent with category scores) ---
    function getRadarData(ratios) {
        const health = calculateHealthScore(ratios);

        return {
            labels: ['Profitability', 'Liquidity', 'Leverage', 'Efficiency', 'Valuation'],
            data: [
                Math.round(health.categories.profitability),
                Math.round(health.categories.liquidity),
                Math.round(health.categories.leverage),
                Math.round(health.categories.efficiency),
                Math.round(health.categories.valuation)
            ]
        };
    }

    // --- AI Interpretation Text Generator ---
    function generateInterpretation(ratios, healthScore) {
        const parts = [];
        const yr = ratios.year;

        // Overall
        let healthLabel = 'yếu';
        if (healthScore.total >= 85) healthLabel = 'xuất sắc';
        else if (healthScore.total >= 70) healthLabel = 'tốt';
        else if (healthScore.total >= 50) healthLabel = 'trung bình';

        parts.push({
            icon: '🏥',
            title: 'Sức khỏe tổng thể',
            text: `BMP đạt điểm sức khỏe tài chính ${healthScore.total}/100, được đánh giá ở mức <strong>${healthLabel}</strong> cho năm ${yr}.`
        });

        // Profitability
        const roeInterp = interpretRatio('roe', ratios.roe);
        parts.push({
            icon: '📈',
            title: 'Khả năng sinh lời',
            text: `ROE đạt ${(ratios.roe * 100).toFixed(1)}% — ${roeInterp.message}. Biên lợi nhuận gộp ${(ratios.gross_margin * 100).toFixed(1)}% cho thấy năng lực kiểm soát chi phí ${ratios.gross_margin >= 0.35 ? 'rất tốt' : ratios.gross_margin >= 0.25 ? 'tốt' : 'cần cải thiện'}.`
        });

        // Liquidity
        const crInterp = interpretRatio('current_ratio', ratios.current_ratio);
        parts.push({
            icon: '💧',
            title: 'Thanh khoản',
            text: `Current Ratio ${ratios.current_ratio.toFixed(2)}x — ${crInterp.message}. ${ratios.cash_ratio > 1 ? 'Lượng tiền mặt dồi dào, có thể tận dụng để đầu tư hoặc chia cổ tức.' : 'Thanh khoản tiền mặt ở mức chấp nhận được.'}`
        });

        // Leverage
        const deInterp = interpretRatio('debt_to_equity', ratios.debt_to_equity);
        parts.push({
            icon: '⚖️',
            title: 'Đòn bẩy tài chính',
            text: `D/E Ratio chỉ ${ratios.debt_to_equity.toFixed(2)}x — ${deInterp.message}. ${ratios.debt_to_equity < 0.3 ? 'BMP hầu như không sử dụng nợ vay, đây là điểm mạnh về an toàn tài chính.' : ''}`
        });

        // Valuation
        parts.push({
            icon: '💰',
            title: 'Định giá',
            text: `P/E ${ratios.pe_ratio.toFixed(1)}x, P/B ${ratios.pb_ratio.toFixed(1)}x, EV/EBITDA ${ratios.ev_ebitda.toFixed(1)}x. ${ratios.pe_ratio < 15 ? 'Cổ phiếu đang được định giá thấp so với trung bình ngành.' : ratios.pe_ratio < 25 ? 'Định giá ở vùng hợp lý.' : 'Định giá ở mức cao, cần cân nhắc rủi ro.'}`
        });

        return parts;
    }

    // --- Format Value ---
    function formatValue(value, format) {
        if (format === 'pct') return (value * 100).toFixed(1) + '%';
        if (format === 'times') return value.toFixed(2) + 'x';
        return value.toFixed(2);
    }

    // --- Public API ---
    return {
        calculateAllRatios,
        calculateAllYears,
        interpretRatio,
        calculateHealthScore,
        calculateDuPont,
        getRadarData,
        generateInterpretation,
        formatValue,
        RATIO_CONFIG,
        BENCHMARKS,
    };
})();
