/**
 * main.js - Application Controller & Event Coordinator for Zeeman Effect Analyzer.
 * Pure JavaScript ES6 Module.
 */

import {
  TRANSITIONS_CATALOG, AtomicTransition, createCustomTransition,
  SODIUM_D1, SODIUM_D2, CADMIUM_SINGLET, BOHR_MAGNETON, E_OVER_M_CODATA
} from './physics.js';
import { generateSyntheticSpectrum, renderCcdCanvas } from './simulation.js';
import {
  detectSpectralPeaks, identifyAndLabelComponents,
  analyzeMagneticFieldDependence, generateSampleLabDataset, exportToCsvString
} from './spectral_analysis.js';
import {
  renderSpectrumChart, renderEnergyLevelDiagram,
  renderRegressionChart, renderNormalVsAnomalousChart
} from './chart_renderer.js';

// Application State
const state = {
  transition: SODIUM_D2,
  bFieldTesla: 1.20,
  observationMode: "Transverse",
  polarizer: "None (All)",
  fwhmGaussianNm: 0.0035,
  fwhmLorentzianNm: 0.0015,
  snrDb: 35.0,
  addNoise: true,
  addBaseline: true,
  prominenceFraction: 0.05,
  refineCentroids: true,
  showComponents: true,
  showB0Ref: true,
  currentTab: "tab-spectrum",

  // Cached results
  simResult: null,
  detectedPeaks: [],
  regressionResult: null
};

// DOM Element references
const DOM = {};

function initDomReferences() {
  DOM.selectTransition = document.getElementById("select-transition");
  DOM.customGroup = document.getElementById("custom-transition-group");
  DOM.sliderBField = document.getElementById("slider-bfield");
  DOM.valBField = document.getElementById("val-bfield");
  DOM.presetBtns = document.querySelectorAll(".btn-preset");

  DOM.radioObsModes = document.querySelectorAll("input[name='obs-mode']");
  DOM.selectPolarizer = document.getElementById("select-polarizer");

  DOM.sliderFwhmG = document.getElementById("slider-fwhm-g");
  DOM.valFwhmG = document.getElementById("val-fwhm-g");
  DOM.sliderFwhmL = document.getElementById("slider-fwhm-l");
  DOM.valFwhmL = document.getElementById("val-fwhm-l");
  DOM.checkNoise = document.getElementById("check-noise");

  DOM.sliderProminence = document.getElementById("slider-prominence");
  DOM.valProminence = document.getElementById("val-prominence");
  DOM.checkRefine = document.getElementById("check-refine");

  // Top Metrics
  DOM.metricBField = document.getElementById("metric-bfield");
  DOM.metricObs = document.getElementById("metric-obs");
  DOM.metricWavelength = document.getElementById("metric-wavelength");
  DOM.metricEnergy = document.getElementById("metric-energy");
  DOM.metricUpG = document.getElementById("metric-up-g");
  DOM.metricUpTerm = document.getElementById("metric-up-term");
  DOM.metricLowG = document.getElementById("metric-low-g");
  DOM.metricLowTerm = document.getElementById("metric-low-term");
  DOM.metricClass = document.getElementById("metric-class");
  DOM.metricSplit = document.getElementById("metric-split");

  // Canvases & SVGs
  DOM.canvasSpectrum = document.getElementById("canvas-spectrum");
  DOM.canvasCcd = document.getElementById("canvas-ccd");
  DOM.svgEnergyLevels = document.getElementById("svg-energy-levels");
  DOM.canvasRegression = document.getElementById("canvas-regression");
  DOM.canvasComparison = document.getElementById("canvas-comparison");
  DOM.canvasExperimental = document.getElementById("canvas-experimental");

  // Tables
  DOM.peaksTableBody = document.getElementById("peaks-table-body");
  DOM.upSublevelsBody = document.getElementById("up-sublevels-body");
  DOM.lowSublevelsBody = document.getElementById("low-sublevels-body");
  DOM.expTableBody = document.getElementById("exp-table-body");

  // Tabs
  DOM.tabButtons = document.querySelectorAll(".tab-btn");
  DOM.tabPanes = document.querySelectorAll(".tab-pane");

  // Downloads
  DOM.btnDownloadPeaks = document.getElementById("btn-download-peaks");
  DOM.btnDownloadSpectrum = document.getElementById("btn-download-spectrum");
  DOM.btnDownloadSweep = document.getElementById("btn-download-sweep");

  // Sweep UI
  DOM.sliderSweepMax = document.getElementById("slider-sweep-max");
  DOM.valSweepMax = document.getElementById("val-sweep-max");
  DOM.sliderSweepSteps = document.getElementById("slider-sweep-steps");
  DOM.valSweepSteps = document.getElementById("val-sweep-steps");
  DOM.selectSweepComponent = document.getElementById("select-sweep-component");

  // Experimental UI
  DOM.selectExpDataset = document.getElementById("select-exp-dataset");
  DOM.fileExpUpload = document.getElementById("file-exp-upload");

  // Options toggles
  DOM.checkShowComponents = document.getElementById("check-show-components");
  DOM.checkShowB0 = document.getElementById("check-show-b0");
}

