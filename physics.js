/**
 * physics.js - Core Theoretical Physics Engine for Anomalous & Normal Zeeman Effect.
 * Pure JavaScript ES6 Module.
 */

// ==============================================================================
// CODATA 2022 RECOMMENDED PHYSICAL CONSTANTS
// ==============================================================================
export const C_LIGHT = 2.99792458e8;         // Speed of light in vacuum [m/s]
export const H_PLANCK = 6.62607015e-34;      // Planck constant [J s]
export const H_BAR = H_PLANCK / (2.0 * Math.PI); // Reduced Planck constant [J s]
export const E_CHARGE = 1.602176634e-19;     // Elementary charge [C]
export const M_ELECTRON = 9.1093837015e-31;  // Electron mass [kg]
export const BOHR_MAGNETON = (E_CHARGE * H_BAR) / (2.0 * M_ELECTRON); // ~9.27401e-24 J/T
export const E_OVER_M_CODATA = E_CHARGE / M_ELECTRON; // ~1.75882e11 C/kg

// Normal Zeeman Lorentz wavenumber unit: dnu_L / B = e / (4 * pi * m_e * c) [m^-1 T^-1]
export const LORENTZ_UNIT_PER_TESLA_M = E_CHARGE / (4.0 * Math.PI * M_ELECTRON * C_LIGHT); // ~46.6864 m^-1 T^-1
export const LORENTZ_UNIT_PER_TESLA_CM = LORENTZ_UNIT_PER_TESLA_M * 1e-2;                  // ~0.466864 cm^-1 T^-1

export const SPECTROSCOPIC_ORBITAL_SYMBOLS = {
  0: 'S', 1: 'P', 2: 'D', 3: 'F', 4: 'G', 5: 'H'
};

/**
 * Calculate the Landé g-factor for an LS-coupled atomic state.
 * Formula: g_J = 1 + [J(J + 1) + S(S + 1) - L(L + 1)] / [2 * J * (J + 1)]
 */
export function calculateLandeGFactor(s, l, j) {
  if (j <= 0.0) return 0.0;
  const num = j * (j + 1.0) + s * (s + 1.0) - l * (l + 1.0);
  const den = 2.0 * j * (j + 1.0);
  return 1.0 + (num / den);
}

/**
 * Format quantum numbers into spectroscopic term symbol: ^{2S+1}L_{J}
 */
export function formatTermSymbol(multiplicity, l, j) {
  const lSym = SPECTROSCOPIC_ORBITAL_SYMBOLS[l] || `L=${l}`;
  const jStr = Number.isInteger(j) ? `${j}` : `${Math.round(2 * j)}/2`;
  return `^${multiplicity}${lSym}_${jStr}`;
}

export class AtomicState {
  constructor({ name, s, l, j, energyEv = 0.0 }) {
    this.name = name;
    this.s = s;
    this.l = l;
    this.j = j;
    this.energyEv = energyEv;
  }

  get landeG() {
    return calculateLandeGFactor(this.s, this.l, this.j);
  }

  get multiplicity() {
    return Math.round(2 * this.s + 1);
  }

  get termSymbol() {
    return formatTermSymbol(this.multiplicity, this.l, this.j);
  }

  getMjValues() {
    if (this.j === 0) return [0.0];
    const count = Math.round(2 * this.j + 1);
    const mjs = [];
    for (let i = 0; i < count; i++) {
      mjs.push(-this.j + i);
    }
    return mjs;
  }

  energyShiftJoules(mj, bFieldTesla) {
    return this.landeG * BOHR_MAGNETON * bFieldTesla * mj;
  }

  energyShiftEv(mj, bFieldTesla) {
    return this.energyShiftJoules(mj, bFieldTesla) / E_CHARGE;
  }

  energyShiftCm1(mj, bFieldTesla) {
    return (this.energyShiftJoules(mj, bFieldTesla) / (H_PLANCK * C_LIGHT)) * 1e-2;
  }
}

/**
 * Calculate relative dipole transition intensity using exact Condon-Shortley formulas.
 */
