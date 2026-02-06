(function () {
  'use strict';

  let proposalData = null;
  let assumptionStates = []; // track confirmed/edited per assumption
  let loadingInterval = null;

  // ─── Elements ──────────────────────────────────────────────
  const screens = {
    input: document.getElementById('step-input'),
    loading: document.getElementById('step-loading'),
    assumptions: document.getElementById('step-assumptions'),
    review: document.getElementById('step-review'),
  };
  const briefingText = document.getElementById('briefing-text');
  const charCount = document.getElementById('char-count');
  const btnAnalyze = document.getElementById('btn-analyze');
  const errorMsg = document.getElementById('error-msg');

  // ─── Screen Management ─────────────────────────────────────
  function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[name].classList.add('active');
    screens[name].scrollTo({ top: 0 });
  }

  // ─── Theme Toggle ──────────────────────────────────────────
  (function initTheme() {
    const toggle = document.getElementById('theme-toggle');
    const sunIcon = document.getElementById('icon-sun');
    const moonIcon = document.getElementById('icon-moon');
    const saved = localStorage.getItem('theme');
    if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
      sunIcon.style.display = 'none';
      moonIcon.style.display = 'block';
    }
    toggle.addEventListener('click', () => {
      const isDark = document.documentElement.classList.toggle('dark');
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
      sunIcon.style.display = isDark ? 'none' : 'block';
      moonIcon.style.display = isDark ? 'block' : 'none';
    });
  })();

  // ─── Toast Notifications ───────────────────────────────────
  function toast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = message;
    container.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 400);
    }, duration);
  }

  // ─── Input Logic ───────────────────────────────────────────
  briefingText.addEventListener('input', () => {
    const len = briefingText.value.trim().length;
    charCount.textContent = len;
    btnAnalyze.disabled = len < 20;
    errorMsg.style.display = 'none';
  });

  // ─── Loading Progress Animation ────────────────────────────
  const loadingMessages = [
    'Briefing wordt gelezen...',
    'Doelgroep analyseren...',
    'Steekproef bepalen...',
    'Kosten berekenen...',
    'Offerte samenstellen...',
  ];

  function startLoadingAnimation() {
    const statusEl = document.getElementById('loading-status');
    const progressEl = document.getElementById('progress-fill');
    let step = 0;
    progressEl.style.width = '5%';

    loadingInterval = setInterval(() => {
      step++;
      if (step < loadingMessages.length) {
        statusEl.textContent = loadingMessages[step];
        progressEl.style.width = `${Math.min(15 + step * 18, 85)}%`;
      }
    }, 2500);
  }

  function stopLoadingAnimation() {
    if (loadingInterval) clearInterval(loadingInterval);
    const progressEl = document.getElementById('progress-fill');
    progressEl.style.width = '100%';
  }

  // ─── Analyze Briefing ──────────────────────────────────────
  btnAnalyze.addEventListener('click', async () => {
    const text = briefingText.value.trim();
    if (text.length < 20) return;

    const btnText = btnAnalyze.querySelector('.btn-text');
    const btnLoading = btnAnalyze.querySelector('.btn-loading');
    btnText.style.display = 'none';
    btnLoading.style.display = 'inline-flex';
    btnAnalyze.disabled = true;
    errorMsg.style.display = 'none';

    // Show loading screen immediately
    setTimeout(() => showScreen('loading'), 300);
    startLoadingAnimation();

    try {
      const resp = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ briefing_text: text }),
      });

      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || 'Onbekende fout');
      }

      proposalData = await resp.json();
      stopLoadingAnimation();

      // Route: assumptions or directly to review
      if (proposalData.aannames && proposalData.aannames.length > 0) {
        setTimeout(() => {
          renderAssumptions(proposalData.aannames);
          showScreen('assumptions');
        }, 500);
      } else {
        setTimeout(() => {
          renderReview(proposalData);
          showScreen('review');
          toast('Offerte succesvol gegenereerd', 'success');
        }, 500);
      }
    } catch (err) {
      stopLoadingAnimation();
      showScreen('input');
      errorMsg.textContent = err.message;
      errorMsg.style.display = 'block';
      toast('Er ging iets mis', 'error');
    } finally {
      btnText.style.display = 'inline-flex';
      btnLoading.style.display = 'none';
      btnAnalyze.disabled = false;
    }
  });

  // ─── Assumption Cards ──────────────────────────────────────
  function parseAssumption(text) {
    const colonIdx = text.indexOf(':');
    if (colonIdx > 0 && colonIdx < 35) {
      return {
        category: text.substring(0, colonIdx).trim(),
        description: text.substring(colonIdx + 1).trim(),
      };
    }
    return { category: 'Aanname', description: text };
  }

  function renderAssumptions(aannames) {
    const grid = document.getElementById('assumptions-grid');
    grid.innerHTML = '';
    assumptionStates = aannames.map(() => ({ confirmed: false, edited: false, editText: '' }));

    document.getElementById('assumptions-count').textContent = aannames.length;

    aannames.forEach((text, i) => {
      const parsed = parseAssumption(text);
      const card = document.createElement('div');
      card.className = 'assumption-card';
      card.dataset.index = i;
      card.innerHTML = `
        <div class="card-top">
          <div style="flex:1">
            <div class="card-category">${esc(parsed.category)}</div>
            <div class="card-text">${esc(parsed.description)}</div>
          </div>
          <div class="card-actions">
            <button class="btn-edit" data-action="edit">Aanpassen</button>
            <button class="btn-confirm" data-action="confirm">
              <svg class="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              Akkoord
            </button>
          </div>
        </div>
        <div class="card-edit">
          <textarea rows="2">${esc(parsed.description)}</textarea>
          <div class="card-edit-actions">
            <button class="btn-edit" data-action="cancel-edit">Annuleren</button>
            <button class="btn-confirm" data-action="save-edit">
              <svg class="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              Opslaan
            </button>
          </div>
        </div>`;

      // Staggered entrance
      setTimeout(() => card.classList.add('visible'), 80 * i);

      // Event delegation for card buttons
      card.addEventListener('click', (e) => {
        const action = e.target.closest('[data-action]')?.dataset.action;
        if (!action) return;

        if (action === 'confirm') {
          assumptionStates[i].confirmed = !assumptionStates[i].confirmed;
          card.classList.toggle('confirmed', assumptionStates[i].confirmed);
          updateAssumptionProgress();
        } else if (action === 'edit') {
          card.classList.add('editing');
        } else if (action === 'cancel-edit') {
          card.classList.remove('editing');
        } else if (action === 'save-edit') {
          const newText = card.querySelector('.card-edit textarea').value.trim();
          if (newText) {
            assumptionStates[i].edited = true;
            assumptionStates[i].editText = newText;
            assumptionStates[i].confirmed = true;
            card.querySelector('.card-text').textContent = newText;
            card.classList.remove('editing');
            card.classList.add('confirmed');
            // Update the proposal data
            proposalData.aannames[i] = parseAssumption(proposalData.aannames[i]).category + ': ' + newText;
            updateAssumptionProgress();
          }
        }
      });

      grid.appendChild(card);
    });

    updateAssumptionProgress();
  }

  function updateAssumptionProgress() {
    const total = assumptionStates.length;
    const confirmed = assumptionStates.filter(s => s.confirmed).length;
    const fill = document.getElementById('assumptions-fill');
    const text = document.getElementById('assumptions-progress-text');
    const btnView = document.getElementById('btn-view-proposal');

    fill.style.width = `${(confirmed / total) * 100}%`;
    text.textContent = `${confirmed} van ${total}`;
    btnView.disabled = confirmed < total;
  }

  // Confirm all
  document.getElementById('btn-confirm-all').addEventListener('click', () => {
    assumptionStates.forEach((s, i) => {
      s.confirmed = true;
      const card = document.querySelector(`.assumption-card[data-index="${i}"]`);
      if (card) card.classList.add('confirmed');
    });
    updateAssumptionProgress();
  });

  // View proposal
  document.getElementById('btn-view-proposal').addEventListener('click', () => {
    renderReview(proposalData);
    showScreen('review');
    toast('Offerte succesvol gegenereerd', 'success');
  });

  // ─── Back button ───────────────────────────────────────────
  document.getElementById('btn-back').addEventListener('click', () => {
    showScreen('input');
  });

  // ─── Number Ticker ─────────────────────────────────────────
  function animateNumber(el, target, prefix = '', suffix = '') {
    if (typeof target !== 'number' || isNaN(target)) {
      el.textContent = prefix + (target || '—') + suffix;
      return;
    }
    const duration = 1200;
    const start = performance.now();
    const isDecimal = target % 1 !== 0;

    function update(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = target * eased;

      if (isDecimal) {
        el.textContent = prefix + fmtEur(current) + suffix;
      } else {
        el.textContent = prefix + Math.floor(current).toLocaleString('nl-NL') + suffix;
      }

      if (progress < 1) requestAnimationFrame(update);
      else {
        if (isDecimal) el.textContent = prefix + fmtEur(target) + suffix;
        else el.textContent = prefix + target.toLocaleString('nl-NL') + suffix;
      }
    }
    requestAnimationFrame(update);
  }

  // ─── Render Review ─────────────────────────────────────────
  function renderReview(data) {
    const m = data.meta || {};
    const dg = data.doelgroep || {};
    const sp = data.steekproef || {};
    const me = data.methodologie || {};
    const pl = data.planning || {};
    const ko = data.kosten || {};

    // Key facts grid
    const grid = document.getElementById('facts-grid');
    grid.innerHTML = `
      ${factCard('Opdrachtgever', m.opdrachtgever, 'meta.opdrachtgever')}
      ${factCard('Projectnaam', m.projectnaam, 'meta.projectnaam')}
      ${factCard('Completes', sp.totaal_completes, 'steekproef.totaal_completes', false, true)}
      ${factCard('Landen', (sp.landen || []).length + ' landen')}
      ${factCard('Incidence Rate', dg.geschatte_incidence_rate)}
      ${factCard('LOI', (me.loi_minuten || '?') + ' min')}
      ${factCard('Doorlooptijd', (pl.totale_doorlooptijd_werkdagen || '?') + ' werkdagen')}
      ${factCard('Totaal excl. BTW', ko.totaal_excl_btw || 0, null, true, true)}`;

    // Staggered card entrance + number animation
    grid.querySelectorAll('.fact-card').forEach((card, i) => {
      setTimeout(() => {
        card.classList.add('visible');
        // Animate numbers
        const valEl = card.querySelector('.fact-value:not(input), .ticker');
        if (valEl && valEl.dataset.tick) {
          const num = parseFloat(valEl.dataset.tick);
          if (!isNaN(num)) {
            const isEur = valEl.dataset.ticktype === 'eur';
            if (isEur) animateNumber(valEl, num);
            else animateNumber(valEl, num);
          }
        }
      }, 60 * i);
    });

    // Wire up editable facts
    grid.querySelectorAll('.fact-card.editable input').forEach(input => {
      input.addEventListener('change', () => {
        setNestedValue(proposalData, input.dataset.path, input.value);
      });
    });

    // Sections
    const sections = document.getElementById('review-sections');
    sections.innerHTML = '';

    addSection(sections, 1, 'Management Summary', `
      <textarea data-path="management_summary" rows="4">${esc(data.management_summary || '')}</textarea>`);

    addSection(sections, 2, 'Doelgroep & Screening', `
      <p>${esc(dg.omschrijving || '')}</p>
      ${dg.screeningcriteria?.length ? '<div class="section-label">Screeningcriteria</div><ul>' + dg.screeningcriteria.map(c => `<li>${esc(c)}</li>`).join('') + '</ul>' : ''}
      <div class="section-label">Incidence Rate: ${esc(dg.geschatte_incidence_rate || '?')}</div>
      <p style="font-size:12px;font-style:italic;opacity:0.7">${esc(dg.ir_toelichting || '')}</p>`);

    addSection(sections, 3, 'Steekproefopzet', `
      ${buildMiniTable(['Land', 'Completes', 'Taal'], (sp.landen || []).map(l => [l.land, l.completes, l.taal]))}
      ${sp.quotas?.length ? '<div class="section-label">Quotas</div>' + buildMiniTable(['Variabele', 'Verdeling'], sp.quotas.map(q => [q.variabele, q.verdeling])) : ''}
      ${sp.opmerkingen ? `<p style="font-size:12px;font-style:italic;opacity:0.7;margin-top:8px">${esc(sp.opmerkingen)}</p>` : ''}`);

    addSection(sections, 4, 'Methodologie', `
      <p><strong>${esc(me.onderzoekstype || '')}</strong> &mdash; LOI ${me.loi_minuten || '?'} minuten</p>
      ${me.wervingsaanpak ? '<div class="section-label">Wervingsaanpak</div><p>' + esc(me.wervingsaanpak) + '</p>' : ''}
      ${me.kwaliteitsmaatregelen?.length ? '<div class="section-label">Kwaliteitsmaatregelen</div><ul>' + me.kwaliteitsmaatregelen.map(k => `<li>${esc(k)}</li>`).join('') + '</ul>' : ''}`);

    addSection(sections, 5, 'Planning', `
      <p><strong>Totale doorlooptijd: ${pl.totale_doorlooptijd_werkdagen || '?'} werkdagen</strong></p>
      ${buildMiniTable(['Fase', 'Duur', 'Omschrijving'], (pl.fases || []).map(f => [f.fase, f.duur, f.omschrijving]))}
      <p style="margin-top:8px"><em>Start:</em> ${esc(pl.verwachte_startdatum || '?')} &mdash; <em>Oplevering:</em> ${esc(pl.verwachte_opleverdatum || '?')}</p>`);

    addSection(sections, 6, 'Kostenoverzicht', buildKostenHtml(ko), true);

    addSection(sections, 7, 'Deliverables', `
      <ul>${(data.deliverables || []).map(d => `<li>${esc(d)}</li>`).join('')}</ul>`);

    addSection(sections, 8, 'Verantwoordelijkheden', `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div>
          <div class="section-label">Bureau</div>
          <ul>${((data.verantwoordelijkheden || {}).bureau || []).map(t => `<li>${esc(t)}</li>`).join('')}</ul>
        </div>
        <div>
          <div class="section-label">Opdrachtgever</div>
          <ul>${((data.verantwoordelijkheden || {}).opdrachtgever || []).map(t => `<li>${esc(t)}</li>`).join('')}</ul>
        </div>
      </div>`);

    addSection(sections, 9, 'Kwaliteitsgaranties', `
      <ul>${(data.kwaliteitsgaranties || []).map(g => `<li>${esc(g)}</li>`).join('')}</ul>`);

    addSection(sections, 10, 'Voorwaarden & Disclaimers', `
      ${data.voorwaarden?.length ? '<div class="section-label">Voorwaarden</div><ul>' + data.voorwaarden.map(v => `<li>${esc(v)}</li>`).join('') + '</ul>' : ''}
      ${data.disclaimers?.length ? '<div class="section-label">Disclaimers</div><ul>' + data.disclaimers.map(d => `<li>${esc(d)}</li>`).join('') + '</ul>' : ''}`);

    // Stagger section entrance
    sections.querySelectorAll('.section-card').forEach((card, i) => {
      setTimeout(() => card.classList.add('visible'), 300 + 60 * i);
    });

    // Wire up textarea edits
    sections.querySelectorAll('textarea[data-path]').forEach(ta => {
      ta.addEventListener('change', () => {
        setNestedValue(proposalData, ta.dataset.path, ta.value);
      });
    });
  }

  // ─── Section Builder ───────────────────────────────────────
  const chevronSvg = '<svg class="section-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';

  function addSection(container, num, title, bodyHtml, openByDefault) {
    const card = document.createElement('div');
    card.className = 'section-card' + (openByDefault ? ' open' : '');
    card.innerHTML = `
      <div class="section-header">
        <h3><span class="section-num">${num}</span> ${esc(title)}</h3>
        ${chevronSvg}
      </div>
      <div class="section-body"><div class="section-body-inner">${bodyHtml}</div></div>`;
    card.querySelector('.section-header').addEventListener('click', () => {
      card.classList.toggle('open');
    });
    container.appendChild(card);
  }

  // ─── Fact Card ─────────────────────────────────────────────
  function factCard(label, value, editPath, isAccent, isTicker) {
    const displayVal = String(value ?? '—');
    if (editPath) {
      return `<div class="fact-card editable">
        <div class="fact-label">${esc(label)}</div>
        <input class="fact-value${isAccent ? ' accent' : ''}" data-path="${editPath}" value="${esc(displayVal)}">
      </div>`;
    }
    if (isTicker && typeof value === 'number') {
      const tickType = isAccent ? 'eur' : 'num';
      return `<div class="fact-card">
        <div class="fact-label">${esc(label)}</div>
        <div class="fact-value ticker${isAccent ? ' accent' : ''}" data-tick="${value}" data-ticktype="${tickType}">0</div>
      </div>`;
    }
    return `<div class="fact-card">
      <div class="fact-label">${esc(label)}</div>
      <div class="fact-value${isAccent ? ' accent' : ''}">${esc(displayVal)}</div>
    </div>`;
  }

  // ─── Kosten HTML ───────────────────────────────────────────
  function buildKostenHtml(ko) {
    let html = '';
    if (ko.eenmalige_kosten?.length) {
      html += '<div class="section-label">Eenmalige kosten</div>';
      html += buildMiniTable(
        ['Omschrijving', 'Toelichting', 'Bedrag'],
        ko.eenmalige_kosten.map(e => [e.omschrijving, e.toelichting || '', fmtEur(e.bedrag)]),
        [null, null, 'amount']
      );
    }
    if (ko.variabele_kosten?.length) {
      html += '<div class="section-label" style="margin-top:16px">Variabele kosten</div>';
      html += buildMiniTable(
        ['Land', 'CPI', 'Incentive', 'Completes', 'Subtotaal'],
        ko.variabele_kosten.map(v => [v.land, fmtEur(v.cpi), fmtEur(v.incentive_per_respondent), v.aantal_completes, fmtEur(v.subtotaal)]),
        [null, 'amount', 'amount', 'amount', 'amount']
      );
    }
    html += `
      <table class="mini-table" style="margin-top:16px">
        <tr class="total-row"><td>Subtotaal eenmalig</td><td class="amount">${fmtEur(ko.subtotaal_eenmalig || 0)}</td></tr>
        <tr class="total-row"><td>Subtotaal variabel</td><td class="amount">${fmtEur(ko.subtotaal_variabel || 0)}</td></tr>
        <tr><td>Totaal excl. BTW</td><td class="amount">${fmtEur(ko.totaal_excl_btw || 0)}</td></tr>
        <tr><td>BTW (${ko.btw_percentage || 21}%)</td><td class="amount">${fmtEur(ko.btw_bedrag || 0)}</td></tr>
        <tr class="grand-row"><td>Totaal incl. BTW</td><td class="amount">${fmtEur(ko.totaal_incl_btw || 0)}</td></tr>
      </table>`;
    if (ko.btw_opmerking) {
      html += `<p style="font-size:11px;font-style:italic;opacity:0.6;margin-top:8px">${esc(ko.btw_opmerking)}</p>`;
    }
    return html;
  }

  // ─── Mini Table ────────────────────────────────────────────
  function buildMiniTable(headers, rows, cellClasses) {
    let html = '<table class="mini-table"><thead><tr>';
    headers.forEach(h => { html += `<th>${esc(h)}</th>`; });
    html += '</tr></thead><tbody>';
    rows.forEach(row => {
      html += '<tr>';
      row.forEach((cell, i) => {
        const cls = cellClasses?.[i] ? ` class="${cellClasses[i]}"` : '';
        html += `<td${cls}>${esc(String(cell ?? ''))}</td>`;
      });
      html += '</tr>';
    });
    html += '</tbody></table>';
    return html;
  }

  // ─── PDF Download ──────────────────────────────────────────
  document.getElementById('btn-download-pdf').addEventListener('click', async () => {
    if (!proposalData) return;
    const btn = document.getElementById('btn-download-pdf');
    const origHtml = btn.innerHTML;
    btn.innerHTML = '<span class="spinner"></span> Genereren...';
    btn.disabled = true;

    try {
      const resp = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(proposalData),
      });
      if (!resp.ok) throw new Error('PDF generatie mislukt');

      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const cd = resp.headers.get('Content-Disposition');
      a.download = cd?.match(/filename="(.+)"/)?.[1] || 'offerte.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast('PDF gedownload', 'success');
    } catch (err) {
      toast('Fout: ' + err.message, 'error');
    } finally {
      btn.innerHTML = origHtml;
      btn.disabled = false;
    }
  });

  // ─── JSON Export ───────────────────────────────────────────
  document.getElementById('btn-download-json').addEventListener('click', () => {
    if (!proposalData) return;
    const blob = new Blob([JSON.stringify(proposalData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const nr = (proposalData.meta?.offerte_nummer || 'offerte').toLowerCase().replace(/[^a-z0-9]/g, '-');
    a.download = nr + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast('JSON gedownload', 'success');
  });

  // ─── Helpers ───────────────────────────────────────────────
  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function fmtEur(n) {
    return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(n);
  }

  function setNestedValue(obj, path, value) {
    const keys = path.split('.');
    let target = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!target[keys[i]]) target[keys[i]] = {};
      target = target[keys[i]];
    }
    target[keys[keys.length - 1]] = value;
  }

})();