/**
 * Main application calculation and rendering pipeline.
 */
function runPipeline() {
  // 1. Synthesize Spectrum
  state.simResult = generateSyntheticSpectrum(state.transition, {
    bFieldTesla: state.bFieldTesla,
    observationMode: state.observationMode,
    polarizer: state.polarizer,
    fwhmGaussianNm: state.fwhmGaussianNm,
    fwhmLorentzianNm: state.fwhmLorentzianNm,
    snrDb: state.snrDb,
    wavelengthSpanNm: 0.18,
    numSamples: 1200,
    addNoise: state.addNoise,
    addBaseline: state.addNoise
  });

  // 2. Automated Peak Detection & Quantum Assignment
  const rawPeaks = detectSpectralPeaks(
    state.simResult.wavelengths,
    state.simResult.intensity,
    {
      prominenceFraction: state.prominenceFraction,
      refineCentroids: state.refineCentroids
    }
  );

  state.detectedPeaks = identifyAndLabelComponents(
    rawPeaks,
    state.transition,
    state.bFieldTesla
  );

  // 3. Update Metrics Summary Cards
  updateTopMetrics();

  // 4. Render Visualizations according to active tab
  renderActiveTab();
}

function updateTopMetrics() {
  DOM.metricBField.textContent = `${state.bFieldTesla.toFixed(2)} T`;
  DOM.metricObs.textContent = `${state.observationMode} View`;

  DOM.metricWavelength.textContent = `${state.transition.wavelength0Nm.toFixed(4)} nm`;
  DOM.metricEnergy.textContent = `E₀ = ${state.transition.transitionEnergyEv.toFixed(3)} eV`;

  const upG = state.transition.upperState.landeG;
  DOM.metricUpG.textContent = upG.toFixed(3);
  DOM.metricUpTerm.textContent = `${state.transition.upperState.termSymbol} (J=${state.transition.upperState.j})`;

  const lowG = state.transition.lowerState.landeG;
  DOM.metricLowG.textContent = lowG.toFixed(3);
  DOM.metricLowTerm.textContent = `${state.transition.lowerState.termSymbol} (J=${state.transition.lowerState.j})`;

  if (state.transition.isAnomalous) {
    DOM.metricClass.textContent = "Anomalous";
    DOM.metricClass.style.color = "var(--accent-coral)";
  } else {
    DOM.metricClass.textContent = "Normal";
    DOM.metricClass.style.color = "var(--accent-cyan)";
  }

  const comps = state.transition.calculateZeemanSplitting(state.bFieldTesla);
  const maxShiftPm = comps.length > 0 && state.bFieldTesla > 0
    ? (Math.max(...comps.map(c => Math.abs(c.deltaWavelengthNm))) * 1e3).toFixed(1)
    : "0.0";
  DOM.metricSplit.textContent = `Max Split: ±${maxShiftPm} pm`;
}

