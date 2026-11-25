/**
 * simulation.js - Synthetic Spectrum Generator for the Anomalous Zeeman Effect.
 * Pure JavaScript ES6 Module.
 */

import { AtomicTransition } from './physics.js';

/**
 * High-accuracy pseudo-Voigt profile function (Kielkopf / Thompson formula).
 * Convolution of Gaussian (Doppler) and Lorentzian (natural/instrumental) line shapes.
 */
export function pseudoVoigtProfile(x, x0, amp, fwhmG, fwhmL) {
  const fg = Math.max(fwhmG, 1e-6);
  const fl = Math.max(fwhmL, 1e-6);

  // Total Voigt FWHM approximation
  const fg5 = Math.pow(fg, 5);
  const fl5 = Math.pow(fl, 5);
  const fTotal = Math.pow(
    fg5 + 2.69269 * Math.pow(fg, 4) * fl + 2.42843 * Math.pow(fg, 3) * Math.pow(fl, 2) +
    4.47163 * Math.pow(fg, 2) * Math.pow(fl, 3) + 0.07842 * fg * Math.pow(fl, 4) + fl5,
    0.2
  );

  const ratio = Math.min(1.0, Math.max(0.0, fl / fTotal));
  // Mixing parameter eta
  const eta = Math.min(1.0, Math.max(0.0, 1.36603 * ratio - 0.47719 * Math.pow(ratio, 2) + 0.11116 * Math.pow(ratio, 3)));

  const dx = x - x0;
  const halfF = fTotal / 2.0;

  // Normalized Lorentzian (peak = 1 at dx = 0)
  const lorentzian = (halfF * halfF) / (dx * dx + halfF * halfF);

  // Normalized Gaussian (peak = 1 at dx = 0)
  const sigma = fTotal / (2.0 * Math.sqrt(2.0 * Math.LN2));
  const gaussian = Math.exp(-0.5 * (dx * dx) / (sigma * sigma));

  return amp * (eta * lorentzian + (1.0 - eta) * gaussian);
}

/**
 * Filter component intensity based on observation mode and polarization filter.
 */
export function filterComponentIntensity(comp, observationMode, polarizer) {
  let intensity = comp.relIntensity;

  // Geometry factor
  const isLongitudinal = observationMode.toLowerCase().includes("longitudinal");
  if (isLongitudinal) {
    if (comp.polarization === 'pi') {
      return 0.0; // Strictly forbidden along dipole axis
    }
    // sigma is transmitted fully (circular in transverse wave plane)
  } else {
    // Transverse
    if (comp.polarization !== 'pi') {
      intensity *= 0.5; // Transverse projection of circular state
    }
  }

  if (intensity <= 0.0) return 0.0;

  // Polarizer filter
  const pol = polarizer.toLowerCase();
  if (pol.includes("linear ||") || pol.includes("pi only")) {
    if (comp.polarization !== 'pi') return 0.0;
  } else if (pol.includes("linear perp") || pol.includes("sigma only")) {
    if (comp.polarization === 'pi') return 0.0;
  } else if (pol.includes("sigma+")) {
    if (comp.polarization !== 'sigma+') return 0.0;
  } else if (pol.includes("sigma-")) {
    if (comp.polarization !== 'sigma-') return 0.0;
  }

  return intensity;
}

/**
 * Deterministic pseudo-random number generator for reproducible noise.
 */
