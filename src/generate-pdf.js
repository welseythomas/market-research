#!/usr/bin/env node
/**
 * Respondent Recruitment Proposal — PDF Generator
 *
 * Gebruik: node src/generate-pdf.js <input.json> [output.pdf]
 *
 * Leest een JSON-offerte en genereert een professioneel gestylede PDF.
 */

const fs = require('fs');
const path = require('path');
const PdfPrinter = require('pdfmake');
const { COLORS, SPACING, styles, tableLayouts } = require('./pdf-styles');

// ─── Font setup ──────────────────────────────────────────────────
const fontsDir = path.join(__dirname, '..', 'fonts');
const fonts = {
  Roboto: {
    normal: path.join(fontsDir, 'Roboto-Regular.ttf'),
    bold: path.join(fontsDir, 'Roboto-Medium.ttf'),
    italics: path.join(fontsDir, 'Roboto-Italic.ttf'),
    bolditalics: path.join(fontsDir, 'Roboto-MediumItalic.ttf'),
  }
};

const printer = new PdfPrinter(fonts);

// ─── Helpers ─────────────────────────────────────────────────────

function fmt(amount) {
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(amount);
}

function fmtDate(isoDate) {
  if (!isoDate) return '—';
  const parts = isoDate.split('-');
  if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
  return isoDate;
}

function sectionTitle(number, title) {
  return {
    columns: [
      { text: `${number}.`, style: 'sectionNumber', width: 'auto' },
      { text: title, style: 'sectionTitle' },
    ],
    columnGap: 6,
  };
}

function bulletList(items) {
  return {
    ul: items.map(item => ({ text: item, style: 'bulletItem' })),
    margin: [0, 0, 0, SPACING.paragraphGap],
  };
}

function divider() {
  return {
    canvas: [{ type: 'line', x1: 0, y1: 0, x2: 495, y2: 0, lineWidth: 0.5, lineColor: COLORS.border }],
    margin: [0, 8, 0, 8],
  };
}

// ─── PDF Section Builders ────────────────────────────────────────

function buildCoverPage(data) {
  const meta = data.meta;
  return [
    // Top accent line
    {
      canvas: [{ type: 'rect', x: 0, y: 0, w: 495, h: 4, color: COLORS.primary }],
      margin: [0, 60, 0, 30],
    },
    // Bureau naam + tagline
    { text: meta.bureau_naam || '[BUREAUNAAM]', style: 'coverTitle' },
    { text: meta.bureau_tagline || 'Intelligent Respondent Recruitment', style: 'coverSubtitle', margin: [0, 0, 0, 40] },
    // Accent lijn
    {
      canvas: [{ type: 'rect', x: 0, y: 0, w: 80, h: 3, color: COLORS.accent }],
      margin: [0, 0, 0, 20],
    },
    // Offerte titel
    { text: 'OFFERTE', fontSize: 12, color: COLORS.light, letterSpacing: 4, margin: [0, 0, 0, 8] },
    { text: meta.projectnaam || 'Projectnaam', fontSize: 22, bold: true, color: COLORS.primary, margin: [0, 0, 0, 30] },
    // Details tabel
    {
      layout: 'noBorders',
      table: {
        widths: [120, '*'],
        body: [
          [{ text: 'Offertenummer', style: 'label' }, { text: meta.offerte_nummer || '—', style: 'coverDetail' }],
          [{ text: 'Datum', style: 'label' }, { text: fmtDate(meta.offerte_datum), style: 'coverDetail' }],
          [{ text: 'Geldig tot', style: 'label' }, { text: fmtDate(meta.geldig_tot), style: 'coverDetail' }],
          [{ text: 'Opdrachtgever', style: 'label' }, { text: meta.opdrachtgever || '—', style: 'coverDetail' }],
          [{ text: 'Contactpersoon', style: 'label' }, { text: meta.contactpersoon || '—', style: 'coverDetail' }],
        ],
      },
    },
    { text: '', pageBreak: 'after' },
  ];
}

function buildManagementSummary(data) {
  return [
    sectionTitle(1, 'Management Summary'),
    { text: data.management_summary || '', style: 'body' },
  ];
}

