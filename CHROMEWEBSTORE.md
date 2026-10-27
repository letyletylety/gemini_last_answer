# Chrome Web Store Listing — Gemini Copy

> Last Updated: 2026-10-27 | Target Version: 2.1.2

---

## 1. Store Listing Information

**Extension Name** [REQUIRED]
```text
Gemini Copy
```

**Short Description** [REQUIRED (Max 132 chars)]
```text
Copy Gemini responses as clean Markdown with LaTeX math formulas, formatted tables, and smart completion sound alerts.
```

**Detailed Description** [REQUIRED]
```text
The ultimate productivity companion for Google Gemini.

Gemini Copy streamlines your AI workflow by accurately copying Gemini responses into clean, ready-to-use Markdown, flawlessly preserving LaTeX mathematical formulas and multi-line tables, while keeping you informed with customizable completion sound chimes.

[Key Features]
• Smart GFM Markdown Conversion: Copy complex tables, lists, and formatted code blocks into standard GitHub Flavored Markdown with one click (Ctrl+Shift+C / Cmd+Shift+C).
• Full LaTeX Math Preservation: Keep mathematical formulas intact ($...$ for inline and $$...$$ for block formulas).
• Clean Multi-line Tables: Multi-line paragraphs, bullet lists, and code assets inside table cells are neatly preserved using standard line-breaks without breaking table layout.
• Smart Completion Sound Engine: Work in other tabs or windows with peace of mind. A gentle, customizable audio chime plays the moment Gemini finishes responding.
• Customizable Audio Settings: Open the Options page to choose waveforms (Sine, Triangle, Square), adjust volume, and tweak pitch in real-time.
• Code-Block Optimized: Automatically detects programming languages and cleanly captures code blocks without clutter.

[How to Use]
1. Ask Google Gemini any question.
2. When Gemini finishes generating (or when you hear the chime), press Ctrl + Shift + C (Mac: Cmd + Shift + C).
3. The response is copied to your clipboard as clean Markdown. Paste it anywhere (Notion, Obsidian, GitHub, VS Code, Slack).
4. Right-click the extension icon and select "Options" to adjust the notification volume or sound wave.

[Privacy First]
• Gemini Copy processes everything locally inside your browser.
• Your conversations, prompts, and personal data are never collected, stored, or transmitted to any external server.
```

**Category** [REQUIRED]
```text
Productivity
```

**Single Purpose** [REQUIRED]
```text
Copies Google Gemini responses to the clipboard formatted as clean Markdown and LaTeX formulas with completion audio alerts.
```

**Primary Language** [REQUIRED]
```text
English (or Korean / 한국어)
```

---

## 2. Permissions Justification (대시보드 권한 정당성 작성용)

> 크롬 웹 스토어 심사관이 가장 중요하게 검토하는 항목입니다. 아래 내용을 대시보드 각 권한 항목에 그대로 붙여넣으세요.

| Permission | Type | Justification (심사관 제출용 영문 사유) |
|------------|------|---------------------------------------|
| `clipboardWrite` | permissions | Required to copy the converted Markdown response directly into the user's system clipboard upon shortcut trigger. |
| `storage` | permissions | Used exclusively to save and synchronize user preferences (sound enable/disable, volume level, sound waveform, frequency) via chrome.storage.sync. |
| `scripting` | permissions | Required to inject and execute content scripts for capturing response text and copying Markdown on the Gemini webpage. |
| `https://gemini.google.com/*` | host_permissions | The extension operates solely on Google Gemini (gemini.google.com) to detect when responses finish generating and parse the response HTML. |

---

## 3. Privacy & Data Use Disclosures (개인정보 보호 설문)

- **Does the extension collect user data?**: **No** (데이터 수집 없음)
- **Data Use Certifications** (체크박스 모두 선택):
  - [x] The extension does not sell user data.
  - [x] The extension does not use or transfer user data for purposes unrelated to the extension's core functionality.
  - [x] The extension does not use or transfer user data to determine creditworthiness or for lending purposes.

---

## 4. Graphics & Assets Status

| Asset | Dimensions | Status | Filename |
|-------|-----------|--------|----------|
| Store Icon [REQUIRED] | 128×128 PNG | ✅ Ready | `icon128.png` |
| Small Icon | 16×16, 48×48 PNG | ✅ Ready | `icon16.png`, `icon48.png` |
| Screenshot 1 [REQUIRED] | 1280×800 PNG | ✅ Ready | `screenshot.png` (or `hero_screenshot.html` capture) |
| Small Promo Tile [RECOMMENDED] | 440×280 PNG | 🟡 Optional | |

---

## 5. Version History

| Version | Date | Changes | Status |
|---------|------|---------|--------|
| **2.1.2** | 2026-10-27 | Fixed table cell line-breaking, escaped internal pipes, filtered empty rows, added test runner | Ready for submission |
| **2.1.1** | 2026-03-15 | Updated official branding & icon, improved LaTeX text node replacement | Published |
| **2.1.0** | 2026-02-28 | Added KaTeX/MathML/SVG support, clean code-block parsing | Published |
| **2.0.0** | 2026-02-10 | Added emotional reverb audio chime engine & options UI | Published |
