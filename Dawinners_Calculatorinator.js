
// ==UserScript==
// @name         Dawinner's Calculatorinator
// @namespace    winners.percentagem.automatica
// @version      4.2.0
// @description  Dawinner's Calculatorinator: guarda o objetivo, calcula as vendas registadas e regressa à Home.
// @match        https://win20.worten.net/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  const WIDGET_ID = 'winners-auto-percent-v4';
  const PROGRESS_KEY = 'winners-auto-percent-saved-progress-v3';
  const SALES_KEY = 'winners-auto-percent-registered-sales-v4';

  if (document.getElementById(WIDGET_ID)) return;

  const host = document.createElement('div');
  host.id = WIDGET_ID;
  document.documentElement.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });

  shadow.innerHTML = `
    <style>
      :host {
        all: initial;
        display: block;
        position: fixed;
        right: 18px;
        bottom: 18px;
        z-index: 2147483647;
        color: #f4f5f7;
        font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 14px;
        line-height: 1.4;
      }

      * { box-sizing: border-box; }

      .panel {
        width: min(370px, calc(100vw - 24px));
        padding: 20px;
        border: 1px solid #303542;
        border-radius: 18px;
        background: #191D25;
        box-shadow: 0 20px 65px #0008;
      }

      .header {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 15px;
      }

      .logo {
        width: 39px;
        height: 39px;
        flex: 0 0 39px;
        display: grid;
        place-items: center;
        border-radius: 12px;
        background: #2663F8;
        color: #ffffff;
        font-size: 21px;
        font-weight: 850;
      }

      .title-wrap {
        flex: 1;
        min-width: 0;
      }

      .eyebrow {
        color: #a1a7b3;
        font-size: 10px;
        letter-spacing: 1.5px;
        text-transform: uppercase;
      }

      h2 {
        margin: 3px 0 0;
        font-size: 15px;
        font-weight: 700;
        color: #fff;
      }

      button {
        cursor: pointer;
        font: inherit;
      }

      .minimize {
        width: 30px;
        height: 30px;
        color: #191D25;
        background: #FFCF3D;
        border: 1px solid #FFCF3D;
        border-radius: 9px;
      }

      .status {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        padding: 10px 11px;
        margin-bottom: 15px;
        border: 1px solid #303542;
        border-radius: 10px;
        background: #11151c;
        color: #aeb4c1;
        font-size: 11px;
        line-height: 1.5;
      }

      .dot {
        width: 7px;
        height: 7px;
        margin-top: 4px;
        flex: 0 0 7px;
        border-radius: 50%;
        background: #2663F8;
      }

      .source-values {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 9px;
      }

      .source-card {
        min-width: 0;
        padding: 11px;
        border: 1px solid #2e3340;
        border-radius: 11px;
        background: #11151d;
      }

      .source-label {
        margin-bottom: 5px;
        color: #949baa;
        font-size: 10px;
        line-height: 1.4;
      }

      .source-number {
        color: #f0f1f5;
        font-size: 15px;
        font-weight: 700;
        overflow-wrap: anywhere;
      }

      .action {
        width: 100%;
        margin-top: 15px;
        padding: 14px 12px;
        border: 0;
        border-radius: 11px;
        background: #FFCF3D;
        color: #191D25;
        font-size: 12px;
        font-weight: 850;
        letter-spacing: .7px;
        box-shadow: 0 6px 20px #FFCF3D20;
        transition: opacity .2s;
      }

      .action:hover {
        filter: brightness(1.04);
      }

      .action:disabled {
        cursor: wait;
        opacity: .65;
      }

      .result {
        margin-top: 15px;
        padding: 17px;
        border: 1px solid #2663F840;
        border-radius: 14px;
        background: #2663F810;
      }

      .result-label {
        color: #9BB5FF;
        font-size: 10px;
        letter-spacing: 1.4px;
        text-transform: uppercase;
      }

      .percentage {
        margin-top: 6px;
        color: #2663F8;
        font-size: clamp(32px, 9vw, 42px);
        font-weight: 800;
        letter-spacing: -1.5px;
        line-height: 1.2;
        overflow-wrap: anywhere;
      }

      .description {
        margin: 9px 0 0;
        color: #aeb4c1;
        font-size: 11px;
        line-height: 1.6;
      }

      .track {
        height: 5px;
        margin-top: 14px;
        overflow: hidden;
        border-radius: 99px;
        background: #35405A;
      }

      .bar {
        width: 0%;
        height: 100%;
        border-radius: inherit;
        background: #2663F8;
        transition: width .25s;
      }

      .summary {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 12px;
        margin-top: 13px;
        color: #a2a8b5;
        font-size: 11px;
      }

      .summary strong {
        color: #f4f5f7;
        font-size: 12px;
        font-weight: 650;
        text-align: right;
        overflow-wrap: anywhere;
      }

      .clear {
        width: 100%;
        margin-top: 16px;
        padding: 10px;
        color: #191D25;
        background: #FFCF3D;
        border: 1px solid #FFCF3D;
        border-radius: 10px;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 1px;
      }

      .clear:hover,
      .minimize:hover {
        background: #F0BD24;
        border-color: #F0BD24;
      }

      .launcher {
        display: none;
        padding: 13px 15px;
        color: #191D25;
        background: #FFCF3D;
        border: 0;
        border-radius: 12px;
        box-shadow: 0 10px 35px #0007;
        font-weight: 750;
      }

      .panel[hidden] {
        display: none;
      }

      .launcher.visible {
        display: block;
      }

      @media (max-width: 420px) {
        :host {
          right: 10px;
          bottom: 10px;
        }

        .panel {
          padding: 16px;
        }
      }
    </style>

    <section class="panel" aria-label="Dawinner's Calculatorinator">
      <header class="header">
        <div class="logo">%</div>

        <div class="title-wrap">
          <div class="eyebrow">Winners 2.0</div>
          <h2>Dawinner's Calculatorinator</h2>
        </div>

        <button
          class="minimize"
          type="button"
          title="Minimizar"
          aria-label="Minimizar"
        >−</button>
      </header>

      <div class="status" role="status" aria-live="polite">
        <span class="dot"></span>
        <span id="statusText">
          À espera de calcular as vendas do dia.
        </span>
      </div>

      <div class="source-values">
        <div class="source-card">
          <div class="source-label">Valor atual guardado</div>
          <div class="source-number" id="current">—</div>
        </div>

        <div class="source-card">
          <div class="source-label">Objetivo (100%)</div>
          <div class="source-number" id="goal">—</div>
        </div>

        <div class="source-card">
          <div class="source-label" id="salesLabel">
            Vendas registadas
          </div>
          <div class="source-number" id="salesToday">—</div>
        </div>

        <div class="source-card">
          <div class="source-label">Registos considerados</div>
          <div class="source-number" id="salesCount">—</div>
        </div>
      </div>

      <button class="action" id="calculateBtn" type="button">
        CALCULAR VALOR TOTAL
      </button>

      <section class="result" aria-live="polite">
        <div class="result-label">Percentagem final estimada</div>

        <div class="percentage" id="percentage">—</div>

        <p class="description" id="description">
          Carrega em CALCULAR VALOR TOTAL para abrir Vendas,
          selecionar REGISTADAS e calcular o total de hoje.
        </p>

        <div class="track">
          <div class="bar" id="bar"></div>
        </div>
      </section>

      <div class="summary">
        <span>Total projetado</span>
        <strong id="finalValue">—</strong>
      </div>

      <div class="summary">
        <span>Percentagem atual</span>
        <strong id="currentPercent">—</strong>
      </div>

      <div class="summary">
        <span>Data do cálculo guardado</span>
        <strong id="savedDate">—</strong>
      </div>

      <button class="clear" id="clearBtn" type="button">
        LIMPAR
      </button>
    </section>

    <button class="launcher" type="button">
      % Dawinner's Calculatorinator
    </button>
  `;

  const $ = selector => shadow.querySelector(selector);

  const MONTHS = [
    'JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN',
    'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'
  ];

  function readJson(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || 'null');
    } catch (error) {
      console.warn('[Dawinner] Falha a ler dados guardados.', error);
      return null;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.warn('[Dawinner] Falha a guardar dados.', error);
      return false;
    }
  }

  function parseNumber(value) {
    let text = String(value ?? '')
      .trim()
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, '')
      .replace(/[€%]/g, '')
      .replace(/PTS?$/i, '');

    if (!text) return NaN;

    if (text.includes(',') && text.includes('.')) {
      text = text.replace(/\./g, '').replace(',', '.');
    } else if (text.includes(',')) {
      text = text.replace(',', '.');
    } else if (/^-?\d{1,3}(\.\d{3})+$/.test(text)) {
      text = text.replace(/\./g, '');
    }

    const number = Number(text);
    return Number.isFinite(number) ? number : NaN;
  }

  function normalise(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/\./g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function dateInfo(date = new Date()) {
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');

    return {
      key: `${date.getFullYear()}-${mm}-${dd}`,
      label: `${date.getDate()} ${MONTHS[date.getMonth()]}`
    };
  }

  const numberFormat = new Intl.NumberFormat('pt-PT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  const ptsFormat = new Intl.NumberFormat('pt-PT', {
    maximumFractionDigits: 2
  });

  const fmt = n => numberFormat.format(n);
  const fmtPts = n => `${ptsFormat.format(n)} PTS`;

  let progress = readJson(PROGRESS_KEY);

  if (
    !progress ||
    !Number.isFinite(progress.current) ||
    !Number.isFinite(progress.goal) ||
    progress.goal <= 0
  ) {
    progress = null;
  }

  let persisted = readJson(SALES_KEY);

  if (!persisted || typeof persisted !== 'object') {
    persisted = { pending: false, result: null };
  }

  if (!('result' in persisted)) persisted.result = null;

  let savedSales =
    persisted.result && Number.isFinite(persisted.result.total)
      ? persisted.result
      : null;

  let running = false;
  let workflowToken = 0;
  let statusOverride = '';
  let scanTimer = null;

  function setPersistentState(pending, result = savedSales) {
    persisted = { pending, result };
    writeJson(SALES_KEY, persisted);
  }

  function saveProgress(current, goal) {
    progress = {
      current,
      goal,
      updatedAt: new Date().toISOString()
    };

    writeJson(PROGRESS_KEY, progress);
  }

  // Lê o rácio do ecrã que apresenta o objetivo: "37401 / 55961".
  function findProgress() {
    const elements = document.querySelectorAll('p.text-center.mb-0');

    for (const element of elements) {
      if (host.contains(element)) continue;

      const text = (
        element.innerText || element.textContent || ''
      ).replace(/\u00a0/g, ' ').trim();

      const match = text.match(
        /^([\d.,\s]+?)\s*\/\s*([\d.,\s]+?)$/
      );

      if (!match) continue;

      const current = parseNumber(match[1]);
      const goal = parseNumber(match[2]);

      if (
        Number.isFinite(current) &&
        Number.isFinite(goal) &&
        current >= 0 &&
        goal > 0
      ) {
        return { current, goal };
      }
    }

    return null;
  }

  function isSalesPage() {
    const route = location.pathname.replace(/\/$/, '');

    if (route.endsWith('/mobile/m/sales')) return true;

    return [
      ...document.querySelectorAll('.sales-header-left .sales-title')
    ].some(
      element => normalise(element.textContent) === 'VENDAS'
    );
  }

  function findSalesLink() {
    return document.querySelector(
      'a[href="/mobile/m/sales"], a[href$="/mobile/m/sales"]'
    );
  }

  function findRegisteredTab() {
    return [
      ...document.querySelectorAll('button.nav-link[role="tab"]')
    ].find(
      button => normalise(button.textContent) === 'REGISTADAS'
    );
  }

  function readSalePoints(element) {
    const text = (
      element.innerText || element.textContent || ''
    ).replace(/\u00a0/g, ' ').trim();

    const match = text.match(/^([\d.,\s]+?)\s*PTS?$/i);

    if (!match) return NaN;

    return parseNumber(match[1]);
  }

  function isVisible(element) {
    return !!(
      element &&
      element.getClientRects &&
      element.getClientRects().length
    );
  }

  // Associa cada venda ao cabeçalho de data imediatamente anterior.
  // O total é recalculado de raiz e nunca se soma ao resultado anterior.
  function findTodaysSales() {
    const today = dateInfo();

    const timeline = [
      ...document.querySelectorAll(
        'p.month-title, span.value-pts-sale'
      )
    ].filter(isVisible);

    let activeDate = '';
    let dateFound = false;

    const values = [];
    const seenElements = new Set();

    for (const element of timeline) {
      if (element.matches('p.month-title')) {
        activeDate = normalise(element.textContent);

        if (activeDate === normalise(today.label)) {
          dateFound = true;
        }

        continue;
      }

      if (!element.matches('span.value-pts-sale')) continue;
      if (activeDate !== normalise(today.label)) continue;
      if (seenElements.has(element)) continue;

      seenElements.add(element);

      const value = readSalePoints(element);

      if (Number.isFinite(value) && value >= 0) {
        values.push(value);
      }
    }

    if (!dateFound) return null;

    return {
      dateKey: today.key,
      dateLabel: today.label,
      values,
      total: values.reduce((sum, value) => sum + value, 0),
      count: values.length
    };
  }

  const sleep = ms =>
    new Promise(resolve => setTimeout(resolve, ms));

  async function waitFor(
    test,
    timeoutMs,
    token,
    intervalMs = 300
  ) {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      if (token !== workflowToken) {
        throw new Error('Cálculo cancelado.');
      }

      let result;

      try {
        result = test();
      } catch (_) {
        result = null;
      }

      if (result) return result;

      await sleep(intervalMs);
    }

    throw new Error('Tempo esgotado à espera da página.');
  }

  function render() {
    $('#current').textContent =
      progress ? fmtPts(progress.current) : '—';

    $('#goal').textContent =
      progress ? fmtPts(progress.goal) : '—';

    $('#salesToday').textContent =
      savedSales ? fmtPts(savedSales.total) : '—';

    $('#salesCount').textContent =
      savedSales ? String(savedSales.count) : '—';

    $('#salesLabel').textContent = savedSales
      ? `Vendas (${savedSales.dateLabel})`
      : 'Vendas registadas';

    $('#savedDate').textContent =
      savedSales && savedSales.updatedAt
        ? new Date(savedSales.updatedAt).toLocaleString('pt-PT')
        : '—';

    $('#calculateBtn').disabled = running;

    $('#calculateBtn').textContent = running
      ? 'A CALCULAR...'
      : 'CALCULAR VALOR TOTAL';

    $('#statusText').textContent = statusOverride || (
      savedSales
        ? `Resultado de ${savedSales.dateLabel} guardado. Só é apagado ao carregar em LIMPAR.`
        : progress
          ? 'Objetivo guardado. Carrega no botão para abrir Vendas e calcular as registadas.'
          : 'Abre o ecrã do objetivo pelo menos uma vez para guardar o valor atual e o objetivo.'
    );

    if (!progress) {
      $('#percentage').textContent = '—';
      $('#finalValue').textContent = '—';
      $('#currentPercent').textContent = '—';
      $('#bar').style.width = '0%';

      $('#description').textContent =
        'Ainda não foi guardado o objetivo. Abre o ecrã que mostra "valor atual / objetivo" e depois volta a calcular.';

      return;
    }

    const currentPercent =
      (progress.current / progress.goal) * 100;

    $('#currentPercent').textContent = `${fmt(currentPercent)}%`;

    if (!savedSales) {
      $('#percentage').textContent = '—';
      $('#finalValue').textContent = '—';

      $('#bar').style.width =
        `${Math.max(0, Math.min(currentPercent, 100))}%`;

      $('#description').textContent =
        'Carrega em CALCULAR VALOR TOTAL para ler as vendas de hoje na aba REGISTADAS.';

      return;
    }

    const finalValue = progress.current + savedSales.total;
    const finalPercent = (finalValue / progress.goal) * 100;

    $('#percentage').textContent = `${fmt(finalPercent)}%`;
    $('#finalValue').textContent = fmtPts(finalValue);

    $('#description').textContent =
      `${fmtPts(progress.current)} atuais + ` +
      `${fmtPts(savedSales.total)} de vendas registadas em ` +
      `${savedSales.dateLabel} = ${fmtPts(finalValue)} sobre um objetivo de ` +
      `${fmtPts(progress.goal)}.`;

    $('#bar').style.width =
      `${Math.max(0, Math.min(finalPercent, 100))}%`;
  }

  async function collectSales(token) {
    statusOverride = 'A abrir a secção Vendas...';
    render();

    if (!isSalesPage()) {
      const link = findSalesLink();

      if (link) {
        link.click();
      } else {
        location.href = new URL(
          '/mobile/m/sales',
          location.origin
        ).href;
      }

      await waitFor(
        () => isSalesPage(),
        25000,
        token
      );
    }

    statusOverride = 'A abrir o separador REGISTADAS...';
    render();

    const tab = await waitFor(
      () => findRegisteredTab(),
      20000,
      token
    );

    if (tab.getAttribute('aria-selected') !== 'true') {
      tab.click();

      await waitFor(() => {
        const currentTab = findRegisteredTab();

        return currentTab &&
          currentTab.getAttribute('aria-selected') === 'true'
            ? currentTab
            : null;
      }, 10000, token);
    }

    statusOverride =
      `A ler as vendas de hoje (${dateInfo().label})...`;

    render();

    const deadline = Date.now() + 22000;
    let dateWithoutValuesSince = null;

    while (Date.now() < deadline) {
      if (token !== workflowToken) {
        throw new Error('Cálculo cancelado.');
      }

      const result = findTodaysSales();

      if (result && result.count > 0) return result;

      if (result && result.count === 0) {
        if (dateWithoutValuesSince === null) {
          dateWithoutValuesSince = Date.now();
        }

        if (Date.now() - dateWithoutValuesSince >= 8000) {
          return result;
        }
      } else {
        dateWithoutValuesSince = null;
      }

      await sleep(400);
    }

    throw new Error(
      `Não encontrei as vendas de ${dateInfo().label}. ` +
      'Confirma que o separador REGISTADAS carregou os registos de hoje.'
    );
  }

  function returnToHome() {
    statusOverride =
      'Cálculo concluído e guardado. A regressar à página Home...';

    render();

    // Usa o link real do menu inferior.
    const homeLink = [
      ...document.querySelectorAll(
        'a[href="/mobile/m/"], a[href="/mobile/m"]'
      )
    ].find(link => {
      if (!isVisible(link)) return false;

      const label =
        link.querySelector('span')?.textContent ||
        link.textContent ||
        '';

      return normalise(label) === 'HOME';
    });

    if (homeLink) {
      homeLink.click();
      return;
    }

    // Alternativa se o link Home ainda não estiver renderizado.
    window.location.assign(
      new URL('/mobile/m/', location.origin).href
    );
  }

  async function runCalculation() {
    if (running) return;

    running = true;

    const token = ++workflowToken;

    setPersistentState(true, savedSales);

    statusOverride = 'A preparar o cálculo...';
    render();

    try {
      const result = await collectSales(token);

      if (token !== workflowToken) return;

      savedSales = {
        dateKey: result.dateKey,
        dateLabel: result.dateLabel,
        values: result.values,
        total: result.total,
        count: result.count,
        updatedAt: new Date().toISOString()
      };

      // Guardar o resultado antes de voltar à Home.
      setPersistentState(false, savedSales);

      statusOverride =
        `Total de ${result.dateLabel} calculado e guardado. A regressar à Home...`;

      render();

      await sleep(350);

      if (token === workflowToken) returnToHome();
    } catch (error) {
      if (token !== workflowToken) return;

      setPersistentState(false, savedSales);

      statusOverride =
        error.message === 'Cálculo cancelado.'
          ? 'Cálculo cancelado.'
          : `Não foi possível terminar: ${error.message}`;
    } finally {
      if (token === workflowToken) {
        running = false;
        render();
      }
    }
  }

  $('#calculateBtn').addEventListener(
    'click',
    runCalculation
  );

  $('#clearBtn').addEventListener('click', () => {
    workflowToken++;
    running = false;
    savedSales = null;

    setPersistentState(false, null);

    statusOverride =
      'Resultado das vendas apagado. O objetivo guardado foi mantido.';

    render();
  });

  $('.minimize').addEventListener('click', () => {
    $('.panel').hidden = true;
    $('.launcher').classList.add('visible');
  });

  $('.launcher').addEventListener('click', () => {
    $('.panel').hidden = false;
    $('.launcher').classList.remove('visible');
  });

  function scanProgress() {
    const found = findProgress();

    if (!found) return;

    if (
      !progress ||
      progress.current !== found.current ||
      progress.goal !== found.goal
    ) {
      saveProgress(found.current, found.goal);
      render();
    }
  }

  const observer = new MutationObserver(() => {
    if (scanTimer !== null) clearTimeout(scanTimer);

    scanTimer = setTimeout(() => {
      scanTimer = null;
      scanProgress();
    }, 250);
  });

  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true
  });

  setInterval(scanProgress, 2000);

  scanProgress();
  render();

  // Se a navegação para Vendas recarregar a página, retoma o cálculo.
  if (persisted.pending) {
    setTimeout(() => runCalculation(), 500);
  }
})();