function buildDoelgroep(data) {
  const dg = data.doelgroep || {};
  const content = [
    sectionTitle(2, 'Doelgroep & Screening'),
    { text: dg.omschrijving || '', style: 'body' },
  ];

  if (dg.screeningcriteria && dg.screeningcriteria.length) {
    content.push({ text: 'Screeningcriteria:', style: 'bodyBold', margin: [0, 4, 0, 4] });
    content.push(bulletList(dg.screeningcriteria));
  }

  // IR info box
  content.push({
    layout: 'noBorders',
    table: {
      widths: ['*'],
      body: [[{
        stack: [
          { text: 'Geschatte Incidence Rate', style: 'label' },
          { text: dg.geschatte_incidence_rate || '—', fontSize: 18, bold: true, color: COLORS.accent, margin: [0, 2, 0, 4] },
          { text: dg.ir_toelichting || '', style: 'smallNote' },
        ],
        fillColor: COLORS.bgLight,
        margin: [12, 10, 12, 10],
      }]],
    },
    margin: [0, 4, 0, SPACING.paragraphGap],
  });

  return content;
}

function buildSteekproef(data) {
  const sp = data.steekproef || {};
  const content = [
    sectionTitle(3, 'Steekproefopzet'),
    {
      text: [
        { text: 'Totaal aantal completes: ', style: 'body' },
        { text: `${sp.totaal_completes || 0}`, style: 'highlight' },
      ],
      margin: [0, 0, 0, SPACING.paragraphGap],
    },
  ];

  // Landen tabel
  if (sp.landen && sp.landen.length) {
    const landenBody = [
      [
        { text: 'Land', style: 'tableHeader' },
        { text: 'Completes', style: 'tableHeader' },
        { text: 'Taal', style: 'tableHeader' },
      ],
    ];
    sp.landen.forEach(l => {
      landenBody.push([
        { text: l.land, style: 'tableCell' },
        { text: String(l.completes), style: 'tableCellRight' },
        { text: l.taal, style: 'tableCell' },
      ]);
    });
    content.push({
      layout: tableLayouts.proposal,
      table: { headerRows: 1, widths: ['*', 80, '*'], body: landenBody },
      margin: [0, 0, 0, SPACING.paragraphGap],
    });
  }

  // Quotas
  if (sp.quotas && sp.quotas.length) {
    content.push({ text: 'Quota-verdeling:', style: 'bodyBold', margin: [0, 4, 0, 4] });
    const quotaBody = [
      [
        { text: 'Variabele', style: 'tableHeader' },
        { text: 'Verdeling', style: 'tableHeader' },
      ],
    ];
    sp.quotas.forEach(q => {
      quotaBody.push([
        { text: q.variabele, style: 'tableCell' },
        { text: q.verdeling, style: 'tableCell' },
      ]);
    });
    content.push({
      layout: tableLayouts.proposal,
      table: { headerRows: 1, widths: [150, '*'], body: quotaBody },
      margin: [0, 0, 0, SPACING.paragraphGap],
    });
  }

  if (sp.opmerkingen) {
    content.push({ text: sp.opmerkingen, style: 'smallNote' });
  }

  return content;
}

function buildMethodologie(data) {
  const m = data.methodologie || {};
  const content = [
    sectionTitle(4, 'Methodologie'),
    {
      layout: 'noBorders',
      table: {
        widths: [140, '*'],
        body: [
          [{ text: 'Onderzoekstype', style: 'label' }, { text: m.onderzoekstype || '—', style: 'body' }],
          [{ text: 'Lengte interview (LOI)', style: 'label' }, { text: `${m.loi_minuten || '—'} minuten`, style: 'body' }],
        ],
      },
      margin: [0, 0, 0, SPACING.paragraphGap],
    },
  ];

  if (m.wervingsaanpak) {
    content.push({ text: 'Wervingsaanpak:', style: 'bodyBold', margin: [0, 4, 0, 4] });
    content.push({ text: m.wervingsaanpak, style: 'body' });
  }

  if (m.kwaliteitsmaatregelen && m.kwaliteitsmaatregelen.length) {
    content.push({ text: 'Kwaliteitsmaatregelen:', style: 'bodyBold', margin: [0, 4, 0, 4] });
    content.push(bulletList(m.kwaliteitsmaatregelen));
  }

  return content;
}