function renderActiveTab() {
  // Always update Spectrum Canvas if visible
  if (state.currentTab === "tab-spectrum") {
    renderSpectrumChart(DOM.canvasSpectrum, state.simResult, state.detectedPeaks, {
      showComponents: state.showComponents,
      showB0Ref: state.showB0Ref
    });
    renderCcdCanvas(DOM.canvasCcd, state.simResult.wavelengths, state.simResult.intensity);
    populatePeaksTable();
  } else if (state.currentTab === "tab-levels") {
    renderEnergyLevelDiagram(DOM.svgEnergyLevels, state.transition, state.bFieldTesla);
    populateSublevelsTables();
  } else if (state.currentTab === "tab-field") {
    runBFieldSweep();
  } else if (state.currentTab === "tab-theory") {
    renderNormalVsAnomalousChart(DOM.canvasComparison, state.bFieldTesla > 0 ? state.bFieldTesla : 1.0);
  } else if (state.currentTab === "tab-experimental") {
    loadExperimentalDataset(DOM.selectExpDataset.value);
  }
}

function populatePeaksTable() {
  DOM.peaksTableBody.innerHTML = "";
  if (state.detectedPeaks.length === 0) {
    DOM.peaksTableBody.innerHTML = `<tr><td colspan="10" style="text-align:center; color: var(--text-muted); padding: 16px;">No peaks detected. Try reducing prominence sensitivity.</td></tr>`;
    return;
  }

  state.detectedPeaks.forEach((p, idx) => {
    let badgeClass = "badge-pi";
    if (p.polarization === 'sigma+') badgeClass = "badge-sig-plus";
    else if (p.polarization === 'sigma-') badgeClass = "badge-sig-minus";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td><strong>${p.wavelengthNm.toFixed(5)}</strong></td>
      <td>${p.theoreticalWavelengthNm ? p.theoreticalWavelengthNm.toFixed(5) : '-'}</td>
      <td style="color: ${p.residualPm !== null && Math.abs(p.residualPm) < 1.0 ? 'var(--accent-emerald)' : 'var(--text-main)'}">
        ${p.residualPm !== null ? p.residualPm.toFixed(2) : '-'}
      </td>
      <td>${p.wavenumberShiftCm1 !== null ? p.wavenumberShiftCm1.toFixed(3) : '-'}</td>
      <td><span class="badge ${badgeClass}">${p.assignedComponent || '-'}</span></td>
      <td>${p.polarization || '-'}</td>
      <td>${p.deltaMj !== null && p.deltaMj !== undefined ? (p.deltaMj > 0 ? `+${p.deltaMj}` : p.deltaMj) : '-'}</td>
      <td>${p.fwhmNm.toFixed(5)}</td>
      <td>${(p.intensity * 100).toFixed(1)}%</td>
    `;
    DOM.peaksTableBody.appendChild(tr);
  });
}

function populateSublevelsTables() {
  const up = state.transition.upperState;
  const low = state.transition.lowerState;

  DOM.upSublevelsBody.innerHTML = "";
  up.getMjValues().forEach(m => {
    const dUev = up.energyShiftEv(m, state.bFieldTesla) * 1e6;
    const dCm = up.energyShiftCm1(m, state.bFieldTesla);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${m > 0 ? '+' : ''}${m}</strong></td>
      <td>${dUev >= 0 ? '+' : ''}${dUev.toFixed(2)}</td>
      <td>${dCm >= 0 ? '+' : ''}${dCm.toFixed(3)}</td>
    `;
    DOM.upSublevelsBody.appendChild(tr);
  });

  DOM.lowSublevelsBody.innerHTML = "";
  low.getMjValues().forEach(m => {
    const dUev = low.energyShiftEv(m, state.bFieldTesla) * 1e6;
    const dCm = low.energyShiftCm1(m, state.bFieldTesla);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${m > 0 ? '+' : ''}${m}</strong></td>
      <td>${dUev >= 0 ? '+' : ''}${dUev.toFixed(2)}</td>
      <td>${dCm >= 0 ? '+' : ''}${dCm.toFixed(3)}</td>
    `;
    DOM.lowSublevelsBody.appendChild(tr);
  });
}

function runBFieldSweep() {
  const maxB = parseFloat(DOM.sliderSweepMax.value) || 2.0;
  const steps = parseInt(DOM.sliderSweepSteps.value) || 8;
  const chosenComp = DOM.selectSweepComponent.value || null;

  const bFields = [];
  for (let i = 0; i < steps; i++) {
    bFields.push(0.2 + (i / (steps - 1)) * (maxB - 0.2));
  }

  state.regressionResult = analyzeMagneticFieldDependence(state.transition, bFields, chosenComp);
  renderRegressionChart(DOM.canvasRegression, state.regressionResult);

  // Update regression stat cards
  document.getElementById("metric-reg-em").textContent = `${state.regressionResult.eOverMExperimental.toExponential(4)} C/kg`;
  document.getElementById("metric-reg-em-err").textContent = `Error: ${state.regressionResult.eOverMRelErrorPercent.toFixed(2)}%`;
  document.getElementById("metric-reg-mub").textContent = `${state.regressionResult.muBExperimental.toExponential(4)} J/T`;
  document.getElementById("metric-reg-mub-err").textContent = `Error: ${state.regressionResult.muBRelErrorPercent.toFixed(2)}%`;
  document.getElementById("metric-reg-slope").textContent = `${state.regressionResult.slopeCm1PerT.toFixed(4)} cm⁻¹/T`;
  document.getElementById("metric-reg-r2").textContent = state.regressionResult.rSquared.toFixed(5);
}

function loadExperimentalDataset(datasetName) {
  const labData = generateSampleLabDataset(datasetName);
  const peaks = detectSpectralPeaks(labData.wavelengths, labData.intensities, {
    prominenceFraction: state.prominenceFraction,
    refineCentroids: state.refineCentroids
  });
  const labeled = identifyAndLabelComponents(peaks, labData.transition, labData.bFieldTesla);

  // Render on Experimental Canvas
  renderSpectrumChart(DOM.canvasExperimental, {
    wavelengths: labData.wavelengths,
    intensity: labData.intensities,
    componentProfiles: {},
    bFieldTesla: labData.bFieldTesla,
    observationMode: "Transverse"
  }, labeled, { showComponents: false, showB0Ref: false });

  // Populate Table
  DOM.expTableBody.innerHTML = "";
  labeled.forEach((p, idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td><strong>${p.wavelengthNm.toFixed(5)}</strong></td>
      <td>${p.theoreticalWavelengthNm ? p.theoreticalWavelengthNm.toFixed(5) : '-'}</td>
      <td>${p.residualPm !== null ? p.residualPm.toFixed(2) : '-'}</td>
      <td>${p.assignedComponent || '-'}</td>
      <td>${p.polarization || '-'}</td>
      <td>${(p.intensity * 100).toFixed(1)}%</td>
    `;
    DOM.expTableBody.appendChild(tr);
  });
}

