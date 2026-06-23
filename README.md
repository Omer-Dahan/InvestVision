<div align="center">
  <h1>📈 InvestVision</h1>
  <p><strong>Advanced Real Estate vs. Stock Market Comparison & Simulation Tool</strong></p>
  
  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
  [![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-yellow.svg)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
  [![HTML5](https://img.shields.io/badge/HTML5-Semantic-E34F26.svg)](https://developer.mozilla.org/en-US/docs/Web/HTML)
  [![CSS3](https://img.shields.io/badge/CSS3-Modern-1572B6.svg)](https://developer.mozilla.org/en-US/docs/Web/CSS)
  [![Chart.js](https://img.shields.io/badge/Chart.js-Data_Visualization-FF6384.svg)](https://www.chartjs.org/)

  <p>
    <a href="README.he.md">🇮🇱 לעברית לחץ כאן</a>
  </p>
</div>

<br />

## 🌟 Overview

**InvestVision** is a comprehensive, client-side web application designed to help investors make data-driven decisions when choosing between real estate and capital market investments. Tailored specifically for the Israeli market, the application factors in local inflation, taxation, mortgage rates, and standard fees to provide an accurate, long-term net-worth projection.

---

## ✨ Features

- 📊 **Deep Financial Modeling**: Calculates the true *net worth* over time, accounting for compounding interest, taxes, and hidden fees.
- 🎲 **Monte Carlo Simulations**: Evaluates risk by running stochastic simulations to show the probability distribution of future outcomes.
- 📉 **Interactive Data Visualization**: Utilizes `Chart.js` for dynamic, responsive charts showing net worth progression, fee breakdown, and risk analysis.
- ⚙️ **Highly Customizable Parameters**:
  - **General**: Initial capital, investment timeframe, inflation rate.
  - **Real Estate**: Property value, monthly rent, mortgage rate, appreciation, broker/lawyer fees, maintenance, and vacancy rates.
  - **Stock Market**: Expected return, management fees, and capital gains tax.
- 🌓 **Modern UI/UX**: Clean, glassmorphism-inspired interface with full Dark/Light mode support.
- 📄 **Export Capabilities**: Instantly generate professional PDF reports or raw CSV data for further analysis.

---

## 🛠️ Tech Stack

This project is built using modern, lightweight web technologies without the need for a backend server:

- **Frontend Core**: Semantic HTML5, Modern CSS3 (CSS Variables, Flexbox, Grid), Vanilla JavaScript (ES6+).
- **Visualization**: [Chart.js](https://www.chartjs.org/)
- **Document Export**: [html2pdf.js](https://ekoopmans.github.io/html2pdf.js/)

---

## 🚀 Getting Started

Since the application runs entirely in the browser (Client-Side), no complex installation or server setup is required.

### Prerequisites

- A modern web browser (Chrome, Firefox, Safari, Edge).

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Omer-Dahan/InvestVision.git
   ```
2. **Navigate to the directory:**
   ```bash
   cd InvestVision
   ```
3. **Run the application:**
   Simply open the `index.html` file in your preferred web browser.

---

## 📁 Project Structure

```text
InvestVision/
├── index.html           # Main UI layout and structure
├── css/
│   └── styles.css       # Design system, themes (Dark/Light), and layout styling
└── js/
    ├── app.js           # Core application logic and DOM events binding
    ├── config.js        # Default parameters, constants, and system configurations
    ├── calculator.js    # Financial engine: compound interest, taxes, and fees modeling
    ├── monte-carlo.js   # Stochastic risk simulation engine
    ├── charts.js        # Chart.js initialization and update routines
    └── export.js        # Data extraction and PDF/CSV export utilities
```

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!
Feel free to check the [issues page](https://github.com/Omer-Dahan/InvestVision/issues) if you want to contribute.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m "Add some AmazingFeature"`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

<div align="center">
  <p>Built with ❤️ for better financial decisions.</p>
</div>
