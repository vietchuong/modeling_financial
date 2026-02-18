// --- Constants & Global State ---
const state = {
    assumptions: { ...FINANCIAL_DATA.assumptions },
    results: {},
    charts: {
        dcf: null,
        mc: null,
        profitTrend: null,
        bsRatios: null,
        radar: null,
    },
    currentTab: 'valuation',
    ratiosAllYears: null,
};

// --- DOM Elements ---
const els = {
    inputs: {
        growth: document.getElementById('growth'),
        margin: document.getElementById('margin'),
        wacc: document.getElementById('wacc'),
        term: document.getElementById('terminal'),
        tax: document.getElementById('tax'),
    },
    displays: {
        growth: document.getElementById('val-growth'),
        margin: document.getElementById('val-margin'),
        wacc: document.getElementById('val-wacc'),
        term: document.getElementById('val-term'),
        tax: document.getElementById('val-tax'),
    },
    results: {
        price: document.getElementById('share-price'),
        upside: document.getElementById('upside'),
        ev: document.getElementById('ev-value'),
        equity: document.getElementById('equity-value'),
        heatmap: document.getElementById('sensitivity-heatmap'),
        table: document.getElementById('forecast-table').querySelector('tbody'),
    },
    charts: {
        dcfCtx: document.getElementById('dcfChart').getContext('2d'),
        mcCtx: document.getElementById('monteCarloChart').getContext('2d'),
    },
    summary: {
        pvFcf: document.getElementById('sum-pv-fcf'),
        pvTv: document.getElementById('sum-pv-tv'),
        ev: document.getElementById('sum-ev'),
        netCash: document.getElementById('sum-net-cash'),
        equity: document.getElementById('sum-equity'),
        shares: document.getElementById('sum-shares'),
        price: document.getElementById('sum-price'),
        mcMean: document.getElementById('sum-mc-mean'),
    }
};

// --- Formatting ---
const fmt = {
    bn: (n) => (n).toLocaleString('en-US', { maximumFractionDigits: 0 }),
    pct: (n) => (n * 100).toFixed(1) + '%',
    curr: (n) => (n).toLocaleString('en-US', { maximumFractionDigits: 0 }),
};

// --- Update Range Slider Track Fill ---
function updateSliderFill(slider) {
    const min = parseFloat(slider.min);
    const max = parseFloat(slider.max);
    const val = parseFloat(slider.value);
    const pct = ((val - min) / (max - min)) * 100;
    slider.style.background = `linear-gradient(90deg, #58a6ff 0%, #58a6ff ${pct}%, #30363d ${pct}%, #30363d 100%)`;
}

// Initialize all sliders
Object.values(els.inputs).forEach(slider => {
    updateSliderFill(slider);
    slider.addEventListener('input', () => updateSliderFill(slider));
});

// --- Animate Value Change ---
function animateValue(element) {
    element.classList.remove('animate-value');
    // Force reflow
    void element.offsetWidth;
    element.classList.add('animate-value');
}

