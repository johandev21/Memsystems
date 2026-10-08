# 01: Mobile-Native Shell and Touch Baseline Prefactoring

**What to build:**
Configure the global mobile platform layer across `index.html` and shared CSS: ensure `viewport-fit=cover`, `interactive-widget=resizes-content`, `theme-color` meta tags, `-webkit-tap-highlight-color: transparent`, `overscroll-behavior: none` on root and `overscroll-behavior: contain` on scroll containers, `touch-action: manipulation` on buttons/links, and a baseline font size of 16px on inputs to prevent iOS Safari auto-zoom.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Add `viewport-fit=cover` and `interactive-widget=resizes-content` to HTML viewport meta tag.
- [ ] Add `theme-color` meta tags matching light and dark themes.
- [ ] Set global `-webkit-tap-highlight-color: transparent` and `overscroll-behavior: none` on html/body.
- [ ] Ensure all input, select, and textarea fields enforce a minimum 16px font size on mobile to stop iOS auto-zoom.
- [ ] Ensure root app layout tracks dynamic viewport units (`100dvh`).
