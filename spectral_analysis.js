/**
 * spectral_analysis.js - Automated Peak Detection, Component Identification, and e/m Extraction.
 * Pure JavaScript ES6 Module.
 */

import {
  BOHR_MAGNETON, H_PLANCK, C_LIGHT, E_OVER_M_CODATA, E_CHARGE, M_ELECTRON,
  SODIUM_D1, SODIUM_D2, CADMIUM_SINGLET
} from './physics.js';
import { generateSyntheticSpectrum } from './simulation.js';

/**
 * Estimate slowly-varying spectral baseline using a rolling percentile.
 */
export function estimateBaseline(y, windowFrac = 0.15) {
  const n = y.length;
  let windowSize = Math.max(11, Math.floor(n * windowFrac));
  if (windowSize % 2 === 0) windowSize++;
  const halfWin = Math.floor(windowSize / 2);

  const baseline = new Float64Array(n);
  const buffer = new Float64Array(windowSize);

  for (let i = 0; i < n; i++) {
    let count = 0;
    for (let w = -halfWin; w <= halfWin; w++) {
      const idx = Math.min(n - 1, Math.max(0, i + w));
      buffer[count++] = y[idx];
    }
    // Sort buffer chunk to find 15th percentile
    buffer.subarray(0, count).sort();
    const pIdx = Math.floor(count * 0.15);
    baseline[i] = buffer[pIdx];
  }
  return baseline;
}

/**
 * Calculate Median Absolute Deviation (MAD) of first differences.
 */
export function estimateNoiseSigmaMad(y) {
  const n = y.length;
  if (n < 3) return 0.01;
  const diffs = new Float64Array(n - 1);
  for (let i = 0; i < n - 1; i++) {
    diffs[i] = y[i + 1] - y[i];
  }
  diffs.sort();
  const medianDiff = diffs[Math.floor(diffs.length / 2)];

  const absDevs = new Float64Array(n - 1);
  for (let i = 0; i < n - 1; i++) {
    absDevs[i] = Math.abs(diffs[i] - medianDiff);
  }
  absDevs.sort();
  const mad = absDevs[Math.floor(absDevs.length / 2)];
  return (1.4826 * mad) / Math.SQRT2;
}

/**
 * Refine peak centroid, amplitude, and FWHM via parabolic / 3-point Gaussian fitting.
 */
export function refinePeakCentroid(wavelengths, intensities, peakIdx, halfWin = 8) {
  const n = wavelengths.length;
  const iMin = Math.max(0, peakIdx - halfWin);
  const iMax = Math.min(n - 1, peakIdx + halfWin);

  if (peakIdx <= 0 || peakIdx >= n - 1) {
    return {
      wavelengthNm: wavelengths[peakIdx],
      intensity: intensities[peakIdx],
      fwhmNm: 0.005
    };
  }

  // 3-point logarithmic Gaussian estimator: y = A * exp(-(x - x0)^2 / (2*sigma^2))
  // ln(y) is a quadratic: a*x^2 + b*x + c
  const y1 = Math.max(1e-4, intensities[peakIdx - 1]);
  const y2 = Math.max(1e-4, intensities[peakIdx]);
  const y3 = Math.max(1e-4, intensities[peakIdx + 1]);

  const l1 = Math.log(y1);
  const l2 = Math.log(y2);
  const l3 = Math.log(y3);

  const denom = 2.0 * (2.0 * l2 - l1 - l3);
  let deltaIndex = 0.0;
  if (Math.abs(denom) > 1e-9) {
    deltaIndex = (l3 - l1) / denom;
    if (Math.abs(deltaIndex) > 1.2) deltaIndex = 0.0; // clamp drift
  }

  const dLam = wavelengths[1] - wavelengths[0];
  const refinedLam = wavelengths[peakIdx] + deltaIndex * dLam;
  const refinedAmp = intensities[peakIdx] + 0.5 * Math.abs(deltaIndex) * Math.abs(y2 - Math.min(y1, y3));

  // Estimate FWHM by finding half-max points in local window
  const halfHeight = refinedAmp / 2.0;
  let leftLam = wavelengths[iMin];
  for (let i = peakIdx; i >= iMin; i--) {
    if (intensities[i] <= halfHeight) {
      const frac = (halfHeight - intensities[i]) / Math.max(1e-6, intensities[i + 1] - intensities[i]);
      leftLam = wavelengths[i] + frac * (wavelengths[i + 1] - wavelengths[i]);
      break;
    }
  }

  let rightLam = wavelengths[iMax];
  for (let i = peakIdx; i <= iMax; i++) {
    if (intensities[i] <= halfHeight) {
      const frac = (halfHeight - intensities[i - 1]) / Math.max(1e-6, intensities[i] - intensities[i - 1]);
      rightLam = wavelengths[i - 1] + frac * (wavelengths[i] - wavelengths[i - 1]);
      break;
    }
  }

  const fwhmNm = Math.max(0.001, rightLam - leftLam);

  return {
    wavelengthNm: refinedLam,
    intensity: refinedAmp,
    fwhmNm
  };
}