// ============================
// TAB SWITCHING
// ============================
window.switchAnalysisTab = function (tabId) {
    state.currentTab = tabId;

    // Update tab buttons
    document.querySelectorAll('.analysis-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    // Update tab slider
    updateAnalysisTabSlider(tabId);

    // Show/hide panels
    document.querySelectorAll('.tab-panel').forEach(panel => {
        panel.classList.remove('active-panel');
    });
    const target = document.getElementById('tab-' + tabId);
    if (target) {
        target.classList.add('active-panel');
    }

    // Render tab content if needed
    if (tabId === 'analysis' && !state._analysisRendered) {
        renderAnalysisTab();
        state._analysisRendered = true;
    }
    if (tabId === 'health' && !state._healthRendered) {
        renderHealthTab();
        state._healthRendered = true;
    }
};

function updateAnalysisTabSlider(tabId) {
    const tabs = document.querySelectorAll('.analysis-tab');
    const slider = document.getElementById('analysis-tab-slider');
    if (!slider) return;

    tabs.forEach(tab => {
        if (tab.dataset.tab === tabId) {
            slider.style.width = tab.offsetWidth + 'px';
            slider.style.left = tab.offsetLeft + 'px';
        }
    });
}

// ============================
// CORE DCF LOGIC (unchanged)
// ============================
function calculateDCF(inputOverrides = {}) {
    const config = { ...state.assumptions, ...inputOverrides };

    const years = 5;
    const baseRev = FINANCIAL_DATA.historical.revenue[FINANCIAL_DATA.historical.revenue.length - 1];
    const projections = [];

    let prevRev = baseRev;

    for (let i = 1; i <= years; i++) {
        const rev = prevRev * (1 + config.rev_growth);
        const ebitda = rev * config.ebitda_margin;
        const depr = rev * config.capex_pct;
        const ebit = ebitda - depr;
        const tax = ebit * config.tax_rate;
        const nopat = ebit - tax;

        const capex = rev * config.capex_pct;
        const nwc = rev * config.nwc_pct;
        const prevNwc = prevRev * config.nwc_pct;
        const nwcChange = nwc - prevNwc;

        const fcf = nopat + depr - capex - nwcChange;

        projections.push({
            year: 2025 + i,
            rev,
            ebitda,
            fcf
        });

        prevRev = rev;
    }

    // Terminal Value
    const lastFCF = projections[years - 1].fcf;
    let terminalValue = 0;
    if (config.wacc > config.terminal_growth) {
        terminalValue = (lastFCF * (1 + config.terminal_growth)) / (config.wacc - config.terminal_growth);
    }

    // Discounting
    let pvFCF = 0;
    projections.forEach((p, i) => {
        pvFCF += p.fcf / Math.pow(1 + config.wacc, i + 1);
    });

    const pvTerminal = terminalValue / Math.pow(1 + config.wacc, years);
    const enterpriseValue = pvFCF + pvTerminal;

    const cash = FINANCIAL_DATA.historical.cash_equivalents;
    const debt = FINANCIAL_DATA.historical.debt;
    const equityValue = enterpriseValue + cash - debt;
    const sharePrice = equityValue / FINANCIAL_DATA.shares_outstanding;

    return {
        projections,
        pvFCF,
        pvTerminal,
        enterpriseValue,
        equityValue,
        sharePrice
    };
}

// --- Monte Carlo ---
function runMonteCarlo() {
    const iterations = 1000;
    const prices = [];

    const baseGrowth = state.assumptions.rev_growth;
    const baseMargin = state.assumptions.ebitda_margin;
    const baseWacc = state.assumptions.wacc;

    for (let i = 0; i < iterations; i++) {
        const randNorm = () => {
            let u = 0, v = 0;
            while (u === 0) u = Math.random();
            while (v === 0) v = Math.random();
            return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
        }

        const g = baseGrowth + (randNorm() * 0.015);
        const m = baseMargin + (randNorm() * 0.015);
        const w = baseWacc + (randNorm() * 0.005);

        const result = calculateDCF({
            rev_growth: g,
            ebitda_margin: m,
            wacc: w
        });

        if (result.sharePrice > 0) prices.push(result.sharePrice);
    }

    prices.sort((a, b) => a - b);

    const min = prices[0];
    const max = prices[prices.length - 1];
    const bins = 25;
    const binSize = (max - min) / bins;
    const histogram = new Array(bins).fill(0);
    const labels = [];

    for (let i = 0; i < bins; i++) {
        labels.push((min + i * binSize).toFixed(0));
    }

    prices.forEach(p => {
        let bucket = Math.floor((p - min) / binSize);
        if (bucket >= bins) bucket = bins - 1;
        histogram[bucket]++;
    });

    return { labels, data: histogram, mean: prices.reduce((a, b) => a + b, 0) / prices.length, min, max };
}

function renderSensitivity() {
    const waccBase = state.assumptions.wacc;
    const growthBase = state.assumptions.terminal_growth;

    const wSteps = [-0.01, -0.005, 0, 0.005, 0.01];
    const gSteps = [-0.01, -0.005, 0, 0.005, 0.01];

    let html = `<div class="heatmap-cell heatmap-header">WACC \\ g</div>`;

    // Header Row
    gSteps.forEach(g => {
        html += `<div class="heatmap-cell heatmap-header">${((growthBase + g) * 100).toFixed(1)}%</div>`;
    });

    // Rows
    const basePrice = state.results.sharePrice * 1000;

    wSteps.forEach(w => {
        const currentWacc = waccBase + w;
        html += `<div class="heatmap-cell heatmap-header">${(currentWacc * 100).toFixed(1)}%</div>`;

        gSteps.forEach(g => {
            const currentGrowth = growthBase + g;
            const res = calculateDCF({ wacc: currentWacc, terminal_growth: currentGrowth });
            const price = res.sharePrice * 1000;
            const pctDiff = (price - basePrice) / basePrice;

            let heatClass = 'heat-neutral';
            if (pctDiff > 0.08) heatClass = 'heat-strong-up';
            else if (pctDiff > 0.03) heatClass = 'heat-up';
            else if (pctDiff < -0.08) heatClass = 'heat-strong-down';
            else if (pctDiff < -0.03) heatClass = 'heat-down';

            const isBase = (w === 0 && g === 0);
            const baseClass = isBase ? ' heat-base-case' : '';

            html += `<div class="heatmap-cell heatmap-val ${heatClass}${baseClass}">${price.toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>`;
        });
    });

    els.results.heatmap.innerHTML = html;
}

// --- UI Updates ---
function updateCharts(res, mcRes) {
    const labels = res.projections.map(p => p.year);
    const data = res.projections.map(p => p.fcf);

    // DCF Chart
    if (state.charts.dcf) state.charts.dcf.destroy();

    const dcfGradient = els.charts.dcfCtx.createLinearGradient(0, 0, 0, 300);
    dcfGradient.addColorStop(0, 'rgba(88, 166, 255, 0.9)');
    dcfGradient.addColorStop(1, 'rgba(59, 130, 246, 0.4)');

    state.charts.dcf = new Chart(els.charts.dcfCtx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Projected FCF',
                data: data,
                backgroundColor: dcfGradient,
                borderColor: 'rgba(88, 166, 255, 0.8)',
                borderWidth: 1,
                borderRadius: 6,
                borderSkipped: false,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 600, easing: 'easeOutQuart' },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(22, 27, 34, 0.95)',
                    borderColor: '#30363d',
                    borderWidth: 1,
                    titleColor: '#e6edf3',
                    bodyColor: '#8b949e',
                    titleFont: { family: 'Inter', weight: '600' },
                    bodyFont: { family: 'JetBrains Mono' },
                    padding: 12,
                    cornerRadius: 8,
                    displayColors: false,
                    callbacks: {
                        label: (ctx) => `FCF: ${ctx.parsed.y.toLocaleString('en-US', { maximumFractionDigits: 0 })} Bn VND`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(48, 54, 61, 0.5)', drawBorder: false },
                    ticks: { color: '#6e7681', font: { family: 'JetBrains Mono', size: 11 } },
                    border: { display: false }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#8b949e', font: { family: 'Inter', size: 12 } },
                    border: { display: false }
                }
            }
        }
    });

    // Monte Carlo Chart
    if (state.charts.mc) state.charts.mc.destroy();

    const mcGradient = els.charts.mcCtx.createLinearGradient(0, 0, 0, 300);
    mcGradient.addColorStop(0, 'rgba(16, 185, 129, 0.8)');
    mcGradient.addColorStop(1, 'rgba(16, 185, 129, 0.15)');

    state.charts.mc = new Chart(els.charts.mcCtx, {
        type: 'bar',
        data: {
            labels: mcRes.labels,
            datasets: [{
                label: 'Frequency',
                data: mcRes.data,
                backgroundColor: mcGradient,
                borderColor: 'rgba(16, 185, 129, 0.6)',
                borderWidth: 1,
                barPercentage: 1.0,
                categoryPercentage: 1.0,
                borderRadius: 2,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 800, easing: 'easeOutQuart' },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(22, 27, 34, 0.95)',
                    borderColor: '#30363d',
                    borderWidth: 1,
                    titleColor: '#e6edf3',
                    bodyColor: '#8b949e',
                    titleFont: { family: 'Inter', weight: '600' },
                    bodyFont: { family: 'JetBrains Mono' },
                    padding: 12,
                    cornerRadius: 8,
                    displayColors: false,
                    callbacks: {
                        title: (ctx) => `Price Range: ${(parseFloat(ctx[0].label) * 1000).toLocaleString()} VND`,
                        label: (ctx) => `Count: ${ctx.parsed.y} iterations`
                    }
                }
            },
            scales: {
                x: { display: false },
                y: { display: false }
            }
        }
    });

    document.getElementById('mc-min').textContent = (mcRes.min * 1000).toLocaleString('en-US', { maximumFractionDigits: 0 });
    document.getElementById('mc-max').textContent = (mcRes.max * 1000).toLocaleString('en-US', { maximumFractionDigits: 0 });
    document.getElementById('mc-mean').textContent = (mcRes.mean * 1000).toLocaleString('en-US', { maximumFractionDigits: 0 });

    return mcRes;
}

