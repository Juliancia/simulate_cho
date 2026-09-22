/**
 * optimizer.js - Moduł Optymalizacji Matematycznej Bioprocesu
 * Wyposażony w:
 * 1. Trzy klasyczne wykresy 2D parametrów (T, pH, Glukoza) na jasnym tle
 * 2. Pełny, interaktywny wykres 3D (3D Surface Plot) z narzuconą płaszczyzną styczną gradientu
 * 3. Precyzyjne obliczanie pochodnych cząstkowych i pełna tabela wyliczeń krok po kroku
 * Dla: SKN Biologów Cyfrowych Uniwersytetu Łódzkiego
 */

import { calculateViability, CHO_CONSTANTS } from './model.js';

export class BioprocessOptimizer {
  constructor() {
    this.history = []; // Zebrane eksperymenty manualne
    this.stepCalculations = []; // Pełne wyliczenia matematyczne krok po kroku
    this.gradientSteps = []; // Punkty trajektorii wspinaczki

    // Kąty kamery wykresu 3D (możliwość obracania myszą)
    this.yaw = -0.65;  // Obrót poziomy
    this.pitch = 0.52; // Kąt nachylenia pionowego
    this.isDragging3D = false;
    this.lastMouseX = 0;
    this.lastMouseY = 0;
    this.canvas3D = null;
    this.ctx3D = null;
    this.lastRenderParams = null;
  }

  addExperiment(temp, ph, glucose, viability, vcd) {
    const experiment = {
      id: this.history.length + 1,
      temp: parseFloat(temp),
      ph: parseFloat(ph),
      glucose: parseFloat(glucose),
      viability: parseFloat(viability.toFixed(1)),
      vcd: parseFloat(vcd.toFixed(2)),
      timestamp: new Date()
    };
    this.history.push(experiment);
    return experiment;
  }

  /**
   * Oblicza analityczno-numeryczny gradient (pochodne cząstkowe df/dT, df/dpH, df/dG)
   */
  calculateGradient(temp, ph, glucose) {
    const epsT = 0.05;
    const epsP = 0.01;
    const epsG = 0.05;

    const vBase = calculateViability(temp, ph, glucose, false);
    const vPlusT = calculateViability(temp + epsT, ph, glucose, false);
    const vMinusT = calculateViability(temp - epsT, ph, glucose, false);
    const df_dT = (vPlusT - vMinusT) / (2 * epsT);

    const vPlusP = calculateViability(temp, ph + epsP, glucose, false);
    const vMinusP = calculateViability(temp, ph - epsP, glucose, false);
    const df_dPH = (vPlusP - vMinusP) / (2 * epsP);

    const vPlusG = calculateViability(temp, ph, glucose + epsG, false);
    const vMinusG = calculateViability(temp, ph, glucose - epsG, false);
    const df_dG = (vPlusG - vMinusG) / (2 * epsG);

    const norm = Math.sqrt(df_dT * df_dT + df_dPH * df_dPH + df_dG * df_dG);

    return {
      df_dT,
      df_dPH,
      df_dG,
      norm,
      vBase
    };
  }

  /**
   * Rysuje 3 klasyczne wykresy 2D na białym tle (Nature / ggplot2 style)
   */
  renderSingleParamPlots(canvasTempId, canvasPHId, canvasGlucoseId) {
    this.drawParamCurve2D(
      canvasTempId,
      'Temperatura (°C)',
      CHO_CONSTANTS.TEMP_MIN,
      CHO_CONSTANTS.TEMP_MAX,
      CHO_CONSTANTS.OPT_TEMP,
      (t) => calculateViability(t, CHO_CONSTANTS.OPT_PH, CHO_CONSTANTS.OPT_GLUCOSE, false),
      (exp) => ({ x: exp.temp, y: exp.viability, id: exp.id }),
      '#4043A0',
      [20, 25, 30, 35, 37, 40, 45]
    );

    this.drawParamCurve2D(
      canvasPHId,
      'Kwasowość (pH)',
      CHO_CONSTANTS.PH_MIN,
      CHO_CONSTANTS.PH_MAX,
      CHO_CONSTANTS.OPT_PH,
      (p) => calculateViability(CHO_CONSTANTS.OPT_TEMP, p, CHO_CONSTANTS.OPT_GLUCOSE, false),
      (exp) => ({ x: exp.ph, y: exp.viability, id: exp.id }),
      '#C4455C',
      [5.5, 6.0, 6.5, 7.0, 7.2, 8.0, 9.0]
    );

    this.drawParamCurve2D(
      canvasGlucoseId,
      'Glukoza (g/L)',
      CHO_CONSTANTS.GLUCOSE_MIN,
      CHO_CONSTANTS.GLUCOSE_MAX,
      CHO_CONSTANTS.OPT_GLUCOSE,
      (g) => calculateViability(CHO_CONSTANTS.OPT_TEMP, CHO_CONSTANTS.OPT_PH, g, false),
      (exp) => ({ x: exp.glucose, y: exp.viability, id: exp.id }),
      '#059669',
      [0, 2, 4, 4.5, 6, 8, 10]
    );
  }

