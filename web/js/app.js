// --- Constants & Global State ---
const state = {
    assumptions: { ...FINANCIAL_DATA.assumptions },
    results: {},
    charts: {
        dcf: null,
        mc: null
    }
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

// --- Core DCF Logic ---
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

// --- Simulations ---

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

            // Determine heat class
            let heatClass = 'heat-neutral';
            if (pctDiff > 0.08) heatClass = 'heat-strong-up';
            else if (pctDiff > 0.03) heatClass = 'heat-up';
            else if (pctDiff < -0.08) heatClass = 'heat-strong-down';
            else if (pctDiff < -0.03) heatClass = 'heat-down';

            // Mark base case (both offsets are 0)
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

    // DCF Chart with gradient
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
            animation: {
                duration: 600,
                easing: 'easeOutQuart'
            },
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

    // Monte Carlo Chart with gradient + mean line
    if (state.charts.mc) state.charts.mc.destroy();

    const mcGradient = els.charts.mcCtx.createLinearGradient(0, 0, 0, 300);
    mcGradient.addColorStop(0, 'rgba(16, 185, 129, 0.8)');
    mcGradient.addColorStop(1, 'rgba(16, 185, 129, 0.15)');

    // Find mean bucket index for annotation
    const meanLabel = (mcRes.mean * 1000).toFixed(0);

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
            animation: {
                duration: 800,
                easing: 'easeOutQuart'
            },
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

    // Update Monte Carlo stats with colors
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

    // 3. Update Hero with animation
    const priceVND = result.sharePrice * 1000;
    els.results.price.textContent = priceVND.toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' VND';
    els.results.ev.textContent = result.enterpriseValue.toLocaleString('en-US', { maximumFractionDigits: 0 });
    els.results.equity.textContent = result.equityValue.toLocaleString('en-US', { maximumFractionDigits: 0 });

    // Animate hero values
    animateValue(els.results.price);
    animateValue(els.results.ev);
    animateValue(els.results.equity);

    els.results.upside.textContent = "Estimated Value (Implied)";

    // 4. Run Simulations
    const mcRes = runMonteCarlo();

    // 5. Render
    const mcData = updateCharts(result, mcRes);
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
    // Reset buttons
    document.querySelectorAll('.scenario-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');

    // Set Inputs
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

    // Update all slider fills
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

// --- Init ---
updateAll();