function updateTable(res) {
    let html = '';
    res.projections.forEach((p, i) => {
        const isLast = i === res.projections.length - 1;
        html += `
      <tr style="${isLast ? 'font-weight: 600;' : ''}">
        <td>${p.year}</td>
        <td class="num-cell">${p.rev.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
        <td class="num-cell">${p.ebitda.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
        <td class="num-cell" style="color: var(--accent); font-weight:600">${p.fcf.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
      </tr>
    `;
    });
    els.results.table.innerHTML = html;
}

function updateSummary(res, mcMean) {
    const cash = FINANCIAL_DATA.historical.cash_equivalents;
    const debt = FINANCIAL_DATA.historical.debt;
    const netCash = cash - debt;

    els.summary.pvFcf.textContent = fmt.bn(res.pvFCF) + ' Bn';
    els.summary.pvTv.textContent = fmt.bn(res.pvTerminal) + ' Bn';
    els.summary.ev.textContent = fmt.bn(res.enterpriseValue) + ' Bn';
    els.summary.netCash.textContent = fmt.bn(netCash) + ' Bn';
    els.summary.netCash.style.color = netCash >= 0 ? 'var(--success)' : 'var(--danger)';
    els.summary.equity.textContent = fmt.bn(res.equityValue) + ' Bn';
    els.summary.shares.textContent = (FINANCIAL_DATA.shares_outstanding).toLocaleString('en-US', { maximumFractionDigits: 1 }) + 'M';
    els.summary.price.textContent = (res.sharePrice * 1000).toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' VND';
    els.summary.mcMean.textContent = (mcMean * 1000).toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' VND';
}