function attachEventListeners() {
  // Transition Selector
  DOM.selectTransition.addEventListener("change", e => {
    const val = e.target.value;
    if (val === "Custom") {
      DOM.customGroup.style.display = "block";
    } else {
      DOM.customGroup.style.display = "none";
      state.transition = TRANSITIONS_CATALOG[val] || SODIUM_D2;
      updateSweepComponentDropdown();
      runPipeline();
    }
  });

  // B-Field Slider
  DOM.sliderBField.addEventListener("input", e => {
    state.bFieldTesla = parseFloat(e.target.value);
    DOM.valBField.textContent = `${state.bFieldTesla.toFixed(2)} T`;
    DOM.presetBtns.forEach(b => b.classList.remove("active"));
    runPipeline();
  });

  // Preset Buttons
  DOM.presetBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const bVal = parseFloat(btn.dataset.b);
      state.bFieldTesla = bVal;
      DOM.sliderBField.value = bVal;
      DOM.valBField.textContent = `${bVal.toFixed(2)} T`;
      DOM.presetBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      runPipeline();
    });
  });

  // Observation Mode
  DOM.radioObsModes.forEach(r => {
    r.addEventListener("change", e => {
      state.observationMode = e.target.value;
      runPipeline();
    });
  });

  // Polarizer
  DOM.selectPolarizer.addEventListener("change", e => {
    state.polarizer = e.target.value;
    runPipeline();
  });

  // Broadening Sliders
  DOM.sliderFwhmG.addEventListener("input", e => {
    state.fwhmGaussianNm = parseFloat(e.target.value);
    DOM.valFwhmG.textContent = `${(state.fwhmGaussianNm * 1e3).toFixed(1)} pm`;
    runPipeline();
  });

  DOM.sliderFwhmL.addEventListener("input", e => {
    state.fwhmLorentzianNm = parseFloat(e.target.value);
    DOM.valFwhmL.textContent = `${(state.fwhmLorentzianNm * 1e3).toFixed(1)} pm`;
    runPipeline();
  });

  DOM.checkNoise.addEventListener("change", e => {
    state.addNoise = e.target.checked;
    runPipeline();
  });

  // Peak Detection Sliders
  DOM.sliderProminence.addEventListener("input", e => {
    state.prominenceFraction = parseFloat(e.target.value);
    DOM.valProminence.textContent = `${(state.prominenceFraction * 100).toFixed(0)}%`;
    runPipeline();
  });

  DOM.checkRefine.addEventListener("change", e => {
    state.refineCentroids = e.target.checked;
    runPipeline();
  });

  // Display Options
  DOM.checkShowComponents.addEventListener("change", e => {
    state.showComponents = e.target.checked;
    renderSpectrumChart(DOM.canvasSpectrum, state.simResult, state.detectedPeaks, {
      showComponents: state.showComponents,
      showB0Ref: state.showB0Ref
    });
  });

  DOM.checkShowB0.addEventListener("change", e => {
    state.showB0Ref = e.target.checked;
    renderSpectrumChart(DOM.canvasSpectrum, state.simResult, state.detectedPeaks, {
      showComponents: state.showComponents,
      showB0Ref: state.showB0Ref
    });
  });

  // Tabs Switching
  DOM.tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      DOM.tabButtons.forEach(b => b.classList.remove("active"));
      DOM.tabPanes.forEach(p => p.classList.remove("active"));

      btn.classList.add("active");
      const targetId = btn.dataset.tab;
      document.getElementById(targetId).classList.add("active");
      state.currentTab = targetId;

      renderActiveTab();
    });
  });

  // Sweep Controls
  DOM.sliderSweepMax.addEventListener("input", e => {
    DOM.valSweepMax.textContent = `${parseFloat(e.target.value).toFixed(1)} T`;
    runBFieldSweep();
  });
  DOM.sliderSweepSteps.addEventListener("input", e => {
    DOM.valSweepSteps.textContent = e.target.value;
    runBFieldSweep();
  });
  DOM.selectSweepComponent.addEventListener("change", () => {
    runBFieldSweep();
  });

  // Experimental controls
  DOM.selectExpDataset.addEventListener("change", e => {
    loadExperimentalDataset(e.target.value);
  });

  DOM.fileExpUpload.addEventListener("change", e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target.result;
      parseCustomCsv(text);
    };
    reader.readAsText(file);
  });

  // CSV Downloads
  DOM.btnDownloadPeaks.addEventListener("click", downloadPeaksCsv);
  DOM.btnDownloadSpectrum.addEventListener("click", downloadSpectrumCsv);
  DOM.btnDownloadSweep.addEventListener("click", downloadSweepCsv);

  // Resize listener
  window.addEventListener("resize", () => {
    renderActiveTab();
  });
}

