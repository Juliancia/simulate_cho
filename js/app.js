/**
 * app.js - Główny kontroler aplikacji symulatora hodowli komórek CHO i optymalizacji bioprocesu
 * Obsługuje: nawigację dwustronicową (Laboratorium vs Biologia Cyfrowa),
 * wykresy 2D, optymalizację wspinaczki gradientowej w 3D i obsługę UI.
 * Dla: SKN Cyfrowi Biolodzy
 */

import { calculateViability, calculateVCD, evaluateCulture, CHO_CONSTANTS } from './model.js';
import { MicroscopeEngine } from './microscope.js';
import { BioprocessOptimizer } from './optimizer.js';

class AppController {
  constructor() {
    this.currentView = 'lab'; // 'lab' lub 'ml'

    // Podzespoły aplikacji
    this.microscope = new MicroscopeEngine('microscope-canvas');
    this.optimizer = new BioprocessOptimizer();

    // Stan bieżący
    this.currentTemp = 34.0;
    this.currentPH = 6.60;
    this.currentGlucose = 2.0;

    this.attempts = 0;
    this.totalCost = 0;

    this.lastViability = 0;
    this.lastVCD = 0;
    this.sampleIncubated = false;
    this.isAIVerificationPhase = false;

    // Cache elementów DOM
    this.dom = {
      // Widoki i nawigacja
      viewLab: document.getElementById('view-lab'),
      viewML: document.getElementById('view-ml'),
      tabNavLab: document.getElementById('tab-nav-lab'),
      tabNavML: document.getElementById('tab-nav-ml'),
      btnJumpML: document.getElementById('btn-jump-ml'),
      btnBackToLab: document.getElementById('btn-back-to-lab'),

      // Karta wiedzy CHO i koszty
      btnToggleChoInfo: document.getElementById('btn-toggle-cho-info'),
      choInfoContent: document.getElementById('cho-info-content'),
      txtToggleChoInfo: document.getElementById('txt-toggle-cho-info'),

      // Slidery i wartości
      sliderTemp: document.getElementById('slider-temp'),
      valTemp: document.getElementById('val-temp'),
      sliderPH: document.getElementById('slider-ph'),
      valPH: document.getElementById('val-ph'),
      sliderGlucose: document.getElementById('slider-glucose'),
      valGlucose: document.getElementById('val-glucose'),

      // Przyciski akcji laboratoryjnej
      btnIncubate: document.getElementById('btn-incubate'),
      btnTrypan: document.getElementById('btn-trypan'),
      btnGrid: document.getElementById('btn-grid'),

      // Statystyki
      statAttempts: document.getElementById('stat-attempts'),
      statCost: document.getElementById('stat-cost'),

      // Wyniki
      resViability: document.getElementById('res-viability'),
      barViability: document.getElementById('bar-viability'),
      resCellCounts: document.getElementById('res-cell-counts'),
      resVCD: document.getElementById('res-vcd'),
      resDescription: document.getElementById('res-description'),
      statusBadge: document.getElementById('status-badge'),

      // Tabela historii
      historyTableBody: document.getElementById('history-table-body'),
      historyEmptyRow: document.getElementById('history-empty-row'),
      btnClearHistory: document.getElementById('btn-clear-history'),

      // Sekcja Optymalizacji i Algorytm
      optStatus: document.getElementById('opt-status'),
      telemetryStep: document.getElementById('telemetry-step'),
      telemetryGrad: document.getElementById('telemetry-grad'),
      telemetryViab: document.getElementById('telemetry-viab'),
      optResT: document.getElementById('opt-res-t'),
      optResPH: document.getElementById('opt-res-ph'),
      optResG: document.getElementById('opt-res-g'),
      btnRunOptimizer: document.getElementById('btn-run-optimizer'),
      btnApplyOptimal: document.getElementById('btn-apply-optimal'),
      calcStepsBody: document.getElementById('calc-steps-body'),
      calcEmptyRow: document.getElementById('calc-empty-row'),

      // Modal
      modalSuccess: document.getElementById('modal-success'),
      modalClose: document.getElementById('modal-close'),
      modalViability: document.getElementById('modal-viability'),
      modalTitle: document.getElementById('modal-title'),
      modalDesc: document.getElementById('modal-desc')
    };

    this.initEventListeners();
    this.loadUserData();
    this.initFirstSample();
    this.initConfetti();
    this.triggerKaTeX();
  }