function buildPlanning(data) {
  const p = data.planning || {};
  const content = [
    sectionTitle(5, 'Planning'),
    {
      text: [
        { text: 'Totale doorlooptijd: ', style: 'body' },
        { text: `${p.totale_doorlooptijd_werkdagen || '—'} werkdagen`, style: 'highlight' },
      ],
      margin: [0, 0, 0, SPACING.paragraphGap],
    },
  ];

  if (p.fases && p.fases.length) {
    const body = [
      [
        { text: 'Fase', style: 'tableHeader' },
        { text: 'Duur', style: 'tableHeader' },
        { text: 'Omschrijving', style: 'tableHeader' },
      ],
    ];
    p.fases.forEach(f => {
      body.push([
        { text: f.fase, style: 'tableCellBold' },
        { text: f.duur, style: 'tableCell' },
        { text: f.omschrijving, style: 'tableCell' },
      ]);
    });
    content.push({
      layout: tableLayouts.proposal,
      table: { headerRows: 1, widths: [140, 80, '*'], body },
      margin: [0, 0, 0, SPACING.paragraphGap],
    });
  }

  if (p.verwachte_startdatum) {
    content.push({
      layout: 'noBorders',
      table: {
        widths: [140, '*'],
        body: [
          [{ text: 'Verwachte start', style: 'label' }, { text: p.verwachte_startdatum, style: 'body' }],
          [{ text: 'Verwachte oplevering', style: 'label' }, { text: p.verwachte_opleverdatum || '—', style: 'body' }],
        ],
      },
    });
  }

  return content;
}

function buildKosten(data) {
  const k = data.kosten || {};
  const content = [
    sectionTitle(6, 'Kostenoverzicht'),
  ];

  // Eenmalige kosten
  if (k.eenmalige_kosten && k.eenmalige_kosten.length) {
    content.push({ text: 'Eenmalige kosten', style: 'bodyBold', margin: [0, 4, 0, 6] });
    const body = [
      [
        { text: 'Omschrijving', style: 'tableHeader' },
        { text: 'Toelichting', style: 'tableHeader' },
        { text: 'Bedrag', style: 'tableHeader' },
      ],
    ];
    k.eenmalige_kosten.forEach(ek => {
      body.push([
        { text: ek.omschrijving, style: 'tableCellBold' },
        { text: ek.toelichting || '', style: 'tableCell' },
        { text: fmt(ek.bedrag), style: 'tableCellRight' },
      ]);
    });
    // Subtotaal rij
    body.push([
      { text: 'Subtotaal eenmalig', style: 'totalRow', colSpan: 2 }, {},
      { text: fmt(k.subtotaal_eenmalig || 0), style: 'totalAmount' },
    ]);
    content.push({
      layout: tableLayouts.proposal,
      table: { headerRows: 1, widths: [150, '*', 90], body },
      margin: [0, 0, 0, SPACING.sectionGap],
    });
  }

  // Variabele kosten
  if (k.variabele_kosten && k.variabele_kosten.length) {
    content.push({ text: 'Variabele kosten (per land)', style: 'bodyBold', margin: [0, 4, 0, 6] });
    const body = [
      [
        { text: 'Land', style: 'tableHeader' },
        { text: 'CPI', style: 'tableHeader' },
        { text: 'Incentive', style: 'tableHeader' },
        { text: 'Completes', style: 'tableHeader' },
        { text: 'Subtotaal', style: 'tableHeader' },
      ],
    ];
    k.variabele_kosten.forEach(vk => {
      body.push([
        { text: vk.land, style: 'tableCellBold' },
        { text: fmt(vk.cpi), style: 'tableCellRight' },
        { text: fmt(vk.incentive_per_respondent), style: 'tableCellRight' },
        { text: String(vk.aantal_completes), style: 'tableCellRight' },
        { text: fmt(vk.subtotaal), style: 'tableCellRight' },
      ]);
    });
    body.push([
      { text: 'Subtotaal variabel', style: 'totalRow', colSpan: 4 }, {}, {}, {},
      { text: fmt(k.subtotaal_variabel || 0), style: 'totalAmount' },
    ]);
    content.push({
      layout: tableLayouts.proposal,
      table: { headerRows: 1, widths: ['*', 70, 70, 65, 85], body },
      margin: [0, 0, 0, SPACING.sectionGap],
    });
  }

  // Totalen overzicht
  content.push({
    layout: tableLayouts.totals,
    table: {
      widths: ['*', 120],
      body: [
        [
          { text: 'Totaal exclusief BTW', style: 'totalRow' },
          { text: fmt(k.totaal_excl_btw || 0), style: 'totalAmount' },
        ],
        [
          { text: `BTW (${k.btw_percentage || 21}%)`, style: 'tableCell' },
          { text: fmt(k.btw_bedrag || 0), style: 'tableCellRight' },
        ],
        [
          { text: 'Totaal inclusief BTW', style: 'grandTotal' },
          { text: fmt(k.totaal_incl_btw || 0), style: 'grandTotalAmount' },
        ],
      ],
    },
    margin: [0, 0, 0, SPACING.paragraphGap],
  });

  if (k.btw_opmerking) {
    content.push({ text: k.btw_opmerking, style: 'smallNote' });
  }

  return content;
}