/**
 * Automatically detect spectral peaks and fit sub-pixel centroids.
 */
export function detectSpectralPeaks(wavelengths, intensities, options = {}) {
  const {
    prominenceFraction = 0.06,
    heightFraction = 0.05,
    minDistanceSamples = 20,
    refineCentroids = true
  } = options;

  const n = wavelengths.length;
  const baseline = estimateBaseline(intensities);
  const correctedY = new Float64Array(n);
  let maxVal = 0.0;

  for (let i = 0; i < n; i++) {
    correctedY[i] = Math.max(0.0, intensities[i] - baseline[i]);
    if (correctedY[i] > maxVal) maxVal = correctedY[i];
  }

  const sigmaMad = estimateNoiseSigmaMad(correctedY);
  const promThreshold = Math.max(prominenceFraction * maxVal, 4.0 * sigmaMad, 0.03);
  const heightThreshold = Math.max(heightFraction * maxVal, 3.5 * sigmaMad, 0.04);

  // Candidate local maxima
  const candidateIndices = [];
  for (let i = 1; i < n - 1; i++) {
    if (correctedY[i] > correctedY[i - 1] && correctedY[i] >= correctedY[i + 1]) {
      if (correctedY[i] >= heightThreshold) {
        candidateIndices.push(i);
      }
    }
  }

  // Filter candidates by prominence and min distance
  const validPeaks = [];
  for (const idx of candidateIndices) {
    const val = correctedY[idx];

    // Find left minimum before higher peak
    let leftMin = val;
    for (let l = idx - 1; l >= 0; l--) {
      if (correctedY[l] < leftMin) leftMin = correctedY[l];
      if (correctedY[l] > val) break;
    }

    // Find right minimum before higher peak
    let rightMin = val;
    for (let r = idx + 1; r < n; r++) {
      if (correctedY[r] < rightMin) rightMin = correctedY[r];
      if (correctedY[r] > val) break;
    }

    const prom = val - Math.max(leftMin, rightMin);
    if (prom >= promThreshold) {
      validPeaks.push({
        index: idx,
        rawWavelengthNm: wavelengths[idx],
        intensity: val,
        prominence: prom
      });
    }
  }

  // Enforce minimum distance separation
  validPeaks.sort((a, b) => b.intensity - a.intensity);
  const filteredPeaks = [];
  for (const p of validPeaks) {
    const tooClose = filteredPeaks.some(f => Math.abs(f.index - p.index) < minDistanceSamples);
    if (!tooClose) {
      filteredPeaks.push(p);
    }
  }
  filteredPeaks.sort((a, b) => a.index - b.index);

  // Centroid refinement
  const detected = [];
  for (const p of filteredPeaks) {
    let finalLam = p.rawWavelengthNm;
    let finalAmp = p.intensity;
    let finalFwhm = 0.005;

    if (refineCentroids) {
      const ref = refinePeakCentroid(wavelengths, correctedY, p.index);
      if (Math.abs(ref.wavelengthNm - p.rawWavelengthNm) < 0.015) {
        finalLam = ref.wavelengthNm;
      }
      finalAmp = ref.intensity;
      finalFwhm = ref.fwhmNm;
    }

    const snr = finalAmp / Math.max(sigmaMad, 1e-6);

    detected.push({
      index: p.index,
      wavelengthNm: finalLam,
      rawWavelengthNm: p.rawWavelengthNm,
      intensity: finalAmp,
      prominence: p.prominence,
      fwhmNm: finalFwhm,
      snr
    });
  }

  return detected;
}