export function calculateCondonShortleyIntensity(jUpper, jLower, mUpper, mLower) {
  const dj = Math.round(jUpper - jLower);
  const dm = Math.round(mUpper - mLower);
  const j2 = jUpper;
  const m2 = mUpper;

  let val = 0.0;
  if (dj === 1) { // J -> J - 1 emission
    if (dm === 0) {
      val = 4.0 * (j2 * j2 - m2 * m2);
    } else if (dm === 1) {
      val = (j2 + m2) * (j2 + m2 - 1.0);
    } else if (dm === -1) {
      val = (j2 - m2) * (j2 - m2 - 1.0);
    }
  } else if (dj === 0) { // J -> J
    if (dm === 0) {
      val = 4.0 * (m2 * m2);
    } else if (dm === 1) {
      val = (j2 - m2 + 1.0) * (j2 + m2);
    } else if (dm === -1) {
      val = (j2 + m2 + 1.0) * (j2 - m2);
    }
  } else if (dj === -1) { // J -> J + 1 emission
    if (dm === 0) {
      val = 4.0 * ((j2 + 1.0) * (j2 + 1.0) - m2 * m2);
    } else if (dm === 1) {
      val = (j2 - m2 + 1.0) * (j2 - m2 + 2.0);
    } else if (dm === -1) {
      val = (j2 + m2 + 1.0) * (j2 + m2 + 2.0);
    }
  }
  return Math.max(0.0, val);
}

export class AtomicTransition {
  constructor({ name, element, upperState, lowerState, wavelength0Nm, isAnomalous = true, description = "" }) {
    this.name = name;
    this.element = element;
    this.upperState = upperState;
    this.lowerState = lowerState;
    this.wavelength0Nm = wavelength0Nm;
    this.isAnomalous = isAnomalous;
    this.description = description;
  }

  get wavenumber0Cm1() {
    return 1.0 / (this.wavelength0Nm * 1e-7);
  }

  get transitionEnergyJoules() {
    return (H_PLANCK * C_LIGHT) / (this.wavelength0Nm * 1e-9);
  }

  get transitionEnergyEv() {
    return this.transitionEnergyJoules / E_CHARGE;
  }

  calculateZeemanSplitting(bFieldTesla) {
    const components = [];
    const gUp = this.upperState.landeG;
    const gLow = this.lowerState.landeG;

    const mUpperList = this.upperState.getMjValues();
    const mLowerList = this.lowerState.getMjValues();

    const rawComponents = [];

    for (const mUp of mUpperList) {
      for (const mLow of mLowerList) {
        const deltaM = Math.round((mUp - mLow) * 1000) / 1000;

        // Selection rule: deltaM in {-1, 0, 1}
        if (deltaM !== -1.0 && deltaM !== 0.0 && deltaM !== 1.0) continue;

        // Forbidden rules
        if (this.upperState.j === 0 && this.lowerState.j === 0) continue;
        if (this.upperState.j === this.lowerState.j && mUp === 0.0 && mLow === 0.0 && deltaM === 0.0) continue;

        let pol = 'pi';
        if (deltaM === 1.0) pol = 'sigma+';
        else if (deltaM === -1.0) pol = 'sigma-';

        let intensity = calculateCondonShortleyIntensity(this.upperState.j, this.lowerState.j, mUp, mLow);
        if (intensity <= 0.0) intensity = 1.0;

        const gEff = (gUp * mUp) - (gLow * mLow);
        const dEnergy = gEff * BOHR_MAGNETON * bFieldTesla;
        const dEnergyEv = dEnergy / E_CHARGE;

        const dWavenumberM1 = dEnergy / (H_PLANCK * C_LIGHT);
        const dWavenumberCm1 = dWavenumberM1 * 1e-2;

        const totalEnergy = this.transitionEnergyJoules + dEnergy;
        const exactWavelengthNm = totalEnergy > 0 ? ((H_PLANCK * C_LIGHT) / totalEnergy) * 1e9 : this.wavelength0Nm;
        const dWavelengthNm = exactWavelengthNm - this.wavelength0Nm;

        rawComponents.push({
          upperMj: mUp,
          lowerMj: mLow,
          deltaMj: deltaM,
          polarization: pol,
          gEff,
          intensity,
          dEnergy,
          dEnergyEv,
          dWavenumberCm1,
          dWavelengthNm,
          wavelengthNm: exactWavelengthNm
        });
      }
    }

    if (rawComponents.length === 0) return [];

    rawComponents.sort((a, b) => a.wavelengthNm - b.wavelengthNm);

    const maxInt = Math.max(...rawComponents.map(c => c.intensity)) || 1.0;

    let piCount = 1;
    let sigPlusCount = 1;
    let sigMinusCount = 1;

    for (const c of rawComponents) {
      const normInt = c.intensity / maxInt;
      let label = "";
      if (c.polarization === 'pi') {
        label = `pi_${piCount++}`;
      } else if (c.polarization === 'sigma+') {
        label = `sigma+_${sigPlusCount++}`;
      } else {
        label = `sigma-_${sigMinusCount++}`;
      }

      components.push({
        upperMj: c.upperMj,
        lowerMj: c.lowerMj,
        deltaMj: c.deltaMj,
        polarization: c.polarization,
        gEff: c.gEff,
        relIntensity: normInt,
        deltaEnergyJoules: c.dEnergy,
        deltaEnergyEv: c.dEnergyEv,
        deltaWavenumberCm1: c.dWavenumberCm1,
        deltaWavelengthNm: c.dWavelengthNm,
        wavelengthNm: c.wavelengthNm,
        label
      });
    }

    return components;
  }
}