function updateAll() {
    // 1. Get Inputs
    state.assumptions.rev_growth = parseFloat(els.inputs.growth.value) / 100;
    state.assumptions.ebitda_margin = parseFloat(els.inputs.margin.value) / 100;
    state.assumptions.wacc = parseFloat(els.inputs.wacc.value) / 100;
    state.assumptions.terminal_growth = parseFloat(els.inputs.term.value) / 100;
    state.assumptions.tax_rate = parseFloat(els.inputs.tax.value) / 100;

    // Update Display Values
    els.displays.growth.textContent = els.inputs.growth.value + '%';
    els.displays.margin.textContent = els.inputs.margin.value + '%';
    els.displays.wacc.textContent = els.inputs.wacc.value + '%';
    els.displays.term.textContent = els.inputs.term.value + '%';
    els.displays.tax.textContent = els.inputs.tax.value + '%';

    // 2. Run DCF
    const result = calculateDCF();
    state.results = result;

    // 3. Update Hero
    const priceVND = result.sharePrice * 1000;
    els.results.price.textContent = priceVND.toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' VND';
    els.results.ev.textContent = result.enterpriseValue.toLocaleString('en-US', { maximumFractionDigits: 0 });
    els.results.equity.textContent = result.equityValue.toLocaleString('en-US', { maximumFractionDigits: 0 });

    animateValue(els.results.price);
    animateValue(els.results.ev);
    animateValue(els.results.equity);

    els.results.upside.textContent = "Estimated Value (Implied)";

    // 4. Run Simulations
    const mcRes = runMonteCarlo();

    // 5. Render
    updateCharts(result, mcRes);
    renderSensitivity();
    updateTable(result);
    updateSummary(result, mcRes.mean);
}