/**
 * Match detected spectral peaks with theoretical quantum components.
 */
export function identifyAndLabelComponents(detectedPeaks, transition, bFieldTesla, maxMatchTolNm = 0.025) {
  const theoreticalComponents = transition.calculateZeemanSplitting(bFieldTesla);

  // Group degenerate theoretical components (e.g., in Normal Zeeman triplet)
  const groupedTheo = [];
  for (const comp of theoreticalComponents) {
    let matchedGroup = groupedTheo.find(g => Math.abs(g.wavelengthNm - comp.wavelengthNm) < 1e-4);
    if (matchedGroup) {
      matchedGroup.components.push(comp);
    } else {
      groupedTheo.push({
        wavelengthNm: comp.wavelengthNm,
        components: [comp]
      });
    }
  }

  const pairs = [];
  for (let pIdx = 0; pIdx < detectedPeaks.length; pIdx++) {
    for (let gIdx = 0; gIdx < groupedTheo.length; gIdx++) {
      const dist = Math.abs(detectedPeaks[pIdx].wavelengthNm - groupedTheo[gIdx].wavelengthNm);
      if (dist <= maxMatchTolNm) {
        pairs.push({ dist, pIdx, gIdx });
      }
    }
  }

  pairs.sort((a, b) => a.dist - b.dist);

  const assignedPeaks = new Set();
  const assignedGroups = new Set();

  for (const { dist, pIdx, gIdx } of pairs) {
    if (assignedPeaks.has(pIdx) || assignedGroups.has(gIdx)) continue;

    const peak = detectedPeaks[pIdx];
    const group = groupedTheo[gIdx];
    const primary = group.components[0];

    const labels = group.components.map(c => c.label);
    const pols = Array.from(new Set(group.components.map(c => c.polarization)));

    peak.assignedComponent = labels.length <= 2 ? labels.join(", ") : `${labels[0]} (+${labels.length - 1})`;
    peak.polarization = pols.length === 1 ? pols[0] : "mixed";
    peak.deltaMj = primary.deltaMj;
    peak.upperMj = primary.upperMj;
    peak.lowerMj = primary.lowerMj;
    peak.gEff = primary.gEff;
    peak.theoreticalWavelengthNm = group.wavelengthNm;
    peak.residualPm = (peak.wavelengthNm - group.wavelengthNm) * 1e3; // picometers

    const lamCm = peak.wavelengthNm * 1e-7;
    const lam0Cm = transition.wavelength0Nm * 1e-7;
    peak.wavenumberShiftCm1 = (1.0 / lam0Cm) - (1.0 / lamCm);

    assignedPeaks.add(pIdx);
    assignedGroups.add(gIdx);
  }

  for (let pIdx = 0; pIdx < detectedPeaks.length; pIdx++) {
    if (!assignedPeaks.has(pIdx)) {
      const peak = detectedPeaks[pIdx];
      peak.assignedComponent = "Spurious / Baseline";
      peak.polarization = "Unknown";
      peak.residualPm = 0.0;
      peak.wavenumberShiftCm1 = 0.0;
      peak.theoreticalWavelengthNm = null;
    }
  }

  return detectedPeaks;
}

/**
 * Perform linear regression on spectral line splitting across magnetic field sweep.
 */
