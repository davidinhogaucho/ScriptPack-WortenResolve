// ==UserScript==
// @name         Worten Q Trigger - Senha Mais Antiga DSP
// @namespace    http://tampermonkey.net/
// @version      4.8
// @description  Prioridade às senhas E, seleção pela maior espera, animação e reinicialização interna.
// @match        https://queuemanager-q-trigger.worten.site/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    // ============================================================
    // CONFIGURAÇÕES
    // ============================================================

    const DSP = {
        intervaloReinicio: 60000,
        atrasoInicial: 1500,
        atrasoDepoisTerminar: 1500,
        tentativasBotaoManual: 25,
        intervaloTentativas: 200,
        seletorFila: '.waiting-tickets-expanded',
        seletorSenha: '.typology-item',
        seletorCodigo: '.typology-code',
        seletorTempo: '.typology-time',
        seletorBotaoNativo: 'button.primary.action-button',
        seletorBotaoManual: 'button.manual-button'
    };

    let observador = null;
    let temporizadorReinicio = null;
    let botaoPersonalizado = null;
    let wrapperBotao = null;
    let processando = false;
    let reiniciando = false;
    let ultimaSenhaSelecionada = null;
    let estiloOriginalBotao = null;
    let botaoNativoGuardado = null;
    let identificadorReinicio = 0;

    // ============================================================
    // FUNÇÕES AUXILIARES
    // ============================================================

    function normalizar(texto) {
        return String(texto || '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function visivel(elemento) {
        if (!elemento || !elemento.isConnected) {
            return false;
        }

        const estilo = window.getComputedStyle(elemento);
        const rect = elemento.getBoundingClientRect();

        return (
            estilo.display !== 'none' &&
            estilo.visibility !== 'hidden' &&
            Number(estilo.opacity) !== 0 &&
            rect.width > 0 &&
            rect.height > 0
        );
    }

    function paraSegundos(texto) {
        if (!texto) {
            return null;
        }

        const valor = normalizar(texto);

        // Formato MM:SS ou HH:MM:SS.
        if (!/^\d{1,3}:\d{2}(:\d{2})?$/.test(valor)) {
            return null;
        }

        const partes = valor.split(':').map(Number);

        if (partes.some(numero => !Number.isFinite(numero))) {
            return null;
        }

        if (partes.length === 2) {
            const [minutos, segundos] = partes;

            if (segundos > 59) {
                return null;
            }

            return minutos * 60 + segundos;
        }

        const [horas, minutos, segundos] = partes;

        if (minutos > 59 || segundos > 59) {
            return null;
        }

        return horas * 3600 + minutos * 60 + segundos;
    }

    function obterTexto(elemento, seletor) {
        const alvo = elemento.querySelector(seletor);
        return alvo ? normalizar(alvo.textContent) : '';
    }

    // ============================================================
    // LER AS SENHAS QUE ESTÃO À ESPERA
    // ============================================================

    function lerSenhas() {
        const fila = document.querySelector(DSP.seletorFila);

        if (!fila || !visivel(fila)) {
            return {
                filaEncontrada: false,
                senhas: [],
                invalidas: []
            };
        }

        const elementos = Array.from(
            fila.querySelectorAll(DSP.seletorSenha)
        );

        const senhas = [];
        const invalidas = [];

        for (const elemento of elementos) {
            if (!visivel(elemento)) {
                continue;
            }

            const codigo = obterTexto(
                elemento,
                DSP.seletorCodigo
            );

            const textoTempo = obterTexto(
                elemento,
                DSP.seletorTempo
            );

            if (!codigo || !textoTempo) {
                continue;
            }

            const segundos = paraSegundos(textoTempo);

            if (segundos === null) {
                invalidas.push({
                    codigo,
                    textoTempo
                });

                continue;
            }

            senhas.push({
                codigo,
                textoTempo,
                segundos,
                elemento
            });
        }

        return {
            filaEncontrada: true,
            senhas,
            invalidas
        };
    }

    // ============================================================
    // ESCOLHER A SENHA
    //
    // PRIORIDADE 1:
    // Se houver senhas E, escolher a E com maior espera.
    //
    // PRIORIDADE 2:
    // Se não houver senhas E, escolher a senha com maior espera.
    // ============================================================

    function obterMaisAntiga() {
        const dados = lerSenhas();

        if (!dados.filaEncontrada) {
            return {
                senha: null,
                senhas: [],
                erro: 'A lista de senhas ainda não está carregada.'
            };
        }

        if (dados.invalidas.length > 0) {
            console.warn(
                '[DSP] Existem senhas com tempos não reconhecidos:',
                dados.invalidas
            );
        }

        if (dados.senhas.length === 0) {
            return {
                senha: null,
                senhas: [],
                erro: dados.invalidas.length
                    ? 'Não foi possível interpretar os tempos das senhas.'
                    : null
            };
        }

        // Identifica as senhas da letra E.
        // Exemplos aceites: E011, E 011, E  011.
        const prioritarias = dados.senhas.filter(senha => {
            const codigoLimpo = senha.codigo.replace(/\s+/g, '');

            return /^E\d+/i.test(codigoLimpo);
        });

        // PRIORIDADE 1: escolher uma senha E, se existir.
        if (prioritarias.length > 0) {
            prioritarias.sort(
                (a, b) => b.segundos - a.segundos
            );

            const selecionada = prioritarias[0];

            console.log(
                '[DSP] Senha prioritária selecionada:',
                selecionada.codigo,
                '| Espera:',
                selecionada.textoTempo
            );

            return {
                senha: selecionada,
                senhas: dados.senhas,
                erro: null
            };
        }

        // PRIORIDADE 2: não existem senhas E.
        // Escolher a senha com o maior tempo de espera.
        let maisAntiga = null;

        for (const senha of dados.senhas) {
            if (
                !maisAntiga ||
                senha.segundos > maisAntiga.segundos
            ) {
                maisAntiga = senha;
            }
        }

        console.log(
            '[DSP] Sem senhas prioritárias. Selecionada:',
            maisAntiga.codigo,
            '| Espera:',
            maisAntiga.textoTempo
        );

        return {
            senha: maisAntiga,
            senhas: dados.senhas,
            erro: null
        };
    }

    // ============================================================
    // ESTILOS E ANIMAÇÕES
    // ============================================================

    function instalarAnimacoes() {
        if (document.getElementById('dsp-estilos')) {
            return;
        }

        const estilo = document.createElement('style');
        estilo.id = 'dsp-estilos';

        estilo.textContent = `
            .dsp-botao-wrapper {
                position: absolute !important;
                z-index: 99999 !important;
                margin: 0 !important;
                padding: 0 !important;
            }

            .dsp-botao-personalizado {
                width: 100% !important;
                height: 100% !important;
                min-height: 38px;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                gap: 8px !important;
                border: none !important;
                border-radius: 6px !important;
                padding: 8px 14px !important;
                font: inherit !important;
                font-weight: 600 !important;
                color: #fff !important;
                background: #1769aa !important;
                cursor: pointer !important;
                box-shadow: 0 2px 5px rgba(0,0,0,.15);
                transition:
                    background .2s ease,
                    transform .15s ease,
                    box-shadow .2s ease;
            }

            .dsp-botao-personalizado:hover {
                background: #12578f !important;
                box-shadow: 0 4px 9px rgba(0,0,0,.2);
            }

            .dsp-botao-personalizado:active {
                transform: scale(.98);
            }

            .dsp-botao-personalizado:disabled {
                opacity: .65 !important;
                cursor: wait !important;
            }

            .dsp-botao-personalizado.dsp-sem-senhas {
                background: #687782 !important;
            }

            .dsp-indicador {
                position: fixed;
                right: 12px;
                bottom: 12px;
                z-index: 99998;
                padding: 4px 8px;
                border-radius: 5px;
                background: rgba(23, 105, 170, .12);
                color: #1769aa;
                font-size: 10px;
                font-weight: 700;
                letter-spacing: 1px;
                pointer-events: none;
                opacity: .7;
            }

            .dsp-ticket-flight {
                position: fixed;
                z-index: 100000;
                pointer-events: none;
                box-sizing: border-box;
                padding: 12px 18px;
                border: 2px dashed #1769aa;
                border-radius: 8px;
                background: #fff;
                color: #1769aa;
                font-size: 20px;
                font-weight: 800;
                white-space: nowrap;
                box-shadow: 0 8px 22px rgba(0,0,0,.2);
                animation: dsp-ticket-puxado .85s ease-in forwards;
            }

            .dsp-ticket-flight::before,
            .dsp-ticket-flight::after {
                content: "";
                position: absolute;
                top: 50%;
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: #fff;
                border: 1px solid #1769aa;
                transform: translateY(-50%);
            }

            .dsp-ticket-flight::before {
                left: -5px;
            }

            .dsp-ticket-flight::after {
                right: -5px;
            }

            @keyframes dsp-ticket-puxado {
                0% {
                    opacity: 0;
                    transform: translate(0, 0) rotate(0deg) scale(.85);
                }

                15% {
                    opacity: 1;
                    transform: translate(0, -8px) rotate(-2deg) scale(1);
                }

                45% {
                    opacity: 1;
                    transform: translate(-35px, -22px) rotate(-5deg) scale(.95);
                }

                100% {
                    opacity: 0;
                    transform: translate(150px, -110px) rotate(12deg) scale(.55);
                }
            }
        `;

        document.head.appendChild(estilo);
    }

    function instalarIndicador() {
        if (document.getElementById('dsp-indicador')) {
            return;
        }

        const indicador = document.createElement('div');

        indicador.id = 'dsp-indicador';
        indicador.className = 'dsp-indicador';
        indicador.textContent = 'DSP';

        document.body.appendChild(indicador);
    }

    function animarSenhaPuxada(codigo, origem) {
        const bilhete = document.createElement('div');

        bilhete.className = 'dsp-ticket-flight';
        bilhete.textContent = codigo;

        let x = window.innerWidth / 2;
        let y = window.innerHeight / 2;

        if (origem && origem.getBoundingClientRect) {
            const rect = origem.getBoundingClientRect();

            x = rect.left + rect.width / 2;
            y = rect.top + rect.height / 2;
        }

        bilhete.style.left = `${x}px`;
        bilhete.style.top = `${y}px`;

        document.body.appendChild(bilhete);

        window.setTimeout(() => {
            bilhete.remove();
        }, 1100);
    }

    // ============================================================
    // ENCONTRAR O CAMPO DE INTRODUÇÃO MANUAL
    // ============================================================

    function encontrarInputManual() {
        const seletoresPreferenciais = [
            'input.manual-input',
            'input[name="ticket"]',
            'input[name="ticketCode"]',
            'input[placeholder*="senha" i]',
            'input[aria-label*="senha" i]',
            'input[placeholder*="código" i]',
            'input[aria-label*="código" i]',
            'input[placeholder*="ticket" i]',
            'input[aria-label*="ticket" i]'
        ];

        for (const seletor of seletoresPreferenciais) {
            const campos = Array.from(
                document.querySelectorAll(seletor)
            );

            const campo = campos.find(input => {
                return (
                    visivel(input) &&
                    !input.disabled &&
                    input.type !== 'hidden'
                );
            });

            if (campo) {
                return campo;
            }
        }

        // Alternativa: procurar um campo de texto perto
        // do botão de chamada manual.
        const botaoManual = document.querySelector(
            DSP.seletorBotaoManual
        );

        if (botaoManual) {
            let elemento = botaoManual.parentElement;

            for (let nivel = 0; nivel < 5 && elemento; nivel++) {
                const campos = Array.from(
                    elemento.querySelectorAll(
                        'input:not([type="hidden"]), textarea'
                    )
                );

                const campo = campos.find(input => {
                    return (
                        visivel(input) &&
                        !input.disabled &&
                        input.type !== 'checkbox' &&
                        input.type !== 'radio' &&
                        !input.classList.contains('multiselect-search')
                    );
                });

                if (campo) {
                    return campo;
                }

                elemento = elemento.parentElement;
            }
        }

        return null;
    }

    function preencherInput(input, codigo) {
        if (!input) {
            return false;
        }

        input.focus();

        const setter = Object.getOwnPropertyDescriptor(
            Object.getPrototypeOf(input),
            'value'
        );

        if (setter && setter.set) {
            setter.set.call(input, codigo);
        } else {
            input.value = codigo;
        }

        input.dispatchEvent(
            new Event('input', {
                bubbles: true
            })
        );

        input.dispatchEvent(
            new Event('change', {
                bubbles: true
            })
        );

        return true;
    }

    // ============================================================
    // ATUALIZAR O TEXTO DO BOTÃO
    // ============================================================

    function atualizarTextoBotao() {
        if (!botaoPersonalizado) {
            return;
        }

        const resultado = obterMaisAntiga();

        if (resultado.erro) {
            botaoPersonalizado.textContent = 'Próxima senha · DSP';
            botaoPersonalizado.title = resultado.erro;
            botaoPersonalizado.classList.add('dsp-sem-senhas');
            return;
        }

        if (!resultado.senha) {
            botaoPersonalizado.textContent = 'Sem senhas · DSP';
            botaoPersonalizado.title = 'Não existem senhas à espera.';
            botaoPersonalizado.classList.add('dsp-sem-senhas');
            return;
        }

        const prioritarias = resultado.senhas.filter(senha => {
            return /^E\d+/i.test(
                senha.codigo.replace(/\s+/g, '')
            );
        });

        if (prioritarias.length > 0) {
            botaoPersonalizado.textContent =
                `Chamar ${resultado.senha.codigo} · PRIORITÁRIA`;

            botaoPersonalizado.title =
                `Senha E prioritária — espera ${resultado.senha.textoTempo}`;
        } else {
            botaoPersonalizado.textContent =
                `Chamar ${resultado.senha.codigo} · DSP`;

            botaoPersonalizado.title =
                `Maior tempo de espera: ${resultado.senha.textoTempo}`;
        }

        botaoPersonalizado.classList.remove('dsp-sem-senhas');
    }

    // ============================================================
    // CHAMAR A SENHA SELECIONADA
    // ============================================================

    async function chamarSenha() {
        if (processando || reiniciando) {
            return;
        }

        processando = true;

        if (botaoPersonalizado) {
            botaoPersonalizado.disabled = true;
            botaoPersonalizado.textContent = 'A selecionar senha...';
        }

        try {
            // Voltar a ler a fila imediatamente antes de selecionar.
            const resultado = obterMaisAntiga();

            if (resultado.erro) {
                console.warn('[DSP]', resultado.erro);
                return;
            }

            if (!resultado.senha) {
                console.info('[DSP] Não existem senhas à espera.');
                return;
            }

            const senha = resultado.senha;

            ultimaSenhaSelecionada = senha.codigo;

            console.log(
                '[DSP] A preparar a chamada da senha:',
                senha.codigo
            );

            const input = encontrarInputManual();

            if (!input) {
                console.error(
                    '[DSP] Não foi encontrado o campo de introdução manual.'
                );

                terminarComErro(
                    'Não foi encontrado o campo para introduzir a senha.'
                );

                return;
            }

            const preenchido = preencherInput(
                input,
                senha.codigo
            );

            if (!preenchido) {
                terminarComErro(
                    'Não foi possível preencher o campo da senha.'
                );

                return;
            }

            animarSenhaPuxada(
                senha.codigo,
                botaoPersonalizado
            );

            // Esperar que a aplicação atualize o estado do botão manual.
            let botaoManual = null;

            for (
                let tentativa = 0;
                tentativa < DSP.tentativasBotaoManual;
                tentativa++
            ) {
                await new Promise(resolve => {
                    window.setTimeout(
                        resolve,
                        DSP.intervaloTentativas
                    );
                });

                botaoManual = document.querySelector(
                    DSP.seletorBotaoManual
                );

                if (
                    botaoManual &&
                    visivel(botaoManual) &&
                    !botaoManual.disabled
                ) {
                    break;
                }
            }

            if (
                !botaoManual ||
                !visivel(botaoManual) ||
                botaoManual.disabled
            ) {
                terminarComErro(
                    'O botão de chamada manual não ficou disponível.'
                );

                return;
            }

            console.log(
                '[DSP] A chamar a senha:',
                senha.codigo
            );

            botaoManual.click();

            // Dar tempo à aplicação para atualizar a fila.
            await new Promise(resolve => {
                window.setTimeout(resolve, 1200);
            });

            console.log(
                '[DSP] Chamada efetuada. A atualizar a seleção.'
            );

        } catch (erro) {
            console.error('[DSP] Erro ao chamar a senha:', erro);

            terminarComErro(
                'Ocorreu um erro ao tentar chamar a senha.'
            );

        } finally {
            processando = false;

            if (botaoPersonalizado) {
                botaoPersonalizado.disabled = false;
            }

            atualizarTextoBotao();
        }
    }

    function terminarComErro(mensagem) {
        console.error('[DSP]', mensagem);

        if (botaoPersonalizado) {
            botaoPersonalizado.title = mensagem;
            botaoPersonalizado.textContent = 'Tentar novamente · DSP';
        }
    }

    // ============================================================
    // BOTÃO PERSONALIZADO
    // ============================================================

    function restaurarBotaoNativo() {
        if (
            botaoNativoGuardado &&
            estiloOriginalBotao &&
            botaoNativoGuardado.isConnected
        ) {
            botaoNativoGuardado.style.position =
                estiloOriginalBotao.position;

            botaoNativoGuardado.style.opacity =
                estiloOriginalBotao.opacity;

            botaoNativoGuardado.style.pointerEvents =
                estiloOriginalBotao.pointerEvents;

            botaoNativoGuardado.style.zIndex =
                estiloOriginalBotao.zIndex;

            botaoNativoGuardado.style.visibility =
                estiloOriginalBotao.visibility;
        }

        botaoNativoGuardado = null;
        estiloOriginalBotao = null;
    }

    function removerSobreposicao() {
        if (wrapperBotao) {
            wrapperBotao.remove();
        }

        wrapperBotao = null;
        botaoPersonalizado = null;

        restaurarBotaoNativo();
    }

    function garantirSobreposicao() {
        const botaoNativo = Array.from(
            document.querySelectorAll(DSP.seletorBotaoNativo)
        ).find(botao => {
            return (
                visivel(botao) &&
                /próxima senha|proxima senha/i.test(
                    normalizar(botao.textContent)
                )
            );
        });

        if (!botaoNativo) {
            return;
        }

        if (
            botaoPersonalizado &&
            wrapperBotao &&
            wrapperBotao.isConnected &&
            botaoNativoGuardado === botaoNativo
        ) {
            posicionarWrapper(botaoNativo);
            return;
        }

        removerSobreposicao();

        botaoNativoGuardado = botaoNativo;

        estiloOriginalBotao = {
            position: botaoNativo.style.position,
            opacity: botaoNativo.style.opacity,
            pointerEvents: botaoNativo.style.pointerEvents,
            zIndex: botaoNativo.style.zIndex,
            visibility: botaoNativo.style.visibility
        };

        const rect = botaoNativo.getBoundingClientRect();

        wrapperBotao = document.createElement('div');
        wrapperBotao.className = 'dsp-botao-wrapper';

        botaoPersonalizado = document.createElement('button');
        botaoPersonalizado.type = 'button';
        botaoPersonalizado.className = 'dsp-botao-personalizado';
        botaoPersonalizado.textContent = 'Próxima senha · DSP';

        botaoPersonalizado.addEventListener('click', chamarSenha);

        wrapperBotao.appendChild(botaoPersonalizado);
        document.body.appendChild(wrapperBotao);

        posicionarWrapper(botaoNativo);

        // Tornar o botão nativo invisível ao rato, mas mantê-lo no DOM.
        botaoNativo.style.pointerEvents = 'none';
        botaoNativo.style.opacity = '0';
        botaoNativo.style.visibility = 'visible';

        atualizarTextoBotao();
    }

    function posicionarWrapper(botaoNativo) {
        if (
            !wrapperBotao ||
            !botaoPersonalizado ||
            !botaoNativo ||
            !botaoNativo.isConnected
        ) {
            return;
        }

        const rect = botaoNativo.getBoundingClientRect();

        wrapperBotao.style.left =
            `${rect.left + window.scrollX}px`;

        wrapperBotao.style.top =
            `${rect.top + window.scrollY}px`;

        wrapperBotao.style.width = `${rect.width}px`;
        wrapperBotao.style.height = `${rect.height}px`;
    }

    // ============================================================
    // DETETAR SE A PÁGINA ESTÁ PRONTA
    // ============================================================

    function verificarEAtivarTipologia() {
        const fila = document.querySelector(DSP.seletorFila);

        if (!fila) {
            return false;
        }

        garantirSobreposicao();

        return true;
    }

    function processarPagina() {
        if (reiniciando) {
            return;
        }

        instalarAnimacoes();
        instalarIndicador();
        verificarEAtivarTipologia();
        atualizarTextoBotao();
    }

    // ============================================================
    // OBSERVAR ALTERAÇÕES NA FILA
    // ============================================================

    function iniciarObservador() {
        pararObservador();

        observador = new MutationObserver(() => {
            if (reiniciando) {
                return;
            }

            processarPagina();
        });

        observador.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
        });
    }

    function pararObservador() {
        if (observador) {
            observador.disconnect();
            observador = null;
        }
    }

    // ============================================================
    // REINICIALIZAÇÃO INTERNA — SEM RECARREGAR A PÁGINA
    // ============================================================

    function reiniciarScript(motivo = 'Reinicialização automática') {
        if (reiniciando) {
            return;
        }

        reiniciando = true;
        identificadorReinicio++;

        console.log('[DSP]', motivo);

        pararObservador();

        if (temporizadorReinicio) {
            clearTimeout(temporizadorReinicio);
            temporizadorReinicio = null;
        }

        processando = false;
        ultimaSenhaSelecionada = null;

        removerSobreposicao();

        const estilos = document.getElementById('dsp-estilos');

        if (estilos) {
            estilos.remove();
        }

        const indicador = document.getElementById('dsp-indicador');

        if (indicador) {
            indicador.remove();
        }

        document.querySelectorAll('.dsp-ticket-flight').forEach(
            elemento => elemento.remove()
        );

        window.setTimeout(() => {
            reiniciando = false;

            instalarAnimacoes();
            instalarIndicador();
            processarPagina();
            iniciarObservador();

            console.log('[DSP] Reinicialização concluída.');

            agendarReinicio();
        }, 500);
    }

    function agendarReinicio() {
        if (temporizadorReinicio) {
            clearTimeout(temporizadorReinicio);
        }

        temporizadorReinicio = window.setTimeout(() => {
            reiniciarScript('Reinicialização automática após 60 segundos');
        }, DSP.intervaloReinicio);
    }

    // ============================================================
    // DETETAR O BOTÃO "TERMINAR"
    // ============================================================

    document.addEventListener('click', evento => {
        const alvo = evento.target;

        if (!(alvo instanceof Element)) {
            return;
        }

        const botao = alvo.closest(
            'button, [role="button"], input[type="button"], input[type="submit"]'
        );

        if (!botao) {
            return;
        }

        const texto = normalizar(
            botao.innerText || botao.value || botao.textContent
        ).toLowerCase();

        if (
            texto === 'terminar' ||
            texto.includes('terminar atendimento') ||
            texto.includes('terminar sessão')
        ) {
            window.setTimeout(() => {
                reiniciarScript(
                    'Reinicialização após clicar em Terminar'
                );
            }, DSP.atrasoDepoisTerminar);
        }
    }, true);

    // ============================================================
    // MANTER O BOTÃO ALINHADO COM O BOTÃO NATIVO
    // ============================================================

    window.addEventListener('resize', () => {
        if (botaoNativoGuardado) {
            posicionarWrapper(botaoNativoGuardado);
        }
    });

    window.addEventListener('scroll', () => {
        if (botaoNativoGuardado) {
            posicionarWrapper(botaoNativoGuardado);
        }
    }, true);

    // ============================================================
    // INICIAR O DSP
    // ============================================================

    function iniciar() {
        instalarAnimacoes();
        instalarIndicador();
        processarPagina();
        iniciarObservador();
        agendarReinicio();

        console.log(
            '[DSP] Script iniciado. Prioridade às senhas E ativada.'
        );
    }

    window.setTimeout(iniciar, DSP.atrasoInicial);

})();
