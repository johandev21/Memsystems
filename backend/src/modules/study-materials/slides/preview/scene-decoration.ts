import type { SlideDesign } from '../slides-design.types';

export function decorationSvg(design: SlideDesign): string {
  const primary = design.primary;
  const secondary = design.secondary;
  switch (design.decoration) {
    case 'geometric':
      return (
        `<circle cx="1170" cy="140" r="90" fill="${primary}" opacity="0.10"/>` +
        `<circle cx="1100" cy="620" r="55" fill="${secondary}" opacity="0.12"/>` +
        `<rect x="80" y="600" width="140" height="10" rx="5" fill="${primary}" opacity="0.25"/>`
      );
    case 'editorial':
      return (
        `<rect x="120" y="120" width="60" height="6" rx="3" fill="${primary}"/>` +
        `<rect x="120" y="640" width="1040" height="2" fill="${secondary}" opacity="0.35"/>`
      );
    case 'diagrammatic': {
      let dots = '';
      for (let x = 100; x <= 1180; x += 60) {
        dots += `<circle cx="${x}" cy="640" r="2.5" fill="${secondary}" opacity="0.4"/>`;
      }
      return (
        dots +
        `<rect x="1080" y="120" width="80" height="80" rx="8" fill="none" stroke="${primary}" stroke-width="2" opacity="0.35"/>` +
        `<circle cx="1120" cy="160" r="6" fill="${primary}" opacity="0.6"/>`
      );
    }
    case 'minimal':
    default:
      return `<rect x="120" y="640" width="72" height="6" rx="3" fill="${primary}" opacity="0.7"/>`;
  }
}
