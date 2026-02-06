(function () {
  'use strict';

  let proposalData = null;

  // ─── Elements ────────────────────────────────────────────────

  const screenInput = document.getElementById('step-input');
  const screenReview = document.getElementById('step-review');
  const briefingText = document.getElementById('briefing-text');
  const charCount = document.getElementById('char-count');
  const btnAnalyze = document.getElementById('btn-analyze');
  const errorMsg = document.getElementById('error-msg');

  // ─── Screen switching ────────────────────────────────────────

  function showScreen(screen) {
    screenInput.classList.remove('active');
    screenReview.classList.remove('active');
    screen.classList.add('active');
    window.scrollTo({ top: 0 });
  }

  // ─── Input logic ─────────────────────────────────────────────

  briefingText.addEventListener('input', () => {
    const len = briefingText.value.trim().length;
    charCount.textContent = `${len} tekens`;
    btnAnalyze.disabled = len < 20;
    errorMsg.style.display = 'none';
  });

  // ─── Analyze briefing ────────────────────────────────────────

  btnAnalyze.addEventListener('click', async () => {
    const text = briefingText.value.trim();
    if (text.length < 20) return;

    const btnText = btnAnalyze.querySelector('.btn-text');
    const btnLoading = btnAnalyze.querySelector('.btn-loading');
    btnText.style.display = 'none';
    btnLoading.style.display = 'inline-flex';
    btnAnalyze.disabled = true;
    errorMsg.style.display = 'none';

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
      renderReview(proposalData);
      showScreen(screenReview);
    } catch (err) {
      errorMsg.textContent = err.message;
      errorMsg.style.display = 'block';
    } finally {
      btnText.style.display = 'inline';
      btnLoading.style.display = 'none';
      btnAnalyze.disabled = false;
    }
  });

  // ─── Back button ─────────────────────────────────────────────

  document.getElementById('btn-back').addEventListener('click', () => {
    showScreen(screenInput);
  });

  // ─── Render Review ───────────────────────────────────────────

  function renderReview(data) {
    const m = data.meta || {};
    const dg = data.doelgroep || {};
    const sp = data.steekproef || {};
    const me = data.methodologie || {};
    const pl = data.planning || {};
    const ko = data.kosten || {};

    // Aannames banner
    const banner = document.getElementById('aannames-banner');
    const aanList = document.getElementById('aannames-list');
    if (data.aannames && data.aannames.length) {
      banner.style.display = 'flex';
      document.getElementById('aannames-text').textContent =
        `Er zijn ${data.aannames.length} aanname(s) gemaakt bij ontbrekende informatie:`;
      aanList.innerHTML = data.aannames.map(a => `<li>${esc(a)}</li>`).join('');
    } else {
      banner.style.display = 'none';
    }

    // Key facts grid
    const grid = document.getElementById('facts-grid');
    grid.innerHTML = `
      ${factCard('Opdrachtgever', m.opdrachtgever, 'meta.opdrachtgever')}
      ${factCard('Projectnaam', m.projectnaam, 'meta.projectnaam')}
      ${factCard('Completes', sp.totaal_completes, 'steekproef.totaal_completes')}
      ${factCard('Landen', (sp.landen || []).length + ' landen')}
      ${factCard('Incidence Rate', dg.geschatte_incidence_rate)}
      ${factCard('LOI', (me.loi_minuten || '?') + ' min')}
      ${factCard('Doorlooptijd', (pl.totale_doorlooptijd_werkdagen || '?') + ' werkdagen')}
      ${factCard('Totaal excl. BTW', fmtEur(ko.totaal_excl_btw || 0), null, true)}`;

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
      <p style="font-size:12px;color:#6b7280;font-style:italic">${esc(dg.ir_toelichting || '')}</p>`);

    addSection(sections, 3, 'Steekproefopzet', `
      ${buildMiniTable(['Land', 'Completes', 'Taal'], (sp.landen || []).map(l => [l.land, l.completes, l.taal]))}
      ${sp.quotas?.length ? '<div class="section-label">Quotas</div>' + buildMiniTable(['Variabele', 'Verdeling'], sp.quotas.map(q => [q.variabele, q.verdeling])) : ''}
      ${sp.opmerkingen ? `<p style="font-size:12px;color:#6b7280;font-style:italic;margin-top:8px">${esc(sp.opmerkingen)}</p>` : ''}`);

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

    // Wire up textarea edits
    sections.querySelectorAll('textarea[data-path]').forEach(ta => {
      ta.addEventListener('change', () => {
        setNestedValue(proposalData, ta.dataset.path, ta.value);
      });
    });
  }

  // ─── Section builder ─────────────────────────────────────────

  function addSection(container, num, title, bodyHtml, openByDefault) {
    const card = document.createElement('div');
    card.className = 'section-card' + (openByDefault ? ' open' : '');
    card.innerHTML = `
      <div class="section-header">
        <h3><span class="section-num">${num}</span> ${esc(title)}</h3>
        <span class="section-chevron">&#9662;</span>
      </div>
      <div class="section-body">${bodyHtml}</div>`;
    card.querySelector('.section-header').addEventListener('click', () => {
      card.classList.toggle('open');
    });
    container.appendChild(card);
  }

  // ─── Fact card ───────────────────────────────────────────────

  function factCard(label, value, editPath, isAccent) {
    if (editPath) {
      return `<div class="fact-card editable">
        <div class="fact-label">${esc(label)}</div>
        <input class="fact-value${isAccent ? ' accent' : ''}" data-path="${editPath}" value="${esc(String(value || ''))}">
      </div>`;
    }
    return `<div class="fact-card">
      <div class="fact-label">${esc(label)}</div>
      <div class="fact-value${isAccent ? ' accent' : ''}">${esc(String(value || '—'))}</div>
    </div>`;
  }

  // ─── Kosten HTML ─────────────────────────────────────────────

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
      html += `<p style="font-size:11px;color:#6b7280;font-style:italic;margin-top:8px">${esc(ko.btw_opmerking)}</p>`;
    }

    return html;
  }

  // ─── Mini table builder ──────────────────────────────────────

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

  // ─── PDF Download ────────────────────────────────────────────

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
    } catch (err) {
      alert('Fout: ' + err.message);
    } finally {
      btn.innerHTML = origHtml;
      btn.disabled = false;
    }
  });

  // ─── JSON Export ─────────────────────────────────────────────

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
  });

  // ─── Helpers ─────────────────────────────────────────────────

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
