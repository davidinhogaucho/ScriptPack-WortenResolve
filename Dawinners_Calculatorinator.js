// ==UserScript==
// @name         Dawinner's Calculatorinator
// @namespace    winners.percentagem.automatica
// @version      4.8.2
// @description  Calcula vendas, contratos e previsão das moedas douradas e cinzentas do fim do mês.
// @match        https://win20.worten.net/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  const WIDGET_ID = 'winners-auto-percent-v4';
  const PROGRESS_KEY = 'winners-auto-percent-saved-progress-v3';
  const SALES_KEY = 'winners-auto-percent-registered-sales-v4';
  const CONTRACTS_KEY = 'dawinner-calculatorinator-contracts-v1';
  const POINTS_PER_EURO = 500;
  const TECH_POINTS = 3900;
  const CASA_POINTS = 1560;

  if (document.getElementById(WIDGET_ID)) return;

  const host = document.createElement('div');
  host.id = WIDGET_ID;
  document.documentElement.appendChild(host);
  const shadow = host.attachShadow({ mode: 'open' });

  shadow.innerHTML = `
    <style>
      :host{all:initial;display:block;position:fixed;right:18px;bottom:18px;z-index:2147483647;color:#f4f5f7;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:14px;line-height:1.4}
      *{box-sizing:border-box}
      .panel{width:min(390px,calc(100vw - 24px));max-height:calc(100vh - 30px);overflow:auto;padding:20px;border:1px solid #303542;border-radius:18px;background:#191D25;box-shadow:0 20px 65px #0008}
      .header{display:flex;align-items:center;gap:10px;margin-bottom:15px}
      .logo{width:39px;height:39px;flex:0 0 39px;display:grid;place-items:center;border-radius:12px;background:#2663F8;color:#fff;font-size:21px;font-weight:850}
      .title-wrap{flex:1;min-width:0}
      .eyebrow{color:#a1a7b3;font-size:10px;letter-spacing:1.5px;text-transform:uppercase}
      h2{margin:3px 0 0;font-size:15px;font-weight:700;color:#fff}
      button{cursor:pointer;font:inherit}
      .minimize{width:30px;height:30px;color:#191D25;background:#FFCF3D;border:1px solid #FFCF3D;border-radius:9px}
      .status{display:flex;align-items:flex-start;gap:8px;padding:10px 11px;margin-bottom:15px;border:1px solid #303542;border-radius:10px;background:#11151c;color:#aeb4c1;font-size:11px;line-height:1.5}
      .dot{width:7px;height:7px;margin-top:4px;flex:0 0 7px;border-radius:50%;background:#2663F8}
      .section-title{margin:15px 0 8px;color:#9BB5FF;font-size:10px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase}
      .source-values{display:grid;grid-template-columns:1fr 1fr;gap:9px}
      .source-card{min-width:0;padding:11px;border:1px solid #2e3340;border-radius:11px;background:#11151d}
      .source-label{margin-bottom:5px;color:#949baa;font-size:10px;line-height:1.4}
      .source-number{color:#f0f1f5;font-size:15px;font-weight:700;overflow-wrap:anywhere}
      .money{color:#FFCF3D!important}

      .coin-summary{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px}
      .coin-card{min-width:0;padding:11px;border:1px solid #343a46;border-radius:11px;background:#11151d}
      .coin-heading{display:flex;align-items:baseline;justify-content:flex-start;flex-wrap:wrap;gap:5px}
      .coin-label{color:#aeb4c1;font-size:11px;line-height:1.4}
      .coin-value{font-size:9px;font-weight:650;text-align:left;overflow-wrap:anywhere;white-space:nowrap;opacity:.95}
      .gold-card{border-color:#FFC40066}
      .gold-card .coin-value{color:#FFC400}
      .silver-card{border-color:#AEB6C266}
      .silver-card .coin-value{color:#C4CBD5}

      /* Barra única, compacta, para o total das moedas */
      .total-card{
        grid-column:1/-1;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
        padding:8px 11px;
      }
      .total-card .coin-heading{flex:1;min-width:0}
      .total-card .coin-value{color:#f4f5f7}
      .total-card .coin-label{font-size:10px}
      .total-card .coin-euro{margin-top:0;font-size:12px;white-space:nowrap}

      .coin-euro{margin-top:6px;color:#FFCF3D;font-size:13px;font-weight:800}
      .gold-euro{color:#FFC400}
      .silver-euro{color:#C4CBD5}

      .contracts{padding:12px;border:1px solid #303542;border-radius:12px;background:#11151d}
      .contract-intro{margin:0 0 10px;color:#e9ebf1;font-size:12px;font-weight:700}
      .contract-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      .field label{display:block;margin-bottom:6px;color:#aeb4c1;font-size:11px}
      .field input{width:100%;min-width:0;padding:10px;border:1px solid #3a4253;border-radius:9px;outline:none;background:#191D25;color:#fff;font:inherit}
      .field input:focus{border-color:#2663F8;box-shadow:0 0 0 2px #2663F833}
      .field small{display:block;margin-top:5px;color:#8e96a7;font-size:10px}
      .action{width:100%;margin-top:15px;padding:14px 12px;border:0;border-radius:11px;background:#FFCF3D;color:#191D25;font-size:12px;font-weight:850;letter-spacing:.7px;box-shadow:0 6px 20px #FFCF3D20;transition:opacity .2s}
      .action:hover{filter:brightness(1.04)}
      .action:disabled{cursor:wait;opacity:.65}
      .result{margin-top:15px;padding:17px;border:1px solid #2663F840;border-radius:14px;background:#2663F810}
      .result-label{color:#9BB5FF;font-size:10px;letter-spacing:1.4px;text-transform:uppercase}
      .percentage{margin-top:6px;color:#2663F8;font-size:clamp(32px,9vw,42px);font-weight:800;letter-spacing:-1.5px;line-height:1.2;overflow-wrap:anywhere}
      .description{margin:9px 0 0;color:#aeb4c1;font-size:11px;line-height:1.6}
      .track{height:5px;margin-top:14px;overflow:hidden;border-radius:99px;background:#35405A}
      .bar{width:0%;height:100%;border-radius:inherit;background:#2663F8;transition:width .25s}
      .summary{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-top:13px;color:#a2a8b5;font-size:11px}
      .summary strong{color:#f4f5f7;font-size:12px;font-weight:650;text-align:right;overflow-wrap:anywhere}
      .summary strong.money{color:#FFCF3D}
      .clear{width:100%;margin-top:16px;padding:10px;color:#191D25;background:#FFCF3D;border:1px solid #FFCF3D;border-radius:10px;font-size:12px;font-weight:700;letter-spacing:1px}
      .clear:hover,.minimize:hover{background:#F0BD24;border-color:#F0BD24}

      .launcher{display:none;width:48px;height:48px;flex:0 0 48px;align-items:center;justify-content:center;padding:0;position:relative;transform:translateY(-20px);overflow:hidden;color:#191D25;background:radial-gradient(circle at 30% 22%,#FFF0A8 0%,#FFCF3D 42%,#F0BD24 100%);border:2px solid #FFC400;border-radius:50%;box-shadow:0 7px 17px #0007,0 0 5px #FFC400,0 0 11px #FFC40088,inset 0 2px 3px #fff9,inset 0 -4px 7px #b98a00;font-weight:850;transition:transform .18s ease,box-shadow .18s ease,filter .18s ease}
      .launcher::before{content:"";position:absolute;inset:4px 6px auto;height:17px;border-radius:50%;background:linear-gradient(180deg,#ffffff88,#ffffff00);pointer-events:none}
      .launcher-mark{position:relative;z-index:1;display:flex;align-items:baseline;justify-content:center;color:#191D25;line-height:1;letter-spacing:-2px;text-shadow:0 1px 0 #fff7;white-space:nowrap}
      .launcher-d{font-size:22px;font-weight:950;letter-spacing:-2.5px}
      .launcher-sp{margin-left:-1px;font-size:11px;font-weight:950;letter-spacing:-1.2px}
      .launcher.visible{display:flex}
      .launcher:hover{transform:translateY(-22px) scale(1.04);filter:brightness(1.03);box-shadow:0 9px 20px #0008,0 0 6px #FFC400,0 0 14px #FFC400AA,inset 0 2px 3px #fff9,inset 0 -4px 7px #b98a00}
      .launcher:active{transform:translateY(-19px) scale(.97)}
      .panel[hidden]{display:none}
      @media(max-width:420px){:host{right:10px;bottom:10px}.panel{padding:16px}}
    </style>

    <section class="panel" aria-label="Dawinner's Calculatorinator">
      <header class="header">
        <div class="logo">%</div>
        <div class="title-wrap">
          <div class="eyebrow">Winners 2.0</div>
          <h2>Dawinner's Calculatorinator</h2>
        </div>
        <button class="minimize" type="button" title="Minimizar" aria-label="Minimizar">−</button>
      </header>

      <div class="coin-summary">
        <div class="coin-card gold-card">
          <div class="coin-heading">
            <div class="coin-label">Moedas Douradas</div>
            <div class="coin-value" id="goldCoins">—</div>
          </div>
          <div class="coin-euro gold-euro" id="goldCoinEuro">—</div>
        </div>

        <div class="coin-card silver-card">
          <div class="coin-heading">
            <div class="coin-label">Moedas Cinzentas</div>
            <div class="coin-value" id="silverCoins">—</div>
          </div>
          <div class="coin-euro silver-euro" id="silverCoinEuro">—</div>
        </div>

        <div class="coin-card total-card">
          <div class="coin-heading">
            <div class="coin-label">Total de moedas</div>
            <div class="coin-value" id="totalCoins">—</div>
          </div>
          <div class="coin-euro" id="totalCoinEuro">—</div>
        </div>
      </div>

      <div class="status" role="status" aria-live="polite">
        <span class="dot"></span>
        <span id="statusText">À espera de calcular as vendas do dia.</span>
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
          <div class="source-label" id="salesLabel">Vendas registadas</div>
          <div class="source-number" id="salesToday">—</div>
        </div>
        <div class="source-card">
          <div class="source-label">Registos considerados</div>
          <div class="source-number" id="salesCount">—</div>
        </div>
      </div>

      <div class="section-title">Contratos hoje?</div>

      <div class="contracts">
        <p class="contract-intro">Quantos contratos foram feitos hoje?</p>
        <div class="contract-grid">
          <div class="field">
            <label for="techCount">Tech</label>
            <input id="techCount" type="number" min="0" max="10" step="1" inputmode="numeric" value="0">
            <small>+3.900 PTS por contrato</small>
          </div>
          <div class="field">
            <label for="casaCount">Casa</label>
            <input id="casaCount" type="number" min="0" max="10" step="1" inputmode="numeric" value="0">
            <small>+1.560 PTS por contrato</small>
          </div>
        </div>
      </div>

      <button class="action" id="calculateBtn" type="button">CALCULAR VALOR TOTAL</button>

      <section class="result" aria-live="polite">
        <div class="result-label">Percentagem final estimada</div>
        <div class="percentage" id="percentage">—</div>
        <p class="description" id="description">O cálculo percorre Vendas → REGISTADAS, soma as vendas de hoje e só depois acrescenta os contratos escolhidos.</p>
        <div class="track"><div class="bar" id="bar"></div></div>
      </section>

      <div class="summary"><span>Total projetado</span><strong id="finalValue">—</strong></div>
      <div class="summary"><span>Bónus de contratos</span><strong id="contractBonus">—</strong></div>
      <div class="summary"><span>Percentagem atual</span><strong id="currentPercent">—</strong></div>
      <div class="summary"><span>Data do cálculo guardado</span><strong id="savedDate">—</strong></div>

      <button class="clear" id="clearBtn" type="button">LIMPAR</button>
    </section>

    <button class="launcher" type="button" title="Abrir Dawinner's Calculatorinator" aria-label="Abrir Dawinner's Calculatorinator">
      <span class="launcher-mark" aria-hidden="true">
        <span class="launcher-d">D</span><span class="launcher-sp">win</span>
      </span>
    </button>
  `;

  const $ = selector => shadow.querySelector(selector);

  const MONTHS = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];
  const currencyFormat = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' });
  const numberFormat = new Intl.NumberFormat('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const ptsFormat = new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 2 });
  const fmt = n => numberFormat.format(n);
  const fmtPts = n => `${ptsFormat.format(n)} PTS`;
  const fmtEuro = coins => currencyFormat.format(coins / POINTS_PER_EURO);
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

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

  function isVisible(element) {
    return !!(
      element &&
      element.getClientRects &&
      element.getClientRects().length
    );
  }

  function findCoinBalances() {
    const values = [
      ...document.querySelectorAll('span[data-v-50213549].align-middle')
    ]
      .filter(el => !host.contains(el) && isVisible(el))
      .map(el => parseNumber(el.textContent))
      .filter(value => Number.isFinite(value) && value >= 0);

    return {
      gold: values.length > 0 ? values[0] : null,
      silver: values.length > 1 ? values[1] : null
    };
  }

  function findProgress() {
    for (const element of document.querySelectorAll('p.text-center.mb-0')) {
      if (host.contains(element)) continue;

      const text = (element.innerText || element.textContent || '')
        .replace(/\u00a0/g, ' ')
        .trim();

      const match = text.match(/^([\d.,\s]+?)\s*\/\s*([\d.,\s]+?)$/);
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
    if (location.pathname.replace(/\/$/, '').endsWith('/mobile/m/sales')) {
      return true;
    }

    return [
      ...document.querySelectorAll('.sales-header-left .sales-title')
    ].some(el => normalise(el.textContent) === 'VENDAS');
  }

  function findSalesLink() {
    return document.querySelector(
      'a[href="/mobile/m/sales"], a[href$="/mobile/m/sales"]'
    );
  }

  function findRegisteredTab() {
    return [
      ...document.querySelectorAll('button.nav-link[role="tab"]')
    ].find(button => normalise(button.textContent) === 'REGISTADAS');
  }

  function readSalePoints(element) {
    const text = (element.innerText || element.textContent || '')
      .replace(/\u00a0/g, ' ')
      .trim();

    const match = text.match(/^([\d.,\s]+?)\s*PTS?$/i);
    return match ? parseNumber(match[1]) : NaN;
  }

  function findTodaysSales() {
    const today = dateInfo();

    const timeline = [
      ...document.querySelectorAll('p.month-title, span.value-pts-sale')
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

      if (
        !element.matches('span.value-pts-sale') ||
        activeDate !== normalise(today.label) ||
        seenElements.has(element)
      ) {
        continue;
      }

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

  async function waitFor(test, timeoutMs, token, intervalMs = 300) {
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
    $('#current').textContent = progress ? fmtPts(progress.current) : '—';
    $('#goal').textContent = progress ? fmtPts(progress.goal) : '—';

    const gold = coinBalances.gold;
    const silver = coinBalances.silver;
    const totalCoins = gold !== null && silver !== null ? gold + silver : null;

    $('#goldCoins').textContent =
      gold !== null ? `${ptsFormat.format(gold)} moedas` : '—';

    $('#silverCoins').textContent =
      silver !== null ? `${ptsFormat.format(silver)} moedas` : '—';

    $('#goldCoinEuro').textContent =
      gold !== null ? `≈ ${fmtEuro(gold)}` : '—';

    $('#silverCoinEuro').textContent =
      silver !== null ? `≈ ${fmtEuro(silver)}` : '—';

    $('#totalCoins').textContent =
      totalCoins !== null ? ptsFormat.format(totalCoins) : '—';

    $('#totalCoinEuro').textContent =
      totalCoins !== null ? `≈ ${fmtEuro(totalCoins)}` : '—';

    $('#salesToday').textContent = savedSales ? fmtPts(savedSales.total) : '—';
    $('#salesCount').textContent = savedSales ? String(savedSales.count) : '—';

    $('#salesLabel').textContent =
      savedSales ? `Vendas (${savedSales.dateLabel})` : 'Vendas registadas';

    $('#savedDate').textContent =
      savedSales && savedSales.updatedAt
        ? new Date(savedSales.updatedAt).toLocaleString('pt-PT')
        : '—';

    $('#calculateBtn').disabled = running;
    $('#calculateBtn').textContent =
      running ? 'A CALCULAR...' : 'CALCULAR VALOR TOTAL';

    $('#statusText').textContent =
      statusOverride ||
      (
        savedSales
          ? `Resultado de ${savedSales.dateLabel} guardado. Só é apagado ao carregar em LIMPAR.`
          : progress
            ? 'Objetivo guardado. Ao calcular, serão lidas as vendas e depois adicionados os contratos.'
            : 'Abre o ecrã do objetivo para guardar automaticamente o valor atual e o objetivo.'
      );

    const counts =
      savedSales && savedSales.contracts
        ? savedSales.contracts
        : contracts;

    const bonus =
      savedSales && Number.isFinite(savedSales.contractBonus)
        ? savedSales.contractBonus
        : contractPoints(counts);

    $('#contractBonus').textContent = fmtPts(bonus);

    if (!progress) {
      $('#percentage').textContent = '—';
      $('#finalValue').textContent = '—';
      $('#currentPercent').textContent = '—';
      $('#bar').style.width = '0%';

      $('#description').textContent =
        'Ainda não foi guardado o objetivo. Abre o ecrã que mostra "valor atual / objetivo" e depois volta a calcular.';

      return;
    }

    const currentPercent = (progress.current / progress.goal) * 100;
    $('#currentPercent').textContent = `${fmt(currentPercent)}%`;

    if (!savedSales) {
      $('#percentage').textContent = '—';
      $('#finalValue').textContent = '—';

      $('#bar').style.width =
        `${Math.max(0, Math.min(currentPercent, 100))}%`;

      $('#description').textContent =
        'Carrega em CALCULAR VALOR TOTAL. O script soma primeiro as vendas de hoje e só depois adiciona os contratos Tech/Casa.';

      return;
    }

    const finalValue = progress.current + savedSales.total + bonus;
    const finalPercent = (finalValue / progress.goal) * 100;

    $('#percentage').textContent = `${fmt(finalPercent)}%`;
    $('#finalValue').textContent = fmtPts(finalValue);

    $('#description').textContent =
      `${fmtPts(progress.current)} atuais + ` +
      `${fmtPts(savedSales.total)} de vendas registadas + ` +
      `${fmtPts(bonus)} de contratos ` +
      `(${counts.tech} Tech, ${counts.casa} Casa) = ${fmtPts(finalValue)}.`;

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
        location.href = new URL('/mobile/m/sales', location.origin).href;
      }

      await waitFor(() => isSalesPage(), 25000, token);
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

    statusOverride = `A ler as vendas de hoje (${dateInfo().label})...`;
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
      `Não encontrei as vendas de ${dateInfo().label}. Confirma que REGISTADAS carregou os registos de hoje.`
    );
  }

  function returnToHome() {
    statusOverride =
      'Cálculo concluído e guardado. A regressar à página Home...';

    render();

    const homeLink = [
      ...document.querySelectorAll(
        'a[href="/mobile/m/"], a[href="/mobile/m"]'
      )
    ].find(link => {
      if (!isVisible(link)) return false;

      return normalise(
        link.querySelector('span')?.textContent ||
        link.textContent ||
        ''
      ) === 'HOME';
    });

    if (homeLink) {
      homeLink.click();
    } else {
      window.location.assign(
        new URL('/mobile/m/', location.origin).href
      );
    }
  }

  async function runCalculation() {
    if (running) return;

    try {
      contracts = getContractsFromInputs();
      writeJson(CONTRACTS_KEY, contracts);
    } catch (error) {
      statusOverride = error.message;
      render();
      return;
    }

    running = true;
    const token = ++workflowToken;

    setPersistentState(true, savedSales);
    statusOverride = 'A preparar o cálculo das vendas...';
    render();

    try {
      const result = await collectSales(token);
      if (token !== workflowToken) return;

      const bonus = contractPoints(contracts);

      savedSales = {
        dateKey: result.dateKey,
        dateLabel: result.dateLabel,
        values: result.values,
        total: result.total,
        count: result.count,
        contracts: { ...contracts },
        contractBonus: bonus,
        updatedAt: new Date().toISOString()
      };

      setPersistentState(false, savedSales);

      statusOverride =
        `Vendas somadas; bónus de ${fmtPts(bonus)} adicionado. A regressar à Home...`;

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

  function clampCount(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(10, Math.trunc(n)));
  }

  function getContractsFromInputs() {
    const techRaw = Number($('#techCount').value);
    const casaRaw = Number($('#casaCount').value);

    if (
      $('#techCount').value.trim() === '' ||
      !Number.isInteger(techRaw) ||
      techRaw < 0 ||
      techRaw > 10
    ) {
      throw new Error('Tech deve ser um número inteiro entre 0 e 10.');
    }

    if (
      $('#casaCount').value.trim() === '' ||
      !Number.isInteger(casaRaw) ||
      casaRaw < 0 ||
      casaRaw > 10
    ) {
      throw new Error('Casa deve ser um número inteiro entre 0 e 10.');
    }

    return { tech: techRaw, casa: casaRaw };
  }

  function saveContracts() {
    try {
      contracts = getContractsFromInputs();
      writeJson(CONTRACTS_KEY, contracts);
      return true;
    } catch (_) {
      return false;
    }
  }

  function contractPoints(counts = contracts) {
    return counts.tech * TECH_POINTS + counts.casa * CASA_POINTS;
  }

  function setPersistentState(pending, result = savedSales) {
    persisted = { pending, result, contracts };
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

  let coinBalances = { gold: null, silver: null };
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
    persisted = {
      pending: false,
      result: null,
      contracts: { tech: 0, casa: 0 }
    };
  }

  if (!('result' in persisted)) persisted.result = null;

  let savedSales =
    persisted.result && Number.isFinite(persisted.result.total)
      ? persisted.result
      : null;

  let contracts =
    readJson(CONTRACTS_KEY) ||
    persisted.contracts ||
    { tech: 0, casa: 0 };

  contracts = {
    tech: clampCount(contracts.tech),
    casa: clampCount(contracts.casa)
  };

  let running = false;
  let workflowToken = 0;
  let statusOverride = '';
  let scanTimer = null;

  $('#techCount').value = String(contracts.tech);
  $('#casaCount').value = String(contracts.casa);

  $('#techCount').addEventListener('change', () => {
    if (!saveContracts()) {
      statusOverride =
        'Introduz um número inteiro entre 0 e 10 para Tech e Casa.';
    } else {
      statusOverride = '';
    }

    render();
  });

  $('#casaCount').addEventListener('change', () => {
    if (!saveContracts()) {
      statusOverride =
        'Introduz um número inteiro entre 0 e 10 para Tech e Casa.';
    } else {
      statusOverride = '';
    }

    render();
  });

  $('#calculateBtn').addEventListener('click', runCalculation);

  $('#clearBtn').addEventListener('click', () => {
    workflowToken++;
    running = false;
    savedSales = null;
    setPersistentState(false, null);

    statusOverride =
      'Resultado das vendas apagado. O objetivo e os contratos escolhidos foram mantidos.';

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
    let changed = false;
    const found = findProgress();

    if (
      found &&
      (
        !progress ||
        progress.current !== found.current ||
        progress.goal !== found.goal
      )
    ) {
      saveProgress(found.current, found.goal);
      changed = true;
    }

    const foundBalances = findCoinBalances();

    if (
      foundBalances.gold !== coinBalances.gold ||
      foundBalances.silver !== coinBalances.silver
    ) {
      coinBalances = foundBalances;
      changed = true;
    }

    if (changed) render();
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

  if (persisted.pending) {
    setTimeout(() => runCalculation(), 500);
  }
})();