// --- Event Listeners ---
Object.values(els.inputs).forEach(input => {
    input.addEventListener('input', updateAll);
});

// --- Scenarios ---
window.setScenario = (type) => {
    document.querySelectorAll('.scenario-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');

    if (type === 'base') {
        els.inputs.growth.value = 5.0;
        els.inputs.margin.value = 29.0;
        els.inputs.wacc.value = 11.0;
    } else if (type === 'bull') {
        els.inputs.growth.value = 8.0;
        els.inputs.margin.value = 32.0;
        els.inputs.wacc.value = 10.5;
    } else if (type === 'bear') {
        els.inputs.growth.value = 2.0;
        els.inputs.margin.value = 25.0;
        els.inputs.wacc.value = 12.0;
    }

    Object.values(els.inputs).forEach(slider => updateSliderFill(slider));
    updateAll();
};

// --- Mobile Sidebar Toggle ---
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.querySelector('.sidebar-toggle');
if (sidebarToggle) {
    sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
    });
}

// ============================
// TAB 2: FINANCIAL ANALYSIS
// ============================
function renderAnalysisTab() {
    // Calculate ratios for all years
    state.ratiosAllYears = FinancialAnalysis.calculateAllYears(FINANCIAL_DATA);
    const latestRatios = state.ratiosAllYears[state.ratiosAllYears.length - 1];

    // --- Key Ratio Cards ---
    const keyRatios = ['roe', 'roa', 'current_ratio', 'debt_to_equity', 'gross_margin', 'ev_ebitda'];
    const cardsContainer = document.getElementById('ratio-cards');

    cardsContainer.innerHTML = keyRatios.map(key => {
        const config = FinancialAnalysis.RATIO_CONFIG[key];
        const value = latestRatios[key];
        const interp = FinancialAnalysis.interpretRatio(key, value);
        const formatted = FinancialAnalysis.formatValue(value, config.format);

        return `
            <div class="ratio-card">
                <div class="ratio-card-header">
                    <span class="ratio-card-label">${config.label}</span>
                    <span class="rating-badge" style="background: ${interp.color}20; color: ${interp.color};">${interp.rating}</span>
                </div>
                <div class="ratio-card-value">${formatted}</div>
                <div class="ratio-card-desc">${config.vi}</div>
            </div>
        `;
    }).join('');

    // --- Profitability Trend Chart ---
    renderProfitTrendChart();

    // --- Balance Sheet Ratios Chart ---
    renderBSRatiosChart();

    // --- DuPont Analysis ---
    renderDuPont(latestRatios);

    // --- Ratio Detail Table ---
    renderRatioDetailTable();
}