function buildDeliverables(data) {
  const content = [
    sectionTitle(7, 'Deliverables'),
  ];
  if (data.deliverables && data.deliverables.length) {
    content.push(bulletList(data.deliverables));
  }
  return content;
}

function buildVerantwoordelijkheden(data) {
  const v = data.verantwoordelijkheden || {};
  const content = [
    sectionTitle(8, 'Verantwoordelijkheden'),
  ];

  const colLeft = [];
  const colRight = [];

  if (v.bureau && v.bureau.length) {
    colLeft.push({ text: 'Ons bureau', style: 'bodyBold', margin: [0, 0, 0, 4] });
    colLeft.push({ ul: v.bureau.map(t => ({ text: t, style: 'bulletItem' })) });
  }
  if (v.opdrachtgever && v.opdrachtgever.length) {
    colRight.push({ text: 'Opdrachtgever', style: 'bodyBold', margin: [0, 0, 0, 4] });
    colRight.push({ ul: v.opdrachtgever.map(t => ({ text: t, style: 'bulletItem' })) });
  }

  content.push({
    columns: [
      { width: '*', stack: colLeft },
      { width: 20, text: '' },
      { width: '*', stack: colRight },
    ],
    margin: [0, 0, 0, SPACING.paragraphGap],
  });

  return content;
}

function buildKwaliteitsgaranties(data) {
  const content = [sectionTitle(9, 'Kwaliteitsgaranties')];
  if (data.kwaliteitsgaranties && data.kwaliteitsgaranties.length) {
    content.push(bulletList(data.kwaliteitsgaranties));
  }
  return content;
}

function buildVoorwaardenDiscl(data) {
  const content = [sectionTitle(10, 'Voorwaarden & Disclaimers')];

  if (data.voorwaarden && data.voorwaarden.length) {
    content.push({ text: 'Voorwaarden:', style: 'bodyBold', margin: [0, 0, 0, 4] });
    content.push(bulletList(data.voorwaarden));
  }
  if (data.disclaimers && data.disclaimers.length) {
    content.push({ text: 'Disclaimers:', style: 'bodyBold', margin: [0, 4, 0, 4] });
    content.push(bulletList(data.disclaimers));
  }
  return content;
}

function buildAannames(data) {
  if (!data.aannames || !data.aannames.length) return [];
  return [
    divider(),
    { text: 'Aannames', style: 'bodyBold', color: COLORS.accent, margin: [0, 8, 0, 6] },
    { text: 'De volgende aannames zijn gemaakt bij het opstellen van deze offerte:', style: 'smallNote', margin: [0, 0, 0, 6] },
    bulletList(data.aannames),
  ];
}

