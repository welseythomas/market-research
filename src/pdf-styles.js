/**
 * PDF Styling configuratie voor offerte-generator
 * Professioneel blauw/grijs kleurenschema
 */

const COLORS = {
  primary: '#1a3a5c',       // Donkerblauw — headers, titels
  primaryLight: '#2d5f8a',  // Middenblauw — subtitels
  accent: '#e8913a',        // Oranje accent — highlights, bedragen
  dark: '#1a1a2e',          // Bijna zwart — body tekst
  medium: '#4a4a5a',        // Donkergrijs — secundaire tekst
  light: '#6b7280',         // Grijs — labels, toelichtingen
  border: '#d1d5db',        // Lichtgrijs — tabelranden
  bgLight: '#f0f4f8',       // Lichtblauw-grijs — tabel header achtergrond
  bgAccent: '#fef7ed',      // Licht oranje — highlight achtergrond
  white: '#ffffff',
};

const FONTS = {
  // pdfmake default fonts: Roboto
  headerSize: 24,
  subHeaderSize: 16,
  sectionTitleSize: 14,
  bodySize: 10,
  smallSize: 9,
  tinySize: 8,
};

const SPACING = {
  sectionGap: 16,
  paragraphGap: 8,
  listItemGap: 4,
  pageMargins: [50, 80, 50, 60], // left, top, right, bottom
};

/** Herbruikbare pdfmake style-definities */
const styles = {
  coverTitle: {
    fontSize: 28,
    bold: true,
    color: COLORS.primary,
    alignment: 'left',
    margin: [0, 0, 0, 8],
  },
  coverSubtitle: {
    fontSize: 14,
    color: COLORS.primaryLight,
    alignment: 'left',
    margin: [0, 0, 0, 4],
  },
  coverDetail: {
    fontSize: 11,
    color: COLORS.medium,
    alignment: 'left',
    margin: [0, 2, 0, 2],
  },
  sectionTitle: {
    fontSize: FONTS.sectionTitleSize,
    bold: true,
    color: COLORS.primary,
    margin: [0, SPACING.sectionGap, 0, 8],
  },
  sectionNumber: {
    fontSize: FONTS.sectionTitleSize,
    bold: true,
    color: COLORS.accent,
    margin: [0, SPACING.sectionGap, 6, 8],
  },
  body: {
    fontSize: FONTS.bodySize,
    color: COLORS.dark,
    lineHeight: 1.5,
    margin: [0, 0, 0, SPACING.paragraphGap],
  },
  bodyBold: {
    fontSize: FONTS.bodySize,
    bold: true,
    color: COLORS.dark,
    lineHeight: 1.5,
  },
  label: {
    fontSize: FONTS.smallSize,
    color: COLORS.light,
    margin: [0, 0, 0, 2],
  },
  highlight: {
    fontSize: FONTS.bodySize,
    color: COLORS.accent,
    bold: true,
  },
  tableHeader: {
    fontSize: FONTS.smallSize,
    bold: true,
    color: COLORS.primary,
    fillColor: COLORS.bgLight,
    margin: [4, 6, 4, 6],
  },
  tableCell: {
    fontSize: FONTS.smallSize,
    color: COLORS.dark,
    margin: [4, 5, 4, 5],
  },
  tableCellRight: {
    fontSize: FONTS.smallSize,
    color: COLORS.dark,
    alignment: 'right',
    margin: [4, 5, 4, 5],
  },
  tableCellBold: {
    fontSize: FONTS.smallSize,
    bold: true,
    color: COLORS.dark,
    margin: [4, 5, 4, 5],
  },
  totalRow: {
    fontSize: FONTS.bodySize,
    bold: true,
    color: COLORS.primary,
    fillColor: COLORS.bgLight,
    margin: [4, 6, 4, 6],
  },
  totalAmount: {
    fontSize: FONTS.bodySize,
    bold: true,
    color: COLORS.accent,
    alignment: 'right',
    fillColor: COLORS.bgLight,
    margin: [4, 6, 4, 6],
  },
  grandTotal: {
    fontSize: 12,
    bold: true,
    color: COLORS.primary,
    fillColor: COLORS.bgAccent,
    margin: [4, 8, 4, 8],
  },
  grandTotalAmount: {
    fontSize: 12,
    bold: true,
    color: COLORS.accent,
    alignment: 'right',
    fillColor: COLORS.bgAccent,
    margin: [4, 8, 4, 8],
  },
  bulletItem: {
    fontSize: FONTS.bodySize,
    color: COLORS.dark,
    lineHeight: 1.4,
    margin: [0, 0, 0, SPACING.listItemGap],
  },
  smallNote: {
    fontSize: FONTS.tinySize,
    color: COLORS.light,
    italics: true,
    margin: [0, 4, 0, 0],
  },
  footer: {
    fontSize: FONTS.tinySize,
    color: COLORS.light,
    alignment: 'center',
  },
};

/** Tabel layout presets */
const tableLayouts = {
  proposal: {
    hLineWidth: (i, node) => (i === 0 || i === 1 || i === node.table.body.length) ? 1 : 0.5,
    vLineWidth: () => 0,
    hLineColor: (i) => i <= 1 ? COLORS.primary : COLORS.border,
    paddingLeft: () => 4,
    paddingRight: () => 4,
    paddingTop: () => 5,
    paddingBottom: () => 5,
  },
  totals: {
    hLineWidth: (i, node) => (i === 0 || i === node.table.body.length) ? 1.5 : 0.5,
    vLineWidth: () => 0,
    hLineColor: () => COLORS.primary,
    paddingLeft: () => 4,
    paddingRight: () => 4,
    paddingTop: () => 6,
    paddingBottom: () => 6,
  },
  noBorders: {
    hLineWidth: () => 0,
    vLineWidth: () => 0,
    paddingLeft: () => 0,
    paddingRight: () => 8,
    paddingTop: () => 3,
    paddingBottom: () => 3,
  },
};

module.exports = { COLORS, FONTS, SPACING, styles, tableLayouts };