function seededRandom(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return function() {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function gaussianRandom(randFn) {
  let u = 0, v = 0;
  while (u === 0) u = randFn();
  while (v === 0) v = randFn();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/**
 * Generate full synthetic spectrum.
 */
export function generateSyntheticSpectrum(transition, config) {
  const {
    bFieldTesla = 1.0,
    observationMode = "Transverse",
    polarizer = "None (All)",
    fwhmGaussianNm = 0.0035,
    fwhmLorentzianNm = 0.0015,
    snrDb = 35.0,
    wavelengthSpanNm = 0.16,
    numSamples = 1200,
    addNoise = true,
    addBaseline = true
  } = config;

  const halfSpan = wavelengthSpanNm / 2.0;
  const lamMin = transition.wavelength0Nm - halfSpan;
  const lamMax = transition.wavelength0Nm + halfSpan;
  const step = (lamMax - lamMin) / (numSamples - 1);

  const wavelengths = new Float64Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    wavelengths[i] = lamMin + i * step;
  }

  const components = transition.calculateZeemanSplitting(bFieldTesla);
  const intensityClean = new Float64Array(numSamples);
  const componentProfiles = {};

  if (bFieldTesla === 0.0 || components.length === 0) {
    const prof = new Float64Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
      prof[i] = pseudoVoigtProfile(wavelengths[i], transition.wavelength0Nm, 1.0, fwhmGaussianNm, fwhmLorentzianNm);
      intensityClean[i] += prof[i];
    }
    componentProfiles["B=0_reference"] = prof;
  } else {
    // Generate each active component profile
    for (const comp of components) {
      const effAmp = filterComponentIntensity(comp, observationMode, polarizer);
      if (effAmp > 1e-4) {
        const prof = new Float64Array(numSamples);
        for (let i = 0; i < numSamples; i++) {
          prof[i] = pseudoVoigtProfile(wavelengths[i], comp.wavelengthNm, effAmp, fwhmGaussianNm, fwhmLorentzianNm);
          intensityClean[i] += prof[i];
        }
        componentProfiles[comp.label] = prof;
      }
    }
  }

  // Normalize clean intensity
  let maxClean = 0.0;
  for (let i = 0; i < numSamples; i++) {
    if (intensityClean[i] > maxClean) maxClean = intensityClean[i];
  }
  if (maxClean > 0.0) {
    for (let i = 0; i < numSamples; i++) {
      intensityClean[i] /= maxClean;
    }
    for (const key of Object.keys(componentProfiles)) {
      const p = componentProfiles[key];
      for (let i = 0; i < numSamples; i++) p[i] /= maxClean;
    }
  }

  // Generate noisy measured intensity
  const intensityNoisy = new Float64Array(numSamples);
  intensityNoisy.set(intensityClean);

  if (addBaseline) {
    for (let i = 0; i < numSamples; i++) {
      const xNorm = (wavelengths[i] - wavelengths[0]) / (wavelengths[numSamples - 1] - wavelengths[0]);
      const base = 0.02 + 0.015 * Math.sin(Math.PI * xNorm) + 0.005 * Math.pow(xNorm - 0.5, 2);
      intensityNoisy[i] += base;
    }
  }

  if (addNoise) {
    const snrLinear = Math.pow(10.0, snrDb / 10.0);
    const noiseSigma = 1.0 / Math.sqrt(snrLinear);
    const randFn = seededRandom(42);

    for (let i = 0; i < numSamples; i++) {
      const readoutNoise = gaussianRandom(randFn) * noiseSigma;
      const shotNoise = gaussianRandom(randFn) * (noiseSigma * 0.7 * Math.sqrt(Math.max(0.01, intensityClean[i])));
      intensityNoisy[i] += readoutNoise + shotNoise;
      if (intensityNoisy[i] < 0.0) intensityNoisy[i] = 0.0;
    }
  }

  let maxNoisy = 0.0;
  for (let i = 0; i < numSamples; i++) {
    if (intensityNoisy[i] > maxNoisy) maxNoisy = intensityNoisy[i];
  }
  if (maxNoisy > 0.0) {
    for (let i = 0; i < numSamples; i++) {
      intensityNoisy[i] /= maxNoisy;
    }
  }

  return {
    wavelengths,
    intensity: intensityNoisy,
    intensityClean,
    components,
    componentProfiles,
    bFieldTesla,
    observationMode,
    polarizer
  };
}

/**
 * Render 2D CCD slit camera focal plane image directly to HTML5 Canvas.
 */
export function renderCcdCanvas(canvas, wavelengths, spectrum1d, height = 90) {
  const ctx = canvas.getContext('2d');
  const width = spectrum1d.length;
  canvas.width = width;
  canvas.height = height;

  const imgData = ctx.createImageData(width, height);
  const data = imgData.data;

  const randFn = seededRandom(123);

  for (let y = 0; y < height; y++) {
    const yNorm = (y - height / 2.0) / (height / 2.0);
    const slitFalloff = Math.max(0.05, 1.0 - 0.75 * (yNorm * yNorm));

    for (let x = 0; x < width; x++) {
      const baseSignal = spectrum1d[x] * slitFalloff;
      const noise = (randFn() - 0.5) * 0.04;
      const val = Math.min(1.0, Math.max(0.0, baseSignal + noise));

      // Color mapping: inferno-like palette (black -> purple -> orange -> yellow)
      const r = Math.min(255, Math.floor(Math.pow(val, 0.7) * 255 * 1.2));
      const g = Math.min(255, Math.floor(Math.pow(val, 1.5) * 230));
      const b = Math.min(255, Math.floor(Math.pow(val, 3.0) * 255));

      const idx = (y * width + x) * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
}