// ─── Document Builder ────────────────────────────────────────────

function buildDocument(data) {
  const content = [
    ...buildCoverPage(data),
    ...buildManagementSummary(data),
    divider(),
    ...buildDoelgroep(data),
    divider(),
    ...buildSteekproef(data),
    divider(),
    ...buildMethodologie(data),
    divider(),
    ...buildPlanning(data),
    { text: '', pageBreak: 'after' },
    ...buildKosten(data),
    divider(),
    ...buildDeliverables(data),
    divider(),
    ...buildVerantwoordelijkheden(data),
    divider(),
    ...buildKwaliteitsgaranties(data),
    divider(),
    ...buildVoorwaardenDiscl(data),
    ...buildAannames(data),
  ];

  const bureauNaam = (data.meta && data.meta.bureau_naam) || '';

  return {
    content,
    styles,
    pageSize: 'A4',
    pageMargins: SPACING.pageMargins,
    defaultStyle: {
      font: 'Roboto',
      fontSize: 10,
      color: COLORS.dark,
    },
    header: (currentPage) => {
      if (currentPage === 1) return null;
      return {
        columns: [
          { text: bureauNaam, fontSize: 8, color: COLORS.light, margin: [50, 20, 0, 0] },
          { text: (data.meta && data.meta.projectnaam) || '', fontSize: 8, color: COLORS.light, alignment: 'right', margin: [0, 20, 50, 0] },
        ],
      };
    },
    footer: (currentPage, pageCount) => {
      if (currentPage === 1) return null;
      return {
        columns: [
          { text: `${(data.meta && data.meta.offerte_nummer) || ''} | Vertrouwelijk`, fontSize: 7, color: COLORS.light, margin: [50, 0, 0, 0] },
          { text: `${currentPage} / ${pageCount}`, fontSize: 7, color: COLORS.light, alignment: 'right', margin: [0, 0, 50, 0] },
        ],
      };
    },
  };
}

// ─── Main ────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
  Respondent Recruitment Proposal — PDF Generator

  Gebruik:
    node src/generate-pdf.js <input.json> [output.pdf]

  Als output.pdf niet opgegeven wordt, wordt het bestand in output/ geplaatst
  met de naam gebaseerd op het offertenummer.

  Voorbeelden:
    node src/generate-pdf.js examples/example-proposal.json
    node src/generate-pdf.js offerte.json mijn-offerte.pdf
    npm run example
`);
    process.exit(0);
  }

  const inputPath = path.resolve(args[0]);

  if (!fs.existsSync(inputPath)) {
    console.error(`Fout: bestand niet gevonden: ${inputPath}`);
    process.exit(1);
  }

  let data;
  try {
    const raw = fs.readFileSync(inputPath, 'utf-8');
    data = JSON.parse(raw);
  } catch (err) {
    console.error(`Fout bij lezen JSON: ${err.message}`);
    process.exit(1);
  }

  // Validate minimal structure
  if (!data.meta) {
    console.error('Fout: JSON mist het "meta" object. Controleer de structuur.');
    process.exit(1);
  }

  // Determine output path
  let outputPath;
  if (args[1]) {
    outputPath = path.resolve(args[1]);
  } else {
    const slug = (data.meta.offerte_nummer || 'offerte')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-');
    const outputDir = path.join(__dirname, '..', 'output');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    outputPath = path.join(outputDir, `${slug}.pdf`);
  }

  console.log(`Genereren: ${path.basename(inputPath)} → ${path.basename(outputPath)}`);

  const docDefinition = buildDocument(data);
  const pdfDoc = printer.createPdfKitDocument(docDefinition, { tableLayouts });

  const writeStream = fs.createWriteStream(outputPath);
  pdfDoc.pipe(writeStream);
  pdfDoc.end();

  writeStream.on('finish', () => {
    console.log(`PDF succesvol gegenereerd: ${outputPath}`);
  });

  writeStream.on('error', (err) => {
    console.error(`Fout bij schrijven PDF: ${err.message}`);
    process.exit(1);
  });
}

main();