function updateSweepComponentDropdown() {
  const comps = state.transition.calculateZeemanSplitting(1.0);
  DOM.selectSweepComponent.innerHTML = "";
  comps.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c.label;
    opt.textContent = `${c.label} (${c.polarization}, g_eff=${c.gEff.toFixed(2)})`;
    DOM.selectSweepComponent.appendChild(opt);
  });
}

function downloadPeaksCsv() {
  const headers = ["Peak #", "Measured Wavelength (nm)", "Theoretical (nm)", "Residual (pm)", "Shift (cm^-1)", "Component", "Polarization", "Delta M_J", "FWHM (nm)", "Intensity"];
  const rows = state.detectedPeaks.map((p, i) => [
    i + 1,
    p.wavelengthNm.toFixed(5),
    p.theoreticalWavelengthNm ? p.theoreticalWavelengthNm.toFixed(5) : "",
    p.residualPm !== null ? p.residualPm.toFixed(2) : "",
    p.wavenumberShiftCm1 !== null ? p.wavenumberShiftCm1.toFixed(3) : "",
    p.assignedComponent || "",
    p.polarization || "",
    p.deltaMj !== null ? p.deltaMj : "",
    p.fwhmNm.toFixed(5),
    p.intensity.toFixed(3)
  ]);
  const csv = exportToCsvString(headers, rows);
  triggerDownload(csv, `zeeman_peaks_${state.transition.name}_${state.bFieldTesla.toFixed(2)}T.csv`);
}

