```javascript
// ==UserScript==
// @name         Worten Q Trigger - Senha Mais Antiga DSP
// @namespace    http://tampermonkey.net/
// @version      4.8
// @match        https://queuemanager-q-trigger.worten.site/*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const BOTAO_ID = 'btn-chamar-mais-antiga';
    const WRAPPER_ID = 'wrapper-botoes-lado-a-lado';
    const ESTILO_ID = 'dsp-animations-style';
    const INTERVALO_REINICIO = 60000;

    let aChamar = false;
    let resetAgendado = false;
    let tentouAtivarTipologia = false;
    let ultimaAssinatura = '';
    let temporizadorObserver = null;
    let observerAtivo = false;

    const normalizar = texto => String(texto || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();

    function visivel(el) {
        return !!(
            el &&
            el.isConnected &&
            (el.offsetWidth || el.offsetHeight ||
             el.getClientRects().length)
        );
    }

    // Converte os tempos para segundos.
    function paraSegundos(texto) {
        const valor = normalizar(texto).replace(/,/g, '.');
        if (!valor) return null;

        const relogio = valor.match(
            /(\d{1,4}:\d{1,2}(?::\d{1,2})?)/
        );

        if (relogio) {
            const partes = relogio[1].split(':').map(Number);

            if (partes.some(n => !Number.isFinite(n) || n < 0)) {
                return null;
            }

            if (partes.length === 3) {
                if (partes[1] >= 60 || partes[2] >= 60) {
                    return null;
                }

                return partes[0] * 3600 +
                    partes[1] * 60 + partes[2];
            }

            if (partes[1] >= 60) return null;

            return partes[0] * 60 + partes[1];
        }

        const unidades =
            /(\d+(?:\.\d+)?)\s*(dias?|d|horas?|hrs?|h|minutos?|mins?|min|segundos?|segs?|secs?|s)\b/g;

        let total = 0;
        let encontrou = false;
        let m;

        while ((m = unidades.exec(valor)) !== null) {
            const n = Number(m[1]);
            const u = m[2];

            if (!Number.isFinite(n)) continue;

            if (['d', 'dia', 'dias'].includes(u)) {
                total += n * 86400;
            } else if (
                ['h', 'hr', 'hrs', 'hora', 'horas'].includes(u)
            ) {
                total += n * 3600;
            } else if (
                ['min', 'mins', 'minuto', 'minutos'].includes(u)
            ) {
                total += n * 60;
            } else {
                total += n;
            }

            encontrou = true;
        }

        return encontrou ? Math.round(total) : null;
    }

    // Lê as senhas de todas as tipologias.
    function lerSenhas() {
        const raiz = document.querySelector(
            '.waiting-tickets-expanded'
        );

        if (!raiz) {
            return {
                senhas: [],
                invalidas: [],
                filaEncontrada: false
            };
        }

        const senhas = [];
        const invalidas = [];

        raiz.querySelectorAll(
            '.typology-column .typology-items .typology-item'
        ).forEach(el => {
            if (!visivel(el)) return;

            const codigo = (
                el.querySelector('.typology-code')?.textContent || ''
            ).trim().replace(/\s+/g, '');

            const textoTempo = (
                el.querySelector('.typology-time')?.textContent || ''
            ).trim();

            if (!codigo && !textoTempo) return;

            const segundos = paraSegundos(textoTempo);
            const coluna = el.closest('.typology-column');

            if (!codigo || !textoTempo || segundos === null) {
                invalidas.push({ codigo, textoTempo });
                return;
            }

            senhas.push({
                codigo,
                textoTempo,
                segundos,
                tipologia: (
                    coluna?.querySelector('.typology-header')?.textContent || ''
                ).trim()
            });
        });

        return { senhas, invalidas, filaEncontrada: true };
    }

    // Prioridade:
    // 1. Senhas E, se existirem.
    // 2. Dentro das senhas E, maior tempo de espera.
    // 3. Se não existirem senhas E, maior tempo de espera global.
    function obterMaisAntiga() {
        const dados = lerSenhas();

        if (!dados.filaEncontrada) {
            return {
                senha: null,
                senhas: [],
                erro: 'A lista de senhas ainda não está carregada.'
            };
        }

        if (dados.invalidas.length) {
            return {
                senha: null,
                senhas: dados.senhas,
                erro: 'Há senhas com tempos não reconhecidos.'
            };
        }

        // Aceita códigos como E001 e E 001.
        const senhasE = dados.senhas.filter(s =>
            /^E\d/i.test(s.codigo.replace(/\s+/g, ''))
        );

        // Se houver senhas E, ignora as restantes para a seleção.
        const candidatas = senhasE.length > 0
            ? senhasE
            : dados.senhas;

        let maior = null;

        for (const senha of candidatas) {
            if (!maior || senha.segundos > maior.segundos) {
                maior = senha;
            }
        }

        return {
            senha: maior,
            senhas: dados.senhas,
            erro: null
        };
    }

    // Animação DSP e bilhete a ser puxado.
    function instalarAnimacoes() {
        if (document.getElementById(ESTILO_ID)) return;

        const style = document.createElement('style');
        style.id = ESTILO_ID;

        style.textContent = `
            @keyframes dspPass {
                0%,82% {
                    left:0%;
                    opacity:0;
                    transform:translateX(-110%);
                }
                84% { opacity:.12; }
                91% {
                    left:100%;
                    opacity:.20;
                    transform:translateX(-100%);
                }
                93%,100% {
                    left:100%;
                    opacity:0;
                    transform:translateX(0);
                }
            }

            #${BOTAO_ID}::after {
                content:"dsp";
                position:absolute;
                top:5px;
                left:0;
                z-index:2;
                pointer-events:none;
                font-size:9px;
                font-weight:800;
                letter-spacing:2px;
                color:rgba(59,43,0,.32);
                opacity:0;
                animation:dspPass 18s linear infinite;
            }

            @keyframes dspTicketPull {
                0% {
                    opacity:0;
                    transform:translate(-50%,-50%)
                               translate(0,12px) scale(.65) rotate(0);
                }
                18% {
                    opacity:1;
                    transform:translate(-50%,-50%)
                               translate(0,0) scale(1) rotate(-2deg);
                }
                45% {
                    opacity:1;
                    transform:translate(-50%,-50%)
                               translate(30px,-35px) scale(.94) rotate(5deg);
                }
                100% {
                    opacity:0;
                    transform:translate(-50%,-50%)
                               translate(125px,-125px) scale(.72) rotate(16deg);
                }
            }

            .dsp-ticket-flight {
                position:fixed;
                z-index:2147483647;
                width:142px;
                height:46px;
                box-sizing:border-box;
                display:flex;
                align-items:center;
                justify-content:space-between;
                gap:8px;
                padding:7px 12px;
                background:linear-gradient(135deg,#fffdf1,#f6df9a);
                color:#503a08;
                border:1px solid #b38728;
                border-radius:5px;
                box-shadow:0 8px 20px rgba(0,0,0,.20);
                pointer-events:none;
                animation:dspTicketPull 900ms cubic-bezier(.22,.72,.24,1) forwards;
            }

            .dsp-ticket-flight::after {
                content:"";
                position:absolute;
                top:5px;
                bottom:5px;
                left:48px;
                border-left:1px dashed rgba(80,58,8,.4);
            }

            .dsp-ticket-label {
                font-size:8px;
                font-weight:700;
                letter-spacing:1px;
            }

            .dsp-ticket-code {
                font-size:15px;
                font-weight:900;
            }

            @media (prefers-reduced-motion: reduce) {
                #${BOTAO_ID}::after {
                    animation:none;
                    display:none;
                }

                .dsp-ticket-flight {
                    animation-duration:1ms;
                }
            }
        `;

        document.head.appendChild(style);
    }

    function animarSenhaPuxada(codigo) {
        instalarAnimacoes();

        const botao = document.getElementById(BOTAO_ID);
        if (!botao) return;

        const rect = botao.getBoundingClientRect();
        const ticket = document.createElement('div');

        ticket.className = 'dsp-ticket-flight';
        ticket.style.left = `${rect.left + rect.width / 2}px`;
        ticket.style.top = `${rect.top + rect.height / 2}px`;

        const label = document.createElement('span');
        label.className = 'dsp-ticket-label';
        label.textContent = 'SENHA';

        const codigoElemento = document.createElement('span');
        codigoElemento.className = 'dsp-ticket-code';
        codigoElemento.textContent = codigo;

        ticket.append(label, codigoElemento);
        document.body.appendChild(ticket);

        ticket.addEventListener('animationend', () => ticket.remove(), {
            once: true
        });

        setTimeout(() => ticket.remove(), 1500);
    }

    function atualizarTextoBotao() {
        const botao = document.getElementById(BOTAO_ID);

        if (!botao || aChamar) return;

        const resultado = obterMaisAntiga();

        if (resultado.erro) {
            botao.textContent = '⚠️ A verificar fila';
            botao.title = resultado.erro;
            botao.disabled = true;
            return;
        }

        if (!resultado.senha) {
            botao.textContent = '⭐ Sem senhas em espera ⭐';
            botao.title = 'Não foram encontradas senhas.';
            botao.disabled = true;
            return;
        }

        const s = resultado.senha;
        const prioridadeE = /^E\d/i.test(
            s.codigo.replace(/\s+/g, '')
        );

        botao.textContent =
            `⭐ Chamar mais antiga (${s.codigo} - ${s.textoTempo}) ⭐`;

        botao.title =
            `${prioridadeE ? 'Prioridade: senha E' : 'Maior tempo de espera'}\n` +
            `${s.tipologia}\nTempo: ${s.textoTempo} (${s.segundos} segundos)`;

        botao.disabled = false;
    }

    function encontrarInputManual() {
        const inputs = Array.from(document.querySelectorAll(
            'input[type="text"], input:not([type]), input[type="search"]'
        )).filter(el =>
            visivel(el) && !el.disabled && !el.readOnly
        );

        return inputs.find(el => {
            const info = normalizar([
                el.placeholder,
                el.name,
                el.id,
                el.getAttribute('aria-label')
            ].join(' '));

            return info.includes('senha') || info.includes('codigo');
        }) || inputs[0] || null;
    }

    function preencherInput(input, valor) {
        const setter = Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype, 'value'
        )?.set;

        if (setter) setter.call(input, valor);
        else input.value = valor;

        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function chamarSenha() {
        if (aChamar) return;

        // Reanalisa a fila imediatamente antes da chamada.
        const resultado = obterMaisAntiga();

        console.table(resultado.senhas.map(s => ({
            senha: s.codigo,
            tipologia: s.tipologia,
            tempo: s.textoTempo,
            segundos: s.segundos
        })));

        if (resultado.erro) {
            alert(resultado.erro + '\nA chamada foi cancelada.');
            atualizarTextoBotao();
            return;
        }

        if (!resultado.senha) {
            alert('Não existem senhas em espera.');
            atualizarTextoBotao();
            return;
        }

        const senha = resultado.senha;
        const codigo = senha.codigo;

        console.log(
            'SENHA ESCOLHIDA:',
            codigo,
            '| TEMPO:',
            senha.textoTempo,
            '| SEGUNDOS:',
            senha.segundos
        );

        const input = encontrarInputManual();

        if (!input) {
            alert('Não foi encontrada a caixa da senha manual.');
            return;
        }

        aChamar = true;
        animarSenhaPuxada(codigo);

        const botao = document.getElementById(BOTAO_ID);

        if (botao) {
            botao.disabled = true;
            botao.textContent = `A preparar a chamada: ${codigo}`;
        }

        preencherInput(input, codigo);

        // Pequena pausa para o site processar o campo.
        setTimeout(() => tentarClicarTelefone(codigo, 0), 200);
    }

    function tentarClicarTelefone(codigo, tentativa) {
        const telefone = document.querySelector('button.manual-button');

        if (!telefone || !visivel(telefone)) {
            terminarComErro(
                'Não foi encontrado o botão manual do telefone.'
            );
            return;
        }

        if (telefone.disabled) {
            if (tentativa < 20) {
                setTimeout(
                    () => tentarClicarTelefone(codigo, tentativa + 1),
                    100
                );
                return;
            }

            terminarComErro(
                'O botão do telefone continuou desativado. ' +
                'Verifica se o código foi aceite.'
            );
            return;
        }

        telefone.click();

        console.log('Clique no telefone para a senha:', codigo);

        setTimeout(() => {
            aChamar = false;
            atualizarTextoBotao();
        }, 1500);
    }

    function terminarComErro(mensagem) {
        aChamar = false;
        atualizarTextoBotao();
        alert(mensagem);
    }

    // Restaura o botão nativo antes de remover a sobreposição.
    function removerSobreposicao() {
        const wrapper = document.getElementById(WRAPPER_ID);
        const personalizado = document.getElementById(BOTAO_ID);

        if (personalizado) personalizado.remove();
        if (!wrapper) return;

        const nativo = wrapper.querySelector(
            'button.primary.action-button, button.primary'
        );

        if (nativo && wrapper.parentNode) {
            const estado = nativo._dspOriginalState;

            wrapper.parentNode.insertBefore(nativo, wrapper);
            wrapper.remove();

            if (estado) {
                nativo.style.cssText = estado.style;
                nativo.disabled = estado.disabled;

                if (estado.tabindex === null) {
                    nativo.removeAttribute('tabindex');
                } else {
                    nativo.setAttribute('tabindex', estado.tabindex);
                }

                if (estado.ariaHidden === null) {
                    nativo.removeAttribute('aria-hidden');
                } else {
                    nativo.setAttribute('aria-hidden', estado.ariaHidden);
                }

                delete nativo._dspOriginalState;
            } else {
                nativo.style.removeProperty('opacity');
                nativo.style.removeProperty('pointer-events');
                nativo.disabled = false;
                nativo.removeAttribute('aria-hidden');
                nativo.removeAttribute('tabindex');
            }
        } else {
            wrapper.remove();
        }
    }

    // Cria ou reconstrói o botão sobreposto.
    function garantirSobreposicao() {
        const painel = document.querySelector('#call-actions-container');
        if (!painel) return;

        const nativo =
            painel.querySelector('button.primary.action-button') ||
            painel.querySelector('button.primary');

        if (!nativo) return;

        let wrapper = document.getElementById(WRAPPER_ID);
        let personalizado = document.getElementById(BOTAO_ID);

        if (
            wrapper &&
            (!wrapper.isConnected || !wrapper.contains(nativo))
        ) {
            wrapper.remove();
            wrapper = null;
            personalizado = null;
        }

        if (!wrapper) {
            wrapper = document.createElement('div');
            wrapper.id = WRAPPER_ID;

            Object.assign(wrapper.style, {
                position: 'relative',
                display: 'block',
                width: '100%',
                padding: '0',
                margin: '0'
            });

            nativo.parentNode.insertBefore(wrapper, nativo);
            wrapper.appendChild(nativo);
        }

        // Guarda o estado original uma única vez.
        if (!nativo._dspOriginalState) {
            nativo._dspOriginalState = {
                style: nativo.style.cssText,
                disabled: nativo.disabled,
                tabindex: nativo.getAttribute('tabindex'),
                ariaHidden: nativo.getAttribute('aria-hidden')
            };
        }

        Object.assign(nativo.style, {
            display: 'block',
            width: '100%',
            boxSizing: 'border-box',
            margin: '0',
            opacity: '0',
            pointerEvents: 'none'
        });

        nativo.disabled = true;
        nativo.tabIndex = -1;
        nativo.setAttribute('aria-hidden', 'true');

        if (!personalizado || !personalizado.isConnected) {
            personalizado = document.createElement('button');
            personalizado.id = BOTAO_ID;
            personalizado.type = 'button';

            Object.assign(personalizado.style, {
                position: 'absolute',
                inset: '0',
                zIndex: '1000',
                boxSizing: 'border-box',
                width: '100%',
                height: '100%',
                margin: '0',
                padding: '12px 10px',
                overflow: 'hidden',
                background:
                    'linear-gradient(135deg,#bf953f 0%,#fcf6ba 25%,#b38728 50%,#fbf5b7 75%,#aa771c 100%)',
                color: '#3b2b00',
                fontWeight: 'bold',
                fontSize: '11px',
                border: '1px solid #967117',
                borderRadius: '4px',
                boxShadow: '0 2px 4px rgba(0,0,0,.15)',
                cursor: 'pointer',
                whiteSpace: 'normal'
            });

            personalizado.addEventListener('click', chamarSenha);
            wrapper.appendChild(personalizado);
        }

        instalarAnimacoes();
    }

    // Não volta a clicar no seletor se a tipologia já estiver visível.
    function verificarEAtivarTipologia() {
        const area = document.querySelector('.waiting-tickets-expanded');

        if (area) {
            const colunasVisiveis = Array.from(
                area.querySelectorAll('.typology-column')
            ).some(visivel);

            if (colunasVisiveis) {
                tentouAtivarTipologia = true;
                return;
            }
        }

        if (tentouAtivarTipologia) return;

        const candidatos = Array.from(document.querySelectorAll(
            'button, a, [role="button"]'
        )).filter(el => {
            const t = normalizar(el.innerText);

            return visivel(el) &&
                !t.includes('fechar') &&
                (
                    t.includes('ver senhas por tipologia') ||
                    (t.includes('tipologia') && t.includes('ver'))
                );
        }).sort((a, b) =>
            (a.innerText || '').length - (b.innerText || '').length
        );

        if (candidatos.length) {
            tentouAtivarTipologia = true;
            candidatos[0].click();
        }
    }

    function processarPagina() {
        verificarEAtivarTipologia();
        garantirSobreposicao();

        const dados = lerSenhas();

        const assinatura = JSON.stringify({
            filaEncontrada: dados.filaEncontrada,
            senhas: dados.senhas.map(s => [
                s.codigo, s.segundos, s.tipologia
            ]),
            invalidas: dados.invalidas
        });

        const botao = document.getElementById(BOTAO_ID);
        const botaoNovo = botao && botao.dataset.needsUpdate === '1';

        if (assinatura !== ultimaAssinatura || botaoNovo) {
            ultimaAssinatura = assinatura;

            if (botao) delete botao.dataset.needsUpdate;

            atualizarTextoBotao();
        }
    }

    const observer = new MutationObserver(() => {
        if (temporizadorObserver) return;

        temporizadorObserver = setTimeout(() => {
            temporizadorObserver = null;
            processarPagina();
        }, 150);
    });

    function iniciarObservador() {
        if (!document.body || observerAtivo) return;

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
        });

        observerAtivo = true;
    }

    function pararObservador() {
        observer.disconnect();
        observerAtivo = false;

        if (temporizadorObserver) {
            clearTimeout(temporizadorObserver);
            temporizadorObserver = null;
        }
    }

    // Reinicia apenas o estado e a interface do userscript.
    // Não recarrega a página nem altera o estado do site no servidor.
    function reiniciarScript() {
        if (aChamar) return false;

        pararObservador();

        removerSobreposicao();

        document.querySelectorAll('.dsp-ticket-flight').forEach(el => {
            el.remove();
        });

        tentouAtivarTipologia = false;
        ultimaAssinatura = '';

        const estilo = document.getElementById(ESTILO_ID);
        if (estilo) estilo.remove();

        processarPagina();
        iniciarObservador();

        console.log(
            '[Worten DSP] Script reinicializado. Fila reanalisada.'
        );

        return true;
    }

    // Agenda a reinicialização sem interromper uma chamada em curso.
    function agendarReinicio(atraso = 0) {
        if (resetAgendado) return;

        resetAgendado = true;

        function executar() {
            if (aChamar) {
                setTimeout(executar, 1000);
                return;
            }

            try {
                reiniciarScript();
            } finally {
                resetAgendado = false;
            }
        }

        setTimeout(executar, atraso);
    }

    // Reinicialização periódica: sem location.reload().
    setInterval(() => {
        agendarReinicio();
    }, INTERVALO_REINICIO);

    // Reinicializa após terminar o atendimento.
    document.addEventListener('click', event => {
        const alvo = event.target.closest('button, a');
        if (!alvo) return;

        if (normalizar(alvo.innerText).includes('terminar')) {
            agendarReinicio(1500);
        }
    });

    // Primeira execução.
    setTimeout(() => {
        processarPagina();
        iniciarObservador();
    }, 1500);

})();
```