// ==============================================================================
// PRECONFIGURED STANDARD TRANSITIONS CATALOG
// ==============================================================================
export const SODIUM_D1 = new AtomicTransition({
  name: "Sodium D1 (589.6 nm)",
  element: "Sodium (Na)",
  upperState: new AtomicState({ name: "3p ^2P_{1/2}", s: 0.5, l: 1, j: 0.5, energyEv: 2.1023 }),
  lowerState: new AtomicState({ name: "3s ^2S_{1/2}", s: 0.5, l: 0, j: 0.5, energyEv: 0.0 }),
  wavelength0Nm: 589.5924,
  isAnomalous: true,
  description: "Sodium yellow doublet line D1. Splits into 4 distinct components (2 pi, 2 sigma) due to differing Landé g-factors (2/3 and 2)."
});

export const SODIUM_D2 = new AtomicTransition({
  name: "Sodium D2 (589.0 nm)",
  element: "Sodium (Na)",
  upperState: new AtomicState({ name: "3p ^2P_{3/2}", s: 0.5, l: 1, j: 1.5, energyEv: 2.1044 }),
  lowerState: new AtomicState({ name: "3s ^2S_{1/2}", s: 0.5, l: 0, j: 0.5, energyEv: 0.0 }),
  wavelength0Nm: 588.9950,
  isAnomalous: true,
  description: "Sodium yellow doublet line D2. Splits into 6 components (2 pi, 4 sigma) with Landé factors 4/3 (upper) and 2 (lower)."
});

export const CADMIUM_SINGLET = new AtomicTransition({
  name: "Cadmium Singlet (643.8 nm - Normal Zeeman)",
  element: "Cadmium (Cd)",
  upperState: new AtomicState({ name: "5d ^1D_2", s: 0.0, l: 2, j: 2.0, energyEv: 7.34 }),
  lowerState: new AtomicState({ name: "5p ^1P_1", s: 0.0, l: 1, j: 1.0, energyEv: 5.41 }),
  wavelength0Nm: 643.8470,
  isAnomalous: false,
  description: "Normal Zeeman Effect benchmark in Cadmium red line. Spin S=0 produces singlet states with identical g=1, yielding exactly 3 equidistant lines separated by the Lorentz unit."
});

