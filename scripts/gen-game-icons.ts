/* Génère public/core/game-icons.js à partir des SVG game-icons.net téléchargés.
   One-shot. */
import { readFileSync, writeFileSync } from 'node:fs'

function innerIcon(file: string): string {
  let s = readFileSync(file, 'utf8')
  s = s.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')   // enlève le wrapper <svg>
  s = s.replace(/<path d="M0 0h512v512H0z"\/>/, '')                     // enlève le fond noir
  s = s.replace(/fill="#fff"/g, 'fill="currentColor"')                 // teinte = couleur courante
  return s.trim()
}

const GI: Record<string, string> = {
  slots:     innerIcon('scripts/gi-src/slots.svg'),
  blackjack: innerIcon('scripts/gi-src/blackjack.svg'),
  mines:     innerIcon('scripts/gi-src/mines.svg'),
  dice:      innerIcon('scripts/gi-src/dice.svg'),
  plinko:    innerIcon('scripts/gi-src/plinko.svg'),
  // Roue de la fortune (icône maison) : pointeur + anneau + croisillon + moyeu.
  // L'icône game-icons spinning-wheel a été jugée trop chargée/peu lisible.
  wheel:
    '<path d="M256 30 L294 96 L218 96 Z"/>' +
    '<path fill-rule="evenodd" d="M256 96a190 190 0 1 0 0 380 190 190 0 0 0 0-380zm0 54a136 136 0 1 1 0 272 136 136 0 0 1 0-272z"/>' +
    '<rect x="244" y="120" width="24" height="332" rx="6"/>' +
    '<rect x="90" y="274" width="332" height="24" rx="6"/>' +
    '<circle cx="256" cy="286" r="40"/>',
}

const header =
`/* BlackState — icônes des jeux du casino.
   Sources game-icons.net (CC BY 3.0) :
     slots     = caro-asercion/slot-machine
     blackjack = lorc/poker-hand
     mines     = lorc/land-mine
     dice      = delapouite/perspective-dice-six-faces-six
     plinko    = delapouite/ball-pyramid
     wheel     = icône maison (roue de la fortune ; spinning-wheel game-icons jugée moche)
   SVG teintés à la couleur courante (currentColor). */
`

const body =
`const GI = ${JSON.stringify(GI)};
function giSvg(key, cls) {
  return '<svg class="gi' + (cls ? ' ' + cls : '') + '" viewBox="0 0 512 512" fill="currentColor" aria-hidden="true">' + (GI[key] || '') + '</svg>';
}
function applyGameIcons() {
  document.querySelectorAll('.nav-item[data-v]').forEach(function (el) {
    var g = el.dataset.v, ni = el.querySelector('.ni'); if (GI[g] && ni) ni.innerHTML = giSvg(g);
  });
  document.querySelectorAll('.home-game-card[data-game]').forEach(function (el) {
    var g = el.dataset.game, ic = el.querySelector('.hg-icon'); if (GI[g] && ic) ic.innerHTML = giSvg(g);
  });
  document.querySelectorAll('.game-view[id^="view-"]').forEach(function (v) {
    var g = v.id.slice(5), ic = v.querySelector('.machine-head .ic-game');
    if (GI[g] && ic) { var s = document.createElement('span'); s.className = 'ic-game'; s.innerHTML = giSvg(g); ic.replaceWith(s); }
  });
}
window.applyGameIcons = applyGameIcons;
document.addEventListener('DOMContentLoaded', applyGameIcons);
`

writeFileSync('public/core/game-icons.js', header + body)
console.log('public/core/game-icons.js généré (' + Object.keys(GI).length + ' icônes)')
for (const k of Object.keys(GI)) console.log('  ' + k + ': ' + GI[k].length + ' chars')
