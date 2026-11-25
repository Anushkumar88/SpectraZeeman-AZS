# Analysis of the Anomalous Zeeman Effect Using Automated Spectral Line Splitting
## Web Application (HTML5, CSS3, ES6 JavaScript)

A modern, standalone, interactive scientific computing dashboard and automated spectroscopic analysis engine for the **Anomalous Zeeman Effect**. Built entirely using pure **HTML5**, **CSS3**, and **Modern JavaScript (ES6 Modules)** with Canvas and SVG rendering.

---

## 🌟 Key Features

1. **Interactive Magnetic Field Control**:
   - Variable magnetic field strength $B$ ($0.0 - 3.0\text{ Tesla}$) with live 60 FPS real-time spectral updates.
   - Quick preset buttons ($0.0\text{ T}$, $0.8\text{ T}$, $1.2\text{ T}$, $2.0\text{ T}$).
2. **High-Resolution Spectral Line Simulations**:
   - Compares unperturbed line ($B = 0$) with split multiplet spectrum ($B > 0$).
   - Convolves thermal Doppler broadening (Gaussian) and natural/instrumental damping (Lorentzian) using pseudo-Voigt profile convolution.
   - Transverse ($\perp \mathbf{B}$) and Longitudinal ($\parallel \mathbf{B}$) observation geometries.
   - Polarization analyzer filters ($\pi$-only, $\sigma$-only, $\sigma^+$ RCP, $\sigma^-$ LCP).
3. **Automated Peak Detection & Sub-Pixel Precision**:
   - Rolling percentile baseline subtraction and Median Absolute Deviation (MAD) noise floor estimation.
   - Refines peak centroids to sub-picometer precision ($< 0.5\text{ pm}$) using logarithmic Gaussian peak fitting.
   - Automatically correlates detected peaks with quantum transitions ($\pi$, $\sigma^+$, $\sigma^-$).
4. **Interactive Quantum Energy Level Splitting Diagram**:
   - Visualizes $(2J+1)$ magnetic sub-levels $M_J$ split proportionally to $g_J \mu_B B M_J$.
   - Draws color-coded electric dipole transition arrows obeying $\Delta M_J = 0, \pm 1$.
   - Live energy shift readout tables in $\mu\text{eV}$ and $\text{cm}^{-1}$.
5. **Magnetic Field Sweep & Specific Charge ($e/m_e$) Extraction**:
   - Linear regression of splitting wavenumber $\Delta\tilde{\nu}$ vs. field $B$.
   - Extracts experimental electron specific charge $(e/m_e)$ and Bohr Magneton $\mu_B$ with relative percentage errors against CODATA standards ($1.7588 \times 10^{11}\text{ C/kg}$) and $R^2$ goodness-of-fit.
6. **2D CCD Focal Plane Spectrograph Camera**:
   - Simulates realistic 2D slit camera detector images on the spectrometer focal plane.
7. **Experimental Laboratory Data Ingestion & CSV Downloads**:
   - Pre-loaded authentic lab benchmark datasets (Sodium D1, Sodium D2, Cadmium 643.8 nm).
   - Drag-and-drop custom CSV file uploader.
   - Instant CSV export for Peak Analysis, Spectrum Data, and Field Sweeps.
8. **Comprehensive Physics Guide & Viva-Voce Oral Prep**:
   - Detailed derivation of the Landé $g$-factor and vector model.
   - Side-by-side Normal vs. Anomalous Zeeman comparative chart.
   - Laboratory apparatus breakdown and 7 common Viva-Voce oral exam questions with authoritative answers.

---

## 📁 File Structure

```
e:\Zeeman effect\
├── index.html              # Main HTML5 application structure & layout
├── styles.css              # Modern dark-theme CSS styling, glassmorphism, responsive grid
├── physics.js              # Quantum constants, states, Landé g, Condon-Shortley intensities
├── simulation.js           # Pseudo-Voigt convolution, observation geometry, polarizers, 2D CCD
├── spectral_analysis.js    # Automated peak finding, centroid fitting, e/m regression, CSV tools
├── chart_renderer.js       # HiDPI Canvas & SVG diagram rendering engine
├── main.js                 # Application controller, UI state, and event coordinators
└── README.md               # Complete project documentation
```

---

## 🚀 How to Run the Application

Because this is a pure web application built with ES6 modules, you can run it via any local web server:

### Option 1: Built-in Python HTTP Server
Open your terminal in `e:\Zeeman effect` and run:
```powershell
python -m http.server 8080 --directory "e:\Zeeman effect"
```
Then open your web browser at:
👉 **[http://localhost:8080](http://localhost:8080)**

### Option 2: Node.js (npx serve)
```powershell
npx serve "e:\Zeeman effect"
```

### Option 3: VS Code "Live Server" Extension
1. Open the folder `e:\Zeeman effect` in Visual Studio Code.
2. Right-click `index.html` and select **"Open with Live Server"**.

---

## ⚛️ Physical Principles & Formulas

### 1. Landé $g$-Factor
$$g_J = 1 + \frac{J(J + 1) + S(S + 1) - L(L + 1)}{2J(J + 1)}$$

### 2. Energy Shift of Sub-Levels
$$\Delta E(M_J) = g_J \mu_B B M_J$$

### 3. Transition Selection Rules
$$\Delta M_J = M_{J,\text{upper}} - M_{J,\text{lower}} \in \{0, \pm 1\}$$
- $\Delta M_J = 0$: **$\pi$ line** (electric vector parallel to $\mathbf{B}$; zero intensity along $\mathbf{B}$).
- $\Delta M_J = +1$: **$\sigma^+$ line** (right-circularly polarized in longitudinal view).
- $\Delta M_J = -1$: **$\sigma^-$ line** (left-circularly polarized in longitudinal view).

### 4. Determination of Electron Specific Charge ($e/m_e$)
$$\Delta\tilde{\nu} = \left(\frac{e}{4\pi m_e c}\right) g_{\text{eff}} B \implies \left(\frac{e}{m_e}\right)_{\text{exp}} = \frac{4\pi c \cdot \text{Slope}}{g_{\text{eff}}}$$
$$\mu_{B,\text{exp}} = \frac{\text{Slope} \cdot h c}{g_{\text{eff}}}$$
