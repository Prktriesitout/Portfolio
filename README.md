# Windows XP Portfolio - Pratyush Kumar

An interactive personal portfolio website styled to look and feel like classic Windows XP Luna desktop. Built purely with static HTML5, CSS3, and JavaScript, designed for hosting on GitHub Pages without any build steps or external dependencies.

## Features
- **Classic Luna Desktop**: Fullscreen desktop wallpaper with system fallback colors.
- **Interactive Taskbar**: Start button, quick-launch File Explorer, active running window tasks, and live updating system tray clock.
- **Start Menu**: Native XP popup panel featuring shortcuts to About Me, Credibility, Projects, and Contact windows.
- **Draggable Windows**: Window management with cascading placement, maximize/restore, minimize to taskbar, focus layering, and responsive layout.
- **File Explorer**: Browse the virtual `Datasets` folder tree with history navigation (Back, Forward, Up) and address bar.
- **Built-in Document Viewers**:
  - **PDF Viewer**: Embedded PDF viewer with download and new-tab fallback links.
  - **CSV Viewer**: High-performance in-browser CSV parser supporting quotes, commas, CRLF/LF line endings, sticky headers, row/column statistics, and full file downloads.

## Local Development
To serve locally under a sub-path matching GitHub Pages:
```bash
# From the parent directory of this repository:
python -m http.server 8000
# Then visit: http://localhost:8000/portfolio/
```

---

## Agent Specification: Native Desktop "Sponsor" Pill Feature

> **For Automated/Subsequent Agents**: Follow this exact specification to implement the desktop surface sponsor pill. Do not introduce build tools, bundlers, or runtime third-party dependencies beyond the Razorpay payment button script.

### Feature Summary
- **Target Branch**: **`add_portfolio_feature`** for implementation. After verification, fast-forward **`main`** from the main worktree. Do not implement directly on `main`.
- **Component**: Minimalist wallpaper-pinned desktop surface pill (Option 3).
- **Label**: "Sponsor" with heart icon `❤️`.
- **Action**: Embedded Razorpay Payment Button (`pl_U4bDwhWftmAWIS`).
- **Rendered Widget**: The live payment button is a 160×40 dark "Pay Now" button; the pill is sized around it. Do not complete a payment during verification.
- **Layering Constraint**: Must sit directly inside `#desktop` below `#window-container` (`z-index: 1`). Any open/dragged window must float over this widget.

### Files to Modify

#### 1. `index.html`
Insert the following block inside `<div id="desktop">`, immediately before `<div id="window-container"></div>`:
```html
<!-- Native Desktop Surface Item: Sponsor Pill -->
<div id="desktop-sponsor-pill" class="xp-desktop-sponsor-pill" role="complementary" aria-label="Sponsor Creator">
  <div class="sponsor-pill-label">
    <span class="sponsor-icon" aria-hidden="true">❤️</span>
    <span class="sponsor-text">Sponsor</span>
  </div>
  <div class="sponsor-pill-action">
    <form>
      <script src="https://checkout.razorpay.com/v1/payment-button.js" data-payment_button_id="pl_U4bDwhWftmAWIS" async></script>
    </form>
  </div>
</div>
```

#### 2. `css/desktop.css`
Append the following styles to the end of `css/desktop.css`:
```css
/* ==========================================================================
   Desktop Surface Item: Minimalist Sponsor Pill
   ========================================================================== */

#desktop-sponsor-pill {
  position: absolute;
  bottom: 20px;
  right: 24px;
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding: 6px 12px 6px 14px;
  background: rgba(236, 233, 216, 0.88);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  border: 1px solid rgba(255, 255, 255, 0.7);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.8);
  border-radius: 24px;
  z-index: 1;
  pointer-events: auto;
  font-family: var(--xp-font-family);
  transition: transform 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease;
  user-select: none;
}

#desktop-sponsor-pill:hover {
  background: rgba(236, 233, 216, 0.98);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.45);
  transform: translateY(-1px);
}

.sponsor-pill-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 700;
  color: #1a3b70;
  letter-spacing: 0.3px;
}

.sponsor-icon {
  font-size: 13px;
  line-height: 1;
}

.sponsor-pill-action {
  display: flex;
  align-items: center;
}

.sponsor-pill-action form {
  margin: 0;
  padding: 0;
  display: flex;
  align-items: center;
}

/* Razorpay injects span.razorpay-payment-button > a.PaymentButton (160x40).
   Size the pill around that native button instead of restyling its internals. */
.sponsor-pill-action .razorpay-payment-button {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  transition: filter 0.15s ease;
}

.sponsor-pill-action .razorpay-payment-button:hover {
  filter: brightness(1.06);
}

/* Razorpay's injected stylesheet removes the anchor outline. Restore it. */
.sponsor-pill-action .PaymentButton:focus-visible {
  outline: 2px solid #0058e6 !important;
  outline-offset: 2px !important;
}

@media (max-width: 700px) {
  #desktop-sponsor-pill {
    bottom: 12px;
    right: 12px;
    padding: 5px 10px 5px 12px;
    gap: 8px;
    border-radius: 20px;
  }

  .sponsor-pill-label .sponsor-text {
    font-size: 11px;
  }
}

@media (max-width: 340px) {
  #desktop-sponsor-pill {
    gap: 6px;
    padding-left: 10px;
  }

  .sponsor-pill-label .sponsor-text {
    display: none;
  }
}
```

### Agent Verification Steps
1. Verify `index.html` parses cleanly and `#desktop-sponsor-pill` precedes `#window-container`.
2. Start a test server from the repository root: `python -m http.server 8000`, then open `http://localhost:8000/`.
3. Verify `#desktop-sponsor-pill` renders at bottom-right of Bliss wallpaper above the taskbar.
4. Drag an XP window over the pill to verify window layering (`z-index` stacking).
5. Click the **Pay Now** button to confirm the payment modal opens, then close it without completing a payment.
6. Tab to the **Pay Now** button and verify the visible focus ring.
