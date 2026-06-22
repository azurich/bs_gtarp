/* BlackState — sélecteur custom (design type shadcn).
   Améliore chaque <select> natif : déclencheur stylé + panneau d'options flottant.
   Le <select> natif est conservé (caché) pour la valeur → le code existant
   (`el.value`, événements `change`) continue de fonctionner. */
(function () {
  const CARET = '<svg class="sel-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';

  function closeAll(except) {
    document.querySelectorAll('.sel.open').forEach(function (w) { if (w !== except) w.classList.remove('open'); });
  }

  function enhance(sel) {
    if (sel.dataset.enh === '1') return;
    sel.dataset.enh = '1';

    const wrap = document.createElement('div');
    wrap.className = 'sel';
    sel.parentNode.insertBefore(wrap, sel);
    wrap.appendChild(sel);
    sel.classList.add('sel-native');

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'sel-trigger';
    trigger.innerHTML = '<span class="sel-value"></span>' + CARET;
    wrap.appendChild(trigger);

    const panel = document.createElement('div');
    panel.className = 'sel-panel';
    Array.from(sel.options).forEach(function (opt, i) {
      const item = document.createElement('div');
      item.className = 'sel-opt';
      item.setAttribute('role', 'option');
      item.textContent = opt.textContent;
      item.addEventListener('click', function (e) { e.stopPropagation(); choose(i); });
      panel.appendChild(item);
    });
    wrap.appendChild(panel);

    function sync() {
      const o = sel.options[sel.selectedIndex];
      trigger.querySelector('.sel-value').textContent = o ? o.textContent : '';
      Array.prototype.forEach.call(panel.children, function (c, i) {
        c.classList.toggle('active', i === sel.selectedIndex);
      });
    }
    function choose(i) {
      if (i !== sel.selectedIndex) {
        sel.selectedIndex = i;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      }
      sync();
      wrap.classList.remove('open');
    }
    trigger.addEventListener('click', function (e) {
      e.stopPropagation();
      const willOpen = !wrap.classList.contains('open');
      closeAll(wrap);
      wrap.classList.toggle('open', willOpen);
    });
    sel.addEventListener('change', sync);   // resync si la valeur change par code
    sync();
  }

  document.addEventListener('click', function () { closeAll(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeAll(); });

  function init() { document.querySelectorAll('select').forEach(enhance); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