function downloadSpectrumCsv() {
  const headers = ["Wavelength_nm", "Intensity_Measured", "Intensity_Clean"];
  const rows = [];
  for (let i = 0; i < state.simResult.wavelengths.length; i++) {
    rows.push([
      state.simResult.wavelengths[i].toFixed(5),
      state.simResult.intensity[i].toFixed(4),
      state.simResult.intensityClean[i].toFixed(4)
    ]);
  }
  const csv = exportToCsvString(headers, rows);
  triggerDownload(csv, `zeeman_spectrum_${state.transition.name}_${state.bFieldTesla.toFixed(2)}T.csv`);
}

function downloadSweepCsv() {
  if (!state.regressionResult) return;
  const headers = ["Magnetic_Field_Tesla", "Wavenumber_Shift_cm1", "Wavelength_Shift_nm"];
  const rows = state.regressionResult.bFieldsTesla.map((b, i) => [
    b.toFixed(3),
    state.regressionResult.shiftsCm1[i].toFixed(4),
    state.regressionResult.shiftsNm[i].toFixed(5)
  ]);
  const csv = exportToCsvString(headers, rows);
  triggerDownload(csv, `zeeman_sweep_${state.transition.name}.csv`);
}

function triggerDownload(content, filename) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function parseCustomCsv(csvText) {
  const lines = csvText.trim().split("\n");
  const lams = [];
  const ints = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(",");
    if (parts.length >= 2) {
      const lam = parseFloat(parts[0].replace(/"/g, ''));
      const val = parseFloat(parts[1].replace(/"/g, ''));
      if (!isNaN(lam) && !isNaN(val)) {
        lams.push(lam);
        ints.push(val);
      }
    }
  }

  if (lams.length > 5) {
    const minVal = Math.min(...ints);
    const maxVal = Math.max(...ints);
    const normInts = new Float64Array(ints.map(v => (v - minVal) / Math.max(1e-6, maxVal - minVal)));

    const peaks = detectSpectralPeaks(new Float64Array(lams), normInts, {
      prominenceFraction: state.prominenceFraction,
      refineCentroids: state.refineCentroids
    });
    const labeled = identifyAndLabelComponents(peaks, state.transition, state.bFieldTesla);

    renderSpectrumChart(DOM.canvasExperimental, {
      wavelengths: new Float64Array(lams),
      intensity: normInts,
      componentProfiles: {},
      bFieldTesla: state.bFieldTesla,
      observationMode: "Transverse"
    }, labeled, { showComponents: false, showB0Ref: false });
  }
}

// Initial bootstrap
window.addEventListener("DOMContentLoaded", () => {
  initDomReferences();
  updateSweepComponentDropdown();
  attachEventListeners();
  runPipeline();
});