  initFirstSample() {
    const initV = calculateViability(this.currentTemp, this.currentPH, this.currentGlucose, false);
    const initVCD = calculateVCD(initV, this.currentGlucose);
    this.lastViability = initV;
    this.lastVCD = initVCD;
    this.microscope.loadSample(initV, initVCD, false);
  }

  initEventListeners() {
    // 1. Nawigacja między stronami (Laboratorium vs Biologia Cyfrowa)
    this.dom.tabNavLab.addEventListener('click', () => this.switchView('lab'));
    this.dom.tabNavML.addEventListener('click', () => this.switchView('ml'));
    this.dom.btnJumpML.addEventListener('click', () => this.switchView('ml'));
    this.dom.btnBackToLab.addEventListener('click', () => this.switchView('lab'));

    // 2. Zmiany wartości suwaków (zapisywane na urządzeniu)
    this.dom.sliderTemp.addEventListener('input', (e) => {
      this.currentTemp = parseFloat(e.target.value);
      this.dom.valTemp.innerText = `${this.currentTemp.toFixed(1)} °C`;
      this.saveUserData();
    });

    this.dom.sliderPH.addEventListener('input', (e) => {
      this.currentPH = parseFloat(e.target.value);
      this.dom.valPH.innerText = `${this.currentPH.toFixed(2)}`;
      this.saveUserData();
    });

    this.dom.sliderGlucose.addEventListener('input', (e) => {
      this.currentGlucose = parseFloat(e.target.value);
      this.dom.valGlucose.innerText = `${this.currentGlucose.toFixed(1)} g/L`;
      this.saveUserData();
    });

    // Przycisk wyczyszczenia danych na bieżącym urządzeniu
    if (this.dom.btnClearHistory) {
      this.dom.btnClearHistory.addEventListener('click', () => {
        if (confirm('Czy na pewno chcesz zresetować historię prób i koszty na tym urządzeniu?')) {
          this.clearUserData();
        }
      });
    }

    // 3. Przycisk: Zainkubuj próbkę
    this.dom.btnIncubate.addEventListener('click', () => {
      this.handleIncubate();
    });

    // 4. Przycisk: Dodaj błękit trypanu
    this.dom.btnTrypan.addEventListener('click', () => {
      this.handleTrypanBlue();
    });

    // 5. Przełącznik siatki Bürkera
    this.dom.btnGrid.addEventListener('click', () => {
      this.microscope.toggleBurkerGrid();
    });

    // 6. Uruchomienie wspinaczki gradientowej
    this.dom.btnRunOptimizer.addEventListener('click', () => {
      this.handleRunOptimizer();
    });

    // 7. Zastosowanie parametrów optymalnych w bioreaktorze
    this.dom.btnApplyOptimal.addEventListener('click', () => {
      this.handleApplyOptimal();
    });

    // 8. Zamknięcie modalu sukcesu
    this.dom.modalClose.addEventListener('click', () => {
      this.dom.modalSuccess.classList.add('hidden');
      this.dom.modalSuccess.classList.remove('flex');
    });

    // 9. Rozwijanie / zwijanie karty wiedzy CHO i kosztów
    if (this.dom.btnToggleChoInfo && this.dom.choInfoContent) {
      this.dom.btnToggleChoInfo.addEventListener('click', () => {
        const isHidden = this.dom.choInfoContent.classList.contains('hidden');
        if (isHidden) {
          this.dom.choInfoContent.classList.remove('hidden');
          if (this.dom.txtToggleChoInfo) this.dom.txtToggleChoInfo.innerText = 'Zwiń wiedzę bioinżynierską';
        } else {
          this.dom.choInfoContent.classList.add('hidden');
          if (this.dom.txtToggleChoInfo) this.dom.txtToggleChoInfo.innerText = 'Rozwiń wiedzę bioinżynierską';
        }
      });
    }
  }