export function analyzeMagneticFieldDependence(transition, bFields, componentLabel = null) {
  const sampleComps = transition.calculateZeemanSplitting(1.0);
  const sigComps = sampleComps.filter(c => c.polarization.includes("sigma"));
  sigComps.sort((a, b) => Math.abs(b.gEff) - Math.abs(a.gEff));
  const targetComp = sigComps.length > 0 ? sigComps[0] : sampleComps[0];

  const chosenLabel = componentLabel || targetComp.label;
  let gEff = targetComp.gEff;
  if (Math.abs(gEff) < 1e-6) gEff = 1.0;

  const shiftsCm1 = [];
  const shiftsNm = [];

  for (const b of bFields) {
    const comps = transition.calculateZeemanSplitting(b);
    let matched = comps.find(c => c.label === chosenLabel);
    if (!matched) {
      matched = comps.reduce((prev, curr) => Math.abs(curr.gEff - gEff) < Math.abs(prev.gEff - gEff) ? curr : prev, comps[0]);
    }

    // Add tiny simulated scatter (standard lab accuracy)
    const noise = (Math.sin(b * 123.45) * 0.008);
    shiftsCm1.push(matched.deltaWavenumberCm1 + noise);
    shiftsNm.push(matched.deltaWavelengthNm);
  }

  // Linear regression y = slope * x + intercept
  const n = bFields.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += bFields[i];
    sumY += shiftsCm1[i];
    sumXY += bFields[i] * shiftsCm1[i];
    sumXX += bFields[i] * bFields[i];
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // R-squared
  const meanY = sumY / n;
  let ssTot = 0, ssRes = 0;
  for (let i = 0; i < n; i++) {
    const pred = slope * bFields[i] + intercept;
    ssRes += Math.pow(shiftsCm1[i] - pred, 2);
    ssTot += Math.pow(shiftsCm1[i] - meanY, 2);
  }
  const rSquared = 1.0 - (ssRes / Math.max(ssTot, 1e-12));

  // slope in cm^-1 / T -> m^-1 / T
  const slopeM1PerT = slope * 100.0;
  const muBExp = (Math.abs(slopeM1PerT) * H_PLANCK * C_LIGHT) / Math.abs(gEff);
  const eOverMExp = (4.0 * Math.PI * C_LIGHT * Math.abs(slopeM1PerT)) / Math.abs(gEff);

  const muBRelErr = Math.abs((muBExp - BOHR_MAGNETON) / BOHR_MAGNETON) * 100.0;
  const eOverMRelErr = Math.abs((eOverMExp - E_OVER_M_CODATA) / E_OVER_M_CODATA) * 100.0;

  return {
    componentLabel: chosenLabel,
    bFieldsTesla: bFields,
    shiftsCm1,
    shiftsNm,
    slopeCm1PerT: slope,
    interceptCm1: intercept,
    rSquared,
    muBExperimental: muBExp,
    muBRelErrorPercent: muBRelErr,
    eOverMExperimental: eOverMExp,
    eOverMRelErrorPercent: eOverMRelErr
  };
}

/**
 * Generate realistic sample laboratory dataset for demonstration.
 */
export function generateSampleLabDataset(datasetName) {
  let trans = SODIUM_D2;
  let bField = 1.15;

  if (datasetName.toLowerCase().includes("sodium d1")) {
    trans = SODIUM_D1;
    bField = 0.85;
  } else if (datasetName.toLowerCase().includes("cadmium")) {
    trans = CADMIUM_SINGLET;
    bField = 1.00;
  }

  const sim = generateSyntheticSpectrum(trans, {
    bFieldTesla: bField,
    observationMode: "Transverse",
    polarizer: "None (All)",
    snrDb: 28.0,
    wavelengthSpanNm: 0.18,
    numSamples: 1200,
    addNoise: true,
    addBaseline: true
  });

  return {
    name: datasetName,
    transition: trans,
    bFieldTesla: bField,
    wavelengths: sim.wavelengths,
    intensities: sim.intensity
  };
}

/**
 * Export data array to downloadable CSV string.
 */
export function exportToCsvString(headers, rows) {
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(row.map(val => (val === null || val === undefined) ? "" : `"${val}"`).join(","));
  }
  return lines.join("\n");
}
