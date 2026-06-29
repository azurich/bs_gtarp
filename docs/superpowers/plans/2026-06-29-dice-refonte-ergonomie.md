# Dice — Refonte ergonomique · Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recentrer la machine Dice sur la piste et la rendre compacte/responsive, pour qu'elle reste toujours visible (numéro de lancer moyen, slider de chance collé sous la piste, 2 stats au lieu de 3).

**Architecture:** Réorganisation front de la vue Dice : le slider de chance descend dans la zone de jeu (sous la piste/échelle), le bloc résultat devient un petit « readout » moyen, la stat « Cible » (redondante avec la chance) est retirée. Tout en `clamp()` + container-queries. Aucune logique de jeu touchée.

**Tech Stack:** Vanilla HTML/CSS/JS (front, servi `no-cache` → F5, pas de redémarrage serveur). Bun (`bun test` pour la non-régression).

## Global Constraints

- **Front uniquement** : seuls `public/casino.html`, `public/casino.css`, `public/casino.js` (un garde dans `diceUpdate`) changent. **Aucune** modif serveur/économie/`games.ts`/autre jeu.
- **IDs conservés** (utilisés par le JS) : `diceResult`, `diceSlider`, `diceChanceLbl`, `diceMarker`, `diceDot`, `diceMult`, `dicePot`, `diceBet`, `diceBtn`, `diceResultMsg`. **Supprimer** `diceTargetLbl` (élément + son écriture JS).
- Mécanisme `--win` (posé sur `document.documentElement`) + marqueur/dé **inchangés**. `diceRoll()` inchangé.
- **Charte violette** : pas de doré, pas de `rgba(91,33,182,…)` codé en dur nouveau ; conserver le vert/rouge sémantique des zones GAGNANT/PERDANT et du résultat win/lose. Pas d'emoji.
- **Compacité** : `#diceResult` passe de `clamp(3.6rem,…,13rem)` à une taille moyenne ; marges du bloc résultat fortement réduites ; le slider est pleine largeur, collé sous la piste.
- Effets/notifs (`gameResult`, toast gain net, indicateur `#diceResultMsg`) **inchangés**.
- **Commits** : trailers standard du repo :
  ```
  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01L7Rhnovo7mv6L3n96G1eaQ
  ```
- **Vérif** : `bun test` inchangé (aucune logique testée touchée) ; serveur sur `http://localhost:3000`, F5. Acceptation visuelle par l'utilisateur.

---

## File Structure

| Fichier | Rôle | Action |
|---|---|---|
| `public/casino.html` | Vue Dice restructurée (slider sous la piste, readout, 2 stats) | Modifier (vue `#view-dice`, ≈ L.390-437) |
| `public/casino.css` | Layout Dice compact (readout, `.dice-game`, slider collé, container-queries) | Modifier (bloc dice ≈ L.484-536 + `@container` dice ≈ L.870-882) |
| `public/casino.js` | `diceUpdate()` n'écrit plus `#diceTargetLbl` | Modifier (≈ L.643-650) |

---

### Task 1 : Refonte ergonomique de la machine Dice

**Files:**
- Modify: `public/casino.html` (vue `#view-dice`)
- Modify: `public/casino.css` (bloc Dice + `@container` Dice)
- Modify: `public/casino.js` (`diceUpdate`)

**Interfaces:**
- Consumes : `diceUpdate()` / `diceRoll()` existants (le JS lit `#diceSlider`, écrit `#diceChanceLbl`/`#diceMult`/`#dicePot`/`--win`/`#diceMarker`, anime `#diceDot`, colore `#diceResult`).

- [ ] **Step 1 : Restructurer la vue Dice (HTML)**

