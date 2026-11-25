/**
 * chart_renderer.js - High-Performance Canvas & SVG Visualizations for Zeeman Effect.
 * Pure JavaScript ES6 Module.
 */

// Visual Theme Palette
export const THEME = {
  bg: "#0B0F19",
  panelBg: "#111827",
  grid: "#1F2937",
  axis: "#374151",
  text: "#F3F4F6",
  muted: "#9CA3AF",
  cyan: "#38BDF8",     // sigma-
  coral: "#F43F5E",    // sigma+
  emerald: "#10B981",  // pi
  amber: "#FBBF24",    // peaks
  purple: "#A855F7"    // B=0 reference
};

/**
 * Configure Canvas with Device Pixel Ratio for crystal-clear Retina display.
 */
function setupCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const width = Math.floor(rect.width || canvas.width || 800);
  const height = Math.floor(rect.height || canvas.height || 400);

  if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
    canvas.width = width * dpr;
    canvas.height = height * dpr;
  }
  const ctx = canvas.getContext('2d');
  ctx.resetTransform?.();
  ctx.scale(dpr, dpr);
  return { ctx, width, height };
}

/**
 * Render the primary interactive 1D spectral profile.
 */
export function renderSpectrumChart(canvas, simResult, detectedPeaks = [], options = {}) {
  const { ctx, width, height } = setupCanvas(canvas);
  const { showComponents = true, showB0Ref = true, hoverX = null } = options;

  const w = simResult.wavelengths;
  const y = simResult.intensity;
  const n = w.length;

  const pad = { top: 35, right: 30, bottom: 45, left: 60 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  // Background
  ctx.fillStyle = THEME.panelBg;
  ctx.fillRect(0, 0, width, height);

  const xMin = w[0];
  const xMax = w[n - 1];
  const yMin = -0.05;
  const yMax = 1.25;

  const toX = val => pad.left + ((val - xMin) / (xMax - xMin)) * plotW;
  const toY = val => pad.top + plotH - ((val - yMin) / (yMax - yMin)) * plotH;

  // Draw Grid lines
  ctx.lineWidth = 1;
  ctx.strokeStyle = THEME.grid;
  ctx.setLineDash([4, 4]);

  const xTicks = 6;
  for (let i = 0; i <= xTicks; i++) {
    const xVal = xMin + (i / xTicks) * (xMax - xMin);
    const px = toX(xVal);
    ctx.beginPath();
    ctx.moveTo(px, pad.top);
    ctx.lineTo(px, pad.top + plotH);
    ctx.stroke();

    ctx.fillStyle = THEME.muted;
    ctx.font = "11px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(xVal.toFixed(4), px, pad.top + plotH + 18);
  }

  const yTicks = 5;
  for (let i = 0; i <= yTicks; i++) {
    const yVal = (i / yTicks) * 1.0;
    const py = toY(yVal);
    ctx.beginPath();
    ctx.moveTo(pad.left, py);
    ctx.lineTo(pad.left + plotW, py);
    ctx.stroke();

    ctx.fillStyle = THEME.muted;
    ctx.textAlign = "right";
    ctx.fillText(yVal.toFixed(1), pad.left - 8, py + 4);
  }
  ctx.setLineDash([]);

  // Axis lines
  ctx.strokeStyle = THEME.axis;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(pad.left, pad.top, plotW, plotH);

  // 1. Draw B=0 Reference Line
  if (showB0Ref && simResult.bFieldTesla > 0) {
    const b0Prof = simResult.componentProfiles["B=0_reference"];
    if (b0Prof) {
      ctx.strokeStyle = THEME.purple;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const px = toX(w[i]);
        const py = toY(b0Prof[i]);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // 2. Draw Decomposed Component Curves
  if (showComponents && simResult.bFieldTesla > 0) {
    for (const [label, prof] of Object.entries(simResult.componentProfiles)) {
      if (label === "B=0_reference") continue;

      let color = THEME.cyan;
      if (label.startsWith("pi")) color = THEME.emerald;
      else if (label.startsWith("sigma+")) color = THEME.coral;

      // Fill
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.12;
      ctx.beginPath();
      ctx.moveTo(toX(w[0]), toY(0));
      for (let i = 0; i < n; i++) {
        ctx.lineTo(toX(w[i]), toY(prof[i]));
      }
      ctx.lineTo(toX(w[n - 1]), toY(0));
      ctx.closePath();
      ctx.fill();

      // Line
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const px = toX(w[i]);
        const py = toY(prof[i]);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.globalAlpha = 1.0;
    }
  }

  // 3. Draw Total Measured Spectrum Curve
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = 2.0;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const px = toX(w[i]);
    const py = toY(y[i]);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();

  // 4. Draw Detected Peaks & Badges
  for (const p of detectedPeaks) {
    const px = toX(p.wavelengthNm);
    const py = toY(p.intensity);

    // Peak dot
    ctx.fillStyle = THEME.amber;
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(px, py, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Callout badge
    let badgeColor = THEME.amber;
    if (p.polarization === 'pi') badgeColor = THEME.emerald;
    else if (p.polarization === 'sigma+') badgeColor = THEME.coral;
    else if (p.polarization === 'sigma-') badgeColor = THEME.cyan;

    const labelText = p.assignedComponent || `λ=${p.wavelengthNm.toFixed(4)}`;
    const subText = `${p.wavelengthNm.toFixed(4)} nm`;

    ctx.font = "bold 9.5px Inter, system-ui, sans-serif";
    const textW = Math.max(ctx.measureText(labelText).width, ctx.measureText(subText).width) + 12;
    const badgeH = 28;
    const badgeX = px - textW / 2;
    const badgeY = py - 38;

    // Pointer line
    ctx.strokeStyle = badgeColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px, py - 5);
    ctx.lineTo(px, badgeY + badgeH);
    ctx.stroke();

    // Badge pill
    ctx.fillStyle = THEME.bg;
    ctx.strokeStyle = badgeColor;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, textW, badgeH, 4);
    ctx.fill();
    ctx.stroke();

    // Badge text
    ctx.fillStyle = badgeColor;
    ctx.textAlign = "center";
    ctx.fillText(labelText, px, badgeY + 11);

    ctx.fillStyle = THEME.text;
    ctx.font = "9px Inter, system-ui, sans-serif";
    ctx.fillText(subText, px, badgeY + 23);
  }

  // Axis Labels
  ctx.fillStyle = THEME.text;
  ctx.font = "12px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Wavelength λ [nm]", pad.left + plotW / 2, height - 10);

  ctx.save();
  ctx.translate(16, pad.top + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText("Normalized Intensity [a.u.]", 0, 0);
  ctx.restore();

  // Title
  ctx.fillStyle = THEME.text;
  ctx.font = "bold 13px Inter, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(`Automated Line Splitting Profile | B = ${simResult.bFieldTesla.toFixed(2)} T (${simResult.observationMode} View)`, pad.left + 5, 22);

  // Return coordinate transform helpers for tooltips
  return { toX, toY, pad, plotW, plotH, xMin, xMax, yMin, yMax };
}

/**
 * Render Quantum Energy Level Splitting Diagram in an SVG element.
 */
export function renderEnergyLevelDiagram(svgContainer, transition, bFieldTesla = 1.0) {
  const up = transition.upperState;
  const low = transition.lowerState;

  const upMjs = up.getMjValues();
  const lowMjs = low.getMjValues();
  const components = transition.calculateZeemanSplitting(bFieldTesla);

  const width = 850;
  const height = 480;

  const yUpBase = 120;
  const yLowBase = 360;
  const splitScale = bFieldTesla > 0 ? 32 : 0;

  let svgHtml = `
    <svg viewBox="0 0 ${width} ${height}" class="w-full h-auto select-none" style="background-color: ${THEME.panelBg}; border-radius: 8px;">
      <!-- Title -->
      <text x="20" y="32" fill="${THEME.text}" font-size="14" font-weight="bold">
        Quantum Sub-Level Splitting & Allowed Transitions: ${transition.name}
      </text>
      <text x="20" y="52" fill="${THEME.muted}" font-size="11">
        B = ${bFieldTesla.toFixed(2)} T | Upper State: ${up.name} (g=${up.landeG.toFixed(3)}), Lower State: ${low.name} (g=${low.landeG.toFixed(3)})
      </text>

      <!-- B=0 Reference Levels -->
      <line x1="40" y1="${yUpBase}" x2="160" y2="${yUpBase}" stroke="#6B7280" stroke-width="2" stroke-dasharray="4,4" />
      <line x1="40" y1="${yLowBase}" x2="160" y2="${yLowBase}" stroke="#6B7280" stroke-width="2" stroke-dasharray="4,4" />
      <text x="100" y="${yUpBase - 10}" fill="${THEME.text}" font-size="11" text-anchor="middle" font-weight="bold">${up.name}</text>
      <text x="100" y="${yLowBase - 10}" fill="${THEME.text}" font-size="11" text-anchor="middle" font-weight="bold">${low.name}</text>
      <text x="100" y="240" fill="${THEME.muted}" font-size="11" text-anchor="middle" font-style="italic">B = 0 T (Unperturbed)</text>

      <!-- Dividing Divider -->
      <line x1="180" y1="70" x2="180" y2="440" stroke="#374151" stroke-width="1.5" />
      <text x="200" y="85" fill="${THEME.amber}" font-size="11" font-weight="bold">B = ${bFieldTesla.toFixed(2)} T (Magnetic Sub-Levels)</text>
  `;

  const xSubStart = 240;
  const xSubEnd = 700;

  const upCoords = {};
  for (const m of upMjs) {
    const yPos = yUpBase - (up.landeG * m * splitScale);
    upCoords[m] = yPos;
    const shiftUev = up.energyShiftEv(m, bFieldTesla) * 1e6;
    const mStr = m > 0 ? `+${m}` : `${m}`;

    svgHtml += `
      <line x1="${xSubStart}" y1="${yPos}" x2="${xSubEnd}" y2="${yPos}" stroke="#E5E7EB" stroke-width="2" />
      <text x="${xSubEnd + 12}" y="${yPos + 4}" fill="${THEME.text}" font-size="11" font-family="monospace">
        M_J = ${mStr.padEnd(4)} (${shiftUev >= 0 ? '+' : ''}${shiftUev.toFixed(1)} µeV)
      </text>
    `;
  }

  const lowCoords = {};
  for (const m of lowMjs) {
    const yPos = yLowBase - (low.landeG * m * splitScale);
    lowCoords[m] = yPos;
    const shiftUev = low.energyShiftEv(m, bFieldTesla) * 1e6;
    const mStr = m > 0 ? `+${m}` : `${m}`;

    svgHtml += `
      <line x1="${xSubStart}" y1="${yPos}" x2="${xSubEnd}" y2="${yPos}" stroke="#E5E7EB" stroke-width="2" />
      <text x="${xSubEnd + 12}" y="${yPos + 4}" fill="${THEME.text}" font-size="11" font-family="monospace">
        M_J = ${mStr.padEnd(4)} (${shiftUev >= 0 ? '+' : ''}${shiftUev.toFixed(1)} µeV)
      </text>
    `;
  }

  // Draw transition arrows
  if (components.length > 0) {
    const arrowSlots = components.map((_, i) => xSubStart + 35 + (i / Math.max(1, components.length - 1)) * (xSubEnd - xSubStart - 70));

    // Arrow definitions
    svgHtml += `
      <defs>
        <marker id="arrow-pi" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="${THEME.emerald}"/>
        </marker>
        <marker id="arrow-sig-plus" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="${THEME.coral}"/>
        </marker>
        <marker id="arrow-sig-minus" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="${THEME.cyan}"/>
        </marker>
      </defs>
    `;

    components.forEach((comp, idx) => {
      const xArr = arrowSlots[idx];
      const yTop = upCoords[comp.upperMj];
      const yBot = lowCoords[comp.lowerMj];

      let arrowColor = THEME.emerald;
      let markerId = "arrow-pi";
      let dmLabel = "π (ΔM=0)";

      if (comp.polarization === 'sigma+') {
        arrowColor = THEME.coral;
        markerId = "arrow-sig-plus";
        dmLabel = "σ⁺ (+1)";
      } else if (comp.polarization === 'sigma-') {
        arrowColor = THEME.cyan;
        markerId = "arrow-sig-minus";
        dmLabel = "σ⁻ (-1)";
      }

      svgHtml += `
        <line x1="${xArr}" y1="${yTop + 3}" x2="${xArr}" y2="${yBot - 5}"
              stroke="${arrowColor}" stroke-width="2" marker-end="url(#${markerId})" />
        <rect x="${xArr - 16}" y="${(yTop + yBot) / 2 - 8}" width="32" height="16" fill="${THEME.bg}" rx="3" stroke="${arrowColor}" stroke-width="0.8" opacity="0.9"/>
        <text x="${xArr}" y="${(yTop + yBot) / 2 + 3}" fill="${arrowColor}" font-size="8.5" font-weight="bold" text-anchor="middle">
          ${comp.label}
        </text>
      `;
    });
  }

  // Legend at bottom
  svgHtml += `
    <g transform="translate(40, 450)">
      <circle cx="5" cy="0" r="5" fill="${THEME.emerald}"/>
      <text x="18" y="4" fill="${THEME.text}" font-size="11">π Transitions (ΔM=0, E || B)</text>
      <circle cx="240" cy="0" r="5" fill="${THEME.coral}"/>
      <text x="253" y="4" fill="${THEME.text}" font-size="11">σ⁺ Transitions (ΔM=+1, RCP)</text>
      <circle cx="480" cy="0" r="5" fill="${THEME.cyan}"/>
      <text x="493" y="4" fill="${THEME.text}" font-size="11">σ⁻ Transitions (ΔM=-1, LCP)</text>
    </g>
  </svg>
  `;

  svgContainer.innerHTML = svgHtml;
}

/**
 * Render Linear Regression Chart for e/m determination.
 */
export function renderRegressionChart(canvas, regResult) {
  const { ctx, width, height } = setupCanvas(canvas);

  const bPts = regResult.bFieldsTesla;
  const sPts = regResult.shiftsCm1;
  const n = bPts.length;

  const pad = { top: 35, right: 30, bottom: 45, left: 65 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  ctx.fillStyle = THEME.panelBg;
  ctx.fillRect(0, 0, width, height);

  const xMin = 0.0;
  const xMax = Math.max(...bPts) * 1.15;
  const yMin = 0.0;
  const yMax = Math.max(...sPts) * 1.25;

  const toX = val => pad.left + (val / xMax) * plotW;
  const toY = val => pad.top + plotH - (val / yMax) * plotH;

  // Grid
  ctx.lineWidth = 1;
  ctx.strokeStyle = THEME.grid;
  ctx.setLineDash([4, 4]);

  const xTicks = 5;
  for (let i = 0; i <= xTicks; i++) {
    const xVal = (i / xTicks) * xMax;
    const px = toX(xVal);
    ctx.beginPath();
    ctx.moveTo(px, pad.top);
    ctx.lineTo(px, pad.top + plotH);
    ctx.stroke();

    ctx.fillStyle = THEME.muted;
    ctx.font = "11px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(xVal.toFixed(2), px, pad.top + plotH + 18);
  }

  const yTicks = 5;
  for (let i = 0; i <= yTicks; i++) {
    const yVal = (i / yTicks) * yMax;
    const py = toY(yVal);
    ctx.beginPath();
    ctx.moveTo(pad.left, py);
    ctx.lineTo(pad.left + plotW, py);
    ctx.stroke();

    ctx.fillStyle = THEME.muted;
    ctx.textAlign = "right";
    ctx.fillText(yVal.toFixed(2), pad.left - 8, py + 4);
  }
  ctx.setLineDash([]);

  // Axis outline
  ctx.strokeStyle = THEME.axis;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(pad.left, pad.top, plotW, plotH);

  // Linear Fit line
  const p1x = toX(0);
  const p1y = toY(regResult.interceptCm1);
  const p2x = toX(xMax);
  const p2y = toY(regResult.slopeCm1PerT * xMax + regResult.interceptCm1);

  ctx.strokeStyle = THEME.coral;
  ctx.lineWidth = 2.0;
  ctx.beginPath();
  ctx.moveTo(p1x, p1y);
  ctx.lineTo(p2x, p2y);
  ctx.stroke();

  // Scatter points
  for (let i = 0; i < n; i++) {
    const px = toX(bPts[i]);
    const py = toY(sPts[i]);

    ctx.fillStyle = THEME.cyan;
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(px, py, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Summary Stat Box
  const infoX = pad.left + 15;
  const infoY = pad.top + 15;
  const boxW = 260;
  const boxH = 110;

  ctx.fillStyle = THEME.bg;
  ctx.strokeStyle = THEME.coral;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.roundRect(infoX, infoY, boxW, boxH, 6);
  ctx.fill();
  ctx.stroke();

  ctx.font = "bold 11px Inter, system-ui, sans-serif";
  ctx.fillStyle = THEME.text;
  ctx.textAlign = "left";
  ctx.fillText(`Slope = ${regResult.slopeCm1PerT.toFixed(4)} cm⁻¹/T  |  R² = ${regResult.rSquared.toFixed(5)}`, infoX + 12, infoY + 22);

  ctx.font = "11px Inter, system-ui, sans-serif";
  ctx.fillStyle = THEME.cyan;
  ctx.fillText(`(e/m)ₑₓₚ = ${regResult.eOverMExperimental.toExponential(4)} C/kg`, infoX + 12, infoY + 44);
  ctx.fillStyle = THEME.muted;
  ctx.fillText(`CODATA = 1.7588e+11 C/kg (Err: ${regResult.eOverMRelErrorPercent.toFixed(2)}%)`, infoX + 12, infoY + 62);

  ctx.fillStyle = THEME.amber;
  ctx.fillText(`μ_B,ₑₓₚ = ${regResult.muBExperimental.toExponential(4)} J/T (Err: ${regResult.muBRelErrorPercent.toFixed(2)}%)`, infoX + 12, infoY + 84);

  // Labels
  ctx.fillStyle = THEME.text;
  ctx.font = "12px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Applied Magnetic Field B [Tesla]", pad.left + plotW / 2, height - 10);

  ctx.save();
  ctx.translate(16, pad.top + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText("Wavenumber Shift Δν̃ [cm⁻¹]", 0, 0);
  ctx.restore();

  ctx.fillStyle = THEME.text;
  ctx.font = "bold 13px Inter, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(`Magnetic Field Splitting & e/m Determination (${regResult.componentLabel})`, pad.left + 5, 22);
}

/**
 * Render Side-by-Side Normal vs Anomalous Comparison Chart.
 */
export function renderNormalVsAnomalousChart(canvas, bField = 1.0) {
  const { ctx, width, height } = setupCanvas(canvas);
  import('./physics.js').then(({ CADMIUM_SINGLET, SODIUM_D2 }) => {
    import('./simulation.js').then(({ generateSyntheticSpectrum }) => {
      const cdSim = generateSyntheticSpectrum(CADMIUM_SINGLET, {
        bFieldTesla: bField,
        observationMode: "Transverse",
        polarizer: "None (All)",
        snrDb: 40.0,
        wavelengthSpanNm: 0.14,
        numSamples: 600,
        addNoise: false,
        addBaseline: false
      });

      const naSim = generateSyntheticSpectrum(SODIUM_D2, {
        bFieldTesla: bField,
        observationMode: "Transverse",
        polarizer: "None (All)",
        snrDb: 40.0,
        wavelengthSpanNm: 0.14,
        numSamples: 600,
        addNoise: false,
        addBaseline: false
      });

      ctx.fillStyle = THEME.panelBg;
      ctx.fillRect(0, 0, width, height);

      const halfW = (width - 40) / 2;
      const pad = { top: 40, bottom: 40, left: 45, right: 15 };

      // Left panel: Cadmium (Normal Zeeman)
      drawSubPanel(ctx, 10, pad.top, halfW, height - pad.top - pad.bottom, cdSim, CADMIUM_SINGLET, THEME.cyan, "Normal Zeeman: Cadmium 643.8 nm", "Singlet (S=0, g₁=g₂=1) → Exactly 3 Lines");

      // Right panel: Sodium D2 (Anomalous Zeeman)
      drawSubPanel(ctx, 20 + halfW, pad.top, halfW, height - pad.top - pad.bottom, naSim, SODIUM_D2, THEME.coral, "Anomalous Zeeman: Sodium D2 589.0 nm", "Doublet (S=1/2, g₁=4/3, g₂=2) → 6 Lines");
    });
  });
}

function drawSubPanel(ctx, xOffset, yOffset, w, h, sim, trans, accentColor, title, subtitle) {
  ctx.strokeStyle = THEME.axis;
  ctx.lineWidth = 1;
  ctx.strokeRect(xOffset + 35, yOffset, w - 45, h);

  const lams = sim.wavelengths;
  const ints = sim.intensity;
  const n = lams.length;

  const xMin = -60; // relative pm
  const xMax = 60;

  const toX = val => (xOffset + 35) + ((val - xMin) / (xMax - xMin)) * (w - 45);
  const toY = val => yOffset + h - (val / 1.1) * h;

  // Fill curve
  ctx.fillStyle = accentColor;
  ctx.globalAlpha = 0.2;
  ctx.beginPath();
  ctx.moveTo(toX((lams[0] - trans.wavelength0Nm) * 1e3), toY(0));
  for (let i = 0; i < n; i++) {
    const relPm = (lams[i] - trans.wavelength0Nm) * 1e3;
    ctx.lineTo(toX(relPm), toY(ints[i]));
  }
  ctx.lineTo(toX((lams[n - 1] - trans.wavelength0Nm) * 1e3), toY(0));
  ctx.closePath();
  ctx.fill();

  // Stroke curve
  ctx.globalAlpha = 1.0;
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 2.0;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const relPm = (lams[i] - trans.wavelength0Nm) * 1e3;
    const px = toX(relPm);
    const py = toY(ints[i]);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();

  // Title
  ctx.fillStyle = THEME.text;
  ctx.font = "bold 11.5px Inter, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(title, xOffset + 35, yOffset - 18);

  ctx.fillStyle = THEME.muted;
  ctx.font = "10px Inter, system-ui, sans-serif";
  ctx.fillText(subtitle, xOffset + 35, yOffset - 5);

  // X axis label
  ctx.fillStyle = THEME.muted;
  ctx.textAlign = "center";
  ctx.fillText("Wavelength Shift Relative to λ₀ [pm]", xOffset + 35 + (w - 45) / 2, yOffset + h + 18);
}
