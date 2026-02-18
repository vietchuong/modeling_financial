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
    }
};

// --- Formatting ---
const fmt = {
    bnb: (n) => (n).toLocaleString('en-US', { maximumFractionDigits: 0 }),
    pct: (n) => (n * 100).toFixed(1) + '%',
    curr: (n) => (n).toLocaleString('en-US', { style: 'currency', currency: 'VND' }),
};

// --- Core DCF Logic ---
function calculateDCF(inputOverrides = {}) {
    // Merge defaults with overrides
    const config = { ...state.assumptions, ...inputOverrides };

    const years = 5;
    const baseRev = FINANCIAL_DATA.historical.revenue[FINANCIAL_DATA.historical.revenue.length - 1]; // 2025 rev
    const projections = [];

    let prevRev = baseRev;

    // Project Cash Flows
    for (let i = 1; i <= years; i++) {
        const rev = prevRev * (1 + config.rev_growth);
        const ebitda = rev * config.ebitda_margin;
        const depr = rev * config.capex_pct; // Assume Depr = Capex % for simplicity or user separate assumption
        const ebit = ebitda - depr;
        const tax = ebit * config.tax_rate;
        const nopat = ebit - tax;

        // Capex & NWC
        const capex = rev * config.capex_pct;
        // NWC Change calculation simplified: Assume NWC is % of Revenue, calculate delta
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
    // Gordon Growth
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

    // Equity Value
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
        // Random Normal Distribution (approx)
        const randNorm = () => {
            let u = 0, v = 0;
            while (u === 0) u = Math.random();
            while (v === 0) v = Math.random();
            return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
        }

        // Perturb inputs: 
        // Growth: +/- 2% std dev
        // Margin: +/- 2% std dev
        // WACC: +/- 1% std dev

        const g = baseGrowth + (randNorm() * 0.015);
        const m = baseMargin + (randNorm() * 0.015);
        const w = baseWacc + (randNorm() * 0.005);

        const result = calculateDCF({
            rev_growth: g,
            ebitda_margin: m,
            wacc: w
        });

        if (result.sharePrice > 0) prices.push(result.sharePrice); // Filter out failed calcs
    }

    // Create Histogram Bins
    prices.sort((a, b) => a - b);

    const min = prices[0];
    const max = prices[prices.length - 1];
    const bins = 20;
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

    const wSteps = [-0.01, -0.005, 0, 0.005, 0.01]; // Rows
    const gSteps = [-0.01, -0.005, 0, 0.005, 0.01]; // Cols

    let html = `<div class="heatmap-cell heatmap-header">WACC \\ g</div>`;

    // Header Row
    gSteps.forEach(g => {
        html += `<div class="heatmap-cell heatmap-header">${((growthBase + g) * 100).toFixed(1)}%</div>`;
    });

    // Rows
    wSteps.forEach(w => {
        const currentWacc = waccBase + w;
        html += `<div class="heatmap-cell heatmap-header">${(currentWacc * 100).toFixed(1)}%</div>`;

        gSteps.forEach(g => {
            const currentGrowth = growthBase + g;
            const res = calculateDCF({ wacc: currentWacc, terminal_growth: currentGrowth });
            // Color coding
            const price = res.sharePrice * 1000; // to VND
            // Simple coloring based on base price
            const basePrice = state.results.sharePrice * 1000;
            const pctDiff = (price - basePrice) / basePrice;

            let color = 'var(--text-main)';
            if (pctDiff > 0.05) color = '#10b981';
            if (pctDiff < -0.05) color = '#ef4444';

            html += `<div class="heatmap-cell heatmap-val" style="color:${color}">${price.toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>`;
        });
    });

    els.results.heatmap.innerHTML = html;
}

// --- UI Updates ---

function updateCharts(res, mcRes) {
    // DCF Chart
    const labels = res.projections.map(p => p.year);
    const data = res.projections.map(p => p.fcf);

    // Add terminal value visualization? Maybe messy. Stick to FCF.

    if (state.charts.dcf) state.charts.dcf.destroy();
    state.charts.dcf = new Chart(els.charts.dcfCtx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Projected Free Cash Flow (FCF)',
                data: data,
                backgroundColor: '#3b82f6',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: '#334155' }, ticks: { color: '#94a3b8' } },
                x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
            }
        }
    });

    // Monte Carlo Chart
    if (state.charts.mc) state.charts.mc.destroy();
    state.charts.mc = new Chart(els.charts.mcCtx, {
        type: 'bar', // Histogram
        data: {
            labels: mcRes.labels,
            datasets: [{
                label: 'Frequency',
                data: mcRes.data,
                backgroundColor: 'rgba(16, 185, 129, 0.6)',
                borderColor: '#10b981',
                borderWidth: 1,
                barPercentage: 1.0,
                categoryPercentage: 1.0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { display: false }, // Hide raw buckets
                y: { display: false }
            }
        }
    });

    // Update Monte Carlo Text
    document.getElementById('mc-min').textContent = (mcRes.min * 1000).toLocaleString('en-US', { maximumFractionDigits: 0 });
    document.getElementById('mc-max').textContent = (mcRes.max * 1000).toLocaleString('en-US', { maximumFractionDigits: 0 });
    document.getElementById('mc-mean').textContent = (mcRes.mean * 1000).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function updateTable(res) {
    let html = '';
    res.projections.forEach(p => {
        html += `
      <tr>
        <td>${p.year}</td>
        <td class="num-cell">${p.rev.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
        <td class="num-cell">${p.ebitda.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
        <td class="num-cell" style="color:#3b82f6; font-weight:600">${p.fcf.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
      </tr>
    `;
    });
    els.results.table.innerHTML = html;
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
    state.results = result; // Store global for other funcs

    // 3. Update Hero
    const priceVND = result.sharePrice * 1000;
    els.results.price.textContent = priceVND.toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' VND';
    els.results.ev.textContent = result.enterpriseValue.toLocaleString('en-US', { maximumFractionDigits: 0 });
    els.results.equity.textContent = result.equityValue.toLocaleString('en-US', { maximumFractionDigits: 0 });

    // Upside/Downside? Assume current price is roughly recent trading (lets say 115k for BMP context example, or just show change from base)
    // Let's just show "Estimated Value" for now, or compare to a fixed reference if known.
    // Actually, let's compare to book value or just leave blank
    els.results.upside.textContent = "Estimated Value (Implied)";

    // 4. Run Simulations
    const mcRes = runMonteCarlo();

    // 5. Render
    updateCharts(result, mcRes);
    renderSensitivity();
    updateTable(result);
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
    updateAll();
};

// --- Init ---
updateAll();