function renderProfitTrendChart() {
    const ctx = document.getElementById('profitTrendChart').getContext('2d');
    if (state.charts.profitTrend) state.charts.profitTrend.destroy();

    const years = FINANCIAL_DATA.years;
    const allRatios = state.ratiosAllYears;

    state.charts.profitTrend = new Chart(ctx, {
        type: 'line',
        data: {
            labels: years,
            datasets: [
                {
                    label: 'Gross Margin',
                    data: allRatios.map(r => (r.gross_margin * 100)),
                    borderColor: '#3fb950',
                    backgroundColor: 'rgba(63, 185, 80, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    borderWidth: 2,
                },
                {
                    label: 'Net Margin',
                    data: allRatios.map(r => (r.net_margin * 100)),
                    borderColor: '#58a6ff',
                    backgroundColor: 'rgba(88, 166, 255, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    borderWidth: 2,
                },
                {
                    label: 'ROE',
                    data: allRatios.map(r => (r.roe * 100)),
                    borderColor: '#d29922',
                    backgroundColor: 'rgba(210, 153, 34, 0.1)',
                    fill: false,
                    tension: 0.4,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    borderWidth: 2,
                    borderDash: [5, 5],
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: { color: '#8b949e', font: { family: 'Inter', size: 11 }, boxWidth: 12, padding: 16 }
                },
                tooltip: {
                    backgroundColor: 'rgba(22, 27, 34, 0.95)',
                    borderColor: '#30363d',
                    borderWidth: 1,
                    titleColor: '#e6edf3',
                    bodyColor: '#8b949e',
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                        label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}%`
                    }
                }
            },
            scales: {
                y: {
                    grid: { color: 'rgba(48, 54, 61, 0.5)', drawBorder: false },
                    ticks: { color: '#6e7681', font: { family: 'JetBrains Mono', size: 11 }, callback: v => v + '%' },
                    border: { display: false }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#8b949e', font: { family: 'Inter', size: 12 } },
                    border: { display: false }
                }
            }
        }
    });
}

function renderBSRatiosChart() {
    const ctx = document.getElementById('bsRatiosChart').getContext('2d');
    if (state.charts.bsRatios) state.charts.bsRatios.destroy();

    const years = FINANCIAL_DATA.years;
    const allRatios = state.ratiosAllYears;

    state.charts.bsRatios = new Chart(ctx, {
        type: 'line',
        data: {
            labels: years,
            datasets: [
                {
                    label: 'Current Ratio',
                    data: allRatios.map(r => r.current_ratio),
                    borderColor: '#58a6ff',
                    tension: 0.4,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    borderWidth: 2,
                },
                {
                    label: 'Quick Ratio',
                    data: allRatios.map(r => r.quick_ratio),
                    borderColor: '#3fb950',
                    tension: 0.4,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    borderWidth: 2,
                },
                {
                    label: 'D/E Ratio',
                    data: allRatios.map(r => r.debt_to_equity),
                    borderColor: '#f85149',
                    tension: 0.4,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    borderWidth: 2,
                    borderDash: [5, 5],
                },
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: { color: '#8b949e', font: { family: 'Inter', size: 11 }, boxWidth: 12, padding: 16 }
                },
                tooltip: {
                    backgroundColor: 'rgba(22, 27, 34, 0.95)',
                    borderColor: '#30363d',
                    borderWidth: 1,
                    titleColor: '#e6edf3',
                    bodyColor: '#8b949e',
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                        label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)}x`
                    }
                }
            },
            scales: {
                y: {
                    grid: { color: 'rgba(48, 54, 61, 0.5)', drawBorder: false },
                    ticks: { color: '#6e7681', font: { family: 'JetBrains Mono', size: 11 }, callback: v => v.toFixed(1) + 'x' },
                    border: { display: false }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#8b949e', font: { family: 'Inter', size: 12 } },
                    border: { display: false }
                }
            }
        }
    });
}

function renderDuPont(ratios) {
    const dp = FinancialAnalysis.calculateDuPont(ratios);
    const container = document.getElementById('dupont-flow');

    container.innerHTML = `
        <div class="dupont-grid">
            <div class="dupont-item dupont-result">
                <div class="dupont-label">ROE</div>
                <div class="dupont-value" style="color: var(--accent);">${(dp.calculated_roe * 100).toFixed(1)}%</div>
            </div>
            <div class="dupont-equals">=</div>
            <div class="dupont-item">
                <div class="dupont-label">Net Margin</div>
                <div class="dupont-value">${(dp.net_margin * 100).toFixed(1)}%</div>
                <div class="dupont-sub">LNST / DT</div>
            </div>
            <div class="dupont-operator">×</div>
            <div class="dupont-item">
                <div class="dupont-label">Asset Turnover</div>
                <div class="dupont-value">${dp.asset_turnover.toFixed(2)}x</div>
                <div class="dupont-sub">DT / Tổng TS</div>
            </div>
            <div class="dupont-operator">×</div>
            <div class="dupont-item">
                <div class="dupont-label">Equity Multiplier</div>
                <div class="dupont-value">${dp.equity_multiplier.toFixed(2)}x</div>
                <div class="dupont-sub">Tổng TS / VCSH</div>
            </div>
        </div>
    `;
}