export const ZINC_TRIPLET_468 = new AtomicTransition({
  name: "Zinc Triplet Component 1 (468.0 nm)",
  element: "Zinc (Zn)",
  upperState: new AtomicState({ name: "5s ^3S_1", s: 1.0, l: 0, j: 1.0, energyEv: 6.66 }),
  lowerState: new AtomicState({ name: "4p ^3P_0", s: 1.0, l: 1, j: 0.0, energyEv: 4.01 }),
  wavelength0Nm: 468.0140,
  isAnomalous: true,
  description: "Zinc blue triplet line 1. Splits into 3 lines (2 sigma, 1 pi at center), but anomalous because g_upper=2 and g_lower=0."
});

export const ZINC_TRIPLET_472 = new AtomicTransition({
  name: "Zinc Triplet Component 2 (472.2 nm)",
  element: "Zinc (Zn)",
  upperState: new AtomicState({ name: "5s ^3S_1", s: 1.0, l: 0, j: 1.0, energyEv: 6.66 }),
  lowerState: new AtomicState({ name: "4p ^3P_1", s: 1.0, l: 1, j: 1.0, energyEv: 4.03 }),
  wavelength0Nm: 472.2160,
  isAnomalous: true,
  description: "Zinc blue triplet line 2. Splits into 6 components with g_upper=2 and g_lower=1.5."
});

export const ZINC_TRIPLET_481 = new AtomicTransition({
  name: "Zinc Triplet Component 3 (481.1 nm)",
  element: "Zinc (Zn)",
  upperState: new AtomicState({ name: "5s ^3S_1", s: 1.0, l: 0, j: 1.0, energyEv: 6.66 }),
  lowerState: new AtomicState({ name: "4p ^3P_2", s: 1.0, l: 1, j: 2.0, energyEv: 4.08 }),
  wavelength0Nm: 481.0530,
  isAnomalous: true,
  description: "Zinc blue triplet line 3. Splits into 9 distinct components (3 pi, 6 sigma) with g_upper=2 and g_lower=1.5."
});

export const MERCURY_GREEN = new AtomicTransition({
  name: "Mercury Green Line (546.1 nm)",
  element: "Mercury (Hg)",
  upperState: new AtomicState({ name: "7s ^3S_1", s: 1.0, l: 0, j: 1.0, energyEv: 7.73 }),
  lowerState: new AtomicState({ name: "6p ^3P_2", s: 1.0, l: 1, j: 2.0, energyEv: 5.46 }),
  wavelength0Nm: 546.0740,
  isAnomalous: true,
  description: "Mercury Green 546.1 nm line. Famous laboratory standard showing 9 split components (3 pi, 6 sigma) under magnetic field."
});

export const TRANSITIONS_CATALOG = {
  "Sodium D1 (589.6 nm)": SODIUM_D1,
  "Sodium D2 (589.0 nm)": SODIUM_D2,
  "Cadmium Singlet (643.8 nm - Normal Zeeman)": CADMIUM_SINGLET,
  "Zinc Triplet Component 1 (468.0 nm)": ZINC_TRIPLET_468,
  "Zinc Triplet Component 2 (472.2 nm)": ZINC_TRIPLET_472,
  "Zinc Triplet Component 3 (481.1 nm)": ZINC_TRIPLET_481,
  "Mercury Green Line (546.1 nm)": MERCURY_GREEN
};

export function createCustomTransition({ name, wavelengthNm, sUp, lUp, jUp, sLow, lLow, jLow }) {
  const upState = new AtomicState({
    name: `Upper (${formatTermSymbol(Math.round(2 * sUp + 1), lUp, jUp)})`,
    s: sUp, l: lUp, j: jUp
  });
  const lowState = new AtomicState({
    name: `Lower (${formatTermSymbol(Math.round(2 * sLow + 1), lLow, jLow)})`,
    s: sLow, l: lLow, j: jLow
  });
  const isNormal = (sUp === 0.0 && sLow === 0.0);
  return new AtomicTransition({
    name,
    element: "Custom Element",
    upperState: upState,
    lowerState: lowState,
    wavelength0Nm: wavelengthNm,
    isAnomalous: !isNormal,
    description: `User-defined custom transition at ${wavelengthNm.toFixed(4)} nm.`
  });
}
