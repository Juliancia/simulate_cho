/**
 * microscope.js - Silnik wizualizacji mikroskopu Canvas dla komórek CHO
 * Obsługuje: renderowanie komórek, test błękitem trypanu, siatkę Bürkera, organiczny ruch
 * Dla: SKN Cyfrowi Biolodzy
 */

export class MicroscopeEngine {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    
    this.cells = [];
    this.totalCellsTarget = 80;
    this.stainProgress = 0; // 0 = brak barwnika, 0..1 = animacja wlewania, 1 = pełne wybarwienie
    this.isStaining = false;
    this.showBurkerGrid = true;
    this.zoom = 1.0;
    this.animFrameId = null;
    this.lastTime = performance.now();
    
    this.currentViability = 0;
    this.currentVCD = 0;
    this.stained = false;
    
    this.onCountComplete = null;
    
    this.setupCanvas();
    window.addEventListener('resize', () => this.setupCanvas());
    this.startLoop();
  }

  setupCanvas() {
    if (!this.canvas) return;
    const wrapper = this.canvas.parentElement;
    if (!wrapper) return;

    // Pobieramy dostępną szerokość z nadrzędnego panelu (glass-panel)
    const card = this.canvas.closest('.glass-panel') || wrapper.parentElement || wrapper;
    const cardRect = card.getBoundingClientRect();
    if (cardRect.width <= 0) return;

    // Szerokość wewnątrz panelu z uwzględnieniem paddingu panelu (ok. 48px) i obramowania tubusu (28px)
    const availableWidth = cardRect.width - 56;
    
    // Na komputerze (desktop) okular mikroskopu ma duży, pierwotny rozmiar 480px.
    // Na urządzeniach mobilnych płynnie dopasowuje się do szerokości ekranu (min 240px).
    const size = Math.round(Math.max(240, Math.min(availableWidth, 480)));
    const dpr = window.devicePixelRatio || 1;
    
    const oldWidth = this.width;
    this.canvas.width = size * dpr;
    this.canvas.height = size * dpr;
    this.canvas.style.width = `${size}px`;
    this.canvas.style.height = `${size}px`;
    
    this.width = size;
    this.height = size;
    this.dpr = dpr;

    // Jeśli komórki już istniały, a rozmiar Canvasu uległ zmianie, płynnie przeskaluj ich pozycje
    if (this.cells && this.cells.length > 0 && oldWidth && oldWidth !== size) {
      const scale = size / oldWidth;
      const oldCenter = oldWidth / 2;
      const newCenter = size / 2;
      for (const cell of this.cells) {
        cell.x = newCenter + (cell.x - oldCenter) * scale;
        cell.y = newCenter + (cell.y - oldCenter) * scale;
        cell.originX = newCenter + (cell.originX - oldCenter) * scale;
        cell.originY = newCenter + (cell.originY - oldCenter) * scale;
      }
    }
  }

  /**
   * Inicjalizuje nową próbkę komórek na podstawie wyliczonej żywotności i gęstości
   */
  loadSample(viabilityPercent, vcd, immediateStain = false) {
    this.currentViability = viabilityPercent;
    this.currentVCD = vcd;
    this.stained = immediateStain;
    this.stainProgress = immediateStain ? 1.0 : 0.0;
    this.isStaining = false;

    // Liczba widocznych komórek w polu widzenia zależy od gęstości VCD
    const count = Math.min(130, Math.max(25, Math.round(vcd * 14)));
    this.cells = [];

    // Dokładna proporcja komórek żywych do martwych zgodna z viabilityPercent
    const aliveCount = Math.max(0, Math.min(count, Math.round(count * (viabilityPercent / 100))));
    const deadCount = count - aliveCount;
    this.cellStats = {
      total: count,
      alive: aliveCount,
      dead: deadCount,
      viability: count > 0 ? (aliveCount / count) * 100 : 0
    };

    // Przygotowanie przetasowanej tablicy stanów (Fisher-Yates)
    const aliveStates = [];
    for (let i = 0; i < aliveCount; i++) aliveStates.push(true);
    for (let i = 0; i < deadCount; i++) aliveStates.push(false);
    for (let i = aliveStates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [aliveStates[i], aliveStates[j]] = [aliveStates[j], aliveStates[i]];
    }

    const w = (this.width && this.width > 50) ? this.width : 380;
    const h = (this.height && this.height > 50) ? this.height : 380;
    const radiusField = Math.max(30, (w / 2) - 18);
    const centerX = w / 2;
    const centerY = h / 2;

    for (let i = 0; i < count; i++) {
      // Losowanie pozycji wewnątrz koła mikroskopu
      const angle = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * (radiusField - 15);
      const x = centerX + Math.cos(angle) * r;
      const y = centerY + Math.sin(angle) * r;

      // Rozmiar komórki CHO (12-18 mikrometrów, w pikselach ok. 7-13px)
      const baseRadius = 7.5 + Math.random() * 4.5;

      // Czy dana komórka jest żywa czy martwa na podstawie wyliczonego % żywotności (dokładna proporcja)
      const isAlive = aliveStates[i];

      this.cells.push({
        x,
        y,
        originX: x,
        originY: y,
        radius: baseRadius,
        isAlive,
        driftPhaseX: Math.random() * Math.PI * 2,
        driftPhaseY: Math.random() * Math.PI * 2,
        driftSpeed: 0.3 + Math.random() * 0.4,
        rotation: Math.random() * Math.PI * 2,
        granularity: Array.from({ length: 5 }, () => ({
          ox: (Math.random() - 0.5) * (baseRadius * 0.8),
          oy: (Math.random() - 0.5) * (baseRadius * 0.8),
          r: 1.0 + Math.random() * 1.5
        }))
      });
    }
  }

  /**
   * Uruchamia animację dodania błękitu trypanu
   */
  applyTrypanBlue(onComplete) {
    if (this.isStaining || this.stained) {
      if (onComplete) onComplete();
      return;
    }

    this.isStaining = true;
    this.stainProgress = 0;
    this.onCountComplete = onComplete;
  }

  toggleBurkerGrid() {
    this.showBurkerGrid = !this.showBurkerGrid;
  }

  startLoop() {
    const loop = (timestamp) => {
      const dt = (timestamp - this.lastTime) / 1000;
      this.lastTime = timestamp;

      this.update(dt);
      this.draw();

      this.animFrameId = requestAnimationFrame(loop);
    };
    this.animFrameId = requestAnimationFrame(loop);
  }

  update(dt) {
    // Animacja wlewania barwnika
    if (this.isStaining) {
      this.stainProgress += dt * 0.9;
      if (this.stainProgress >= 1.0) {
        this.stainProgress = 1.0;
        this.isStaining = false;
        this.stained = true;
        if (this.onCountComplete) {
          this.onCountComplete();
          this.onCountComplete = null;
        }
      }
    }

    // Delikatny organiczny ruch Browna komórek w zawiesinie
    const time = performance.now() * 0.001;
    for (const c of this.cells) {
      c.x = c.originX + Math.sin(time * c.driftSpeed + c.driftPhaseX) * 2.5;
      c.y = c.originY + Math.cos(time * c.driftSpeed + c.driftPhaseY) * 2.5;
    }
  }

  draw() {
    try {
      const ctx = this.ctx;
      const w = (this.width && this.width > 50) ? this.width : 380;
      const h = (this.height && this.height > 50) ? this.height : 380;
      const centerX = w / 2;
      const centerY = h / 2;
      const radius = Math.max(20, w / 2 - 8);

      ctx.save();
      ctx.scale(this.dpr, this.dpr);

      // 1. Tło poza okularem mikroskopu (ciemny metal tubusu)
      ctx.fillStyle = '#0b0f19';
      ctx.fillRect(0, 0, w, h);

      // 2. Maska okularu mikroskopu (koło)
      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.clip();

    // 3. Płyn hodowlany (jasne tło z lekkim odcieniem pożywki DMEM/F12 z czerwienią fenolową)
    const baseGradient = ctx.createRadialGradient(
      centerX - radius * 0.2, centerY - radius * 0.2, 10,
      centerX, centerY, radius
    );
    baseGradient.addColorStop(0, '#fbf8f5');
    baseGradient.addColorStop(0.7, '#f4ece1');
    baseGradient.addColorStop(1, '#e2d3c1');
    ctx.fillStyle = baseGradient;
    ctx.fillRect(0, 0, w, h);

    // 4. Efekt fali błękitu trypanu w trakcie barwienia
    if (this.stainProgress > 0) {
      const stainAlpha = Math.min(0.22, this.stainProgress * 0.22);
      ctx.fillStyle = `rgba(30, 64, 175, ${stainAlpha})`;
      ctx.fillRect(0, 0, w, h);

      // Fala rozchodząca się od krawędzi
      if (this.isStaining) {
        const waveRadius = radius * 2 * this.stainProgress;
        const waveGrad = ctx.createRadialGradient(centerX, centerY - radius, 0, centerX, centerY - radius, waveRadius);
        waveGrad.addColorStop(0, 'rgba(59, 130, 246, 0.35)');
        waveGrad.addColorStop(0.7, 'rgba(37, 99, 235, 0.2)');
        waveGrad.addColorStop(1, 'rgba(30, 58, 138, 0)');
        ctx.fillStyle = waveGrad;
        ctx.fillRect(0, 0, w, h);
      }
    }

    // 5. Siatka komory Bürkera (Hemocytometr)
    if (this.showBurkerGrid) {
      this.drawBurkerGrid(ctx, centerX, centerY, radius);
    }

    // 6. Rysowanie komórek CHO
    for (const cell of this.cells) {
      this.drawCHOCell(ctx, cell);
    }

    // 7. Odblaski optyczne soczewki (soczewka mikroskopu)
    this.drawLensReflections(ctx, centerX, centerY, radius);

    ctx.restore(); // koniec przycinania koła

    // 8. Metalowa oprawa tubusu okularu
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.lineWidth = 14;
    ctx.strokeStyle = '#1e293b';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius - 6, 0, Math.PI * 2);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#475569';
    ctx.stroke();

    ctx.restore();
    } catch (e) {
      console.warn('Microscope draw error:', e);
    }
  }

  /**
   * Rysuje precyzyjną siatkę komory Bürkera / Neubauera
   */
  drawBurkerGrid(ctx, cx, cy, radius) {
    ctx.save();
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.32)';
    ctx.lineWidth = 0.8;

    const step = 38;
    const numLines = Math.floor(radius / step);

    for (let i = -numLines; i <= numLines; i++) {
      const pos = i * step;

      // Linie główne potrójne (charakterystyczne dla komory Bürkera)
      if (i % 3 === 0) {
        ctx.strokeStyle = 'rgba(71, 85, 105, 0.5)';
        ctx.lineWidth = 1.2;
      } else {
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.28)';
        ctx.lineWidth = 0.7;
      }

      // Pionowe
      ctx.beginPath();
      ctx.moveTo(cx + pos, cy - radius);
      ctx.lineTo(cx + pos, cy + radius);
      ctx.stroke();

      // Poziome
      ctx.beginPath();
      ctx.moveTo(cx - radius, cy + pos);
      ctx.lineTo(cx + radius, cy + pos);
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * Rysuje pojedynczą komórkę CHO z uwzględnieniem stanu żywotności i wybarwienia
   */
  drawCHOCell(ctx, cell) {
    const { x, y, radius, isAlive } = cell;
    const stainRatio = this.stainProgress;

    ctx.save();
    ctx.translate(x, y);

    if (isAlive) {
      // --- KOMÓRKA ŻYWA ---
      // Nienaruszona błona komórkowa wypycha/nie wpuszcza błękitu trypanu.
      // Komórka jest refrakcyjna (błyszcząca), jasna, z delikatnym jądrem i zdrową błoną.

      // 1. Zewnętrzne halo refrakcyjne (faza kontrastowa)
      ctx.beginPath();
      ctx.arc(0, 0, radius + 2.2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.fill();

      // 2. Ciało komórki (cytoplazma)
      const grad = ctx.createRadialGradient(-radius * 0.3, -radius * 0.3, 1, 0, 0, radius);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.6, '#f8fafc');
      grad.addColorStop(1, '#cbd5e1');
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      // 3. Wyraźna, nienaruszona błona komórkowa
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.75)';
      ctx.lineWidth = 1.4;
      ctx.stroke();

      // 4. Jądro komórkowe (jasne, zdrowe)
      ctx.beginPath();
      ctx.arc(-radius * 0.15, -radius * 0.1, radius * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(148, 163, 184, 0.5)';
      ctx.fill();

      // 5. Ziarnistości wewnątrzkomórkowe (organelle CHO)
      for (const g of cell.granularity) {
        ctx.beginPath();
        ctx.arc(g.ox, g.oy, g.r * 0.7, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(100, 116, 139, 0.35)';
        ctx.fill();
      }

      // 6. Odblask świetlny na kulistej powierzchni komórki
      ctx.beginPath();
      ctx.arc(-radius * 0.35, -radius * 0.35, radius * 0.28, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fill();

    } else {
      // --- KOMÓRKA MARTWA ---
      // Błona przepuszczalna: błękit trypanu wnika gwałtownie do wnętrza komórki.
      // Wybarwia się na charakterystyczny intensywny błękit kobaltowy z ciemnym jądrem.

      if (stainRatio > 0.05) {
        // Stopniowe wybarwianie barwnikiem
        const blueIntensity = stainRatio;

        // Ciało komórki przepojone błękitem trypanu
        const deadGrad = ctx.createRadialGradient(0, 0, 1, 0, 0, radius);
        deadGrad.addColorStop(0, `rgba(30, 58, 138, ${blueIntensity * 0.95})`);
        deadGrad.addColorStop(0.6, `rgba(29, 78, 216, ${blueIntensity * 0.9})`);
        deadGrad.addColorStop(1, `rgba(30, 64, 175, ${blueIntensity * 0.98})`);

        ctx.beginPath();
        ctx.arc(0, 0, radius * 0.95, 0, Math.PI * 2);
        ctx.fillStyle = deadGrad;
        ctx.fill();

        // Uszkodzona, nieregularna błona (blebbing/liza)
        ctx.strokeStyle = `rgba(15, 23, 42, ${blueIntensity * 0.9})`;
        ctx.lineWidth = 1.6;
        ctx.stroke();

        // Mocno wybarwione jądro martwej komórki
        ctx.beginPath();
        ctx.arc(0, 0, radius * 0.45, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(15, 23, 42, ${blueIntensity * 0.85})`;
        ctx.fill();

      } else {
        // Przed dodaniem barwnika: komórka martwa wygląda na lekko zmętniałą, ale jeszcze niebieską
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fillStyle = '#94a3b8';
        ctx.fill();
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1.0;
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  /**
   * Realistyczny odblask na soczewce mikroskopu
   */
  drawLensReflections(ctx, cx, cy, radius) {
    const lensGrad = ctx.createLinearGradient(
      cx - radius, cy - radius,
      cx + radius, cy + radius
    );
    lensGrad.addColorStop(0, 'rgba(255, 255, 255, 0.18)');
    lensGrad.addColorStop(0.25, 'rgba(255, 255, 255, 0.04)');
    lensGrad.addColorStop(0.6, 'rgba(0, 0, 0, 0)');
    lensGrad.addColorStop(0.85, 'rgba(59, 130, 246, 0.05)');
    lensGrad.addColorStop(1, 'rgba(30, 64, 175, 0.14)');

    ctx.fillStyle = lensGrad;
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
  }

  destroy() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
    }
  }
}