function renderRatioDetailTable() {
    const tbody = document.querySelector('#ratio-detail-table tbody');
    const allRatios = state.ratiosAllYears;
    const ratioKeys = [
        'roe', 'roa', 'gross_margin', 'operating_margin', 'net_margin',
        'current_ratio', 'quick_ratio', 'cash_ratio',
        'debt_to_equity', 'equity_multiplier',
        'asset_turnover', 'inventory_turnover', 'receivables_turnover',
        'pe_ratio', 'pb_ratio', 'ev_ebitda',
    ];

    let html = '';
    let lastCategory = '';

    ratioKeys.forEach(key => {
        const config = FinancialAnalysis.RATIO_CONFIG[key];
        if (!config) return;

        // Category separator
        if (config.category !== lastCategory) {
            const catLabel = config.category.charAt(0).toUpperCase() + config.category.slice(1);
            html += `<tr class="row-section"><td colspan="7" style="text-align:left; font-weight:700; color: var(--accent); text-transform: uppercase; letter-spacing: 0.05em;">${catLabel}</td></tr>`;
            lastCategory = config.category;
        }

        const latestValue = allRatios[allRatios.length - 1][key];
        const interp = FinancialAnalysis.interpretRatio(key, latestValue);

        html += `<tr>
            <td style="text-align:left">${config.label} <span style="color:var(--text-dim); font-size:0.75rem;">${config.vi}</span></td>
            ${allRatios.map(r => {
            const v = r[key];
            const formatted = FinancialAnalysis.formatValue(v, config.format);
            return `<td class="num-cell">${formatted}</td>`;
        }).join('')}
            <td><span class="rating-badge" style="background: ${interp.color}20; color: ${interp.color};">${interp.rating}</span></td>
        </tr>`;
    });

    tbody.innerHTML = html;
}

// ============================
// TAB 3: HEALTH SCORE
// ============================
function renderHealthTab() {
    if (!state.ratiosAllYears) {
        state.ratiosAllYears = FinancialAnalysis.calculateAllYears(FINANCIAL_DATA);
    }

    const latestRatios = state.ratiosAllYears[state.ratiosAllYears.length - 1];
    const healthScore = FinancialAnalysis.calculateHealthScore(latestRatios);

    // --- Health Score Hero ---
    renderHealthHero(healthScore, latestRatios.year);

    // --- Radar Chart ---
    renderRadarChart(latestRatios);

    // --- Category Scores ---
    renderCategoryScores(healthScore);

    // --- AI Interpretation ---
    renderInterpretation(latestRatios, healthScore);
}

function renderHealthHero(healthScore, year) {
    const container = document.getElementById('health-hero');
    const score = healthScore.total;

    let scoreColor = '#f85149';
    let scoreLabel = 'Yếu';
    if (score >= 85) { scoreColor = '#3fb950'; scoreLabel = 'Xuất sắc'; }
    else if (score >= 70) { scoreColor = '#58a6ff'; scoreLabel = 'Tốt'; }
    else if (score >= 50) { scoreColor = '#d29922'; scoreLabel = 'Trung bình'; }

    const circumference = 2 * Math.PI * 54;
    const dashOffset = circumference - (score / 100) * circumference;

    container.innerHTML = `
        <div class="health-score-card">
            <div class="health-circle-wrap">
                <svg class="health-circle" viewBox="0 0 120 120">
                    <circle class="health-bg" cx="60" cy="60" r="54" />
                    <circle class="health-progress" cx="60" cy="60" r="54"
                        stroke="${scoreColor}"
                        stroke-dasharray="${circumference}"
                        stroke-dashoffset="${dashOffset}" />
                </svg>
                <div class="health-score-text">
                    <span class="health-number" style="color: ${scoreColor};">${score}</span>
                    <span class="health-label">/100</span>
                </div>
            </div>
            <div class="health-meta">
                <div class="health-status" style="color: ${scoreColor};">${scoreLabel}</div>
                <div class="health-year">Financial Health Score — ${year}</div>
                <div class="health-desc">Đánh giá tổng thể dựa trên 5 nhóm chỉ số: Profitability, Liquidity, Leverage, Efficiency, Valuation</div>
            </div>
        </div>
    `;
}

