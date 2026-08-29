/**
 * Professional Masaniello Calculator for Binary Options
 * Logic: Strict Masaniello (Stake based on bridging gap to Target Capital)
 */

// --- STATE VARIABLES ---
let config = {
    capital: 100,
    payout: 82,      // Percentage
    odds: 1.82,      // Decimal (1 + payout/100)
    totalTrades: 10,
    targetWins: 6
};

let state = {
    currentBalance: 0,
    tradesTaken: 0,
    winsAchieved: 0,
    history: [],
    targetCapital: 0,
    active: false
};

// --- MATH FUNCTIONS ---

// Factorial
function factorial(n) {
    if (n < 0) return 0;
    if (n === 0 || n === 1) return 1;
    let res = 1;
    for (let i = 2; i <= n; i++) res *= i;
    return res;
}

// Combinations (nCr)
function nCr(n, r) {
    if (r < 0 || r > n) return 0;
    if (r === 0 || r === n) return 1;
    if (r > n / 2) r = n - r;
    let res = 1;
    for (let i = 1; i <= r; i++) res = res * (n - i + 1) / i;
    return res;
}

// Binomial Probability Mass Function
function binomialPMF(k, n, p) {
    return nCr(n, k) * Math.pow(p, k) * Math.pow(1 - p, n - k);
}

// Probability of at least K wins in N events
function probAtLeast(k, n, p) {
    let totalProb = 0;
    for (let i = k; i <= n; i++) {
        totalProb += binomialPMF(i, n, p);
    }
    return totalProb;
}

// --- CORE FUNCTIONS ---

function startStrategy() {
    // 1. Get Inputs
    const cap = parseFloat(document.getElementById('initialCapital').value);
    const pay = parseFloat(document.getElementById('payoutPercent').value);
    const tot = parseInt(document.getElementById('totalTrades').value);
    const tar = parseInt(document.getElementById('targetWins').value);

    // 2. Validation
    const errorEl = document.getElementById('configError');
    if (isNaN(cap) || cap <= 0 || isNaN(pay) || pay <= 0 || isNaN(tot) || tot <= 0 || isNaN(tar) || tar < 0) {
        errorEl.textContent = "Please enter valid positive numbers.";
        return;
    }
    if (tar > tot) {
        errorEl.textContent = "Target wins cannot be higher than total trades.";
        return;
    }

    // 3. Set Config
    config.capital = cap;
    config.payout = pay;
    config.odds = 1 + (pay / 100);
    config.totalTrades = tot;
    config.targetWins = tar;

    // 4. Initialize State
    state.currentBalance = cap;
    state.tradesTaken = 0;
    state.winsAchieved = 0;
    state.history = [];
    state.active = true;

    // 5. Calculate Global Target Capital (Strict Masaniello)
    const p = 1 / config.odds; // Implied probability
    const probSuccess = probAtLeast(config.targetWins, config.totalTrades, p);

    if (probSuccess === 0) {
        errorEl.textContent = "Target impossible (Probability 0%). Adjust inputs.";
        return;
    }

    state.targetCapital = config.capital / probSuccess;

    // 6. Switch UI
    errorEl.textContent = "";
    document.getElementById('configSection').classList.add('hidden');
    document.getElementById('dashboardSection').classList.remove('hidden');

    updateUI();
}

function calculateNextStake() {
    const remainingTrades = config.totalTrades - state.tradesTaken;
    const winsNeeded = config.targetWins - state.winsAchieved;

    // Stop conditions
    if (remainingTrades === 0 || winsNeeded <= 0) {
        return 0;
    }
    
    // If wins needed > remaining trades, strategy failed (but we can calculate what "would" be needed, usually huge)
    // In practice, we return 0 or remaining balance if logic breaks, but strict math:
    if (winsNeeded > remainingTrades) {
        return 0; // Strategy Failed
    }

    // Masaniello Formula for Next Stake:
    // Stake = (TargetCapital / Odds) * P(Getting exactly winsNeeded-1 in remainingTrades-1)
    
    const p = 1 / config.odds;
    const probPivot = binomialPMF(winsNeeded - 1, remainingTrades - 1, p);
    
    let stake = (state.targetCapital / config.odds) * probPivot;

    // Safety checks
    if (stake > state.currentBalance) stake = state.currentBalance; // Cannot bet more than you have
    if (stake < 0) stake = 0;

    return stake;
}

function recordTrade(isWin) {
    if (!state.active) return;

    const stake = calculateNextStake();
    if (stake <= 0) return; // Strategy finished

    // Calculate Outcome
    let profitLoss = 0;
    if (isWin) {
        profitLoss = stake * (config.payout / 100);
        state.winsAchieved++;
    } else {
        profitLoss = -stake;
    }

    // Update Balance
    state.currentBalance += profitLoss;
    state.tradesTaken++;

    // Add to History
    state.history.push({
        id: state.tradesTaken,
        result: isWin ? "WIN" : "LOSS",
        stake: stake,
        pl: profitLoss,
        balance: state.currentBalance
    });

    updateUI();
    checkCompletion();
}

function checkCompletion() {
    const remainingTrades = config.totalTrades - state.tradesTaken;
    const winsNeeded = config.targetWins - state.winsAchieved;

    let message = "";
    let finished = false;

    if (winsNeeded <= 0) {
        message = "🎉 TARGET ACHIEVED! Strategy Completed Successfully.";
        finished = true;
    } else if (winsNeeded > remainingTrades) {
        message = "⚠️ STOP LOSS HIT. Not enough trades left to reach target.";
        finished = true;
    } else if (remainingTrades === 0) {
        message = "Strategy Ended.";
        finished = true;
    }

    if (finished) {
        state.active = false;
        document.querySelector('.trade-amount').innerHTML = `<span style="font-size:20px; color:#555">${message}</span>`;
        // Disable buttons
        document.querySelectorAll('.action-buttons button').forEach(b => b.disabled = true);
    }
}

function updateUI() {
    // 1. Status Bar
    document.getElementById('displayBalance').textContent = `$${state.currentBalance.toFixed(2)}`;
    document.getElementById('displayProgress').textContent = `${state.tradesTaken} / ${config.totalTrades}`;
    document.getElementById('displayWinsNeeded').textContent = `${Math.max(0, config.targetWins - state.winsAchieved)}`;
    document.getElementById('displayPayout').textContent = `${config.payout}%`;
    document.getElementById('targetCapitalDisplay').textContent = `$${state.targetCapital.toFixed(2)}`;

    // 2. Next Stake
    if (state.active) {
        const nextStake = calculateNextStake();
        document.getElementById('nextStakeDisplay').textContent = `$${nextStake.toFixed(2)}`;
    }

    // 3. History Table
    const tbody = document.querySelector('#historyTable tbody');
    tbody.innerHTML = ""; // Clear existing
    
    // Render in reverse order (newest top) or normal (newest bottom)? Normal is better for progression.
    state.history.forEach(trade => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${trade.id}</td>
            <td class="${trade.result === 'WIN' ? 'result-win' : 'result-loss'}">${trade.result}</td>
            <td>$${trade.stake.toFixed(2)}</td>
            <td style="color:${trade.pl >= 0 ? 'green' : 'red'}">${trade.pl >= 0 ? '+' : ''}${trade.pl.toFixed(2)}</td>
            <td><strong>$${trade.balance.toFixed(2)}</strong></td>
        `;
        tbody.prepend(tr); // Newest on top
    });
}

function resetCalculator() {
    if(confirm("Are you sure you want to reset the strategy?")) {
        location.reload();
    }
}
