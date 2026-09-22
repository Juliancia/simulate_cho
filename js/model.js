/**
 * model.js - Biologiczny model symulacji hodowli komórek ssaczych CHO (Chinese Hamster Ovary)
 * Dla: SKN Cyfrowi Biolodzy
 */

export const CHO_CONSTANTS = {
  OPT_TEMP: 37.0,      // Optymalna temperatura (°C)
  OPT_PH: 7.20,        // Optymalne pH
  OPT_GLUCOSE: 4.5,    // Optymalne stężenie glukozy (g/L)

  TEMP_MIN: 20.0,
  TEMP_MAX: 45.0,

  PH_MIN: 5.5,
  PH_MAX: 9.0,

  GLUCOSE_MIN: 0.0,
  GLUCOSE_MAX: 10.0,

  MAX_VCD: 8.5,        // Maksymalna gęstość żywych komórek (mln komórek/mL)
  BASE_COST_PLN: 180,  // Średni koszt 1 eksperymentu manualnego (pożywka, naczynia, testy)
  TIME_DAYS: 3.5       // Czas trwania hodowli w inkubatorze (dni)
};

/**
 * Wylicza żywotność (viability %) komórek CHO na podstawie parametrów środowiska
 * Wykorzystuje funkcje Gaussa oraz nieliniowe zjawiska biologiczne (np. asymetria denaturacji termicznej)
 */
export function calculateViability(temp, ph, glucose, addNoise = false) {
  // 1. Czynnik temperaturowy (silna asymetria: wysoka temperatura zabija gwałtowniej niż niska)
  let tempFactor = 0;
  if (temp <= CHO_CONSTANTS.OPT_TEMP) {
    // Spadek w stronę hipotermii (spowolnienie metaboliczne, zahamowanie w G1)
    const sigmaCold = 6.0;
    tempFactor = Math.exp(-Math.pow(temp - CHO_CONSTANTS.OPT_TEMP, 2) / (2 * Math.pow(sigmaCold, 2)));
  } else {
    // Spadek w stronę hipertermii (denaturacja białek, szok cieplny, szybka apoptoza)
    const sigmaHeat = 2.4;
    tempFactor = Math.exp(-Math.pow(temp - CHO_CONSTANTS.OPT_TEMP, 2) / (2 * Math.pow(sigmaHeat, 2)));
  }

  // 2. Czynnik pH (wąskie okno fizjologiczne 7.0 - 7.4)
  const sigmaPH = 0.55;
  const phFactor = Math.exp(-Math.pow(ph - CHO_CONSTANTS.OPT_PH, 2) / (2 * Math.pow(sigmaPH, 2)));

  // 3. Czynnik glukozy (brak = śmierć głodowa; nadmiar = stres hiperosmotyczny + toksyczny mleczan)
  let glucoseFactor = 0;
  if (glucose <= CHO_CONSTANTS.OPT_GLUCOSE) {
    // Znormalizowana kinetyka Monoda osiągająca 1.0 w punkcie optymalnym
    const gVal = glucose / (glucose + 0.5);
    const gOpt = CHO_CONSTANTS.OPT_GLUCOSE / (CHO_CONSTANTS.OPT_GLUCOSE + 0.5);
    glucoseFactor = gVal / gOpt;
  } else {
    // Hamowanie nadmiarem substratu i kwasica mleczanowa
    const excess = glucose - CHO_CONSTANTS.OPT_GLUCOSE;
    glucoseFactor = 1.0 / (1.0 + 0.12 * Math.pow(excess, 1.6));
  }

  // Łączna żywotność bazowa w skali 0.0 - 1.0
  let viability = tempFactor * phFactor * glucoseFactor;

  // Realistyczny szum biologiczny (±1.5%) jeśli włączony
  if (addNoise) {
    const noise = (Math.random() - 0.5) * 0.03;
    viability = Math.max(0, Math.min(0.985, viability + noise));
  }

  // Skalowanie do procentów: maksymalna żywotność w idealnych warunkach to ~98% (naturalna apoptoza)
  const viabilityPercent = Math.max(1.0, Math.min(98.2, viability * 98.2));
  return viabilityPercent;
}

/**
 * Wylicza gęstość komórek żywych (VCD - Viable Cell Density w mln/mL)
 */
export function calculateVCD(viabilityPercent, glucose) {
  const viabilityNorm = viabilityPercent / 100;
  // Gęstość rośnie wraz z żywotnością i dostępnością pożywki
  const growthMultiplier = Math.pow(viabilityNorm, 2.2);
  const substrateFactor = Math.min(1.0, glucose / 3.0);
  const vcd = CHO_CONSTANTS.MAX_VCD * growthMultiplier * substrateFactor;
  return Math.max(0.05, Math.round(vcd * 100) / 100);
}

/**
 * Ocenia jakość hodowli dla użytkownika
 */
export function evaluateCulture(viabilityPercent, vcd) {
  if (viabilityPercent >= 90 && vcd >= 4.0) {
    return {
      status: "success",
      title: "Doskonała hodowla!",
      message: "Parametry zbliżone do optimum bioreaktora przemysłowego. Wysoka ekspresja białka!",
      badge: "Sukces przemysłowy"
    };
  } else if (viabilityPercent >= 75 && vcd >= 2.0) {
    return {
      status: "warning",
      title: "Hodowla umiarkowana",
      message: "Komórki przeżyły, ale stres środowiskowy ogranicza tempo podziałów i plon.",
      badge: "Wymaga optymalizacji"
    };
  } else {
    return {
      status: "danger",
      title: "Krytyczny stan hodowli",
      message: "Większość komórek obumarła lub uległa lizie. Błękit trypanu wniknął do cytoplazmy.",
      badge: "Liza / Apoptoza"
    };
  }
}