  /**
   * Przełączanie widoków (Strona 1 vs Strona 2)
   */
  switchView(viewName) {
    this.currentView = viewName;

    if (viewName === 'lab') {
      this.dom.viewLab.classList.remove('hidden');
      this.dom.viewML.classList.add('hidden');

      // Style zakładek zgodne z website_BC
      this.dom.tabNavLab.className = 'px-3.5 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 bg-[#4043A0] text-[#DFEFF6] shadow-md';
      this.dom.tabNavML.className = 'px-3.5 py-1.5 rounded-lg font-bold text-[#DFEFF6]/60 hover:text-white transition-all flex items-center gap-1.5';

      window.scrollTo({ top: 0, behavior: 'smooth' });

      // Ponowna kalibracja Canvasu mikroskopu po zdjęciu klasy hidden
      setTimeout(() => {
        this.microscope.setupCanvas();
      }, 50);
    } else {
      this.dom.viewLab.classList.add('hidden');
      this.dom.viewML.classList.remove('hidden');

      // Style zakładek
      this.dom.tabNavLab.className = 'px-3.5 py-1.5 rounded-lg font-bold text-[#DFEFF6]/60 hover:text-white transition-all flex items-center gap-1.5';
      this.dom.tabNavML.className = 'px-3.5 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 bg-[#4043A0] text-[#DFEFF6] shadow-md';

      window.scrollTo({ top: 0, behavior: 'smooth' });

      // Wyrenderowanie 3 klasycznych wykresów 2D oraz powierzchni 3D na jasnym tle
      setTimeout(() => {
        this.optimizer.renderSingleParamPlots('plot-2d-temp', 'plot-2d-ph', 'plot-2d-glucose');
        this.optimizer.render3DSurface('landscape-canvas', this.currentTemp, this.currentPH, this.currentGlucose);
        this.triggerKaTeX();
      }, 60);
    }
  }

