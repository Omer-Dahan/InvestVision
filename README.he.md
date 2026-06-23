<div align="center">
  <h1 dir="rtl">📈 InvestVision</h1>
  <p dir="rtl"><strong>כלי מתקדם להשוואה וסימולציה בין השקעות נדל"ן לשוק ההון</strong></p>
  
  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
  [![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-yellow.svg)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
  [![HTML5](https://img.shields.io/badge/HTML5-Semantic-E34F26.svg)](https://developer.mozilla.org/en-US/docs/Web/HTML)
  [![CSS3](https://img.shields.io/badge/CSS3-Modern-1572B6.svg)](https://developer.mozilla.org/en-US/docs/Web/CSS)
  [![Chart.js](https://img.shields.io/badge/Chart.js-Data_Visualization-FF6384.svg)](https://www.chartjs.org/)

  <p>
    <a href="README.md">🇺🇸 For English click here</a>
  </p>
</div>

<br />

<div dir="rtl">

## 🌟 סקירה כללית

**InvestVision** היא מערכת חכמה להשוואת אפיקי השקעה. המערכת עוזרת למשקיעים לקבל החלטות מבוססות נתונים בין השקעה בנדל"ן לבין השקעה בשוק ההון, תוך התחשבות בפרמטרים הכלכליים הייחודיים לישראל (אינפלציה, מיסוי מקרקעין, מס רווחי הון, עמלות תיווך ועוד). המערכת מספקת תחזית שווי נקי לטווח ארוך בדיוק מירבי.

---

## ✨ תכונות מרכזיות

- 📊 **מודל פיננסי מעמיק**: חישוב ה"שווי הנקי" האמיתי לאורך זמן, תוך שקלול של ריבית דריבית, מיסים ועמלות נסתרות.
- 🎲 **סימולציות מונטה קרלו**: הערכת סיכונים על ידי הרצת סימולציות סטוכסטיות המציגות התפלגות הסתברויות של התוצאות העתידיות.
- 📉 **גרפים חזותיים אינטראקטיביים**: שימוש ב-`Chart.js` להצגת גרפים דינמיים הממחישים את התקדמות ההון, פילוג העמלות וניתוח סיכונים.
- ⚙️ **פרמטרים מותאמים אישית ברמה גבוהה**:
  - **כללי**: הון התחלתי, טווח השקעה בשנים, שיעור אינפלציה.
  - **נדל"ן**: שווי נכס, שכירות חודשית, ריבית משכנתא, עליית ערך, עמלות תיווך ועו"ד, תחזוקה וחודשי ריק.
  - **שוק ההון**: תשואה שנתית מצופה, דמי ניהול ומס רווחי הון.
- 🌓 **ממשק משתמש מודרני (UI/UX)**: עיצוב נקי בסגנון "Glassmorphism" הכולל תמיכה מלאה בתצוגת יום ולילה (Dark/Light mode).
- 📄 **ייצוא נתונים**: אפשרות להפיק דוחות PDF מקצועיים או נתוני CSV לניתוח המשך.

---

## 🛠️ טכנולוגיות

הפרויקט בנוי בטכנולוגיות צד-לקוח מתקדמות וקלות משקל, ללא צורך בשרת אחורי:

- **ליבת צד הלקוח**: HTML5 סמנטי, CSS3 מודרני (כולל משתני CSS, Flexbox ו-Grid), ו-JavaScript נקי (Vanilla ES6+).
- **תצוגה חזותית**: [Chart.js](https://www.chartjs.org/)
- **ייצוא מסמכים**: [html2pdf.js](https://ekoopmans.github.io/html2pdf.js/)

---

## 🚀 איך מתחילים

מכיוון שהאפליקציה רצה כולה בדפדפן (Client-Side), אין צורך בהתקנה מורכבת או הגדרת שרת.

### דרישות קדם

- דפדפן אינטרנט עדכני (Chrome, Firefox, Safari, Edge).

### התקנה

</div>

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Omer-Dahan/InvestVision.git
   ```
2. **Navigate to the directory:**
   ```bash
   cd InvestVision
   ```
3. **Run the application:**
   ```text
   Simply open the index.html file in your preferred web browser.
   ```

<div dir="rtl">

---

## 📁 מבנה הפרויקט

</div>

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

<div dir="rtl">

---

## 🤝 תרומה לפרויקט

נשמח לקבל תרומות לקוד, דיווח על תקלות ובקשות לפיצ'רים חדשים!
ניתן לרשום בעמוד ה-[Issues](https://github.com/Omer-Dahan/InvestVision/issues) את כל מה  שבאלכם!

</div>

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m "Add some AmazingFeature"`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

<div dir="rtl">

---

## 📄 רישיון

הפרויקט מופץ תחת רישיון MIT. למידע נוסף, ראו את קובץ ה-`LICENSE`.

<div align="center">
  <p>נבנה באהבה למען החלטות פיננסיות טובות יותר. ❤️</p>
</div>
</div>