Modify `public/casino.html` — remplacer tout le bloc `<!-- DICE -->` (`<div id="view-dice" …>` jusqu'à son `</div>` de fermeture de vue) par :

```html
          <!-- DICE -->
          <div id="view-dice" class="view game-view">
            <div class="view-inner">
              <div class="machine" data-game="dice">
                <div class="machine-head">
                  <span class="ic-game"></span>
                  <div class="machine-head-txt"><h2>Dice</h2><span class="sub">Choisissez votre chance de gagner</span></div>
                </div>
                <div class="machine-board">
                  <div class="dice-game">
                    <div class="dice-readout">
                      <span class="dice-result-cap">Dernier lancer</span>
                      <div class="dice-result" id="diceResult">—</div>
                    </div>
                    <div class="dice-track">
                      <span class="dice-zone dice-zone-win">GAGNANT</span>
                      <span class="dice-zone dice-zone-lose">PERDANT</span>
                      <div class="dice-marker" id="diceMarker"></div>
                      <div class="dice-dot" id="diceDot"></div>
                    </div>
                    <div class="dice-scale"><span>0</span><span>25</span><span>50</span><span>75</span><span>100</span></div>
                    <div class="slider-row dice-slider">
                      <label>Chance de gagner <b id="diceChanceLbl">50%</b></label>
                      <input id="diceSlider" type="range" min="2" max="95" value="50" oninput="diceUpdate()">
                    </div>
                  </div>
                </div>
                <div class="machine-result" id="diceResultMsg" data-state="idle"></div>
                <div class="machine-controls">
                  <div class="dice-stats">
                    <div class="stat"><div class="lbl">Multiplicateur</div><div class="val" id="diceMult">—</div></div>
                    <div class="stat"><div class="lbl">Gains potentiels</div><div class="val" id="dicePot">—</div></div>
                  </div>
                  <div class="bet-row">
                    <div class="field">
                      <label>Mise</label>
                      <input id="diceBet" type="number" min="1" value="100" oninput="diceUpdate()">
                      <div class="qbet">
                        <button onclick="qbet('diceBet','half');diceUpdate()">½</button>
                        <button onclick="qbet('diceBet','double');diceUpdate()">×2</button>
                        <button onclick="qbet('diceBet','max');diceUpdate()">MAX</button>
                      </div>
                    </div>
                    <button id="diceBtn" class="btn" onclick="diceRoll()">LANCER</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
```

Changements clés : le `slider-row` (chance) descend **dans** `.dice-game` (sous l'échelle) ; l'ancien `.dice-stage` devient `.dice-readout` (cap + `#diceResult`) ; la stat « Cible » (`#diceTargetLbl`) est **supprimée** ; `.game-board game-board-stack` → `.dice-game`.

- [ ] **Step 2 : `diceUpdate` n'écrit plus `#diceTargetLbl` (JS)**

Modify `public/casino.js` — dans `diceUpdate()` (≈ L.645), la ligne actuelle est :
```js
  $('diceChanceLbl').textContent = c+'%'; $('diceTargetLbl').textContent = c.toFixed(2);
```
La remplacer par (retrait de l'écriture sur l'élément supprimé) :
```js
  $('diceChanceLbl').textContent = c+'%';
```
Ne rien changer d'autre dans `diceUpdate` ni dans `diceRoll`.

- [ ] **Step 3 : Layout Dice compact (CSS)**

Modify `public/casino.css` — remplacer le bloc Dice actuel (de `.game-board-stack{…}` à `.dice-stats .stat{…}`, ≈ L.484-536) par :

```css
.dice-game{width:100%;max-width:520px;margin:0 auto;display:flex;flex-direction:column}

/* Lecture du lancer — compacte (remplace l'ancien gros .dice-stage) */
.dice-readout{display:flex;flex-direction:column;align-items:center;gap:2px;margin:0 0 clamp(8px,2cqw,14px)}
.dice-result{
  font-family:var(--num);font-variant-numeric:tabular-nums;
  font-size:clamp(1.8rem,9cqw,3rem);line-height:1;text-align:center;
  color:var(--v-300);letter-spacing:-.02em;font-weight:700;
  transition:color .2s,text-shadow .2s,transform .2s;
}
.dice-result.win{color:var(--green);text-shadow:0 0 28px rgba(16,185,129,.55);transform:scale(1.04)}
.dice-result.lose{color:var(--red);text-shadow:0 0 28px rgba(244,63,94,.45)}
.dice-result-cap{font-family:var(--body);font-size:clamp(.58rem,1.8cqw,.72rem);text-transform:uppercase;letter-spacing:.2em;color:var(--tx-4)}

.dice-track{
  --dt:clamp(46px,7cqw,72px);
  position:relative;width:100%;height:var(--dt);border-radius:calc(var(--dt)/2);margin:4px 0;
  background:linear-gradient(90deg,
    #0e7a4e 0%,#12a065 var(--win,50%),
    #1a1330 var(--win,50%),#120e26 100%);
  border:1px solid var(--accent-dim);
  box-shadow:inset 0 3px 14px rgba(0,0,0,.7),0 4px 16px rgba(0,0,0,.4);
  overflow:hidden;
}
.dice-track::before{
  content:'';position:absolute;inset:0;pointer-events:none;border-radius:inherit;
  background:linear-gradient(180deg,rgba(255,255,255,.16),transparent 42%);
}
.dice-zone{
  position:absolute;top:50%;transform:translateY(-50%);z-index:1;
  font-family:var(--body);font-size:clamp(.56rem,1.6cqw,.78rem);font-weight:800;
  letter-spacing:.14em;text-transform:uppercase;pointer-events:none;
}
.dice-zone-win{left:16px;color:rgba(255,255,255,.85)}
.dice-zone-lose{right:16px;color:rgba(255,255,255,.35)}
.dice-marker{
  position:absolute;top:-6px;bottom:-6px;width:4px;z-index:3;
  background:linear-gradient(180deg,#fff,var(--accent));
  box-shadow:0 0 16px var(--accent),0 0 30px var(--accent-dim);
  left:var(--win,50%);transform:translateX(-50%);border-radius:3px;
}
.dice-dot{
  position:absolute;top:50%;width:clamp(26px,5cqw,44px);aspect-ratio:1;border-radius:50%;z-index:4;
  background:radial-gradient(circle at 34% 28%,#fff,#cfcfe0 70%);
  transform:translate(-50%,-50%);left:50%;
  box-shadow:0 0 18px rgba(255,255,255,.9),0 3px 10px rgba(0,0,0,.55),inset 0 -2px 4px rgba(0,0,0,.15);
  transition:left .85s var(--ease-out);
}
.dice-scale{display:flex;width:100%;justify-content:space-between;color:var(--tx-4);font-size:clamp(.62rem,1.6cqw,.78rem);font-family:var(--body);letter-spacing:.05em;padding:6px 2px 0;font-variant-numeric:tabular-nums}

/* Slider de chance collé sous la piste (lien visuel direct avec --win) */
.dice-slider{margin:clamp(8px,2cqw,14px) 0 0}
.dice-slider input[type=range]{width:100%}

.dice-stats{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin:clamp(10px,2cqw,16px) 0}
.dice-stats .stat{flex:1;min-width:130px;padding:clamp(10px,1.8cqw,16px) 14px}
```

(Notes : l'ancien `.dice-stage` à grosses marges + dégradé radial disparaît au profit de `.dice-readout`. Les unités passent en `cqw` pour suivre la largeur de la machine. Le vert/rouge des zones et du résultat est conservé — sémantique, hors charte violette assumée comme avant.)

- [ ] **Step 4 : Simplifier les `@container` Dice (CSS)**

Modify `public/casino.css` — remplacer le bloc `/* ── Dice ── */` `@container` actuel (≈ L.870-882, qui ajustait l'ancien gros `#diceResult` et le `.dice-track` height) par :

```css
/* ── Dice ── */
@container (max-width: 380px){
  .dice-zone{display:none}
  .dice-stats .stat{min-width:100px}
}
```

(Les tailles principales sont désormais gérées par les `clamp(...cqw...)` du Step 3 ; on garde juste le masquage des libellés de zone en très étroit.)

- [ ] **Step 5 : Vérifier**

Front statique (no-cache) → F5, pas de redémarrage. Vérifs structurelles :

```bash
cd "C:/Users/info/Documents/DEV/Casino_Online_GTARP"
bun test 2>&1 | tail -3                                   # non-regression : tous PASS
curl -s -o /dev/null -w "casino %{http_code}\n" http://localhost:3000/casino   # 200
grep -c 'id="diceSlider"' public/casino.html              # 1
grep -c 'class="dice-game"' public/casino.html            # 1
grep -c 'diceTargetLbl' public/casino.html public/casino.js   # 0 (element + ecriture JS supprimes)
grep -cE 'id="diceResult"|id="diceMult"|id="dicePot"|id="diceBtn"|id="diceMarker"|id="diceDot"' public/casino.html  # 6
grep -nE "rgba\(91,33,182|var\(--gold\)|rgba\(201,168,76" public/casino.css | sed -n '1,3p'   # rien de nouveau hors charte
```
Plus **vérification visuelle (utilisateur)** : sur fenêtre réduite et sur mobile, la machine Dice tient à l'écran — piste + slider + LANCER visibles ensemble, sans scroll pour atteindre le bouton ; bouger le slider déplace la frontière vert/rouge ; le numéro de lancer s'affiche moyen, animé, vert/rouge ; toast seulement sur gain net.

- [ ] **Step 6 : Commit**

```bash
git add public/casino.html public/casino.css public/casino.js
git commit -m "feat(casino/dice): refonte ergonomique centree piste (slider sous la piste, readout compact, 2 stats, responsive)"
```

---

## Notes d'exécution

- **Front pur** → pas de redémarrage serveur, F5.
- La **vérification visuelle finale** (compacité réelle, slider↔frontière, lisibilité du readout) est faite par l'utilisateur ; le structurel (IDs présents, `diceTargetLbl` supprimé, charte) est vérifié par le sous-agent.
- `.slider-row` reste une classe partagée mais n'est utilisée que par le Dice ; on lui ajoute la classe `dice-slider` pour le positionnement sous la piste sans toucher au style générique du label.