  triggerKaTeX() {
    if (window.renderMathInElement) {
      try {
        window.renderMathInElement(document.body, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '\\(', right: '\\)', display: false },
            { left: '$', right: '$', display: false }
          ],
          throwOnError: false
        });
      } catch (e) {
        console.warn('KaTeX render note:', e);
      }
    }
  }

  /**
   * Symulacja inkubacji 3.5 dnia w labie
   */
  handleIncubate() {
    this.dom.btnIncubate.classList.remove('animate-bounce', 'ring-4', 'ring-emerald-400');
    this.attempts++;
    this.totalCost += CHO_CONSTANTS.BASE_COST_PLN;

    this.dom.statAttempts.innerText = this.attempts;
    this.dom.statCost.innerText = `${this.totalCost.toLocaleString('pl-PL')} PLN`;
    this.saveUserData();

    const originalText = this.dom.btnIncubate.innerHTML;
    this.dom.btnIncubate.innerHTML = `
      <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
      <span>Inkubacja w toku (3.5 dnia)...</span>
    `;
    this.dom.btnIncubate.disabled = true;

    setTimeout(() => {
      this.dom.btnIncubate.innerHTML = originalText;
      this.dom.btnIncubate.disabled = false;
      this.sampleIncubated = true;

      // Wyliczenie żywotności i gęstości z lekkim szumem eksperymentalnym
      this.lastViability = calculateViability(this.currentTemp, this.currentPH, this.currentGlucose, true);
      this.lastVCD = calculateVCD(this.lastViability, this.currentGlucose);

      // Wczytanie próbki do mikroskopu (przed barwieniem błękitem trypanu)
      this.microscope.loadSample(this.lastViability, this.lastVCD, false);

      if (this.isAIVerificationPhase) {
        this.dom.resDescription.innerHTML = `
          <div class="space-y-1.5 p-3 bg-blue-950/80 border border-blue-500 rounded-xl text-blue-100">
            <div class="text-white font-bold flex items-center gap-2">
              <span class="inline-block w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse"></span>
              Próbka z optymalnego bioreaktora zainkubowana (3.5 dnia)!
            </div>
            <p class="text-xs text-[#DFEFF6]/90 leading-relaxed">
              Komórki CHO namnożyły się w warunkach optimum wyliczonego cyfrowo. Teraz kliknij podświetlony przycisk <strong>„Wpuść Błękit Trypanu”</strong> poniżej, aby policzyć żywe komórki i zweryfikować szczelność błon komórkowych!
            </p>
          </div>
        `;
        this.dom.btnTrypan.classList.add('animate-bounce', 'ring-4', 'ring-blue-400');
      } else {
        this.dom.resDescription.innerHTML = `
          <span class="text-cyan-300 font-bold">Próbka pobrana z bioreaktora!</span><br>
          Komórki są w polu widzenia. Kliknij poniżej <strong>Wpuść Błękit Trypanu</strong>, aby policzyć komórki żywe i martwe.
        `;
      }
      this.dom.statusBadge.innerText = 'Próbka gotowa';
      this.dom.statusBadge.className = 'badge-tech bg-blue-950 text-blue-300 border border-blue-700';
    }, 500);
  }

  /**
   * Barwienie błękitem trypanu i zliczanie
   */
  handleTrypanBlue() {
    this.dom.btnTrypan.classList.remove('animate-bounce', 'ring-4', 'ring-blue-400');
    if (this.microscope.isStaining) return;

    this.dom.btnTrypan.disabled = true;

    this.microscope.applyTrypanBlue(() => {
      this.dom.btnTrypan.disabled = false;

      // Aktualizacja wyświetlacza wyników
      const roundedV = Math.round(this.lastViability * 10) / 10;
      this.dom.resViability.innerText = roundedV.toFixed(1);
      this.dom.barViability.style.width = `${Math.min(100, roundedV)}%`;
      this.dom.resVCD.innerText = this.lastVCD.toFixed(2);

      // Dokładne zliczenie komórek w polu mikroskopu
      const stats = this.microscope.cellStats;
      if (stats && this.dom.resCellCounts) {
        this.dom.resCellCounts.innerHTML = `
          <span class="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 mr-1 shadow-sm shadow-emerald-400/50"></span><span class="text-emerald-400 font-bold">${stats.alive} żywych</span> | 
          <span class="inline-block w-2.5 h-2.5 rounded-full bg-blue-500 mr-1 shadow-sm shadow-blue-500/50"></span><span class="text-blue-400 font-bold">${stats.dead} martwych</span>
          <span class="text-slate-500 font-normal">(${stats.total} łącznie)</span>
        `;
      }

      const evaluation = evaluateCulture(roundedV, this.lastVCD);
      this.dom.resDescription.innerHTML = `
        <strong class="text-white">${evaluation.title}:</strong> ${evaluation.message}
      `;

      const wasAIVerification = this.isAIVerificationPhase;
      this.isAIVerificationPhase = false;

      if (evaluation.status === 'success') {
        this.dom.statusBadge.className = 'badge-tech bg-emerald-950 text-emerald-300 border border-emerald-500 glow-emerald';
        this.dom.statusBadge.innerText = evaluation.badge;
        this.dom.barViability.className = 'bg-emerald-400 h-1.5 rounded-full transition-all duration-500';
        this.triggerSuccessModal(roundedV, wasAIVerification);
      } else if (evaluation.status === 'warning') {
        this.dom.statusBadge.className = 'badge-tech bg-teal-950 text-teal-300 border border-teal-600';
        this.dom.statusBadge.innerText = evaluation.badge;
        this.dom.barViability.className = 'bg-teal-400 h-1.5 rounded-full transition-all duration-500';
      } else if (evaluation.status === 'caution') {
        this.dom.statusBadge.className = 'badge-tech bg-amber-950 text-amber-300 border border-amber-600';
        this.dom.statusBadge.innerText = evaluation.badge;
        this.dom.barViability.className = 'bg-amber-400 h-1.5 rounded-full transition-all duration-500';
      } else {
        this.dom.statusBadge.className = 'badge-tech bg-rose-950 text-rose-300 border border-rose-600';
        this.dom.statusBadge.innerText = evaluation.badge;
        this.dom.barViability.className = 'bg-rose-500 h-1.5 rounded-full transition-all duration-500';
      }

      // Zapisanie do historii
      const exp = this.optimizer.addExperiment(
        this.currentTemp,
        this.currentPH,
        this.currentGlucose,
        roundedV,
        this.lastVCD
      );
      this.appendHistoryRow(exp, evaluation);
      this.saveUserData();
    });
  }

  appendHistoryRow(exp, evalResult) {
    if (this.dom.historyEmptyRow) {
      this.dom.historyEmptyRow.remove();
      this.dom.historyEmptyRow = null;
    }

    const row = document.createElement('tr');
    row.className = 'hover:bg-slate-800/40 transition-colors text-slate-300';

    let badgeColor = 'text-rose-400';
    if (evalResult.status === 'success') badgeColor = 'text-emerald-400 font-bold';
    else if (evalResult.status === 'warning') badgeColor = 'text-teal-300';
    else if (evalResult.status === 'caution') badgeColor = 'text-amber-400';

    row.innerHTML = `
      <td class="py-2.5 px-3 font-bold text-slate-400">#${exp.id}</td>
      <td class="py-2.5 px-3">${exp.temp.toFixed(1)} °C</td>
      <td class="py-2.5 px-3">${exp.ph.toFixed(2)}</td>
      <td class="py-2.5 px-3">${exp.glucose.toFixed(1)} g/L</td>
      <td class="py-2.5 px-3 ${badgeColor}">${exp.viability}%</td>
      <td class="py-2.5 px-3">${exp.vcd} mln/mL</td>
      <td class="py-2.5 px-3">
        <span class="text-[10px] px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700 ${badgeColor}">
          ${evalResult.badge}
        </span>
      </td>
    `;

    this.dom.historyTableBody.prepend(row);
  }

  /**
   * Wspinaczka gradientowa (Gradient Ascent)
   */
  handleRunOptimizer() {
    this.dom.btnRunOptimizer.disabled = true;
    this.dom.optStatus.innerText = 'Wspinaczka 3D w toku...';
    this.dom.optStatus.className = 'badge-tech bg-[#4043A0] text-cyan-300 border border-cyan-400 animate-pulse';

    // Wyczyść tabelę wyliczeń kroków
    if (this.dom.calcStepsBody) {
      this.dom.calcStepsBody.innerHTML = '';
    }

    this.optimizer.runOptimizationAnimation(
      this.currentTemp,
      this.currentPH,
      this.currentGlucose,
      (stepInfo) => {
        const row = stepInfo.calcRow;

        // Telemetria na żywo
        this.dom.telemetryStep.innerText = `${row.step} / ${stepInfo.maxSteps}`;
        this.dom.telemetryGrad.innerText = `[${row.df_dT >= 0 ? '+' : ''}${row.df_dT.toFixed(2)}, ${row.df_dPH >= 0 ? '+' : ''}${row.df_dPH.toFixed(2)}, ${row.df_dG >= 0 ? '+' : ''}${row.df_dG.toFixed(2)}]`;
        this.dom.telemetryViab.innerText = `${row.viability} %`;

        this.dom.optResT.innerText = `${row.temp} °C`;
        this.dom.optResPH.innerText = `${row.ph}`;
        this.dom.optResG.innerText = `${row.glucose} g/L`;

        // Renderowanie powierzchni 3D z płaszczyzną styczną
        this.optimizer.render3DSurface(
          'landscape-canvas',
          row.temp,
          row.ph,
          row.glucose,
          stepInfo.trajectory,
          row
        );

        // Dodanie wiersza do tabeli wyliczeń
        this.appendCalcStepRow(row);
      },
      (finalResult) => {
        this.dom.optStatus.innerText = 'Szczyt Osiągnięty!';
        this.dom.optStatus.className = 'badge-tech bg-emerald-950 text-emerald-300 border border-emerald-500 glow-emerald';
        this.dom.btnRunOptimizer.disabled = false;

        this.dom.optResT.innerText = `${finalResult.finalTemp.toFixed(1)} °C`;
        this.dom.optResPH.innerText = `${finalResult.finalPH.toFixed(2)}`;
        this.dom.optResG.innerText = `${finalResult.finalGlucose.toFixed(1)} g/L`;

        this.dom.telemetryGrad.innerText = '[0.00, 0.00, 0.00] (Szczyt płaski)';
        this.dom.telemetryViab.innerText = `${Math.round(finalResult.viability * 10) / 10} %`;

        // Końcowe odświeżenie 3D
        this.optimizer.render3DSurface(
          'landscape-canvas',
          finalResult.finalTemp,
          finalResult.finalPH,
          finalResult.finalGlucose,
          finalResult.trajectory,
          { temp: finalResult.finalTemp, ph: finalResult.finalPH, glucose: finalResult.finalGlucose, viability: finalResult.viability }
        );

        // Dodanie finałowego wiersza do tabeli
        const finalRow = finalResult.allCalculations[finalResult.allCalculations.length - 1];
        if (finalRow) {
          this.appendCalcStepRow(finalRow, true);
        }

        this.dom.btnApplyOptimal.disabled = false;
        this.dom.btnApplyOptimal.classList.add('animate-bounce');
      }
    );
  }

  appendCalcStepRow(row, isFinal = false) {
    if (!this.dom.calcStepsBody) return;

    if (this.dom.calcEmptyRow) {
      this.dom.calcEmptyRow.remove();
      this.dom.calcEmptyRow = null;
    }

    const tr = document.createElement('tr');
    tr.className = isFinal 
      ? 'bg-emerald-950/40 text-emerald-200 font-bold border-l-4 border-emerald-400'
      : 'hover:bg-[#1B1D3A]/60 transition-colors text-[#DFEFF6]';

    const slopeStatus = isFinal || row.gradNorm < 2.0
      ? '<span class="text-emerald-400 font-bold">★ Wierzchołek (Optimum: ∇f ≈ 0)</span>'
      : '<span class="text-cyan-300">↗ Wspinaczka pod górę</span>';

    tr.innerHTML = `
      <td class="py-2 px-3 font-bold text-slate-300">k = ${row.step}</td>
      <td class="py-2 px-3 font-mono">(${row.temp}°C, ${row.ph}, ${row.glucose})</td>
      <td class="py-2 px-3 font-bold ${row.viability > 85 ? 'text-emerald-400' : 'text-amber-400'}">${row.viability}%</td>
      <td class="py-2 px-3 text-cyan-300">[${row.df_dT >= 0 ? '+' : ''}${row.df_dT}, ${row.df_dPH >= 0 ? '+' : ''}${row.df_dPH}, ${row.df_dG >= 0 ? '+' : ''}${row.df_dG}]</td>
      <td class="py-2 px-3 font-bold text-white">${row.gradNorm}</td>
      <td class="py-2 px-3 text-emerald-300">[${row.deltaT >= 0 ? '+' : ''}${row.deltaT}, ${row.deltaP >= 0 ? '+' : ''}${row.deltaP}, ${row.deltaG >= 0 ? '+' : ''}${row.deltaG}]</td>
      <td class="py-2 px-3">${slopeStatus}</td>
    `;

    this.dom.calcStepsBody.appendChild(tr);
  }

  /**
   * Zastosowanie wyliczonych parametrów w bioreaktorze
   */
  handleApplyOptimal() {
    this.dom.btnApplyOptimal.classList.remove('animate-bounce');

    // Ustawienie suwaków na optimum
    this.currentTemp = CHO_CONSTANTS.OPT_TEMP;
    this.currentPH = CHO_CONSTANTS.OPT_PH;
    this.currentGlucose = CHO_CONSTANTS.OPT_GLUCOSE;

    this.dom.sliderTemp.value = this.currentTemp;
    this.dom.valTemp.innerText = `${this.currentTemp.toFixed(1)} °C`;

    this.dom.sliderPH.value = this.currentPH;
    this.dom.valPH.innerText = `${this.currentPH.toFixed(2)}`;

    this.dom.sliderGlucose.value = this.currentGlucose;
    this.dom.valGlucose.innerText = `${this.currentGlucose.toFixed(1)} g/L`;

    // Tryb weryfikacji laboratoryjnej po wyznaczeniu optimum
    this.isAIVerificationPhase = true;
    this.sampleIncubated = false;

    // Przełączenie widoku na laboratorium
    this.switchView('lab');

    // Dajemy czas na wyrenderowanie kontenera i ponowną kalibrację Canvasu
    setTimeout(() => {
      this.microscope.setupCanvas();

      // Reset wyświetlacza wyników przed nową inkubacją
      this.dom.resViability.innerText = '--';
      this.dom.barViability.style.width = '0%';
      this.dom.resVCD.innerText = '--';
      if (this.dom.resCellCounts) {
        this.dom.resCellCounts.innerText = 'Zliczenie: oczekiwanie na inkubację';
      }

      this.dom.statusBadge.innerText = 'Optimum wstawione';
      this.dom.statusBadge.className = 'badge-tech bg-emerald-950 text-emerald-300 border border-emerald-500';

      this.dom.resDescription.innerHTML = `
        <div class="space-y-1.5 p-3 bg-emerald-950/80 border border-emerald-500 rounded-xl text-emerald-100">
          <div class="text-white font-bold flex items-center gap-2">
            <span class="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
            Parametry optymalne ustawione w bioreaktorze: 37.0°C, pH 7.20, glukoza 4.5 g/L!
          </div>
          <p class="text-xs text-[#DFEFF6]/90 leading-relaxed">
            <strong>Krok 1:</strong> Kliknij podświetlony przycisk <strong>„Zainkubuj Próbkę”</strong> poniżej, aby uruchomić hodowlę.<br>
            <strong>Krok 2:</strong> Następnie wpuść <strong>Błękit Trypanu</strong>, aby zweryfikować żywotność pod mikroskopem!
          </p>
        </div>
      `;

      // Wyróżnienie przycisku inkubacji
      this.dom.btnIncubate.classList.add('animate-bounce', 'ring-4', 'ring-emerald-400');
    }, 250);
  }

  triggerSuccessModal(viability, isFromAI = false) {
    this.dom.modalViability.innerText = `${viability}%`;
    if (this.dom.modalTitle && this.dom.modalDesc) {
      if (isFromAI) {
        this.dom.modalTitle.innerText = 'Triumf Biologii Cyfrowej i Doświadczalnej!';
        this.dom.modalDesc.innerHTML = `
          Po wyliczeniu optimum przez algorytm gradientowy i zweryfikowaniu próby błękitem trypanu w laboratorium uzyskałeś 
          <span class="text-emerald-400 font-bold text-sm">${viability}%</span> żywotności 
          i maksymalną wydajność bioreaktora!
        `;
      } else {
        this.dom.modalTitle.innerText = 'Znakomity Wynik Hodowli!';
        this.dom.modalDesc.innerHTML = `
          Uzyskałeś znakomitą żywotność <span class="text-emerald-400 font-bold text-sm">${viability}%</span> komórek CHO!
        `;
      }
    }
    this.dom.modalSuccess.classList.remove('hidden');
    this.dom.modalSuccess.classList.add('flex');
    this.launchConfetti();
  }

  // --- EFEKT KONFETTI W CANVAS ---
  initConfetti() {
    this.confettiCanvas = document.getElementById('confetti-canvas');
    this.confettiCtx = this.confettiCanvas.getContext('2d');
    this.confettiParticles = [];
    this.confettiRunning = false;

    const resize = () => {
      this.confettiCanvas.width = window.innerWidth;
      this.confettiCanvas.height = window.innerHeight;
      if (this.dom.viewML && !this.dom.viewML.classList.contains('hidden')) {
        this.optimizer.renderSingleParamPlots('plot-2d-temp', 'plot-2d-ph', 'plot-2d-glucose');
        this.optimizer.render3DSurface('landscape-canvas', this.currentTemp, this.currentPH, this.currentGlucose);
      }
    };
    window.addEventListener('resize', resize);
    resize();
  }

  launchConfetti() {
    const colors = ['#06b6d4', '#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#ffffff'];
    this.confettiParticles = [];

    for (let i = 0; i < 110; i++) {
      this.confettiParticles.push({
        x: window.innerWidth / 2,
        y: window.innerHeight * 0.4,
        vx: (Math.random() - 0.5) * 16,
        vy: (Math.random() - 0.8) * 18,
        size: 5 + Math.random() * 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
        opacity: 1
      });
    }

    if (!this.confettiRunning) {
      this.confettiRunning = true;
      this.animateConfetti();
    }
  }

  animateConfetti() {
    if (!this.confettiRunning) return;
    const ctx = this.confettiCtx;
    ctx.clearRect(0, 0, this.confettiCanvas.width, this.confettiCanvas.height);

    let activeCount = 0;
    for (const p of this.confettiParticles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.35;
      p.rotation += p.rotationSpeed;
      p.opacity -= 0.007;

      if (p.opacity > 0 && p.y < this.confettiCanvas.height + 20) {
        activeCount++;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      }
    }

    if (activeCount > 0) {
      requestAnimationFrame(() => this.animateConfetti());
    } else {
      this.confettiRunning = false;
      ctx.clearRect(0, 0, this.confettiCanvas.width, this.confettiCanvas.height);
    }
  }

  /**
   * Zapisuje stan użytkownika wyłącznie w pamięci lokalnej jego urządzenia (LocalStorage)
   */
  saveUserData() {
    try {
      const state = {
        attempts: this.attempts,
        totalCost: this.totalCost,
        history: this.optimizer.history,
        currentTemp: this.currentTemp,
        currentPH: this.currentPH,
        currentGlucose: this.currentGlucose
      };
      localStorage.setItem('skn_biologia_cyfrowa_user_data', JSON.stringify(state));
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
  }

  /**
   * Wczytuje zapisane dane użytkownika z tego konkretnego urządzenia
   */
  loadUserData() {
    try {
      const raw = localStorage.getItem('skn_biologia_cyfrowa_user_data');
      if (!raw) return;
      const state = JSON.parse(raw);

      if (typeof state.attempts === 'number') this.attempts = state.attempts;
      if (typeof state.totalCost === 'number') this.totalCost = state.totalCost;
      if (typeof state.currentTemp === 'number') this.currentTemp = state.currentTemp;
      if (typeof state.currentPH === 'number') this.currentPH = state.currentPH;
      if (typeof state.currentGlucose === 'number') this.currentGlucose = state.currentGlucose;

      if (this.dom.statAttempts) this.dom.statAttempts.innerText = this.attempts;
      if (this.dom.statCost) this.dom.statCost.innerText = `${this.totalCost.toLocaleString('pl-PL')} PLN`;

      if (this.dom.sliderTemp) {
        this.dom.sliderTemp.value = this.currentTemp;
        this.dom.valTemp.innerText = `${this.currentTemp.toFixed(1)} °C`;
      }
      if (this.dom.sliderPH) {
        this.dom.sliderPH.value = this.currentPH;
        this.dom.valPH.innerText = `${this.currentPH.toFixed(2)}`;
      }
      if (this.dom.sliderGlucose) {
        this.dom.sliderGlucose.value = this.currentGlucose;
        this.dom.valGlucose.innerText = `${this.currentGlucose.toFixed(1)} g/L`;
      }

      // Odtworzenie tabeli historii
      if (Array.isArray(state.history) && state.history.length > 0) {
        this.optimizer.history = state.history;
        for (const exp of state.history) {
          const evalResult = evaluateCulture(exp.viability, exp.vcd);
          this.appendHistoryRow(exp, evalResult);
        }
      }
    } catch (e) {
      console.warn('LocalStorage load failed:', e);
    }
  }

  /**
   * Czyści dane użytkownika z pamięci urządzenia i resetuje liczniki
   */
  clearUserData() {
    try {
      localStorage.removeItem('skn_biologia_cyfrowa_user_data');
    } catch (e) {
      console.warn('LocalStorage clear failed:', e);
    }
    this.attempts = 0;
    this.totalCost = 0;
    this.optimizer.history = [];
    if (this.dom.statAttempts) this.dom.statAttempts.innerText = '0';
    if (this.dom.statCost) this.dom.statCost.innerText = '0 PLN';
    if (this.dom.historyTableBody) {
      this.dom.historyTableBody.innerHTML = `
        <tr id="history-empty-row">
          <td colspan="7" class="py-4 text-center text-[#DFEFF6]/50 italic font-sans">Brak przeprowadzonych prób. Zacznij od ustawienia suwaków!</td>
        </tr>
      `;
      this.dom.historyEmptyRow = document.getElementById('history-empty-row');
    }
  }
}

// Start aplikacji
window.addEventListener('DOMContentLoaded', () => {
  new AppController();
});