function renderRadarChart(ratios) {
    const ctx = document.getElementById('radarChart').getContext('2d');
    if (state.charts.radar) state.charts.radar.destroy();

    const radarData = FinancialAnalysis.getRadarData(ratios);

    state.charts.radar = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: radarData.labels,
            datasets: [{
                label: 'BMP Score',
                data: radarData.data,
                backgroundColor: 'rgba(88, 166, 255, 0.15)',
                borderColor: '#58a6ff',
                borderWidth: 2,
                pointBackgroundColor: '#58a6ff',
                pointBorderColor: '#161b22',
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 7,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(22, 27, 34, 0.95)',
                    borderColor: '#30363d',
                    borderWidth: 1,
                    titleColor: '#e6edf3',
                    bodyColor: '#8b949e',
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                        label: (ctx) => `Score: ${ctx.parsed.r}/100`
                    }
                }
            },
            scales: {
                r: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        stepSize: 25,
                        color: '#6e7681',
                        backdropColor: 'transparent',
                        font: { family: 'JetBrains Mono', size: 10 }
                    },
                    grid: { color: 'rgba(48, 54, 61, 0.5)' },
                    angleLines: { color: 'rgba(48, 54, 61, 0.5)' },
                    pointLabels: {
                        color: '#8b949e',
                        font: { family: 'Inter', size: 12, weight: '600' }
                    }
                }
            }
        }
    });
}

function renderCategoryScores(healthScore) {
    const container = document.getElementById('category-scores');
    const categories = [
        { key: 'profitability', label: 'Profitability', icon: '📈', color: '#3fb950' },
        { key: 'liquidity', label: 'Liquidity', icon: '💧', color: '#58a6ff' },
        { key: 'leverage', label: 'Leverage', icon: '⚖️', color: '#d29922' },
        { key: 'efficiency', label: 'Efficiency', icon: '⚡', color: '#a371f7' },
        { key: 'valuation', label: 'Valuation', icon: '💰', color: '#f0883e' },
    ];

    container.innerHTML = categories.map(cat => {
        const score = Math.round(healthScore.categories[cat.key] || 0);
        return `
            <div class="cat-score-item">
                <div class="cat-score-header">
                    <span>${cat.icon} ${cat.label}</span>
                    <span class="cat-score-val" style="color: ${cat.color};">${score}/100</span>
                </div>
                <div class="cat-score-bar">
                    <div class="cat-score-fill" style="width: ${score}%; background: ${cat.color};"></div>
                </div>
            </div>
        `;
    }).join('');
}

function renderInterpretation(ratios, healthScore) {
    const container = document.getElementById('interpretation-content');
    const parts = FinancialAnalysis.generateInterpretation(ratios, healthScore);

    container.innerHTML = parts.map(part => `
        <div class="interp-block">
            <div class="interp-header">
                <span class="interp-icon">${part.icon}</span>
                <span class="interp-title">${part.title}</span>
            </div>
            <p class="interp-text">${part.text}</p>
        </div>
    `).join('');
}

// ============================
// INIT
// ============================
updateAll();

// Initialize analysis tab slider
requestAnimationFrame(() => {
    updateAnalysisTabSlider('valuation');
});

window.addEventListener('resize', () => {
    updateAnalysisTabSlider(state.currentTab);
});
