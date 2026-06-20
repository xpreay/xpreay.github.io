(() => {
  "use strict";

  const byId = (id) => document.getElementById(id);
  const STAT_SIMULATIONS = 5000;
  const controls = {
    capital: byId("initialCapital"), winRate: byId("winRate"), rr: byId("rr"), risk: byId("risk"), fixedRiskAmount: byId("fixedRiskAmount"),
    trades: byId("trades"), paths: byId("paths"), cost: byId("transactionCost"), sizing: byId("sizing"),
    throttleAfter: byId("throttleAfter"), throttleReduction: byId("throttleReduction"),
    restoreAfterWin: byId("restoreAfterWin"), profitTarget: byId("profitTarget"),
    maxDrawdown: byId("maxDrawdown"), dailyDrawdown: byId("dailyDrawdown"),
    drawdownType: byId("drawdownType"), tradesPerDay: byId("tradesPerDay"), maxDays: byId("maxDays"),
    timePolicy: byId("timePolicy"), tradingDaysOnly: byId("tradingDaysOnly")
  };
  const rangeUnits = {
    winRate: "%", rr: "R", risk: "%", trades: "", paths: "", transactionCost: "R",
    throttleAfter: "", throttleReduction: "%", profitTarget: "%", maxDrawdown: "%",
    dailyDrawdown: "%", tradesPerDay: "", maxDays: "dni"
  };

  function enhanceRangeInputs() {
    document.querySelectorAll('input[type="range"]').forEach((range) => {
      const editor = document.createElement("span");
      const shell = document.createElement("span");
      const number = document.createElement("input");
      const unit = document.createElement("span");
      const label = range.closest(".control-group")?.querySelector(".control-head > span:first-child")?.textContent || "Wartość";
      editor.className = "range-editor";
      shell.className = "number-shell";
      number.type = "number";
      number.min = range.min;
      number.max = range.max;
      number.step = range.step;
      number.value = range.value;
      number.setAttribute("aria-label", `${label} - wpisz wartość`);
      unit.textContent = rangeUnits[range.id] || "";
      range.parentNode.insertBefore(editor, range);
      editor.append(range, shell);
      shell.append(number, unit);
      range.closest(".control-group")?.classList.add("has-range-editor");
      range.manualInput = number;
      range.addEventListener("input", () => { number.value = range.value; });
      number.addEventListener("input", () => {
        const value = Number(number.value);
        if (number.value !== "" && Number.isFinite(value) && value >= Number(range.min) && value <= Number(range.max)) range.value = value;
      });
      number.addEventListener("change", () => {
        const fallback = Number(range.value);
        const raw = Number.isFinite(Number(number.value)) ? Number(number.value) : fallback;
        const clamped = Math.min(Number(range.max), Math.max(Number(range.min), raw));
        range.value = clamped;
        number.value = range.value;
        range.dispatchEvent(new Event("input", { bubbles: true }));
      });
    });
  }

  enhanceRangeInputs();

  const propControlKeys = new Set(["capital", "profitTarget", "maxDrawdown", "dailyDrawdown", "drawdownType", "timePolicy"]);
  const propPresets = {
    oneStep: { profitTarget: 10, maxDrawdown: 10, dailyDrawdown: 3, drawdownType: "static", timePolicy: "trades" },
    twoStep: { profitTarget: 10, maxDrawdown: 10, dailyDrawdown: 5, drawdownType: "static", timePolicy: "trades" },
    futures50Trailing: { capital: 50000, profitTarget: 6, maxDrawdown: 4, dailyDrawdown: 0, drawdownType: "trailing", timePolicy: "trades" }
  };
  const propPresetDescriptions = {
    custom: "Wybierz model lub ustaw parametry ręcznie poniżej.",
    oneStep: "Popularny model 1-Step: target 10%, daily loss 3%, max loss 10%.",
    twoStep: "Popularny model 2-Step, etap 1: target 10%, daily loss 5%, max loss 10%.",
    futures50Trailing: "Typowy model Futures 50K: target 3 000 USD i trailing drawdown 2 000 USD. Model nie dodaje dziennego limitu straty."
  };
  const riskMessages = [
    [.5, "Konserwatywne ryzyko. Więcej przestrzeni na wariancję i serie strat."],
    [1, "Umiarkowane ryzyko. Wariancja nadal może tworzyć głębokie obsunięcia."],
    [2, "Agresywne ryzyko. Pojedyncza zła sekwencja zaczyna decydować o wyniku."],
    [5, "Bardzo wysokie ryzyko. Kilka strat może poważnie uszkodzić konto."],
    [10, "Ryzyko ruiny jest dominującą częścią modelu."]
  ];

  let accountMode = "own";
  let activePropPreset = "custom";
  let pathsData = [];
  let statsData = [];
  let medianPath = [];
  let selectedPath = 0;
  let sceneLow = 0;
  let sceneHigh = 0;
  let clickableLines = [];
  const viewState = { mode: "3d", showAlternatives: true, showMedian: true, showSelected: true, showBreakEvenLine: true, showDrawdown: true };

  function seededRandom(seed) {
    let value = seed >>> 0;
    return () => {
      value = (value + 0x6d2b79f5) >>> 0;
      let mixed = value;
      mixed = Math.imul(mixed ^ mixed >>> 15, mixed | 1);
      mixed ^= mixed + Math.imul(mixed ^ mixed >>> 7, mixed | 61);
      return ((mixed ^ mixed >>> 14) >>> 0) / 4294967296;
    };
  }
  function params() {
    return {
      mode: accountMode,
      initial: Math.max(100, Number(controls.capital.value) || 10000),
      wr: Number(controls.winRate.value) / 100,
      rr: Number(controls.rr.value),
      risk: Number(controls.risk.value) / 100,
      fixedRiskAmount: Math.max(1, Number(controls.fixedRiskAmount.value) || 1),
      trades: Number(controls.trades.value),
      paths: Number(controls.paths.value),
      costR: Number(controls.cost.value),
      sizing: controls.sizing.value,
      throttleAfter: Number(controls.throttleAfter.value),
      throttleScale: 1 - Number(controls.throttleReduction.value) / 100,
      restoreAfterWin: controls.restoreAfterWin.checked,
      target: Number(controls.profitTarget.value) / 100,
      maxDdLimit: Number(controls.maxDrawdown.value) / 100,
      dailyDdLimit: Number(controls.dailyDrawdown.value) / 100,
      ddType: controls.drawdownType.value,
      tradesPerDay: Number(controls.tradesPerDay.value),
      maxDays: Number(controls.maxDays.value),
      timePolicy: controls.timePolicy.value,
      tradingDaysOnly: controls.timePolicy.value === "trades" ? true : controls.tradingDaysOnly.checked
    };
  }
  function riskFraction(p, equity, lossStreak) {
    if (p.sizing === "amount") return p.fixedRiskAmount / Math.max(equity, 1);
    if (p.sizing === "throttle" && lossStreak >= p.throttleAfter) return p.risk * p.throttleScale;
    return p.risk;
  }
  function simulatePath(p, seed, includeCurve) {
    const random = seededRandom(seed);
    const maxTrades = p.mode === "prop" && p.timePolicy !== "trades" ? simulationDays(p) * p.tradesPerDay : p.trades;
    let equity = p.initial;
    let peak = p.initial;
    let highEod = p.initial;
    let maxDd = 0;
    let longestLoss = 0;
    let lossStreak = 0;
    let totalCost = 0;
    let result = p.mode === "prop" ? "active" : "complete";
    let resultDay = null;
    let resultTrade = null;
    let executedTrades = 0;
    let dayStart = p.initial;
    const curve = includeCurve ? [equity] : null;

    for (let i = 0; i < maxTrades; i++) {
      executedTrades = i + 1;
      const day = Math.floor(i / p.tradesPerDay) + 1;
      if (p.mode === "prop" && i % p.tradesPerDay === 0) dayStart = equity;
      const win = random() < p.wr;
      const outcome = win ? p.rr : -1;
      const fraction = riskFraction(p, equity, lossStreak);
      const riskAmount = equity * fraction;
      const transactionCost = riskAmount * p.costR;
      totalCost += transactionCost;
      equity = Math.max(0, equity + outcome * riskAmount - transactionCost);
      peak = Math.max(peak, equity);
      maxDd = Math.max(maxDd, 1 - equity / Math.max(peak, 1));
      lossStreak = win ? (p.restoreAfterWin ? 0 : lossStreak) : lossStreak + 1;
      longestLoss = Math.max(longestLoss, lossStreak);
      if (includeCurve) curve.push(equity);

      if (p.mode !== "prop" && equity <= 0) {
        result = "ruin";
        resultTrade = i + 1;
        break;
      }

      if (p.mode === "prop") {
        const dailyFloor = dayStart * (1 - p.dailyDdLimit);
        const trailingDistance = p.initial * p.maxDdLimit;
        const maxFloor = p.ddType === "trailing" ? Math.min(p.initial, highEod - trailingDistance) : p.initial - trailingDistance;
        if (p.dailyDdLimit > 0 && equity <= dailyFloor) { result = "failDaily"; resultDay = day; break; }
        if (equity <= maxFloor) { result = "failMax"; resultDay = day; break; }
        if (equity >= p.initial * (1 + p.target)) { result = "pass"; resultDay = day; break; }
        if (i % p.tradesPerDay === p.tradesPerDay - 1) highEod = Math.max(highEod, equity);
      }
    }
    const renewalReached = p.mode === "prop" && p.timePolicy === "rebill" && result === "active";
    if (p.mode === "prop" && p.timePolicy === "fail" && result === "active") {
      result = "failTime";
      resultDay = simulationDays(p);
    }
    return {
      curve: curve || [], final: equity, maxDd, longestLoss, totalCost, executedTrades, result, resultDay, resultTrade, renewalReached,
      touched10: maxDd >= .1, touched20: maxDd >= .2, touched30: maxDd >= .3
    };
  }
  function percentile(values, q) {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * q)));
    return sorted[index];
  }
  function money(value) {
    return new Intl.NumberFormat("pl-PL", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
  }
  function percent(value) {
    if (value > 0 && value < .001) return "<0.1%";
    return `${(value * 100).toFixed(value < .1 ? 1 : 0)}%`;
  }
  function tradeCountLabel(value) {
    return value === 1 ? "1 transakcja" : `${value} transakcji`;
  }
  function tradingDaysInPeriod(calendarDays) {
    const fullWeeks = Math.floor(calendarDays / 7);
    return fullWeeks * 5 + Math.min(calendarDays % 7, 5);
  }
  function calendarDayForTradingDay(tradingDay) {
    return tradingDay + Math.floor((tradingDay - 1) / 5) * 2;
  }
  function simulationDays(p) {
    return p.tradingDaysOnly ? tradingDaysInPeriod(p.maxDays) : p.maxDays;
  }
  function simulationDayLabel(days, p, includeCalendar = true) {
    const roundedDays = Math.max(1, Math.round(days));
    if (!p.tradingDaysOnly) return `${roundedDays} dni kalendarzowych`;
    const calendar = calendarDayForTradingDay(roundedDays);
    return includeCalendar ? `${calendar} dni kalendarzowych (${roundedDays} handlowych)` : `${roundedDays} dni handlowych`;
  }
  function simulationDayMetric(days, p) {
    const roundedDays = Math.max(1, Math.round(days));
    if (!p.tradingDaysOnly) return { value: `${roundedDays} dni`, detail: "mediana · dni kalendarzowe" };
    return {
      value: `${roundedDays} dni handlowych`,
      detail: `${calendarDayForTradingDay(roundedDays)} dni kalendarzowych · mediana`
    };
  }
  function simulate() {
    const p = params();
    pathsData = Array.from({ length: p.paths }, (_, i) => simulatePath(p, 1937 + i * 97 + p.trades, true));
    statsData = Array.from({ length: STAT_SIMULATIONS }, (_, i) => simulatePath(p, 910001 + i * 131 + p.trades, false));
    const maxCurveLength = Math.max(...pathsData.map((d) => d.curve.length));
    medianPath = Array.from({ length: maxCurveLength }, (_, i) => {
      const values = pathsData.map((d) => d.curve[Math.min(i, d.curve.length - 1)]);
      return percentile(values, .5);
    });
    const medianFinal = percentile(pathsData.map((d) => d.final), .5);
    selectedPath = pathsData.map((d, i) => [Math.abs(d.final - medianFinal), i]).sort((a, b) => a[0] - b[0])[0][1];
    const sceneOutcomeSummary = byId("sceneOutcomeSummary");
    sceneOutcomeSummary.hidden = p.mode !== "prop";
    if (p.mode === "prop") {
      const visiblePass = pathsData.filter((path) => path.result === "pass").length;
      const visibleFail = pathsData.filter((path) => path.result === "failDaily" || path.result === "failMax" || path.result === "failTime").length;
      const visibleActive = pathsData.length - visiblePass - visibleFail;
      const terminalDays = pathsData.filter((path) => path.result !== "active").map((path) => path.resultDay);
      const typicalEnd = terminalDays.length ? percentile(terminalDays, .5) : null;
      sceneOutcomeSummary.textContent = `Widoczne ścieżki: ${visiblePass} PASS · ${visibleFail} FAIL${visibleActive ? ` · ${visibleActive} ACTIVE` : ""}${typicalEnd ? ` · typowy koniec: ${simulationDayLabel(typicalEnd, p)}` : ""}`;
    }
    updateMetrics(p);
    drawScene(p);
    updateSelectedPath(p);
  }

  function updateMetrics(p) {
    const grossExpectancy = p.wr * p.rr - (1 - p.wr);
    const netExpectancy = grossExpectancy - p.costR;
    const finals = statsData.map((d) => d.final);
    const drawdowns = statsData.map((d) => d.maxDd);
    const streaks = statsData.map((d) => d.longestLoss);
    const medianCosts = percentile(statsData.map((d) => d.totalCost), .5);
    byId("expectancyMetric").textContent = `${netExpectancy >= 0 ? "+" : ""}${netExpectancy.toFixed(2)}R`;
    byId("expectancyMetric").style.color = netExpectancy >= 0 ? "#31d1a0" : "#f05a54";
    byId("expectancyBreakdown").textContent = `brutto ${grossExpectancy >= 0 ? "+" : ""}${grossExpectancy.toFixed(2)}R · koszt ${p.costR.toFixed(2)}R · mediana ${money(medianCosts)}`;
    byId("propExpectancyMetric").textContent = `${netExpectancy >= 0 ? "+" : ""}${netExpectancy.toFixed(2)}R`;
    byId("propExpectancyMetric").style.color = netExpectancy >= 0 ? "#31d1a0" : "#f05a54";
    byId("propExpectancyBreakdown").textContent = `brutto ${grossExpectancy >= 0 ? "+" : ""}${grossExpectancy.toFixed(2)}R · koszt ${p.costR.toFixed(2)}R na trade`;
    byId("propCostMetric").textContent = money(medianCosts);
    byId("medianMetric").textContent = money(percentile(finals, .5));
    byId("drawdownMetric").textContent = `${(percentile(drawdowns, .5) * 100).toFixed(1)}%`;
    byId("profitMetric").textContent = percent(statsData.filter((d) => d.final > p.initial).length / statsData.length);
    byId("underwaterMetric").textContent = percent(statsData.filter((d) => d.final < p.initial).length / statsData.length);
    byId("lossStreakMedian").textContent = Math.round(percentile(streaks, .5));
    byId("lossStreakP90").textContent = Math.round(percentile(streaks, .9));
    byId("capitalP5").textContent = money(percentile(finals, .05));
    byId("capitalP50").textContent = money(percentile(finals, .5));
    byId("capitalP95").textContent = money(percentile(finals, .95));
    byId("ddRisk10").textContent = percent(statsData.filter((d) => d.touched10).length / statsData.length);
    byId("ddRisk20").textContent = percent(statsData.filter((d) => d.touched20).length / statsData.length);
    byId("ddRisk30").textContent = percent(statsData.filter((d) => d.touched30).length / statsData.length);

    const pass = statsData.filter((d) => d.result === "pass");
    const failDaily = statsData.filter((d) => d.result === "failDaily");
    const failMax = statsData.filter((d) => d.result === "failMax");
    const failTime = statsData.filter((d) => d.result === "failTime");
    const active = statsData.filter((d) => d.result === "active");
    const failed = [...failDaily, ...failMax, ...failTime];
    byId("passMetric").textContent = percent(pass.length / statsData.length);
    byId("failDailyMetric").textContent = percent(failDaily.length / statsData.length);
    byId("failMaxMetric").textContent = percent(failMax.length / statsData.length);
    const activeMode = p.timePolicy === "fail" ? "fail" : p.timePolicy === "rebill" ? "rebill" : "active";
    byId("activeMetric").textContent = percent((activeMode === "fail" ? failTime : active).length / statsData.length);
    byId("activeMetricLabel").textContent = activeMode === "fail" ? "Fail · deadline" : activeMode === "rebill" ? "Rebill · active" : "Still active";
    byId("activeMetricHelp").textContent = activeMode === "fail"
      ? "brak targetu przed końcem limitu"
      : activeMode === "rebill"
        ? "konto pozostaje aktywne · opłata nie jest doliczana"
        : "bez rozstrzygnięcia w wybranej próbie transakcji";
    const activeMetricCard = byId("activeMetric").closest(".metric");
    activeMetricCard.classList.toggle("metric-active", activeMode !== "fail");
    activeMetricCard.classList.toggle("metric-fail", activeMode === "fail");
    const passDays = pass.length ? simulationDayMetric(percentile(pass.map((d) => d.resultDay), .5), p) : null;
    const failDays = failed.length ? simulationDayMetric(percentile(failed.map((d) => d.resultDay), .5), p) : null;
    byId("passDaysMetric").textContent = passDays?.value || "—";
    byId("failDaysMetric").textContent = failDays?.value || "—";
    byId("passDaysLabel").textContent = passDays?.detail || "brak zaliczonych symulacji";
    byId("failDaysLabel").textContent = failDays?.detail || "brak niezaliczonych symulacji";
    byId("propDdMetric").textContent = `${(percentile(drawdowns, .5) * 100).toFixed(1)}%`;
    byId("propLossMetric").textContent = `${Math.round(percentile(streaks, .5))} / ${Math.round(percentile(streaks, .9))}`;

    const median = percentile(finals, .5);
    const medianDd = percentile(drawdowns, .5);
    const growth = Math.max(3, Math.min(100, (median / p.initial - 1) * 60 + 35));
    const safety = Math.max(3, Math.min(100, 100 - medianDd * 240));
    const variance = Math.max(3, Math.min(100, (percentile(finals, .9) - percentile(finals, .1)) / Math.max(p.initial, 1) * 100));
    [["growth", growth], ["safety", safety], ["variance", variance]].forEach(([name, value]) => {
      byId(`${name}Bar`).style.width = `${value}%`;
      byId(`${name}Score`).textContent = `${Math.round(value)}`;
    });
    byId("lessonText").textContent = netExpectancy <= 0
      ? `Koszty ${p.costR.toFixed(2)}R zmieniają expectancy brutto ${grossExpectancy.toFixed(2)}R w ujemne ${netExpectancy.toFixed(2)}R. Strategia traci przewagę jeszcze przed wpływem wariancji.`
      : p.mode === "prop"
        ? `Challenge wymaga dojścia do targetu przed limitem. Koszt ${p.costR.toFixed(2)}R na każdej transakcji obniża tempo dojścia i może zmienić pass rate.`
        : p.sizing === "throttle"
        ? "Redukcja ryzyka po serii strat spłaszcza część obsunięć, ale zwalnia także późniejsze odbicie kapitału."
        : `Po kosztach expectancy wynosi ${netExpectancy >= 0 ? "+" : ""}${netExpectancy.toFixed(2)}R. Wyższe koszty przesuwają cały rozkład wyników w dół.`;
    renderDistribution(finals);
  }
  function renderDistribution(finals) {
    const root = byId("distribution");
    const min = Math.min(...finals), max = Math.max(...finals), bins = Array(24).fill(0);
    finals.forEach((value) => bins[Math.min(bins.length - 1, Math.floor((value - min) / (max - min || 1) * bins.length))]++);
    const top = Math.max(...bins);
    root.innerHTML = bins.map((value) => `<i class="bar" style="height:${Math.max(3, value / top * 100)}%"></i>`).join("");
  }
  function updateSelectedPath(p = params()) {
    const path = pathsData[selectedPath];
    if (!path) return;
    byId("selectedPathTitle").textContent = `Ścieżka ${selectedPath + 1} z ${pathsData.length}`;
    byId("selectedFinal").textContent = money(path.final);
    const delta = path.final - p.initial;
    byId("selectedDelta").textContent = `${delta >= 0 ? "+" : ""}${money(delta)}`;
    byId("selectedDelta").style.color = delta >= 0 ? "#31d1a0" : "#f05a54";
    byId("selectedDd").textContent = `${(path.maxDd * 100).toFixed(1)}%`;
    byId("selectedLosses").textContent = tradeCountLabel(path.longestLoss);
    byId("selectedTrades").textContent = tradeCountLabel(path.executedTrades);
    byId("selectedAvgCost").textContent = money(path.totalCost / Math.max(1, path.executedTrades));
    byId("selectedCosts").textContent = money(path.totalCost);
    byId("selectedRuinRow").hidden = path.result !== "ruin";
    byId("selectedRuinResult").textContent = path.resultTrade
      ? `RUINA · po ${path.resultTrade} ${path.resultTrade === 1 ? "transakcji" : "transakcjach"}`
      : "RUINA";
    byId("selectedRuinResult").style.color = "#f05a54";
    byId("selectedPropRow").hidden = p.mode !== "prop";
    const resultLabels = { pass: "PASS", failDaily: "FAIL · DAILY DD", failMax: "FAIL · MAX DD", failTime: "FAIL · DEADLINE", active: path.renewalReached ? "REBILL · STILL ACTIVE" : "STILL ACTIVE" };
    const resultDay = path.resultDay ? ` · ${simulationDayLabel(path.resultDay, p)}` : "";
    byId("selectedPropResult").textContent = `${resultLabels[path.result] || "—"}${resultDay}`;
    byId("selectedPropResult").style.color = path.result === "pass" ? "#31d1a0" : path.result === "active" ? "#aaa" : "#f05a54";
  }

  function applyValues(values) {
    Object.entries(values).forEach(([key, value]) => {
      const control = controls[key];
      if (!control) return;
      if (control.type === "checkbox") control.checked = value;
      else {
        control.value = value;
        if (control.manualInput) control.manualInput.value = control.value;
      }
    });
  }
  function setActivePropPreset(name) {
    activePropPreset = name;
    byId("challengePreset").value = name;
    byId("challengePresetHelp").textContent = propPresetDescriptions[name];
  }
  function setAccountMode(mode) {
    accountMode = mode;
    document.querySelectorAll("[data-account-mode]").forEach((button) => button.classList.toggle("active", button.dataset.accountMode === mode));
    byId("propControls").classList.toggle("is-visible", mode === "prop");
    setActivePropPreset(activePropPreset);
    byId("capitalLabel").textContent = mode === "prop" ? "Kapitał nominalny" : "Kapitał początkowy";
    byId("ownMetrics").hidden = mode === "prop";
    byId("propMetrics").hidden = mode !== "prop";
    updateLabels();
    simulate();
  }
  function updateLabels() {
    const p = params();
    const usesTradeSample = p.mode === "prop" && p.timePolicy === "trades";
    byId("tradesControl").hidden = p.mode === "prop" && !usesTradeSample;
    byId("periodControl").hidden = usesTradeSample;
    byId("timePolicyHelp").textContent = p.timePolicy === "fail"
      ? "Po upływie wskazanego czasu nierozstrzygnięta próba jest liczona jako fail."
      : p.timePolicy === "rebill"
        ? "Po upływie okresu konto pozostaje aktywne i przechodzi do kolejnego rozliczenia."
        : "Bez limitu czasu wynik jest mierzony po wybranej liczbie transakcji.";
    byId("wrValue").textContent = `${controls.winRate.value}%`;
    byId("rrValue").textContent = `${Number(controls.rr.value).toFixed(1)}R`;
    byId("riskValue").textContent = `${Number(controls.risk.value).toFixed(2).replace(/0$/, "")}%`;
    byId("costValue").textContent = `${Number(controls.cost.value).toFixed(2)}R`;
    byId("tradesValue").textContent = controls.trades.value;
    byId("pathsValue").textContent = controls.paths.value;
    byId("targetValue").textContent = `${controls.profitTarget.value}%`;
    byId("maxDdValue").textContent = `${controls.maxDrawdown.value}%`;
    byId("dailyDdValue").textContent = Number(controls.dailyDrawdown.value) === 0 ? "Brak" : `${controls.dailyDrawdown.value}%`;
    byId("tradesDayValue").textContent = controls.tradesPerDay.value;
    byId("maxDaysValue").textContent = `${controls.maxDays.value} dni`;
    byId("maxDaysLabel").textContent = p.timePolicy === "fail" ? "Deadline challenge'u" : "Okres rozliczeniowy";
    const dayBreakdown = p.tradingDaysOnly
      ? `${p.maxDays} dni kalendarzowych · ${simulationDays(p)} dni handlowych.`
      : `${p.maxDays} dni kalendarzowych z handlem przez cały tydzień.`;
    byId("tradingDaysHelp").textContent = p.timePolicy === "fail"
      ? `${dayBreakdown} Brak targetu w tym czasie oznacza fail.`
      : `${dayBreakdown} Po tym okresie konto pozostaje aktywne i następuje rebill. Opłata nie jest jeszcze doliczana do kosztów symulacji.`;
    byId("throttleAfterValue").textContent = controls.throttleAfter.value;
    byId("throttleReductionValue").textContent = `${controls.throttleReduction.value}%`;
    const reducedRisk = Number(controls.risk.value) * (1 - Number(controls.throttleReduction.value) / 100);
    byId("throttleExample").textContent = `Po ${controls.throttleAfter.value} ${Number(controls.throttleAfter.value) === 1 ? "stracie" : "kolejnych stratach"} ryzyko ${Number(controls.risk.value).toFixed(2)}% spadnie do ${reducedRisk.toFixed(2)}%.`;
    byId("throttleControls").classList.toggle("is-visible", controls.sizing.value === "throttle");
    const usesFixedAmount = controls.sizing.value === "amount";
    const fixedAmount = Math.max(1, Number(controls.fixedRiskAmount.value) || 1);
    const riskValue = usesFixedAmount ? fixedAmount / Math.max(100, Number(controls.capital.value)) * 100 : Number(controls.risk.value);
    byId("percentRiskControl").hidden = usesFixedAmount;
    byId("fixedRiskControl").hidden = !usesFixedAmount;
    byId("riskLabel").textContent = usesFixedAmount ? "Stała kwota ryzyka" : "Ryzyko na transakcję";
    byId("fixedRiskHelp").textContent = `${money(fixedAmount)} odpowiada ${riskValue.toFixed(2)}% kapitału początkowego.`;
    const costEquity = riskValue * Number(controls.cost.value);
    const fixedCost = fixedAmount * Number(controls.cost.value);
    byId("costHelp").textContent = usesFixedAmount
      ? `Spread, prowizja i poślizg. Przy ryzyku ${money(fixedAmount)} koszt wynosi około ${money(fixedCost)} na każdej transakcji.`
      : `Spread, prowizja i poślizg. Przy ryzyku ${riskValue.toFixed(2)}% koszt odejmuje około ${costEquity.toFixed(3)}% kapitału na każdej transakcji.`;
    byId("riskMessage").textContent = riskMessages.find(([limit]) => riskValue <= limit)?.[1] || riskMessages.at(-1)[1];
    byId("riskMessage").style.borderColor = riskValue <= 1 ? "var(--green)" : riskValue <= 2 ? "var(--gold)" : "var(--red)";
    const sizingHelp = {
      percent: "Ryzyko jest procentem bieżącego kapitału, więc rośnie i maleje razem z kontem.",
      amount: `Każda transakcja ryzykuje stałe ${money(fixedAmount)}, niezależnie od bieżącego salda konta.`,
      throttle: "Po wskazanej serii strat ryzyko spada o wybraną wartość. Wygrana może przywrócić poziom bazowy."
    };
    byId("sizingHelp").textContent = sizingHelp[controls.sizing.value];
    byId("drawdownTypeHelp").textContent = p.ddType === "trailing"
      ? "Trailing EOD zachowuje stałą odległość limitu, aktualizuje próg po zamknięciu dnia i zatrzymuje go na saldzie startowym. To uproszczony model — szczegóły firm mogą się różnić."
      : "Static DD pozostaje stałym limitem liczonym od kapitału startowego.";
    const timeLimit = p.mode === "prop"
      ? p.timePolicy === "trades"
        ? ` Próba: ${p.trades} transakcji.`
        : ` ${p.timePolicy === "fail" ? "Deadline" : "Okres do rebillu"}: ${p.maxDays} dni kalendarzowych${p.tradingDaysOnly ? ` · ${simulationDays(p)} dni handlowe` : ""}.`
      : "";
    byId("simulationScope").textContent = `Wykres pokazuje ${p.paths} ścieżek. Statystyki policzone na ${STAT_SIMULATIONS.toLocaleString("pl-PL")} symulacji.${timeLimit}`;
  }

  const canvas = byId("equityCanvas");
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, .1, 500);
  camera.position.set(15, 19, 32);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
  const group = new THREE.Group();
  scene.add(group);
  const grid = new THREE.GridHelper(55, 22, 0x33415f, 0x1d2638);
  grid.position.y = -8;
  scene.add(grid);
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  raycaster.params.Line.threshold = .65;
  let dragging = false, lastX = 0, lastY = 0, pointerStartX = 0, pointerStartY = 0, rotX = -.14, rotY = -.25, distance = 36;
  const cameraTargets = { "3d": { x: 15, y: 19, z: 36 }, "2d": { x: 0, y: 0, z: 48 } };

  canvas.addEventListener("pointerdown", (event) => { dragging = true; lastX = event.clientX; lastY = event.clientY; pointerStartX = event.clientX; pointerStartY = event.clientY; canvas.setPointerCapture(event.pointerId); });
  canvas.addEventListener("pointermove", (event) => {
    if (!dragging || viewState.mode === "2d") return;
    rotY += (event.clientX - lastX) * .006;
    rotX = Math.max(-.6, Math.min(.25, rotX + (event.clientY - lastY) * .003));
    lastX = event.clientX; lastY = event.clientY;
  });
  canvas.addEventListener("pointerup", (event) => {
    if (Math.hypot(event.clientX - pointerStartX, event.clientY - pointerStartY) < 6) pickPath(event);
    dragging = false;
  });
  canvas.addEventListener("wheel", (event) => { event.preventDefault(); distance = Math.max(20, Math.min(62, distance + event.deltaY * .025)); }, { passive: false });

  function pickPath(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(clickableLines, false)[0];
    if (!hit || hit.object.userData.pathIndex == null) return;
    selectedPath = hit.object.userData.pathIndex;
    drawScene(params());
    updateSelectedPath();
  }
  function clearGroup() {
    clickableLines = [];
    while (group.children.length) {
      const object = group.children.pop();
      object.traverse((child) => {
        child.geometry?.dispose();
        child.material?.map?.dispose();
        child.material?.dispose();
      });
    }
  }
  function yForValue(value) {
    const center = (sceneHigh + sceneLow) / 2;
    const span = Math.max(1000, sceneHigh - sceneLow);
    return Math.max(-11, Math.min(11, ((value - center) / span) * 20));
  }
  let sceneMaxTrades = 1;
  function xForTrade(index) {
    return (index / Math.max(1, sceneMaxTrades) - .5) * 48;
  }
  function lineObject(curve, z, color, opacity, pathIndex = null) {
    const points = curve.map((value, index) => new THREE.Vector3(xForTrade(index), yForValue(value), z));
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
    line.userData.pathIndex = pathIndex;
    return line;
  }
  function referencePlane(value, color) {
    const level = new THREE.Group();
    const y = yForValue(value);
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(48, 20),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .04, side: THREE.DoubleSide, depthWrite: false })
    );
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = y;
    level.add(plane);

    const outlinePoints = [
      new THREE.Vector3(-24, y + .03, -10), new THREE.Vector3(24, y + .03, -10),
      new THREE.Vector3(24, y + .03, 10), new THREE.Vector3(-24, y + .03, 10)
    ];
    const outline = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(outlinePoints),
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: .68, depthWrite: false })
    );
    level.add(outline);
    return level;
  }
  function endpointMarker(path, index, p) {
    if (p.mode !== "prop") return null;
    const colors = { pass: 0x31d1a0, failDaily: 0xf05a54, failMax: 0xf05a54, active: 0x888c96 };
    const marker = new THREE.Mesh(new THREE.SphereGeometry(.3, 10, 10), new THREE.MeshBasicMaterial({ color: colors[path.result] }));
    marker.position.set(xForTrade(path.curve.length - 1), yForValue(path.final), viewState.mode === "2d" ? .8 : (index / Math.max(1, pathsData.length - 1) - .5) * 20);
    return marker;
  }
  function drawScene(p) {
    clearGroup();
    sceneMaxTrades = p.mode === "prop" && p.timePolicy !== "trades" ? simulationDays(p) * p.tradesPerDay : p.trades;
    const allValues = pathsData.flatMap((d) => d.curve);
    const targetValue = p.initial * (1 + p.target);
    const maxDdValue = p.initial * (1 - p.maxDdLimit);
    sceneLow = Math.min(p.initial, percentile(allValues, .02), p.mode === "prop" ? maxDdValue : p.initial * .7);
    sceneHigh = Math.max(p.initial, percentile(allValues, .98), p.mode === "prop" ? targetValue : p.initial);
    const step = Math.max(1, Math.ceil(pathsData.length / 200));
    if (viewState.showAlternatives) {
      for (let i = 0; i < pathsData.length; i += step) {
        const path = pathsData[i];
        const z = viewState.mode === "2d" ? 0 : (i / Math.max(1, pathsData.length - 1) - .5) * 20;
        const color = p.mode === "prop" ? (path.result === "pass" ? 0x2fbf97 : path.result === "active" ? 0x777b84 : 0xe05252) : (path.final >= p.initial ? 0x2fbf97 : 0xe05252);
        const opacity = p.mode === "prop" ? (path.result === "pass" ? .34 : path.result === "active" ? .2 : .58) : .25;
        const line = lineObject(path.curve, z, color, opacity, i);
        clickableLines.push(line);
        group.add(line);
        const marker = endpointMarker(path, i, p);
        if (marker) group.add(marker);
      }
    }
    const lineLength = sceneMaxTrades + 1;
    if (viewState.showBreakEvenLine) {
      if (viewState.mode === "3d") group.add(referencePlane(p.initial, 0x72a8ff));
      else group.add(lineObject(Array(lineLength).fill(p.initial), .2, 0x72a8ff, .95));
    }
    if (viewState.showDrawdown) {
      if (p.mode === "prop") {
        if (viewState.mode === "3d") {
          group.add(referencePlane(targetValue, 0x31d1a0));
          group.add(referencePlane(maxDdValue, 0xf05a54));
        } else {
          group.add(lineObject(Array(lineLength).fill(targetValue), .15, 0x31d1a0, .95));
          group.add(lineObject(Array(lineLength).fill(maxDdValue), .1, 0xf05a54, .95));
        }
      } else {
        const ddLevels = viewState.mode === "3d" ? [.1, .2] : [.1, .2, .3];
        ddLevels.forEach((dd, index) => {
          const value = p.initial * (1 - dd);
          if (viewState.mode === "3d") group.add(referencePlane(value, 0xff655d));
          else group.add(lineObject(Array(lineLength).fill(value), .1 + index * .08, 0xff655d, .55 + index * .15));
        });
      }
    }
    if (viewState.showMedian) group.add(lineObject(medianPath, viewState.mode === "2d" ? .35 : 0, 0xeef3ff, .95));
    if (viewState.showSelected && pathsData[selectedPath]) group.add(lineObject(pathsData[selectedPath].curve, viewState.mode === "2d" ? .55 : 1.1, 0xf6c665, 1));
  }
  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio, 1.7);
    if (canvas.width !== Math.round(rect.width * dpr) || canvas.height !== Math.round(rect.height * dpr)) {
      renderer.setSize(rect.width, rect.height, false);
      camera.aspect = rect.width / rect.height;
      camera.updateProjectionMatrix();
    }
  }
  function animate() {
    requestAnimationFrame(animate);
    resize();
    const targetX = viewState.mode === "2d" ? 0 : rotX;
    const targetY = viewState.mode === "2d" ? 0 : rotY;
    const cameraTarget = cameraTargets[viewState.mode];
    group.rotation.x += (targetX - group.rotation.x) * .08;
    group.rotation.y += (targetY - group.rotation.y) * .08;
    camera.position.x += (cameraTarget.x - camera.position.x) * .08;
    camera.position.y += (cameraTarget.y - camera.position.y) * .08;
    camera.position.z += (distance - camera.position.z) * .08;
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
  }

  Object.entries(controls).forEach(([key, control]) => control?.addEventListener("input", () => {
    if (accountMode === "prop" && propControlKeys.has(key)) setActivePropPreset("custom");
    updateLabels();
    clearTimeout(window.riskLabTimer);
    window.riskLabTimer = setTimeout(simulate, 130);
  }));
  byId("challengePreset").addEventListener("change", (event) => {
    const presetName = event.target.value;
    setActivePropPreset(presetName);
    if (presetName === "custom") return;
    applyValues(propPresets[presetName]);
    updateLabels(); simulate();
  });
  document.querySelectorAll("[data-account-mode]").forEach((button) => button.addEventListener("click", () => setAccountMode(button.dataset.accountMode)));
  document.querySelectorAll("[data-view-mode]").forEach((button) => button.addEventListener("click", () => {
    document.querySelectorAll("[data-view-mode]").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    viewState.mode = button.dataset.viewMode;
    distance = viewState.mode === "2d" ? 48 : 36;
    byId("sceneAxisLabel").textContent = viewState.mode === "2d" ? "X: transakcje · Y: kapitał · widok płaski" : "X: transakcje · Y: kapitał · Z: scenariusze";
    byId("sceneInstruction").textContent = viewState.mode === "2d" ? "Scroll, aby przybliżyć" : "Przeciągnij, aby obrócić · scroll, aby przybliżyć";
    drawScene(params());
  }));
  [["showAlternatives", "showAlternatives"], ["showMedian", "showMedian"], ["showSelected", "showSelected"], ["showBreakEvenLine", "showBreakEvenLine"], ["showDrawdown", "showDrawdown"]].forEach(([id, key]) => {
    byId(id).addEventListener("change", (event) => { viewState[key] = event.target.checked; drawScene(params()); });
  });
  byId("resetView").addEventListener("click", () => {
    rotX = -.14; rotY = -.25; distance = cameraTargets[viewState.mode].z;
    camera.position.set(cameraTargets[viewState.mode].x, cameraTargets[viewState.mode].y, cameraTargets[viewState.mode].z);
  });
  const scenePanel = document.querySelector(".scene-panel");
  const fullscreenToggle = byId("toggleFullscreen");
  const focusControlsToggle = byId("toggleFocusControls");
  const controlsPanel = document.querySelector(".controls");
  const controlsAnchor = document.createComment("risk-lab-controls");
  controlsPanel.before(controlsAnchor);
  function setFocusControls(isOpen) {
    scenePanel.classList.toggle("controls-collapsed", !isOpen);
    focusControlsToggle.textContent = isOpen ? "Ukryj parametry" : "Pokaż parametry";
    focusControlsToggle.setAttribute("aria-expanded", String(isOpen));
  }
  function setFocusMode(isOpen) {
    if (isOpen) {
      scenePanel.appendChild(controlsPanel);
      setFocusControls(window.innerWidth >= 900);
    } else {
      controlsAnchor.parentNode.insertBefore(controlsPanel, controlsAnchor.nextSibling);
      scenePanel.classList.remove("controls-collapsed");
    }
    scenePanel.classList.toggle("is-focus-mode", isOpen);
    document.body.classList.toggle("risk-focus-open", isOpen);
    fullscreenToggle.textContent = isOpen ? "Zamknij pełny ekran" : "Pełny ekran";
    fullscreenToggle.setAttribute("aria-label", isOpen ? "Zamknij pełny ekran wykresu" : "Otwórz wykres na pełnym ekranie");
    fullscreenToggle.setAttribute("aria-pressed", String(isOpen));
  }
  fullscreenToggle.setAttribute("aria-pressed", "false");
  fullscreenToggle.addEventListener("click", () => setFocusMode(!scenePanel.classList.contains("is-focus-mode")));
  focusControlsToggle.addEventListener("click", () => setFocusControls(scenePanel.classList.contains("controls-collapsed")));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && scenePanel.classList.contains("is-focus-mode")) setFocusMode(false);
  });
  const menu = document.querySelector(".page-menu");
  const menuToggle = byId("menuToggle");
  menuToggle.addEventListener("click", () => {
    const isOpen = menu.classList.toggle("is-open");
    menuToggle.setAttribute("aria-expanded", String(isOpen));
    menuToggle.setAttribute("aria-label", isOpen ? "Zamknij menu" : "Otwórz menu");
  });
  const themeToggle = byId("themeToggle");
  themeToggle.addEventListener("click", () => {
    const dark = document.documentElement.dataset.theme === "dark";
    document.documentElement.dataset.theme = dark ? "light" : "dark";
    themeToggle.querySelector(".theme-icon").textContent = dark ? "◐" : "☀";
    themeToggle.querySelector(".theme-text").textContent = dark ? "Dark mode" : "Light mode";
  });

  setActivePropPreset(activePropPreset);
  updateLabels();
  simulate();
  animate();
})();