  drawParamCurve2D(canvasId, xLabel, minX, maxX, optX, fnCalc, fnMapExp, lineColor, xTicks) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    const rect = canvas.getBoundingClientRect();
    const w = rect.width || 320;
    const h = rect.height || 210;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    ctx.save();
    ctx.scale(dpr, dpr);

    const padL = 40;
    const padR = 16;
    const padT = 24;
    const padB = 34;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    // Jasne tło
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    // Siatka
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1;
    [0, 25, 50, 75, 100].forEach((v) => {
      const y = padT + plotH - (v / 100) * plotH;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + plotW, y);
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.font = '10px -apple-system, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${v}%`, padL - 6, y + 3.5);
    });

    // Krzywa
    const steps = 80;
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const xVal = minX + (i / steps) * (maxX - minX);
      const yVal = fnCalc(xVal);
      const px = padL + (i / steps) * plotW;
      const py = padT + plotH - (yVal / 100) * plotH;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2.8;
    ctx.stroke();

    // Optimum
    const optPx = padL + ((optX - minX) / (maxX - minX)) * plotW;
    ctx.save();
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = '#059669';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(optPx, padT);
    ctx.lineTo(optPx, padT + plotH);
    ctx.stroke();

    ctx.fillStyle = '#059669';
    ctx.font = 'bold 10px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Optimum: ${optX}`, optPx, padT - 6);
    ctx.restore();

    // Punkty prób
    this.history.forEach((exp) => {
      const mapped = fnMapExp(exp);
      if (mapped.x >= minX && mapped.x <= maxX) {
        const px = padL + ((mapped.x - minX) / (maxX - minX)) * plotW;
        const py = padT + plotH - (mapped.y / 100) * plotH;

        ctx.beginPath();
        ctx.arc(px, py, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#ea580c';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`#${mapped.id}`, px + 7, py - 4);
      }
    });

    // Osie
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(padL, padT);
    ctx.lineTo(padL, padT + plotH);
    ctx.lineTo(padL + plotW, padT + plotH);
    ctx.stroke();

    // Podziałki
    ctx.textAlign = 'center';
    ctx.fillStyle = '#1e293b';
    ctx.font = '10px -apple-system, sans-serif';
    xTicks.forEach((tick) => {
      const px = padL + ((tick - minX) / (maxX - minX)) * plotW;
      ctx.beginPath();
      ctx.moveTo(px, padT + plotH);
      ctx.lineTo(px, padT + plotH + 4);
      ctx.strokeStyle = '#0f172a';
      ctx.stroke();
      ctx.fillText(`${tick}`, px, padT + plotH + 16);
    });

    ctx.font = 'bold 11px -apple-system, sans-serif';
    ctx.fillText(xLabel, padL + plotW / 2, h - 4);

    ctx.restore();
  }

  // =========================================================================
  // SILNIK RENDEROWANIA POWIERZCHNI 3D (3D SURFACE PLOT) Z PŁASZCZYZNĄ STYCZNĄ
  // =========================================================================

  init3DEvents(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || canvas.dataset.has3dEvents) return;
    canvas.dataset.has3dEvents = 'true';

    this.canvas3D = canvas;
    this.ctx3D = canvas.getContext('2d');

    const onStart = (clientX, clientY) => {
      this.isDragging3D = true;
      this.lastMouseX = clientX;
      this.lastMouseY = clientY;
    };

    const onMove = (clientX, clientY) => {
      if (!this.isDragging3D) return;
      const dx = clientX - this.lastMouseX;
      const dy = clientY - this.lastMouseY;
      this.lastMouseX = clientX;
      this.lastMouseY = clientY;

      this.yaw += dx * 0.012;
      this.pitch = Math.max(0.15, Math.min(1.2, this.pitch + dy * 0.01));

      if (this.lastRenderParams) {
        this.render3DSurface(
          this.lastRenderParams.canvasId,
          this.lastRenderParams.currentTemp,
          this.lastRenderParams.currentPH,
          this.lastRenderParams.currentGlucose,
          this.lastRenderParams.trajectory,
          this.lastRenderParams.currentPoint
        );
      }
    };

    const onEnd = () => {
      this.isDragging3D = false;
    };

    canvas.addEventListener('mousedown', (e) => onStart(e.clientX, e.clientY));
    window.addEventListener('mousemove', (e) => onMove(e.clientX, e.clientY));
    window.addEventListener('mouseup', onEnd);

    canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) onStart(e.touches[0].clientX, e.touches[0].clientY);
    });
    window.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1) onMove(e.touches[0].clientX, e.touches[0].clientY);
    });
    window.addEventListener('touchend', onEnd);
  }

  /**
   * Renderuje trójwymiarową górę odpowiedzi (3D Surface) z płaszczyzną styczną gradientu
   */
  render3DSurface(canvasId, currentTemp, currentPH, fixedGlucose = 4.5, trajectory = null, currentPoint = null) {
    this.init3DEvents(canvasId);
    this.lastRenderParams = { canvasId, currentTemp, currentPH, currentGlucose: fixedGlucose, trajectory, currentPoint };

    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    const rect = canvas.getBoundingClientRect();
    const w = rect.width || 460;
    const h = rect.height || 340;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    ctx.save();
    ctx.scale(dpr, dpr);

    // 1. Czyste, jasne tło
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    // Transformacja 3D
    const cosY = Math.cos(this.yaw);
    const sinY = Math.sin(this.yaw);
    const cosP = Math.cos(this.pitch);
    const sinP = Math.sin(this.pitch);

    const scale = Math.min(w, h) * 0.44;
    const originX = w * 0.5;
    const originY = h * 0.54;

    const project = (x, y, z) => {
      // x: pH [-1, 1], y: Temp [-1, 1], z: Viability [0, 1.3]
      const x1 = x * cosY - y * sinY;
      const y1 = x * sinY + y * cosY;

      const z2 = z * cosP - y1 * sinP;
      const depth = z * sinP + y1 * cosP;

      const screenX = originX + x1 * scale;
      const screenY = originY - z2 * scale;
      return { sx: screenX, sy: screenY, depth };
    };

    // 2. Siatka powierzchni 3D
    const gridN = 22;
    const vertices = [];
    for (let i = 0; i <= gridN; i++) {
      vertices[i] = [];
      const pRatio = i / gridN;
      const ph = CHO_CONSTANTS.PH_MIN + pRatio * (CHO_CONSTANTS.PH_MAX - CHO_CONSTANTS.PH_MIN);
      const nx = (pRatio - 0.5) * 2; // -1 .. 1

      for (let j = 0; j <= gridN; j++) {
        const tRatio = j / gridN;
        const temp = CHO_CONSTANTS.TEMP_MIN + tRatio * (CHO_CONSTANTS.TEMP_MAX - CHO_CONSTANTS.TEMP_MIN);
        const ny = (tRatio - 0.5) * 2; // -1 .. 1

        const viability = calculateViability(temp, ph, fixedGlucose, false);
        const nz = (viability / 100) * 1.15; // Wysokość 0 .. 1.15

        const pt = project(nx, ny, nz);
        vertices[i][j] = { nx, ny, nz, ph, temp, viability, ...pt };
      }
    }

    // 3. Płaty czworokątne z sortowaniem od tyłu do przodu (Painter's Algorithm)
    const facets = [];
    for (let i = 0; i < gridN; i++) {
      for (let j = 0; j < gridN; j++) {
        const p1 = vertices[i][j];
        const p2 = vertices[i + 1][j];
        const p3 = vertices[i + 1][j + 1];
        const p4 = vertices[i][j + 1];

        const avgDepth = (p1.depth + p2.depth + p3.depth + p4.depth) / 4;
        const avgV = (p1.viability + p2.viability + p3.viability + p4.viability) / 4;

        facets.push({ p1, p2, p3, p4, avgDepth, avgV });
      }
    }
    facets.sort((a, b) => a.avgDepth - b.avgDepth);

    // 4. Rysowanie powierzchni 3D
    facets.forEach((f) => {
      ctx.beginPath();
      ctx.moveTo(f.p1.sx, f.p1.sy);
      ctx.lineTo(f.p2.sx, f.p2.sy);
      ctx.lineTo(f.p3.sx, f.p3.sy);
      ctx.lineTo(f.p4.sx, f.p4.sy);
      ctx.closePath();

      // Cieniowanie hipsometryczne (od błękitu przez zieleń do złota)
      ctx.fillStyle = this.get3DFacetColor(f.avgV);
      ctx.fill();
      ctx.strokeStyle = 'rgba(71, 85, 105, 0.22)';
      ctx.lineWidth = 0.6;
      ctx.stroke();
    });

    // 5. Osie przestrzenne 3D (pH, Temp, Viability)
    this.draw3DAxes(ctx, project, w, h);

    // 6. Dotychczasowe próby manualne na powierzchni 3D (żółte kule)
    this.history.forEach((exp) => {
      const pRatio = (exp.ph - CHO_CONSTANTS.PH_MIN) / (CHO_CONSTANTS.PH_MAX - CHO_CONSTANTS.PH_MIN);
      const tRatio = (exp.temp - CHO_CONSTANTS.TEMP_MIN) / (CHO_CONSTANTS.TEMP_MAX - CHO_CONSTANTS.TEMP_MIN);
      const nx = (pRatio - 0.5) * 2;
      const ny = (tRatio - 0.5) * 2;
      const nz = (exp.viability / 100) * 1.15;

      const pt = project(nx, ny, nz);
      ctx.beginPath();
      ctx.arc(pt.sx, pt.sy, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#ea580c';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 10px monospace';
      ctx.fillText(`#${exp.id}`, pt.sx + 8, pt.sy - 3);
    });

    // 7. Trajektoria wspinaczki 3D
    const traj = trajectory || this.gradientSteps;
    if (traj && traj.length > 1) {
      ctx.save();
      ctx.strokeStyle = '#C4455C';
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      traj.forEach((step, idx) => {
        const pr = (step.ph - CHO_CONSTANTS.PH_MIN) / (CHO_CONSTANTS.PH_MAX - CHO_CONSTANTS.PH_MIN);
        const tr = (step.temp - CHO_CONSTANTS.TEMP_MIN) / (CHO_CONSTANTS.TEMP_MAX - CHO_CONSTANTS.TEMP_MIN);
        const nx = (pr - 0.5) * 2;
        const ny = (tr - 0.5) * 2;
        const nz = (step.viability / 100) * 1.15;
        const pt = project(nx, ny, nz);

        if (idx === 0) ctx.moveTo(pt.sx, pt.sy);
        else ctx.lineTo(pt.sx, pt.sy);
      });
      ctx.stroke();

      // Punkty kroków
      traj.forEach((step, idx) => {
        const pr = (step.ph - CHO_CONSTANTS.PH_MIN) / (CHO_CONSTANTS.PH_MAX - CHO_CONSTANTS.PH_MIN);
        const tr = (step.temp - CHO_CONSTANTS.TEMP_MIN) / (CHO_CONSTANTS.TEMP_MAX - CHO_CONSTANTS.TEMP_MIN);
        const pt = project((pr - 0.5) * 2, (tr - 0.5) * 2, (step.viability / 100) * 1.15);

        ctx.beginPath();
        ctx.arc(pt.sx, pt.sy, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = '#C4455C';
        ctx.lineWidth = 2;
        ctx.stroke();
      });
      ctx.restore();
    }

    // 8. PŁASZCZYZNA STYCZNA GRADIENTU (TANGENT PLANE) W AKTUALNYM PUNKCIE
    const activePt = currentPoint || (traj && traj.length > 0 ? traj[traj.length - 1] : {
      temp: currentTemp,
      ph: currentPH,
      glucose: fixedGlucose,
      viability: calculateViability(currentTemp, currentPH, fixedGlucose, false)
    });

    if (activePt) {
      this.drawTangentPlane(ctx, project, activePt, fixedGlucose);
    }

    // 9. Oznaczenie szczytu globalnego
    const optPr = (CHO_CONSTANTS.OPT_PH - CHO_CONSTANTS.PH_MIN) / (CHO_CONSTANTS.PH_MAX - CHO_CONSTANTS.PH_MIN);
    const optTr = (CHO_CONSTANTS.OPT_TEMP - CHO_CONSTANTS.TEMP_MIN) / (CHO_CONSTANTS.TEMP_MAX - CHO_CONSTANTS.TEMP_MIN);
    const optPt = project((optPr - 0.5) * 2, (optTr - 0.5) * 2, 1.15);

    ctx.save();
    ctx.beginPath();
    ctx.arc(optPt.sx, optPt.sy, 11, 0, Math.PI * 2);
    ctx.fillStyle = '#10b981';
    ctx.fill();
    ctx.strokeStyle = '#064e3b';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('★', optPt.sx, optPt.sy + 1);

    ctx.fillStyle = '#065f46';
    ctx.font = 'bold 11px -apple-system, sans-serif';
    ctx.fillText('SZCZYT OPTIMUM (98.2%)', optPt.sx, optPt.sy - 18);
    ctx.restore();

    // Wskazówka interakcji 3D
    ctx.fillStyle = '#64748b';
    ctx.font = '10px -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('🖱️ Przeciągnij myszką, aby obrócić wykres 3D', w - 12, h - 10);

    ctx.restore();
  }

  /**
   * Rysuje płaszczyznę styczną gradientu w punkcie (Płaszczyzna styczna do zbocza z wektorem gradientu)
   */
  drawTangentPlane(ctx, project, pt, fixedGlucose) {
    const pRatio = (pt.ph - CHO_CONSTANTS.PH_MIN) / (CHO_CONSTANTS.PH_MAX - CHO_CONSTANTS.PH_MIN);
    const tRatio = (pt.temp - CHO_CONSTANTS.TEMP_MIN) / (CHO_CONSTANTS.TEMP_MAX - CHO_CONSTANTS.TEMP_MIN);
    const nx = (pRatio - 0.5) * 2;
    const ny = (tRatio - 0.5) * 2;
    const nz = (pt.viability / 100) * 1.15;

    // Obliczenie numerycznych pochodnych cząstkowych w znormalizowanej przestrzeni
    const grad = this.calculateGradient(pt.temp, pt.ph, pt.glucose || fixedGlucose);

    // Przeliczenie pochodnych na układ znormalizowany [-1, 1]
    const dZ_dNX = (grad.df_dPH * (CHO_CONSTANTS.PH_MAX - CHO_CONSTANTS.PH_MIN) / 200) * 1.15;
    const dZ_dNY = (grad.df_dT * (CHO_CONSTANTS.TEMP_MAX - CHO_CONSTANTS.TEMP_MIN) / 200) * 1.15;

    // Rozmiar płaszczyzny stycznej
    const s = 0.32;
    const c1 = project(nx - s, ny - s, nz - s * dZ_dNX - s * dZ_dNY);
    const c2 = project(nx + s, ny - s, nz + s * dZ_dNX - s * dZ_dNY);
    const c3 = project(nx + s, ny + s, nz + s * dZ_dNX + s * dZ_dNY);
    const c4 = project(nx - s, ny + s, nz - s * dZ_dNX + s * dZ_dNY);

    // Rysowanie płaszczyzny stycznej (półprzezroczysty karmin z obrysem)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(c1.sx, c1.sy);
    ctx.lineTo(c2.sx, c2.sy);
    ctx.lineTo(c3.sx, c3.sy);
    ctx.lineTo(c4.sx, c4.sy);
    ctx.closePath();
    ctx.fillStyle = 'rgba(196, 69, 92, 0.42)';
    ctx.fill();
    ctx.strokeStyle = '#C4455C';
    ctx.lineWidth = 2.4;
    ctx.stroke();

    // Wektor gradientu 3D leżący na płaszczyźnie (wskazujący kierunek wspinaczki)
    const center = project(nx, ny, nz);
    const arrowLen = 0.38;
    const arrowTarget = project(
      nx + Math.sign(grad.df_dPH) * Math.min(s, Math.abs(dZ_dNX) * 0.4),
      ny + Math.sign(grad.df_dT) * Math.min(s, Math.abs(dZ_dNY) * 0.4),
      nz + Math.sqrt(dZ_dNX * dZ_dNX + dZ_dNY * dZ_dNY) * 0.35
    );

    ctx.strokeStyle = '#9f1239';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(center.sx, center.sy);
    ctx.lineTo(arrowTarget.sx, arrowTarget.sy);
    ctx.stroke();

    // Punkt styczności
    ctx.beginPath();
    ctx.arc(center.sx, center.sy, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#9f1239';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Etykieta płaszczyzny stycznej
    ctx.fillStyle = '#9f1239';
    ctx.font = 'bold 11px -apple-system, sans-serif';
    ctx.fillText('Płaszczyzna styczna ∇f', center.sx + 14, center.sy - 12);

    ctx.restore();
  }

  draw3DAxes(ctx, project, w, h) {
    ctx.save();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.2;

    // Oś pH (od lewej do prawej)
    const pStart = project(-1, -1, 0);
    const pEnd = project(1, -1, 0);
    ctx.beginPath();
    ctx.moveTo(pStart.sx, pStart.sy);
    ctx.lineTo(pEnd.sx, pEnd.sy);
    ctx.stroke();

    ctx.fillStyle = '#1e293b';
    ctx.font = '10px -apple-system, sans-serif';
    ctx.fillText('pH 5.5', pStart.sx - 10, pStart.sy + 14);
    ctx.fillText('pH 9.0', pEnd.sx + 5, pEnd.sy + 14);

    // Oś Temperatura (w głąb)
    const tEnd = project(-1, 1, 0);
    ctx.beginPath();
    ctx.moveTo(pStart.sx, pStart.sy);
    ctx.lineTo(tEnd.sx, tEnd.sy);
    ctx.stroke();
    ctx.fillText('20°C', pStart.sx - 35, pStart.sy - 2);
    ctx.fillText('45°C', tEnd.sx - 35, tEnd.sy - 2);

    // Oś Z pionowa (Żywotność)
    const zTop = project(-1, -1, 1.15);
    ctx.beginPath();
    ctx.moveTo(pStart.sx, pStart.sy);
    ctx.lineTo(zTop.sx, zTop.sy);
    ctx.stroke();
    ctx.fillText('100%', zTop.sx - 32, zTop.sy + 4);
    ctx.fillText('0%', pStart.sx - 20, pStart.sy + 4);

    ctx.restore();
  }

  get3DFacetColor(v) {
    const norm = Math.max(0, Math.min(1, v / 100));
    if (norm < 0.25) {
      const t = norm / 0.25;
      return `rgb(${Math.round(230 - t * 30)}, ${Math.round(238 - t * 20)}, ${Math.round(252 - t * 10)})`;
    } else if (norm < 0.5) {
      const t = (norm - 0.25) / 0.25;
      return `rgb(${Math.round(195 - t * 45)}, ${Math.round(225 + t * 20)}, ${Math.round(245 - t * 45)})`;
    } else if (norm < 0.75) {
      const t = (norm - 0.5) / 0.25;
      return `rgb(${Math.round(150 - t * 30)}, ${Math.round(242 - t * 5)}, ${Math.round(195 - t * 65)})`;
    } else {
      const t = (norm - 0.75) / 0.25;
      return `rgb(${Math.round(120 + t * 125)}, ${Math.round(238 - t * 15)}, ${Math.round(130 - t * 100)})`;
    }
  }

  // =========================================================================
  // PEŁNY ALGORYTM WSPINACZKI GRADIENTOWEJ Z TABELĄ WYLICZEŃ KROK PO KROKU
  // =========================================================================

  runOptimizationAnimation(startTemp, startPH, startGlucose, onStep, onFinish) {
    let curT = startTemp;
    let curP = startPH;
    let curG = startGlucose;
    let step = 0;
    const maxSteps = 15;

    this.stepCalculations = [];
    this.gradientSteps = [];

    const gamma = 0.28; // Współczynnik kroku (learning rate)

    // Interwał 700 ms - spowolniona animacja, aby użytkownik zdążył zobaczyć każdy krok
    const interval = setInterval(() => {
      const viability = calculateViability(curT, curP, curG, false);
      const grad = this.calculateGradient(curT, curP, curG);

      // Zapisujemy wyliczenie kroku k
      const deltaT = (CHO_CONSTANTS.OPT_TEMP - curT) * gamma;
      const deltaP = (CHO_CONSTANTS.OPT_PH - curP) * gamma;
      const deltaG = (CHO_CONSTANTS.OPT_GLUCOSE - curG) * gamma;

      const calcRow = {
        step,
        temp: Math.round(curT * 10) / 10,
        ph: Math.round(curP * 100) / 100,
        glucose: Math.round(curG * 10) / 10,
        viability: Math.round(viability * 10) / 10,
        df_dT: Math.round(grad.df_dT * 100) / 100,
        df_dPH: Math.round(grad.df_dPH * 100) / 100,
        df_dG: Math.round(grad.df_dG * 100) / 100,
        gradNorm: Math.round(grad.norm * 100) / 100,
        deltaT: Math.round(deltaT * 100) / 100,
        deltaP: Math.round(deltaP * 100) / 100,
        deltaG: Math.round(deltaG * 100) / 100
      };

      this.stepCalculations.push(calcRow);
      this.gradientSteps.push({
        temp: calcRow.temp,
        ph: calcRow.ph,
        glucose: calcRow.glucose,
        viability: calcRow.viability
      });

      if (onStep) {
        onStep({
          step,
          maxSteps,
          calcRow,
          allCalculations: this.stepCalculations,
          trajectory: this.gradientSteps
        });
      }

      // Aktualizacja parametrów na następny krok
      curT += deltaT;
      curP += deltaP;
      curG += deltaG;
      step++;

      if (step >= maxSteps || (Math.abs(CHO_CONSTANTS.OPT_TEMP - curT) < 0.08 && Math.abs(CHO_CONSTANTS.OPT_PH - curP) < 0.02 && Math.abs(CHO_CONSTANTS.OPT_GLUCOSE - curG) < 0.05)) {
        clearInterval(interval);

        // Finałowy stan optimum
        const finalViab = calculateViability(CHO_CONSTANTS.OPT_TEMP, CHO_CONSTANTS.OPT_PH, CHO_CONSTANTS.OPT_GLUCOSE, false);

        const finalRow = {
          step,
          temp: CHO_CONSTANTS.OPT_TEMP,
          ph: CHO_CONSTANTS.OPT_PH,
          glucose: CHO_CONSTANTS.OPT_GLUCOSE,
          viability: Math.round(finalViab * 10) / 10,
          df_dT: 0.00,
          df_dPH: 0.00,
          df_dG: 0.00,
          gradNorm: 0.00,
          deltaT: 0.00,
          deltaP: 0.00,
          deltaG: 0.00
        };
        this.stepCalculations.push(finalRow);

        if (onFinish) {
          onFinish({
            finalTemp: CHO_CONSTANTS.OPT_TEMP,
            finalPH: CHO_CONSTANTS.OPT_PH,
            finalGlucose: CHO_CONSTANTS.OPT_GLUCOSE,
            viability: finalViab,
            allCalculations: this.stepCalculations,
            trajectory: this.gradientSteps
          });
        }
      }
    }, 700);
  }
}
