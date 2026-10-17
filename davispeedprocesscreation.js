
 // ==UserScript==
 // @name         Davispeed Process Creation
 // @namespace    https://www.worten.pt/
 // @version      0.5.6
 // @description  Assistente de preenchimento da Worten Resolve
 // @match        *://www.worten.pt/resolve/forms/*
 // @match        *://*.worten.pt/resolve/forms/*
 // @match        *://bookingcenter.worten.site/*
 // @match        *://*.bookingcenter.worten.site/*
 // @run-at       document-idle
 // @grant        GM_getValue
 // @grant        GM_setValue
 // ==/UserScript==

 (() => {
   'use strict';

   const STORE = 'davispeedProcessCreationState_v3';
   const MAX_PHYSICAL_RETRIES = 3;
   const MAX_NEXT_RETRIES = 3;

   const CONDITIONS = [
     'Sem danos com sinais de uso',
     'Com danos'
   ];

   const PROBLEMS = [
     'Não liga',
     'Não dá imagem',
     'Não tem som',
     'Não carrega',
     'Problema de bateria',
     'Problema de ecrã',
     'Ecrã partido',
     'Problema de ligação/rede',
     'Sobreaquece',
     'Ruído anormal',
     'Outro (especificar)'
   ];

   const PROBLEM_TEXT = {
     'Não liga': 'O equipamento não liga.',
     'Não dá imagem': 'O equipamento não apresenta imagem.',
     'Não tem som': 'O equipamento não apresenta som.',
     'Não carrega': 'O equipamento não carrega.',
     'Problema de bateria': 'O equipamento apresenta um problema de bateria.',
     'Problema de ecrã': 'O equipamento apresenta um problema no ecrã.',
     'Ecrã partido': 'O equipamento apresenta o ecrã partido/danificado.',
     'Problema de ligação/rede': 'O equipamento apresenta problemas de ligação/rede.',
     'Sobreaquece': 'O equipamento sobreaquece durante a utilização.',
     'Ruído anormal': 'O equipamento apresenta ruídos anormais durante a utilização.',
     'Outro (especificar)': 'Descreve a anomalia observada.'
   };

   const DEFAULTS = {
     serial: '',
     condition: CONDITIONS[0],
     extraPhysicalDetails: '',
     accessories: 'Não',
     accessoryDetails: '',
     problem: PROBLEMS[0],
     otherProblem: '',
     autoContinue: false
   };

   let state = { ...DEFAULTS };
   let ui = null;
   let running = false;
   let stopRequested = false;
   let resumePending = false;
   let physicalRetryCount = 0;
   let nextRetryCount = 0;

   const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
   const norm = s => String(s ?? '').replace(/\s+/g, ' ').trim();
   const lower = s => norm(s).toLocaleLowerCase('pt-PT');
   const txt = el => norm(el?.innerText || el?.textContent || '');
   const bodyText = () => norm(document.body?.innerText || '');

   function visible(el) {
     if (!el || !el.isConnected) return false;

     const css = getComputedStyle(el);
     const r = el.getBoundingClientRect();

     return css.display !== 'none'
       && css.visibility !== 'hidden'
       && Number(css.opacity) !== 0
       && r.width > 0
       && r.height > 0;
   }

   function visibleInputs() {
     return [...document.querySelectorAll('input,textarea,select')].filter(visible);
   }

   function headings() {
     return [...document.querySelectorAll('h1,h2,h3,h4,[role="heading"]')]
       .filter(visible)
       .map(txt)
       .join(' | ');
   }

   async function loadState() {
     try {
       if (typeof GM_getValue === 'function') {
         const saved = await GM_getValue(STORE, '');

         if (saved) {
           return {
             ...DEFAULTS,
             ...(typeof saved === 'string' ? JSON.parse(saved) : saved)
           };
         }
       }
     } catch (e) {
       console.warn('[Davispeed] Erro ao carregar:', e);
     }

     try {
       const saved = localStorage.getItem(STORE);

       if (saved) return { ...DEFAULTS, ...JSON.parse(saved) };
     } catch (e) {
       console.warn('[Davispeed] Erro no armazenamento local:', e);
     }

     return { ...DEFAULTS };
   }

   async function saveState() {
     try {
       if (typeof GM_setValue === 'function') {
         await GM_setValue(STORE, JSON.stringify(state));
         return;
       }
     } catch (e) {
       console.warn('[Davispeed] Erro ao guardar:', e);
     }

     try {
       localStorage.setItem(STORE, JSON.stringify(state));
     } catch (e) {
       console.warn('[Davispeed] Não foi possível guardar os dados:', e);
     }
   }

   function readPanel() {
     if (!ui) return;

     state.serial = ui.serial.value.trim();
     state.condition = ui.condition.value;
     state.extraPhysicalDetails = ui.extraPhysicalDetails.value.trim();
     state.accessories = ui.accessories.value;
     state.accessoryDetails = ui.accessoryDetails.value.trim();
     state.problem = ui.problem.value;
     state.otherProblem = ui.otherProblem.value.trim();
   }

   async function savePanel() {
     readPanel();
     await saveState();
   }

   function status(message, kind = 'info') {
     if (!ui?.status) return;

     ui.status.textContent = message;
     ui.status.dataset.kind = kind;
   }

   function fieldContext(el) {
     const parts = [
       el.getAttribute('aria-label'),
       el.getAttribute('placeholder'),
       el.getAttribute('name'),
       el.id,
       el.getAttribute('type')
     ];

     if (el.id) {
       const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
       if (label) parts.push(txt(label));
     }

     let node = el.parentElement;

     for (let i = 0; node && i < 3; i++, node = node.parentElement) {
       const text = txt(node);
       if (text && text.length < 220) parts.push(text);
     }

     return lower(parts.filter(Boolean).join(' '));
   }

   function setNativeValue(el, value) {
     if (!el) return false;

     const proto = el instanceof HTMLTextAreaElement
       ? HTMLTextAreaElement.prototype
       : el instanceof HTMLSelectElement
         ? HTMLSelectElement.prototype
         : HTMLInputElement.prototype;

     const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;

     try {
       el._valueTracker?.setValue(String(el.value ?? ''));
     } catch (_) {}

     if (setter) setter.call(el, String(value ?? ''));
     else el.value = String(value ?? '');

     try {
       el.dispatchEvent(new InputEvent('input', {
         bubbles: true,
         composed: true,
         inputType: 'insertText',
         data: String(value ?? '')
       }));
     } catch (_) {
       el.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
     }

     el.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
     return true;
   }

   function findSerialInput() {
     const fields = visibleInputs().filter(el =>
       el.matches('input:not([type="hidden"]):not([type="email"]),textarea')
     );

     const found = fields.find(el =>
       /n[uú]mero de s[eé]rie|imei|serial/.test(fieldContext(el))
     );

     if (found) return found;

     if (/insere o n[uú]mero de s[eé]rie|imei/.test(lower(headings()))) {
       return fields.find(el =>
         el instanceof HTMLInputElement && /^(text|search|tel)$/i.test(el.type)
       ) || null;
     }

     return null;
   }

   function exactOption(label) {
     const wanted = lower(label);

     return [...document.querySelectorAll(
       'span,button,label,[role="option"],[role="button"],[role="radio"],div'
     )]
       .filter(visible)
       .filter(el => lower(txt(el)) === wanted)
       .sort((a, b) =>
         Number(a.children.length !== 0) - Number(b.children.length !== 0)
       )[0] || null;
   }

   function clickChoice(label) {
     const wanted = lower(label);

     if (wanted === 'loja') {
       const span = [...document.querySelectorAll('div.sc-fedTIj span.sc-dxUMQK')]
         .filter(visible)
         .find(el => lower(txt(el)) === 'loja');

       if (span) {
         const card = span.closest('div.sc-fedTIj');

         if (card && visible(card)) {
           card.scrollIntoView({ block: 'center', behavior: 'auto' });
           card.click();
           console.log('[Davispeed] Clique no cartão Loja.', card);
           return true;
         }
       }
     }

     const el = exactOption(label);
     if (!el) return false;

     const target =
       el.closest('div.sc-fedTIj') ||
       el.closest('[role="radio"]') ||
       el.closest('button,label,[role="button"],[tabindex]') ||
       el.parentElement ||
       el;

     target.click();
     console.log(`[Davispeed] Opção "${label}" selecionada.`, target);
     return true;
   }

   // Procura o botão Seguinte ativo na página da Worten.
   function clickNext() {
     const candidates = [
       ...document.querySelectorAll('button'),
       ...document.querySelectorAll('[role="button"]')
     ];

     const button = candidates.find(el => {
       if (!visible(el)) return false;

       const label = norm(
         el.innerText || el.textContent || el.getAttribute('aria-label') || ''
       );

       return /^seguinte$/i.test(label)
         && !el.disabled
         && el.getAttribute('aria-disabled') !== 'true';
     });

     if (!button) {
       console.warn('[Davispeed] Botão Seguinte não encontrado ou inativo.');
       return false;
     }

     button.scrollIntoView({ block: 'center', behavior: 'auto' });
     button.click();

     // Um clique bem-sucedido em Seguinte reinicia o contador desta falha.
     nextRetryCount = 0;

     console.log('[Davispeed] Botão Seguinte clicado.', button);
     return true;
   }

   function isCustomerStep() {
     const h = lower(headings());

     if (/dados do cliente|dados pessoais|identifica[cç][aã]o do cliente|email e dados|e-?mail do cliente/.test(h)) {
       return true;
     }

     if (visibleInputs().some(el =>
       el instanceof HTMLInputElement && el.type === 'email'
     )) return true;

     return visibleInputs().some(el =>
       /e-?mail|nome do cliente|telefone do cliente|telem[oó]vel do cliente/.test(fieldContext(el))
     ) && /cliente|email|e-mail|contacto|contato/.test(lower(bodyText().slice(0, 900)));
   }

   function detectStage() {
     if (isCustomerStep()) return 'customer';

     const combined = lower(headings() + ' ' + bodyText().slice(0, 1200));

     if (/servi[cç]o de entrega e recolha\s*\(woc\)/i.test(combined)) return 'woc';
     if (/localiza[cç][aã]o f[ií]sica do artigo/.test(combined)) return 'origin';
     if (/\banexos\b|adicione imagens ao seu pedido/.test(combined)) return 'attachments';

     if (/indique informa[cç][aã]o adicional relevante que possa ajudar na realiza[cç][aã]o do servi[cç]o/.test(combined)) {
       return 'additional';
     }

     if (/descreve o estado f[ií]sico do equipamento/.test(combined)) return 'physical';
     if (/descreve o\(s\) acess[oó]rio\(s\)|acess[oó]rios/.test(combined)) return 'accessories';

     if (/indique os problemas com o seu equipamento|anomalia|problemas com o seu equipamento/.test(combined)) {
       return 'anomaly';
     }

     if (/qual o estado do produto\??/.test(combined) ||
       (exactOption(CONDITIONS[0]) && exactOption(CONDITIONS[1]))) {
       return 'condition';
     }

     if (/insere o n[uú]mero de s[eé]rie|imei/.test(combined) && findSerialInput()) {
       return 'serial';
     }

     const physical = document.querySelector('textarea[name="4228"]');
     if (physical && visible(physical)) return 'physical';

     const accessories = document.querySelector('textarea[name="4682"]');
     if (accessories && visible(accessories)) return 'accessories';

     const anomaly = document.querySelector('textarea[name="4215"]');
     if (anomaly && visible(anomaly)) return 'anomaly';

     return 'unknown';
   }

   function missingRequiredFields() {
     const missing = [];

     if (!ui.serial.value.trim()) missing.push('Nº Série / IMEI');
     if (!CONDITIONS.includes(ui.condition.value)) missing.push('estado do produto');
     if (!ui.extraPhysicalDetails.value.trim()) missing.push('Detalhes do estado físico');
     if (!['Sim', 'Não'].includes(ui.accessories.value)) missing.push('indicação de acessórios');

     if (ui.accessories.value === 'Sim' && !ui.accessoryDetails.value.trim()) {
       missing.push('descrição dos acessórios');
     }

     if (!PROBLEMS.includes(ui.problem.value)) missing.push('Anomalia');
     if (!ui.otherProblem.value.trim()) missing.push('Detalhes adicionais da anomalia');

     return missing;
   }

   function syncStartButton() {
     if (!ui?.start) return;

     const missing = missingRequiredFields();

     ui.start.disabled = running || missing.length > 0;
     ui.start.title = missing.length
       ? `Preenche os campos obrigatórios: ${missing.join(', ')}`
       : 'Iniciar ou continuar';
   }

   function problemTemplate(problem) {
     return PROBLEM_TEXT[problem] || `O equipamento apresenta a seguinte anomalia: ${problem}.`;
   }

   async function setPageFieldAndConfirm(selector, value, attempts = 12) {
     const wanted = String(value ?? '').trim().slice(0, 300);
     if (!wanted) return null;

     for (let i = 0; i < attempts; i++) {
       if (stopRequested) return null;

       const field = typeof selector === 'function'
         ? selector()
         : document.querySelector(selector);

       if (field && visible(field) && !field.disabled && !field.readOnly) {
         field.scrollIntoView({ block: 'center', behavior: 'auto' });

         try {
           field.focus({ preventScroll: true });
         } catch (_) {
           field.focus();
         }

         setNativeValue(field, wanted);
         await sleep(300);

         const check = typeof selector === 'function'
           ? selector()
           : document.querySelector(selector);

         if (check && visible(check) && String(check.value ?? '').trim() === wanted) {
           return check;
         }
       }

       await sleep(250);
     }

     return null;
   }

   // Para a automação, exceto quando a falha é elegível para retoma.
   async function stop(message, kind = 'warn') {
     const nextUnavailable = /n[aã]o encontrei.*seguinte/i.test(message);

     if (nextUnavailable && !stopRequested) {
       nextRetryCount++;

       if (nextRetryCount <= MAX_NEXT_RETRIES) {
         state.autoContinue = true;
         await saveState();

         status(
           `${message} Vou voltar a clicar em Iniciar / Continuar ` +
           `(tentativa ${nextRetryCount}/${MAX_NEXT_RETRIES})…`,
           'warn'
         );

         // Não limpar resumePending: scheduleResume precisa de continuar ativo.
         scheduleResume(1000);
         return;
       }

       nextRetryCount = 0;
       message += ' Não foi possível encontrar o botão após várias tentativas.';
       kind = 'error';
     }

     state.autoContinue = false;
     resumePending = false;

     await saveState();
     status(message, kind);
   }

   async function waitForAutomaticAdvance(expectedStage, timeout = 12000) {
     const until = Date.now() + timeout;

     while (Date.now() < until) {
       if (stopRequested) return 'stopped';
       await sleep(250);

       const currentStage = detectStage();

       if (currentStage !== expectedStage && currentStage !== 'unknown') {
         return 'advanced';
       }
     }

     return 'timeout';
   }

   async function waitForChange(oldStage, timeout = 10000) {
     const until = Date.now() + timeout;

     while (Date.now() < until) {
       if (stopRequested) return false;
       await sleep(250);

       const currentStage = detectStage();

       if (currentStage !== oldStage && currentStage !== 'unknown') return true;
     }

     return false;
   }

   async function advance(oldStage) {
     await savePanel();
     await sleep(150);

     if (detectStage() === oldStage && !clickNext()) {
       await stop('Não encontrei o botão Seguinte ativo.', 'warn');
       return false;
     }

     if (!await waitForChange(oldStage)) {
       await stop('O portal não confirmou a mudança de etapa. Verifica se existe uma validação.', 'warn');
       return false;
     }

     return true;
   }

   // Retoma pelo botão real do painel após terminar a execução atual.
   function scheduleResume(delay = 1000) {
     if (resumePending || stopRequested || !ui) return;

     resumePending = true;

     const attemptClick = () => {
       if (stopRequested || !ui) {
         resumePending = false;
         return;
       }

       // run() ainda está ativo; espera que o finally liberte o bloqueio.
       if (running) {
         setTimeout(attemptClick, 300);
         return;
       }

       const missing = missingRequiredFields();

       if (missing.length) {
         resumePending = false;
         status(`Retoma cancelada. Preenche os campos: ${missing.join(', ')}.`, 'warn');
         syncStartButton();
         return;
       }

       syncStartButton();

       if (ui.start.disabled) {
         setTimeout(attemptClick, 300);
         return;
       }

       resumePending = false;
       status('A retomar pelo botão Iniciar / Continuar…', 'success');

       console.log('[Davispeed] A clicar automaticamente em Iniciar / Continuar.');

       // Dispara o evento click do botão dentro do painel do userscript.
       ui.start.click();
     };

     setTimeout(attemptClick, delay);
   }

   // Retoma automaticamente se o campo físico não ficar confirmado
   // ou se o botão Seguinte não for encontrado/aceitar o clique.
   async function retryPhysicalStage(reason) {
     if (stopRequested) return false;

     physicalRetryCount++;

     if (physicalRetryCount > MAX_PHYSICAL_RETRIES) {
       physicalRetryCount = 0;

       await stop(
         `Não foi possível concluir o estado físico após ${MAX_PHYSICAL_RETRIES} tentativas. ${reason}`,
         'error'
       );

       return false;
     }

     await savePanel();

     if (stopRequested) return false;

     status(
       `${reason} Vou voltar a clicar em Iniciar / Continuar ` +
       `(tentativa ${physicalRetryCount}/${MAX_PHYSICAL_RETRIES})…`,
       'warn'
     );

     scheduleResume(1000);
     return true;
   }

   async function run() {
     if (running || !ui) return;

     await savePanel();

     const missing = missingRequiredFields();

     if (missing.length) {
       syncStartButton();
       status(`Preenche os campos obrigatórios: ${missing.join(', ')}.`, 'error');

       const focus = {
         'Nº Série / IMEI': ui.serial,
         'Detalhes do estado físico': ui.extraPhysicalDetails,
         'descrição dos acessórios': ui.accessoryDetails,
         'Detalhes adicionais da anomalia': ui.otherProblem
       };

       (focus[missing[0]] || ui.condition).focus();
       return;
     }

     running = true;
     stopRequested = false;

     syncStartButton();
     ui.stop.disabled = false;

     state.autoContinue = true;
     await saveState();

     status('A preencher o processo…', 'info');

     try {
       for (let step = 0; step < 30; step++) {
         if (stopRequested) {
           await stop('Automação parada pelo utilizador.', 'warn');
           return;
         }

         await sleep(250);

         const stage = detectStage();

         console.log('[Davispeed] Etapa detetada:', stage);

         if (stage === 'customer') {
           physicalRetryCount = 0;
           nextRetryCount = 0;

           await stop('Cheguei aos dados do cliente/email. Parei para preencheres manualmente.', 'success');
           return;
         }

         if (stage === 'serial') {
           const field = findSerialInput();

           if (!field) {
             await stop('Não encontrei o campo de série/IMEI.', 'error');
             return;
           }

           setNativeValue(field, state.serial);
           await sleep(300);

           if (String(field.value || '').trim() !== state.serial.trim()) {
             await stop('Não consegui confirmar o número de série/IMEI.', 'error');
             return;
           }

           if (!clickNext()) {
             await stop('Não encontrei o botão Seguinte na etapa de série/IMEI.', 'warn');
             return;
           }

           if (!await waitForChange('serial')) {
             await stop('A etapa de série/IMEI não avançou.', 'warn');
             return;
           }

           continue;
         }

         if (stage === 'condition') {
           if (!clickChoice(state.condition)) {
             await stop(`Não encontrei a opção "${state.condition}".`, 'error');
             return;
           }

           if (!await advance('condition')) return;
           continue;
         }

         // ESTADO FÍSICO: preenche, confirma e tenta avançar.
         if (stage === 'physical') {
           const description = String(ui.extraPhysicalDetails.value || '')
             .trim()
             .slice(0, 300);

           if (!description) {
             await retryPhysicalStage('A descrição do estado físico está vazia.');
             return;
           }

           const field = await setPageFieldAndConfirm(
             'textarea[name="4228"]',
             description
           );

           if (!field) {
             await retryPhysicalStage(
               'O estado físico não ficou preenchido ou confirmado.'
             );
             return;
           }

           const verify = document.querySelector('textarea[name="4228"]');

           if (
             !verify ||
             !visible(verify) ||
             String(verify.value || '').trim() !== description
           ) {
             await retryPhysicalStage(
               'A caixa do estado físico não contém a descrição esperada.'
             );
             return;
           }

           status('Estado físico preenchido. A aguardar 1 segundo…', 'success');
           await sleep(1000);

           if (stopRequested) {
             await stop('Automação parada pelo utilizador.', 'warn');
             return;
           }

           if (!clickNext()) {
             await retryPhysicalStage('Não encontrei o botão Seguinte ativo.');
             return;
           }

           let currentStage = 'physical';
           const deadline = Date.now() + 5000;

           while (Date.now() < deadline) {
             if (stopRequested) break;

             await sleep(250);
             currentStage = detectStage();

             if (currentStage !== 'physical' && currentStage !== 'unknown') {
               break;
             }
           }

           if (stopRequested) {
             await stop('Automação parada pelo utilizador.', 'warn');
             return;
           }

           if (currentStage === 'physical' || currentStage === 'unknown') {
             await retryPhysicalStage(
               'O portal não confirmou o avanço do estado físico.'
             );
             return;
           }

           physicalRetryCount = 0;

           status(
             'Estado físico concluído. A retomar pelo botão Iniciar / Continuar…',
             'success'
           );

           scheduleResume(1000);
           return;
         }

         if (stage === 'accessories') {
           if (!clickChoice(state.accessories)) {
             await stop(`Não encontrei a opção de acessórios "${state.accessories}".`, 'error');
             return;
           }

           await sleep(300);

           if (state.accessories === 'Sim') {
             const field = await setPageFieldAndConfirm(
               'textarea[name="4682"]',
               state.accessoryDetails
             );

             if (!field) {
               await stop('Não consegui confirmar a descrição dos acessórios.', 'error');
               return;
             }
           }

           if (!await advance('accessories')) return;
           continue;
         }

         if (stage === 'anomaly') {
           const description = String(state.otherProblem || '').trim();

           if (!description) {
             await stop('Preenche os detalhes da anomalia no painel.', 'error');
             return;
           }

           const field = await setPageFieldAndConfirm(
             'textarea[name="4215"]',
             description
           );

           if (!field) {
             await stop('Não consegui confirmar o texto da anomalia na caixa 4215.', 'error');
             return;
           }

           if (!await advance('anomaly')) return;
           continue;
         }

         // LOCALIZAÇÃO FÍSICA: tenta selecionar Loja até 3 vezes.
         if (stage === 'origin') {
           let advanced = false;

           for (let attempt = 1; attempt <= 3; attempt++) {
             if (stopRequested) {
               await stop('Automação parada pelo utilizador.', 'warn');
               return;
             }

             status(`A selecionar Loja (tentativa ${attempt}/3)…`, 'info');

             if (!clickChoice('Loja')) {
               await sleep(500);
               continue;
             }

             await sleep(1000);

             const currentStage = detectStage();

             if (currentStage !== 'origin' && currentStage !== 'unknown') {
               advanced = true;
               break;
             }
           }

           if (!advanced) {
             await stop('Tentei selecionar Loja três vezes, mas não consegui confirmar o avanço.', 'warn');
             return;
           }

           await sleep(500);
           continue;
         }

         // WOC: seleciona Não e aguarda o avanço automático.
         if (stage === 'woc') {
           if (!clickChoice('Não')) {
             await stop('Não consegui selecionar Não na etapa WOC.', 'error');
             return;
           }

           status('WOC: opção Não selecionada. A aguardar o avanço…', 'success');

           const result = await waitForAutomaticAdvance('woc', 12000);

           if (result === 'stopped') {
             await stop('Automação parada pelo utilizador.', 'warn');
             return;
           }

           if (result !== 'advanced') {
             await stop('A opção Não foi selecionada, mas a etapa WOC não avançou.', 'warn');
             return;
           }

           continue;
         }

         // ANEXOS: não carrega ficheiros; clica apenas em Seguinte.
         if (stage === 'attachments') {
           status('Anexos detetados. A avançar sem adicionar imagens…', 'info');

           if (!clickNext()) {
             await stop('Não encontrei o botão Seguinte na etapa Anexos.', 'warn');
             return;
           }

           await sleep(1200);

           let currentStage = detectStage();

           if (currentStage === 'attachments') {
             await sleep(1000);

             if (!clickNext()) {
               await stop('Não encontrei Seguinte na segunda tentativa em Anexos.', 'warn');
               return;
             }

             await sleep(1200);
             currentStage = detectStage();
           }

           if (currentStage === 'attachments' || currentStage === 'unknown') {
             await stop('Não consegui confirmar o avanço da etapa Anexos.', 'warn');
             return;
           }

           continue;
         }

         if (stage === 'additional') {
           if (!clickNext()) {
             await stop('Não encontrei Seguinte na etapa de informação adicional.', 'warn');
             return;
           }

           await sleep(1200);

           if (detectStage() === 'additional') {
             await stop('A etapa de informação adicional continua visível. Verifica se há validações.', 'warn');
             return;
           }

           continue;
         }

         await stop(
           'Não reconheci a etapa atual e parei por segurança. Os dados do painel continuam guardados.',
           'warn'
         );
         return;
       }

       await stop('Atingi o limite de etapas de segurança. Verifica o portal.', 'warn');
     } catch (error) {
       console.error('[Davispeed]', error);
       await stop(`Ocorreu um erro: ${error?.message || error}`, 'error');
     } finally {
       running = false;

       if (ui) {
         syncStartButton();
         ui.stop.disabled = true;
       }

       // Se existir uma retoma pendente, scheduleResume aguardará
       // que running seja false antes de clicar no botão do painel.
     }
   }

   function createUI() {
     const host = document.createElement('div');
     host.id = 'davispeed-process-creation-host';
     host.style.cssText =
       'position:fixed!important;inset:0!important;z-index:2147483647!important;pointer-events:none!important;';

     (document.body || document.documentElement).appendChild(host);

     const shadow = host.attachShadow({ mode: 'open' });

     shadow.innerHTML = `
       <style>
         * { box-sizing: border-box; font-family: Arial, Helvetica, sans-serif; }
         .tab, .panel { pointer-events: auto !important; visibility: visible !important; }

         .tab {
           position: fixed; right: 14px; bottom: 18px; z-index: 2147483646;
           border: 0; border-radius: 999px; padding: 12px 16px;
           background: #142b4a; color: #fff; font-size: 13px; font-weight: 700;
           box-shadow: 0 5px 18px #0004; cursor: pointer;
         }

         .panel {
           position: fixed; top: 4vh; right: 14px;
           width: min(400px, calc(100vw - 28px)); max-height: 92vh;
           overflow: auto; padding: 18px; border: 1px solid #d8dee8;
           border-radius: 14px; background: #fff; color: #172033;
           box-shadow: 0 12px 40px #0003; display: none; font-size: 13px;
         }

         .panel.open { display: block; }
         .head { display: flex; justify-content: space-between; gap: 10px; margin-bottom: 12px; }
         h2 { margin: 0; font-size: 18px; line-height: 1.25; }
         .sub { color: #627089; margin: 5px 0 14px; line-height: 1.4; }

         .close {
           border: 0; background: transparent; font-size: 22px;
           cursor: pointer; color: #617087; padding: 0 4px;
         }

         label { display: block; font-weight: 700; margin: 11px 0 5px; }

         input, select, textarea {
           width: 100%; padding: 9px 10px; border: 1px solid #c8d1de;
           border-radius: 8px; background: #fff; color: #172033; font-size: 13px;
         }

         textarea { min-height: 58px; resize: vertical; }

         input:focus, select:focus, textarea:focus {
           outline: 2px solid #729bd7; border-color: #729bd7;
         }

         .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
         .buttons { display: flex; gap: 8px; margin-top: 16px; }

         .primary, .secondary {
           flex: 1; border: 0; border-radius: 8px; padding: 10px 12px;
           font-weight: 700; cursor: pointer; font-size: 13px;
         }

         .primary { background: #176a48; color: white; }
         .secondary { background: #e8edf3; color: #25364d; }
         button:disabled { opacity: .45; cursor: not-allowed; }

         .required { color: #a12626; font-weight: 700; font-size: 11px; }

         .status {
           padding: 10px; border-radius: 8px; margin-top: 12px;
           background: #eef3fa; color: #314865; line-height: 1.4;
           overflow-wrap: anywhere;
         }

         .status[data-kind="error"] { background: #fff0f0; color: #8b1b1b; }
         .status[data-kind="warn"] { background: #fff7e8; color: #77510c; }
         .status[data-kind="success"] { background: #edf8f1; color: #1f633c; }

         .hint, .foot {
           color: #627089; font-size: 11px; line-height: 1.4; margin-top: 5px;
         }

         .foot { margin-top: 12px; }
       </style>

       <button class="tab" id="toggle" type="button">Davispeed Process Creation</button>

       <section class="panel" id="panel" aria-label="Davispeed Process Creation">
         <div class="head">
           <div>
             <h2>Davispeed Process Creation</h2>
             <div class="sub">Os dados ficam guardados entre etapas.</div>
           </div>
           <button class="close" id="close" type="button" aria-label="Fechar">×</button>
         </div>

         <label for="serial">Nº Série / IMEI <span class="required">(obrigatório)</span></label>
         <input id="serial" required autocomplete="off" placeholder="Introduz o número de série/IMEI" />

         <label for="condition">Qual o estado do produto?</label>
         <select id="condition"></select>

         <label for="extraPhysicalDetails">Detalhes do estado físico <span class="required">(obrigatório)</span></label>
         <textarea id="extraPhysicalDetails" required maxlength="300" rows="3" placeholder="Descreve os sinais de uso ou danos físicos"></textarea>

         <div class="grid">
           <div>
             <label for="accessories">Tem acessórios?</label>
             <select id="accessories"><option>Sim</option><option>Não</option></select>
           </div>
           <div>
             <label for="problem">Anomalia</label>
             <select id="problem"></select>
           </div>
         </div>

         <label for="accessoryDetails">Detalhes dos acessórios <span class="required">(obrigatório se Sim)</span></label>
         <input id="accessoryDetails" placeholder="Ex.: comando, cabo de alimentação" />

         <label for="otherProblem">Detalhes da anomalia <span class="required">(obrigatório)</span></label>
         <textarea id="otherProblem" required maxlength="300" placeholder="Descrição da anomalia; podes editar"></textarea>

         <div class="buttons">
           <button class="primary" id="start" type="button">Iniciar / Continuar</button>
           <button class="secondary" id="stop" type="button" disabled>Parar</button>
         </div>

         <div class="status" id="status" data-kind="info" role="status">Preenche os campos obrigatórios.</div>
         <div class="foot">A automação para nos dados do cliente/email para os preencheres manualmente.</div>
       </section>
     `;

     const $ = id => shadow.getElementById(id);

     for (const value of CONDITIONS) {
       const option = document.createElement('option');
       option.value = value;
       option.textContent = value;
       $('condition').appendChild(option);
     }

     for (const value of PROBLEMS) {
       const option = document.createElement('option');
       option.value = value;
       option.textContent = value;
       $('problem').appendChild(option);
     }

     ui = {
       toggle: $('toggle'),
       panel: $('panel'),
       close: $('close'),
       serial: $('serial'),
       condition: $('condition'),
       extraPhysicalDetails: $('extraPhysicalDetails'),
       accessories: $('accessories'),
       accessoryDetails: $('accessoryDetails'),
       problem: $('problem'),
       otherProblem: $('otherProblem'),
       start: $('start'),
       stop: $('stop'),
       status: $('status')
     };

     ui.toggle.addEventListener('click', () => ui.panel.classList.toggle('open'));
     ui.close.addEventListener('click', () => ui.panel.classList.remove('open'));

     ui.start.addEventListener('click', () => {
       console.log('[Davispeed] Botão Iniciar / Continuar acionado.');
       void run();
     });

     ui.stop.addEventListener('click', async () => {
       stopRequested = true;
       state.autoContinue = false;
       resumePending = false;

       await saveState();

       ui.stop.disabled = true;
       status('Pedido para parar recebido…', 'warn');
     });

     const save = () => {
       syncStartButton();
       void savePanel();
     };

     [
       ui.serial,
       ui.condition,
       ui.extraPhysicalDetails,
       ui.accessoryDetails,
       ui.otherProblem
     ].forEach(el => {
       el.addEventListener('input', save);
       el.addEventListener('change', save);
     });

     ui.accessories.addEventListener('change', () => {
       ui.accessoryDetails.disabled = ui.accessories.value !== 'Sim';
       ui.accessoryDetails.required = ui.accessories.value === 'Sim';

       if (ui.accessories.value !== 'Sim') ui.accessoryDetails.value = '';

       syncStartButton();
       void savePanel();
     });

     ui.problem.addEventListener('change', () => {
       ui.otherProblem.value = problemTemplate(ui.problem.value);
       syncStartButton();
       void savePanel();
     });

     syncStartButton();
   }

   async function boot() {
     if (document.getElementById('davispeed-process-creation-host')) return;

     try {
       createUI();
       status('A carregar os dados guardados…', 'info');

       state = await loadState();
       if (!ui) return;

       ui.serial.value = state.serial || '';

       ui.condition.value = CONDITIONS.includes(state.condition)
         ? state.condition
         : CONDITIONS[0];

       ui.extraPhysicalDetails.value = state.extraPhysicalDetails || '';
       ui.accessories.value = state.accessories === 'Sim' ? 'Sim' : 'Não';
       ui.accessoryDetails.value = state.accessoryDetails || '';
       ui.accessoryDetails.disabled = ui.accessories.value !== 'Sim';
       ui.accessoryDetails.required = ui.accessories.value === 'Sim';

       ui.problem.value = PROBLEMS.includes(state.problem)
         ? state.problem
         : PROBLEMS[0];

       ui.otherProblem.value = state.otherProblem || problemTemplate(ui.problem.value);
       state.otherProblem = ui.otherProblem.value;

       syncStartButton();
       await saveState();

       if (state.autoContinue) {
         const missing = missingRequiredFields();
         ui.panel.classList.add('open');

         if (missing.length) {
           state.autoContinue = false;
           await saveState();

           status(`Continuação pausada. Preenche: ${missing.join(', ')}.`, 'warn');
         } else {
           status('A retomar o preenchimento…', 'info');
           await sleep(800);

           if (state.autoContinue) void run();
         }
       } else {
         const missing = missingRequiredFields();

         status(
           missing.length
             ? `Preenche os campos obrigatórios: ${missing.join(', ')}.`
             : 'Pronto para iniciar.',
           'info'
         );
       }

       syncStartButton();
     } catch (error) {
       console.error('[Davispeed] Erro ao iniciar a interface:', error);
     }
   }

   void boot();

   new MutationObserver(() => {
     if (!document.getElementById('davispeed-process-creation-host')) {
       void boot();
     }
   }).observe(document.documentElement, { childList: true, subtree: true });
 })();
