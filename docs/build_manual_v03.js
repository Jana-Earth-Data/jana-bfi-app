/**
 * Build v0.3 of the Jana Financed Emissions Dashboard User's Manual.
 * Style rule: NO em dashes anywhere in the text (see docs/STYLE_NOTES.md).
 */

const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  PageBreak,
  Table,
  TableRow,
  TableCell,
  WidthType,
  ShadingType,
  BorderStyle,
  Footer,
  Header,
  PageNumber,
  TableOfContents,
  ImageRun,
  TabStopType,
  LeaderType,
  LevelFormat,
  PositionalTab,
  PositionalTabAlignment,
  PositionalTabLeader,
} = require("docx");
const fs = require("fs");

// Cover logo. Tries the repo location first, then a sibling copy, so the
// build works whether it is run from docs/ or from a scratch directory.
const _path = require("path");
const LOGO_CANDIDATES = [
  _path.join(__dirname, "..", "public", "green_logo.png"),
  _path.join(__dirname, "green_logo.png"),
  "/sessions/hopeful-kind-fermi/mnt/Projects/repos/jana-bfi-app/public/green_logo.png",
];
const LOGO_PATH = LOGO_CANDIDATES.find((c) => fs.existsSync(c));
const LOGO_BUF = LOGO_PATH ? fs.readFileSync(LOGO_PATH) : null;
if (!LOGO_BUF) console.warn("WARNING: cover logo not found; building without it");

const BRAND = "0F5132";
const BRAND_ACCENT = "1B6B3D";
const HEADER_TEXT = "334155";
const RULE = "94A3B8";
const CELL_HEAD = "F1F5F9";
const NOTICE_BG = "FEF3C7";
const NOTICE_BORDER = "F59E0B";
const GREEN = "16A34A";
const AMBER = "F59E0B";
const RED = "DC2626";
const GREY = "64748B";
const ORANGE = "F97316";

const FONT = "Calibri";
const BODY_SIZE = 22;
const TINY_SIZE = 18;

function p(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 120, ...(opts.spacing || {}) },
    alignment: opts.alignment,
    heading: opts.heading,
    children: [
      new TextRun({
        text,
        font: FONT,
        size: opts.size ?? BODY_SIZE,
        bold: opts.bold,
        italics: opts.italics,
        color: opts.color,
      }),
    ],
  });
}

/** Top-level heading.
 *
 *  `pageBreakBefore` rather than an explicit trailing pageBreak() at the end
 *  of each Part: a trailing break appended to content that already ends near
 *  the foot of a page produces a blank page (v0.3 shipped one at page 12).
 *  Breaking *before* the heading gives the same layout and cannot orphan. */
function h1(text, opts = {}) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    pageBreakBefore: opts.firstPage !== true,
    spacing: { before: 320, after: 160 },
    children: [
      new TextRun({ text, font: FONT, size: 40, bold: true, color: BRAND }),
    ],
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 260, after: 120 },
    children: [
      new TextRun({ text, font: FONT, size: 30, bold: true, color: BRAND_ACCENT }),
    ],
  });
}

function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 180, after: 80 },
    children: [
      new TextRun({ text, font: FONT, size: 24, bold: true, color: HEADER_TEXT }),
    ],
  });
}

function bullet(text) {
  return new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    spacing: { after: 80 },
    children: [new TextRun({ text, font: FONT, size: BODY_SIZE })],
  });
}

function bulletRuns(runs) {
  return new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    spacing: { after: 80 },
    children: runs,
  });
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

function cell(textOrRuns, opts = {}) {
  const paragraphs = Array.isArray(textOrRuns)
    ? textOrRuns
    : [
        new Paragraph({
          spacing: { after: 0 },
          alignment: opts.alignment,
          children: [
            new TextRun({
              text: textOrRuns,
              font: FONT,
              size: opts.size ?? BODY_SIZE,
              bold: opts.bold,
              color: opts.color,
            }),
          ],
        }),
      ];
  return new TableCell({
    width: { size: opts.widthDxa, type: WidthType.DXA },
    shading: opts.fill
      ? { type: ShadingType.CLEAR, color: "auto", fill: opts.fill }
      : undefined,
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    children: paragraphs,
  });
}

function twoColTable(widths, rows) {
  return new Table({
    columnWidths: widths,
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: RULE },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: RULE },
      left: { style: BorderStyle.SINGLE, size: 4, color: RULE },
      right: { style: BorderStyle.SINGLE, size: 4, color: RULE },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: RULE },
      insideVertical: { style: BorderStyle.SINGLE, size: 2, color: RULE },
    },
    rows,
  });
}

function noticeBox(titleText, paragraphs) {
  const inner = [
    new Paragraph({
      spacing: { after: 100 },
      children: [
        new TextRun({
          text: titleText,
          font: FONT,
          size: 22,
          bold: true,
          color: HEADER_TEXT,
        }),
      ],
    }),
    ...paragraphs,
  ];
  return new Table({
    columnWidths: [9360],
    width: { size: 9360, type: WidthType.DXA },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 12, color: NOTICE_BORDER },
      bottom: { style: BorderStyle.SINGLE, size: 12, color: NOTICE_BORDER },
      left: { style: BorderStyle.SINGLE, size: 12, color: NOTICE_BORDER },
      right: { style: BorderStyle.SINGLE, size: 12, color: NOTICE_BORDER },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "auto" },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: "auto" },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 9360, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, color: "auto", fill: NOTICE_BG },
            margins: { top: 160, bottom: 160, left: 200, right: 200 },
            children: inner,
          }),
        ],
      }),
    ],
  });
}

// ---------- Cover ----------
const cover = [
  ...(LOGO_BUF
    ? [new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 1400, after: 240 },
        children: [new ImageRun({
          data: LOGO_BUF,
          transformation: { width: 150, height: 150 },
          altText: { title: "Jana Earth Data", description: "Jana Earth Data logo", name: "logo" },
        })],
      })]
    : []),
  new Paragraph({
    spacing: { before: 200, after: 200 },
    alignment: AlignmentType.CENTER,
    children: [
      new TextRun({
        text: "Financed Emissions Dashboard",
        font: FONT, size: 56, bold: true, color: BRAND,
      }),
    ],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 800 },
    children: [new TextRun({ text: "User's Manual", font: FONT, size: 40, bold: true, color: HEADER_TEXT })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 100 },
    children: [new TextRun({ text: "Reference demonstration for commercial banks in Nepal", font: FONT, size: 24, italics: true, color: HEADER_TEXT })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 100 },
    children: [new TextRun({ text: "v0.3 (Draft for review)", font: FONT, size: 22, color: HEADER_TEXT })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 1200 },
    children: [new TextRun({ text: "September 2026", font: FONT, size: 22, color: HEADER_TEXT })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 400 },
    children: [new TextRun({ text: "Published by Jana Earth Data", font: FONT, size: 22, bold: true, color: BRAND })],
  }),
  noticeBox("About this manual", [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 0 },
      children: [
        new TextRun({
          text: "This manual describes the Financed Emissions Dashboard as it stands today. The figures and screens reproduced here come from the demonstration portfolio, so the bank names and loan values in them are illustrative rather than real.",
          font: FONT, size: BODY_SIZE,
        }),
      ],
    }),
  ]),
];

// ---------- Important Notice ----------
const importantNotice = [
  h1("About this manual", { firstPage: true }),
  h3("About this demonstration"),
  p("This manual describes the Financed Emissions Dashboard for commercial bank staff in Nepal. Screens and figures throughout are reproduced from the demonstration portfolio, so the bank shown (First Bank of Nepal by default, or Laxmi Sunrise Bank where that access code has been provided) and every loan value in them are illustrative. Section 1.5 explains how a demonstration instance differs from a live one, and how the platform keeps the two apart."),
  h3("What is real in this demonstration"),
  p("The reference emissions data underneath the dashboard is drawn from public sources that the Jana platform has ingested and stabilised. Specifically, the dashboard references:"),
  bullet("Climate TRACE v5.6 (2024) facility-level CO2-equivalent emissions for 213 Nepal assets, summing to approximately 28.04 Mt CO2e."),
  bullet("EDGAR v8.1 gridded national CO2, polygon-clipped to the Nepal administrative boundary, yielding 1,343 cells and an estimated 18.81 Mt national CO2 for the latest available year."),
  bullet("Global Cement and Concrete Tracker (July 2025) for 61 operating cement plants in Nepal, with capacity and owner metadata."),
  bullet("NRB Guideline on Environmental & Social Risk Management (ESRM) for Banks and Financial Institutions, Second Edition, February 2022. Annex 5 (E&S Due Diligence) and Annex 5b (Project Finance Screening) drive the ESDD and PF wizards. Environmental and social due diligence has been required since Circular 22 (Directive 22, FY 2074/75, 2018), which attached the now-superseded 2018 edition."),
  bullet("NRB Green Finance Taxonomy (October 2024) categorisation of bank lending activities into green, amber, red and unclassified, with the Annex 4b annual filing schedule."),
  bullet("PCAF Global GHG Accounting and Reporting Standard, Part A (3rd Edition), Category 15 (Financed Emissions) attribution methodology and Data Quality scoring."),
  bullet("IFC Performance Standards on Environmental and Social Sustainability (2012), PS1 to PS8, which anchor the NRB Annex 5b Project Finance Screening Questionnaire."),
  h3("What is illustrative in this demonstration"),
  p("The example bank, its branding, branches, customer borrower names outside the public reference dataset, the loan book, the application queue, and the screening recommendations are all synthesized for demonstration. The platform is capable of replacing every illustrative element with real bank source-of-record data once a production integration has been scoped and agreed."),
  noticeBox("Use and distribution", [
    p("This manual and the accompanying demonstration product are shared by Jana Earth Data as a reference to commercial banks in Nepal during the evaluation period. The materials may be circulated within a recipient bank for the purpose of evaluating the platform. Please credit the data sources listed in Part 15 when reproducing figures outside this manual. Thank you.", { spacing: { after: 0 } }),
  ]),
];

// ---------- Contents ----------
/** Part titles, in order. Kept here so the contents list and the Part
 *  headings cannot drift apart silently. */
const PARTS = [
  "Getting started",
  "My Work tab",
  "Loan Book tab",
  "Manager tab",
  "ESDD wizard",
  "Green Finance Taxonomy tab and wizard",
  "Project Finance screening wizard",
  "PCAF availability wizard",
  "CAP, Covenants, and Monitoring",
  "Evidence attachments",
  "NFRS tab",
  "Settings",
  "Guided audio tours",
  "Inline explanations",
  "Data sources and citations",
];

/** Page numbers from the previous build pass, supplied as JSON via
 *  --pages '{"1":5,"2":7,...}'. Absent on the first pass. */
const PAGE_MAP = (() => {
  const i = process.argv.indexOf("--pages");
  if (i < 0 || !process.argv[i + 1]) return null;
  try { return JSON.parse(process.argv[i + 1]); } catch { return null; }
})();

function contentsRows() {
  return PARTS.map((title, idx) => {
    const n = idx + 1;
    const page = PAGE_MAP && PAGE_MAP[String(n)];
    const children = [
      new TextRun({ text: `Part ${n}`, font: FONT, size: BODY_SIZE, bold: true, color: BRAND }),
      new TextRun({ text: `\u2003${title}`, font: FONT, size: BODY_SIZE, color: HEADER_TEXT }),
    ];
    // A real right tab stop with a dot leader, not a PositionalTab: ptab is a
    // Word-only element and LibreOffice drops it, which jams the page number
    // against the title ("Getting started4").
    if (page) {
      children.push(new TextRun({ text: "\t", font: FONT, size: BODY_SIZE }));
      children.push(new TextRun({ text: String(page), font: FONT, size: BODY_SIZE, color: HEADER_TEXT }));
    }
    return new Paragraph({
      spacing: { after: 60 },
      // Letter page (12240 twips) less 1in margins each side = 9360.
      tabStops: [{ type: TabStopType.RIGHT, position: 9360, leader: LeaderType.DOTS }],
      children,
    });
  });
}

const contents = [
  h1("Contents"),
  p("This manual has fifteen parts. The dashboard's five tabs are covered in Parts 2 through 4 and Part 11; the four per-loan wizards are covered in Parts 5 through 8; supporting workflows and reference material are in Parts 9 through 15."),
  new Paragraph({ children: [new TextRun({ text: "" })], spacing: { after: 200 } }),
  // A TableOfContents field only populates when a word processor updates
  // fields. Converting the .docx straight to PDF therefore shipped a blank
  // Contents page in v0.1 and v0.2. We emit a static list instead, with page
  // numbers injected by the two-pass build (see docs/build_manual_v03.js
  // usage note): pass 1 produces the PDF, the wrapper reads the real page of
  // each Part heading, pass 2 bakes them in.
  ...contentsRows(),
];


// ---------------------------------------------------------------------------
// Figures
//
// Screenshots live in docs/manual-screenshots/, produced by
//   npx tsx scripts/capture-screenshots.ts --profile manual
// They are optional: if the directory is absent the manual still builds, just
// without figures, so a text-only rebuild never fails for want of a browser.
// ---------------------------------------------------------------------------
const FIG_DIRS = [
  _path.join(__dirname, "manual-screenshots"),
  _path.join(__dirname, "..", "docs", "manual-screenshots"),
  "/sessions/hopeful-kind-fermi/mnt/Projects/repos/jana-bfi-app/docs/manual-screenshots",
];
const FIG_DIR = FIG_DIRS.find((d) => fs.existsSync(d));
let FIG_N = 0;
const FIG_MISSING = [];

/** Read intrinsic pixel size straight from the PNG IHDR chunk. */
function pngSize(buf) {
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

/** Max image width on the page, in px at 96dpi (content width is 6.5in). */
const FIG_MAX_W = 600;
const FIG_MAX_H = 780;

function figure(file, caption) {
  const full = FIG_DIR ? _path.join(FIG_DIR, file) : null;
  if (!full || !fs.existsSync(full)) {
    FIG_MISSING.push(file);
    return [];
  }
  const buf = fs.readFileSync(full);
  const { w, h } = pngSize(buf);
  let width = FIG_MAX_W;
  let height = Math.round((h / w) * width);
  if (height > FIG_MAX_H) {
    height = FIG_MAX_H;
    width = Math.round((w / h) * height);
  }
  FIG_N += 1;
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 160, after: 60 },
      children: [new ImageRun({
        data: buf,
        transformation: { width, height },
        altText: { title: caption, description: caption, name: file },
      })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 220 },
      children: [new TextRun({
        text: `Figure ${FIG_N}. ${caption}`,
        font: FONT, size: 17, italics: true, color: HEADER_TEXT,
      })],
    }),
  ];
}

// ---------- Part 1 ----------
const tabsRows = [
  new TableRow({
    tableHeader: true,
    children: [
      cell("Tab", { widthDxa: 1900, bold: true, fill: CELL_HEAD }),
      cell("Purpose", { widthDxa: 7460, bold: true, fill: CELL_HEAD }),
    ],
  }),
  new TableRow({ children: [
    cell("My Work", { widthDxa: 1900, bold: true }),
    cell("Personal queue for the signed-in officer. Shows loans assigned to you, loans available to claim from the unassigned pool, and follow-ups (CAP items and monitoring reports) due in the next 30 days. This is the default tab when an officer is signed in.", { widthDxa: 7460 }),
  ] }),
  new TableRow({ children: [
    cell("Loan Book", { widthDxa: 1900, bold: true }),
    cell("Browse the bank's loan portfolio with full filtering, sort, and search. Default landing tab when no officer is signed in.", { widthDxa: 7460 }),
  ] }),
  new TableRow({ children: [
    cell("Manager", { widthDxa: 1900, bold: true }),
    cell("Portfolio-wide compliance oversight against the NRB ESRM Guideline (2022). Application queue on the left; per-loan screening workbench on the right with sub-tabs for Overview, CAP + Covenants, PCAF, Hydropower docs, and Facility map. Escalation and overdue-CAP banners at the top of the tab surface the loans that need manager attention.", { widthDxa: 7460 }),
  ] }),
  new TableRow({ children: [
    cell("Taxonomy", { widthDxa: 1900, bold: true }),
    cell("Inspect the portfolio's classification under the NRB Green Finance Taxonomy (October 2024). Colours (Green, Amber, Red, Unclassified), distribution by count and value, sector breakdown, and per-loan drilldown into the saved classification.", { widthDxa: 7460 }),
  ] }),
  new TableRow({ children: [
    cell("NFRS", { widthDxa: 1900, bold: true }),
    cell("Review financed emissions and PCAF data quality on a disclosure-ready basis. Structured for the bank's NFRS S1/S2 disclosure once ICAN pronounces the finalised standards. Contains the NRBSIS Green Finance Statement (Annex 4b) export.", { widthDxa: 7460 }),
  ] }),
];

const part1 = [
  h1("Part 1  |  Getting started"),
  ...figure("01-header.png", 'The header: bank mark, tab strip, guided-tour selector, settings, and the Demo menu.'),
  h2("1.1  Audience and intended use"),
  p("The Financed Emissions Dashboard is intended for use by commercial bank staff in Nepal who are responsible for environmental and social risk management, green finance reporting, and forward sustainability disclosure. Specifically, the dashboard is designed around four operating roles:"),
  bullet("Loan officers and relationship officers preparing new applications and renewals for credit committee review, capturing the required ESDD, taxonomy, and PCAF evidence on each loan."),
  bullet("Risk officers and ESG officers reviewing high-emitting loan applications against the NRB ESRM Guideline (2022) before approval."),
  bullet("Green finance and sustainability teams classifying the existing portfolio against the NRB Green Finance Taxonomy (October 2024) and preparing the annual NRBSIS Annex 4b submission."),
  bullet("Compliance and disclosure teams preparing the bank's climate-related financial disclosure under NFRS S1/S2, and monitoring CAP deadlines and covenant compliance across the portfolio."),
  noticeBox("Not a regulatory filing tool", [
    p("Where the dashboard supports a regulated process (ESRM screening, taxonomy classification, NRBSIS Annex 4b filing, NFRS disclosure) it supports the preparation of the filing rather than acting as the official submission system. Final filings continue to be produced through the bank's existing regulatory reporting workflow.", { spacing: { after: 0 } }),
  ]),
  h2("1.2  Dashboard layout"),
  p("The dashboard opens to the My Work tab when an officer is signed in, and to the Loan Book tab otherwise. Five tabs are available across the top of the main view, in the order below:"),
  twoColTable([1900, 7460], tabsRows),
  p(""),
  h3("Header controls"),
  p("The top-right corner of the dashboard carries four controls that are available on every tab:"),
  bulletRuns([
    new TextRun({ text: "Tour selector: ", font: FONT, size: BODY_SIZE, bold: true }),
    new TextRun({ text: "a dropdown that opens one of six pre-recorded audio tours (Dashboard, Loan officer, Manager, PF screening, PCAF scoring, NFRS). See Part 13.", font: FONT, size: BODY_SIZE }),
  ]),
  bulletRuns([
    new TextRun({ text: "Officer picker: ", font: FONT, size: BODY_SIZE, bold: true }),
    new TextRun({ text: "select the officer you are acting as. The picker is populated from the bank's demonstration roster (loan officers, ESG officers, compliance, credit committee). Signing in as a specific officer is what unlocks My Work and enables loan assignment.", font: FONT, size: BODY_SIZE }),
  ]),
  bulletRuns([
    new TextRun({ text: "Settings (gear icon): ", font: FONT, size: BODY_SIZE, bold: true }),
    new TextRun({ text: "opens the per-bank settings page (Part 12). One setting is fully wired in this build; the remainder are visible in the interface and marked \"Coming soon\".", font: FONT, size: BODY_SIZE }),
  ]),
  bulletRuns([
    new TextRun({ text: "Exit demo: ", font: FONT, size: BODY_SIZE, bold: true }),
    new TextRun({ text: "leaves the demonstration and returns to the bank-select screen, clearing the bank cookie and the demonstration data behind it. Used when the same URL is being shown to two different banks in one session. Shown only on a demonstration instance.", font: FONT, size: BODY_SIZE }),
  ]),
  p("A live-vs-demo data indicator sits to the left of the header controls. When connected to the Jana platform, the Climate TRACE 2024 snapshot is served from a stable internal copy rather than re-fetched from the upstream provider for each request."),
  h2("1.3  Authentication and access"),
  p("Production deployments of the dashboard are gated by the bank's single sign-on and use role-based access control. In this demonstration the sign-in step is present but not enforced: any officer in the picker can be selected, and any user can navigate all five tabs. In production, the four operating roles listed in section 1.1 each receive a tailored subset of tabs and actions."),
  p("Bank tenants are separated by an access code entered on the landing page. Two tenants ship with this demonstration: the default First Bank of Nepal (a hypothetical bank used for platform-agnostic walkthroughs) and Laxmi Sunrise Bank (branded for on-site meetings with Laxmi Sunrise). The code is remembered in a cookie for the session; use Exit demo in the header to return to the bank-select screen and enter a different code."),
  h2("1.4  Conventions used in this manual"),
  bullet("The (i) icons in the dashboard show inline tooltips that explain PCAF scores, taxonomy colour codes, ESRM risk classifications, and air quality bands. The same explanations are reproduced in Part 14 of this manual."),
  bullet("Bold UI labels in this manual refer to controls, tabs, or buttons that appear in the dashboard itself."),
  bullet("NPR values throughout the NFRS tab follow the IFRS S1 presentation-currency guidance that NFRS S1 inherits. USD appears where it is needed for the PCAF attribution calculation, which is conventionally performed in USD because borrower enterprise values from public sources are denominated that way."),
  h2("1.5  Demonstration mode and live mode"),
  p("An instance of the platform is set up as either a demonstration instance or a live one. That choice is made when the bank's instance is built, and it decides whether the demonstration portfolio exists at all."),
  p("A demonstration instance is loaded with a fabricated portfolio so that every screen can be explored before any bank data is involved. While that data is in use a DEMO MODE banner sits across the top of every page, deliberately unclosable, so that no screenshot or shared session can be mistaken for real figures. A Demo menu in the header holds the prepared walkthrough scenarios, a switch that turns the demonstration data off, and an Exit demo action that returns to the bank-select screen."),
  p("Anyone using a demonstration instance can flip that switch. Turning the demonstration data off empties the loan book, because every loan in it was fabricated, and the dashboard shows an empty-portfolio notice rather than pretending to have records. Turning it back on reloads the same fabricated book. The setting applies to that browser session only; it does not change what a colleague sees."),
  p("A live instance is different in kind, not in setting. It contains no fabricated data, so there is no Demo menu, no banner, and no switch to find. The safeguard is deliberately one-way: the control can only ever remove fabricated data from view, never introduce it into an instance that does not have any."),
  p("In a live instance the dashboard reads the bank's own loan book, and screening records, classifications, corrective actions and PCAF flags captured by officers are written to the bank's database. Every capture table carries a provenance column recording whether a row originated in demonstration or in live use, so a demonstration row can never reach a live report or a regulatory export."),
];

// ---------- Part 2 ----------
const part2 = [
  h1("Part 2  |  My Work tab"),
  h2("2.1  Purpose"),
  p("The My Work tab is the loan officer's personal view. It answers two questions on one screen: \"what do I owe action on today?\" and \"what is available to pick up?\" Every officer sees only their own queue."),
  p("If no officer is signed in, the tab shows a friendly prompt to open the officer picker in the header. Once an officer is selected, the tab is populated from the bank's live records."),
  h2("2.2  Follow-ups due"),
  ...figure("03-followups-panel.png", 'Follow-ups due: corrective actions and monitoring reports falling due in the next thirty days.'),
  p("The top panel of the tab lists all CAP items and monitoring reports that the signed-in officer owes action on in the next 30 days. Items are bucketed by urgency:"),
  bulletRuns([
    new TextRun({ text: "Overdue: ", font: FONT, size: BODY_SIZE, bold: true, color: RED }),
    new TextRun({ text: "deadline has already passed. The parent loan gets an \"Overdue CAP\" flag on the Manager tab, visible portfolio-wide.", font: FONT, size: BODY_SIZE }),
  ]),
  bulletRuns([
    new TextRun({ text: "Due this week: ", font: FONT, size: BODY_SIZE, bold: true, color: AMBER }),
    new TextRun({ text: "deadline is in the next 7 days.", font: FONT, size: BODY_SIZE }),
  ]),
  bulletRuns([
    new TextRun({ text: "Due this month: ", font: FONT, size: BODY_SIZE, bold: true, color: GREY }),
    new TextRun({ text: "deadline is between 8 and 30 days out.", font: FONT, size: BODY_SIZE }),
  ]),
  p("Clicking a row opens the relevant workbench sub-tab (CAP + Covenants for a CAP item, Overview for a monitoring report). The panel hides itself when the officer's queue is empty, so an empty top-of-page does not become visual noise. Regulatory authority for these follow-ups is ESRM Guideline §7.3.5 (time-bound CAP) and §7.3.7 (periodic monitoring)."),
  h2("2.3  My loans and Available to claim"),
  ...figure("02-my-work-queue.png", 'My Work. My loans holds what is assigned to the officer; Available to claim holds the unassigned pool.'),
  p("Below the follow-ups panel, the tab splits into two sections:"),
  bulletRuns([
    new TextRun({ text: "My loans: ", font: FONT, size: BODY_SIZE, bold: true }),
    new TextRun({ text: "loans that are assigned to you, plus any loan you have touched (opened a wizard on, saved a screening for, or been assigned by a manager). Each row shows the borrower, sector, outstanding NPR balance, and a set of compliance chips: ESDD progress, Taxonomy colour, PF screening (when applicable), and PCAF availability.", font: FONT, size: BODY_SIZE }),
  ]),
  bulletRuns([
    new TextRun({ text: "Available to claim: ", font: FONT, size: BODY_SIZE, bold: true }),
    new TextRun({ text: "loans in the unassigned pool that any officer can pick up. Each row is a single tap-target; clicking Open navigates to the ESDD wizard and auto-claims the loan for the officer who clicked. There is no separate Claim button; the first click IS the claim.", font: FONT, size: BODY_SIZE }),
  ]),
  p("The header of the panel reports the numbers side by side: \"N assigned to you · M available to claim\". A Recently closed section appears below when there are loans approved, declined, or withdrawn in the last 30 days."),
  h2("2.4  Call-to-action buttons on the loan card"),
  p("For each loan in the My loans section, the card exposes up to four compliance call-to-action buttons, referred to in this manual as CTAs. Each CTA opens the corresponding per-loan wizard; the chip beside it shows completion state at a glance:"),
  twoColTable([2200, 7160], [
    new TableRow({ tableHeader: true, children: [
      cell("Wizard", { widthDxa: 2200, bold: true, fill: CELL_HEAD }),
      cell("What it captures", { widthDxa: 7160, bold: true, fill: CELL_HEAD }),
    ] }),
    new TableRow({ children: [
      cell("ESDD", { widthDxa: 2200, bold: true }),
      cell("Annex 5 of the NRB ESRM Guideline (2022) checklist. Always required. See Part 5.", { widthDxa: 7160 }),
    ] }),
    new TableRow({ children: [
      cell("Taxonomy", { widthDxa: 2200, bold: true }),
      cell("NRB Green Finance Taxonomy (October 2024) classification. Required on every loan. See Part 6.", { widthDxa: 7160 }),
    ] }),
    new TableRow({ children: [
      cell("PF screening", { widthDxa: 2200, bold: true }),
      cell("Annex 5b of the NRB ESRM Guideline (2022) Project Finance Screening (IFC PS1-PS8). Shown only on project-finance loans. See Part 7.", { widthDxa: 7160 }),
    ] }),
    new TableRow({ children: [
      cell("PCAF", { widthDxa: 2200, bold: true }),
      cell("PCAF Part A §5 data-availability capture (four flag rows). Required on every loan under NFRS. See Part 8.", { widthDxa: 7160 }),
    ] }),
  ]),
  p(""),
  p("When the loan's borrower is above the NRB ESRM Guideline (2022) §4.3 climate reporting threshold (25,000 tCO2e/year) without a reduction target on file, an additional badge appears on the card."),
];

// ---------- Part 3 ----------
const filtersRows = [
  new TableRow({ tableHeader: true, children: [
    cell("Filter", { widthDxa: 2000, bold: true, fill: CELL_HEAD }),
    cell("Behaviour", { widthDxa: 7360, bold: true, fill: CELL_HEAD }),
  ] }),
  new TableRow({ children: [
    cell("Free text search", { widthDxa: 2000, bold: true }),
    cell("Matches against loan identifier, borrower name, branch name, and sector. The table updates as you type. Typing the branch name or the status word into the search field is the fastest path to filter to a specific branch or status.", { widthDxa: 7360 }),
  ] }),
  new TableRow({ children: [
    cell("Taxonomy", { widthDxa: 2000, bold: true }),
    cell("Green, Amber, Red, or Unclassified per the NRB Green Finance Taxonomy (October 2024). See Part 6.", { widthDxa: 7360 }),
  ] }),
  new TableRow({ children: [
    cell("Business unit", { widthDxa: 2000, bold: true }),
    cell("Retail, SME, Corporate, or Project Finance.", { widthDxa: 7360 }),
  ] }),
  new TableRow({ children: [
    cell("Sector", { widthDxa: 2000, bold: true }),
    cell("NRB sector classification of the borrower (for example, Cement and Cement Products, Hydropower, Hotels and Tourism).", { widthDxa: 7360 }),
  ] }),
];

const part3 = [
  h1("Part 3  |  Loan Book tab"),
  ...figure("04-loan-book.png", 'Loan Book: the full portfolio, filtered by taxonomy colour, business unit, sector, and free text.'),
  h2("3.1  Purpose"),
  p("The Loan Book tab is the bank's operating view of its full lending portfolio, with environmental risk and financed emissions overlays applied. The demonstration portfolio contains tens of thousands of active or under-review loans across retail, SME, commercial, and corporate business units, attributed to the example bank. In a production deployment for a specific bank, the same view operates directly against that bank's core banking system of record."),
  h2("3.2  Filters and search"),
  p("The filter strip across the top of the loan table provides four filters. They are additive: applying more than one filter narrows the visible set to loans that satisfy all of them at once."),
  twoColTable([2000, 7360], filtersRows),
  p(""),
  noticeBox("Retail loan pools", [
    p("In the loan table, retail products (mortgages, vehicle, personal, and education loans) are attributed to a synthetic retail loan pool rather than to individual customers. This follows PCAF convention: a single retail customer does not have a meaningful enterprise value, so retail loans are aggregated into a pool and attributed at the pool level using a mortgage-emissions or consumer-loan methodology. The pool appears in the borrower column with a name such as Retail mortgage pool or Retail vehicle pool.", { spacing: { after: 0 } }),
  ]),
  h2("3.3  Sorting and pagination"),
  p("Click any sortable column header to sort the visible result set. By default the loan table is sorted by outstanding NPR balance, largest to smallest. The footer pagination control reports the result set in the form Showing X to Y of Z loans, page A of B. Note that Z is the total number of loans matching the current filters, not the total number of loans the bank holds; clearing all filters returns Z to the full portfolio size."),
  h2("3.4  Borrower detail drilldown"),
  p("Clicking a loan row opens the borrower detail panel. The panel shows the borrower's NRB sector, estimated enterprise value used for PCAF attribution, ownership chain where available, and the list of facilities matched to the borrower. For cement borrowers the facility list is enriched with capacity figures from the Global Cement and Concrete Tracker. The borrower detail panel is the right place to confirm the provenance of any single attribution figure shown elsewhere in the dashboard."),
];

// ---------- Part 4 ----------
const subtabRows = [
  new TableRow({ tableHeader: true, children: [
    cell("Sub-tab", { widthDxa: 2200, bold: true, fill: CELL_HEAD }),
    cell("Purpose", { widthDxa: 7160, bold: true, fill: CELL_HEAD }),
  ] }),
  new TableRow({ children: [
    cell("Overview", { widthDxa: 2200, bold: true }),
    cell("Borrower identification, risk classification, recommendation, national emissions share, sector benchmark, and OpenAQ air quality nearby. The default landing sub-tab for the workbench.", { widthDxa: 7160 }),
  ] }),
  new TableRow({ children: [
    cell("CAP + Covenants", { widthDxa: 2200, bold: true }),
    cell("Corrective Action Plan items, E&S covenants, and periodic monitoring reports for the selected loan. ESRM Guideline §7.3.5 and §7.3.7. See Part 9.", { widthDxa: 7160 }),
  ] }),
  new TableRow({ children: [
    cell("PCAF", { widthDxa: 2200, bold: true }),
    cell("PCAF data-availability status for the borrower and the derived Score 1-5. Read-only mirror of the per-loan PCAF wizard; edits are made from the wizard itself. See Part 8.", { widthDxa: 7160 }),
  ] }),
  new TableRow({ children: [
    cell("Hydropower docs", { widthDxa: 2200, bold: true }),
    cell("Hydropower-specific documentation matrix from ESRM Guideline (2022) Annex 2: EIA/IEE, environmental flow, resettlement discharge, biodiversity offset, seismic assessment. Only visible when the borrower's sector is hydropower.", { widthDxa: 7160 }),
  ] }),
  new TableRow({ children: [
    cell("Facility map", { widthDxa: 2200, bold: true }),
    cell("Interactive map of the borrower's matched Climate TRACE and GCCT facilities. Only visible when the borrower has at least one geolocated facility.", { widthDxa: 7160 }),
  ] }),
];

const riskColorsRows = [
  new TableRow({ tableHeader: true, children: [
    cell("Class", { widthDxa: 1800, bold: true, fill: CELL_HEAD }),
    cell("Meaning", { widthDxa: 7560, bold: true, fill: CELL_HEAD }),
  ] }),
  new TableRow({ children: [
    cell("Low", { widthDxa: 1800, bold: true, color: GREEN }),
    cell("Standard underwriting. No additional environmental conditions. No CAP required.", { widthDxa: 7560 }),
  ] }),
  new TableRow({ children: [
    cell("Medium", { widthDxa: 1800, bold: true, color: AMBER }),
    cell("Approve with documented environmental conditions; six-monthly monitoring review. CAP + covenants required per ESRM Guideline §7.3.5.", { widthDxa: 7560 }),
  ] }),
  new TableRow({ children: [
    cell("High", { widthDxa: 1800, bold: true, color: ORANGE }),
    cell("Approve only with strong mitigation commitments and a board-level credit decision. CAP + covenants required; three-monthly monitoring.", { widthDxa: 7560 }),
  ] }),
  new TableRow({ children: [
    cell("Extreme", { widthDxa: 1800, bold: true, color: RED }),
    cell("Recommend decline. Where the bank elects to proceed, escalate to the ESG committee for formal exception. Monthly monitoring.", { widthDxa: 7560 }),
  ] }),
];

const part4 = [
  h1("Part 4  |  Manager tab"),
  h2("4.1  Purpose and regulatory context"),
  p("The Manager tab is the compliance and credit approval dashboard for the whole portfolio, structured around the NRB ESRM Guideline (2022). It covers ESRM screening, corrective actions and covenants, PCAF availability, project-finance screening, and periodic monitoring. The officer's personal queue lives on the My Work tab (Part 2)."),
  p("Under the NRB ESRM Guideline (2022), the bank is required to perform and document an Environmental and Social Due Diligence (ESDD) on applicable applications, agree a Corrective Action Plan and E&S covenants where the loan is rated Medium or High, and monitor the loan periodically thereafter. The Manager tab structures that work into a consistent screening record and gives the manager a portfolio-wide view of compliance state."),
  h2("4.2  Portfolio banners"),
  ...figure("05-escalation-banner.png", 'The escalation banner, raised automatically for every loan screened above Low risk.'),
  p("Two banners sit at the top of the tab and surface the loans that need immediate manager attention. They are always visible when their conditions are met, so a manager landing on this tab in the morning sees the exceptions first."),
  bulletRuns([
    new TextRun({ text: "Escalation banner (amber): ", font: FONT, size: BODY_SIZE, bold: true, color: AMBER }),
    new TextRun({ text: "shows every loan whose ESDD screening resolved to a risk class above Low. Under NRB ESRM Guideline \u00a77.3.6 the escalation flag is raised whenever the risk class is Medium or High, so a \"b\" answer escalates as well as a \"c\". Escalated loans go to the next-higher credit approval authority. The banner lists the driving questions inline.", font: FONT, size: BODY_SIZE }),
  ]),
  bulletRuns([
    new TextRun({ text: "Overdue-CAP banner (rose): ", font: FONT, size: BODY_SIZE, bold: true, color: RED }),
    new TextRun({ text: "shows every loan with one or more corrective action items past their deadline. ESRM Guideline §7.3.5 phrases the CAP as time-bound; a missed deadline is a compliance breach, not a slippage.", font: FONT, size: BODY_SIZE }),
  ]),
  p("Each banner shows the loans as clickable pills. Clicking a pill selects that loan in the workbench and scrolls the workbench into view."),
  p("Below the banners is a summary strip: N assigned · N unassigned · N ESDD in progress · N screening complete. This gives the manager a quick pulse on where the portfolio sits before drilling into any single loan."),
  h2("4.3  Application queue and assignment"),
  ...figure("06-overdue-caps-banner.png", 'The overdue corrective actions banner, which is portfolio-wide.'),
  p("The left-hand application queue lists loans whose status is under-review, sorted by attributed CO2-equivalent emissions in descending order so the highest-exposure reviews are surfaced first. Filter chips above the list let the manager filter to All, Unassigned, or a specific officer."),
  p("Each row shows the loan's assignment (owner name or Unassigned), the ESDD completion state, and any escalation or overdue-CAP flag. The manager can reassign a loan by clicking the owner name in the workbench header and selecting a different officer from the dropdown."),
  p("When a loan is selected in the workbench, the application queue collapses to a slim vertical rail on the left to give the workbench more room. Clicking the expand control returns the queue to its full width."),
  h2("4.4  Screening workbench and risk classes"),
  p("The screening workbench is the core decision-support surface for the Manager tab. For the selected borrower it presents:"),
  bullet("Borrower identification: legal name, NRB sector classification, ownership chain, and headquarters location."),
  bullet("Risk classification: Low, Medium, High, or Extreme, with a colour-coded badge and a written rationale."),
  bullet("Recommendation: Approve, Approve with conditions, or Decline, with the reasoning the dashboard surfaces. The final credit decision is always made by the bank's authorised credit approval authority, not by the dashboard."),
  bullet("National emissions share: the percentage of Nepal's estimated national CO2 footprint represented by the borrower's matched facilities."),
  bullet("Sector benchmark: the borrower's intensity compared to the EDGAR-derived sector average."),
  bullet("Air quality nearby: the nearest OpenAQ monitoring station and a banded PM2.5 reading, where available. The OpenAQ network in Nepal is sparse, so for many facilities no nearby reading is available; the dashboard explicitly says so rather than fabricating a value."),
  p(""),
  p("Risk classification colours used throughout the tab are:"),
  twoColTable([1800, 7560], riskColorsRows),
  p(""),
  h2("4.5  Workbench sub-tabs"),
  ...figure("07-workbench-subtabs.png", 'The per-loan workbench: compliance stripe above, obligation sub-tabs beneath.'),
  p("The workbench splits into up to five sub-tabs, depending on the selected loan. Hydropower docs appears only for hydropower borrowers; Facility map appears only when the borrower has at least one geolocated facility."),
  twoColTable([2200, 7160], subtabRows),
  p(""),
  h2("4.6  Assignment and lock model"),
  p("Every loan can be assigned to exactly one officer at a time. When an officer opens an unassigned loan through any wizard, the loan is auto-claimed for that officer; the manager can override this by selecting a different owner from the workbench dropdown."),
  p("When a different officer navigates to an assigned loan, they see the workbench and every wizard in read-only mode with a rose banner at the top: \"Locked, owned by [officer name]. Ask the manager to reassign this loan before editing.\" This is enforced both in the interface (inputs disabled) and in the underlying API (write attempts are rejected), so a URL-crafter cannot bypass it."),
  p("The manager can reassign at any time via the officer dropdown. Reassignment does not delete prior work; every response on the ESDD, PF screening, taxonomy, PCAF, and CAP surfaces is preserved and carries a captured-by attribution for audit."),
];

// ---------- Part 5 ----------
const esddSectionsRows = [
  new TableRow({ tableHeader: true, children: [
    cell("Section", { widthDxa: 2000, bold: true, fill: CELL_HEAD }),
    cell("Questions", { widthDxa: 1400, bold: true, fill: CELL_HEAD }),
    cell("Coverage", { widthDxa: 5960, bold: true, fill: CELL_HEAD }),
  ] }),
  new TableRow({ children: [
    cell("1. General Risk", { widthDxa: 2000, bold: true }),
    cell("1.1 to 1.4", { widthDxa: 1400 }),
    cell("Legal permits and E&S incidents; stakeholder grievances and NGO campaigns; overlap with eco-sensitive areas (national parks, buffer zones, protected water bodies); land acquisition involving resettlement (Q1.4, introduced by the 2022 edition).", { widthDxa: 5960 }),
  ] }),
  new TableRow({ children: [
    cell("2. Environmental Health and Safety", { widthDxa: 2000, bold: true }),
    cell("2.1 to 2.5", { widthDxa: 1400 }),
    cell("Air and noise pollution; water pollution and effluent treatment; land contamination and waste handling; energy efficiency and renewable energy investment; climate risks and opportunities (2022 addition, physical + transition).", { widthDxa: 5960 }),
  ] }),
  new TableRow({ children: [
    cell("3. Social Risks", { widthDxa: 2000, bold: true }),
    cell("3.1 to 3.4", { widthDxa: 1400 }),
    cell("Fire risk and occupational health & safety; labour and working conditions, including child labour and forced labour; community health, safety and security; community and indigenous-people consultation.", { widthDxa: 5960 }),
  ] }),
];

const part5 = [
  h1("Part 5  |  ESDD wizard"),
  ...figure("08-esdd-wizard.png", "The ESDD wizard, Section 1. Every question carries NRB's four answer options, the guidance notes beneath them, a remarks field, and evidence attachment."),
  h2("5.1  Purpose and regulatory context"),
  p("The ESDD wizard walks the loan officer through the Annex 5 checklist for a single loan. The NRB ESRM Guideline (Second Edition, February 2022) defines a sector-agnostic checklist of thirteen questions across three sections: four General (1.1 to 1.4), five Environmental Health and Safety (2.1 to 2.5), and four Social (3.1 to 3.4). Q1.4 (land acquisition with resettlement) and Q2.5 (climate risks and opportunities) were introduced by the 2022 edition and are not present in the 2018 attachment to Circular 22. Each answer is captured against a stable question identifier so responses persist across sessions and are visible to the manager on the workbench."),
  p("The wizard replaces the sliding checklist drawer that appeared inside the workbench in v0.1. It lives at its own URL (/esdd/[loanId]) so an officer can start it from the My Work tab, work through it in one sitting, and return to their queue with a saved screening."),
  h2("5.2  Structure"),
  p("The wizard has five steps: Basic Information (step 0), then one step per section (steps 1, 2, 3), then a Review and Submit step (step 4). Each answer POSTs on change so nothing is lost if the officer navigates away mid-wizard. Existing responses are loaded on mount, so the officer can always resume where they left off."),
  twoColTable([2000, 1400, 5960], esddSectionsRows),
  p(""),
  h2("5.3  Answer options and the four-way choice"),
  p("Every question offers exactly four answer options, labelled (a), (b), (c), and (d). The options are worded verbatim from the 2022 Guideline. In general:"),
  bulletRuns([
    new TextRun({ text: "(a): ", font: FONT, size: BODY_SIZE, bold: true, color: GREEN }),
    new TextRun({ text: "No evidence of concern, or all controls are in place.", font: FONT, size: BODY_SIZE }),
  ]),
  bulletRuns([
    new TextRun({ text: "(b): ", font: FONT, size: BODY_SIZE, bold: true, color: AMBER }),
    new TextRun({ text: "Some concern, but the client has taken definite steps to address it.", font: FONT, size: BODY_SIZE }),
  ]),
  bulletRuns([
    new TextRun({ text: "(c): ", font: FONT, size: BODY_SIZE, bold: true, color: RED }),
    new TextRun({ text: "Concern exists and the client has no definite plan to address it. A (c) answer sets the loan to High. A (b) answer sets it to Medium. Both raise the escalation flag, because \u00a77.3.6 escalates any risk class above Low to the next-higher credit approval authority.", font: FONT, size: BODY_SIZE }),
  ]),
  bulletRuns([
    new TextRun({ text: "(d): ", font: FONT, size: BODY_SIZE, bold: true, color: GREY }),
    new TextRun({ text: "Not applicable. The officer must justify a Not Applicable answer in the Remarks field.", font: FONT, size: BODY_SIZE }),
  ]),
  p("Below each question the wizard shows the NRB Annex 5 guidance notes verbatim (physical evidence to look for, permits to verify, sample checks to run). These are the same notes NRB distributes with the ESDD Excel checklist."),
  h2("5.4  Remarks and evidence attachments"),
  p("Each question has a Remarks textarea where the officer records what they saw and how they concluded. The bank can require remarks per section through the Settings page (Part 12); this is one of the settings fully wired in the current build."),
  p("Below the Remarks textarea, an Attachments panel accepts multiple files (PDF, image, Word doc, up to 10 MB per file) as the source evidence. See Part 10 for the general rules that apply to evidence attachments across the platform."),
  h2("5.5  Reviewing and saving"),
  p("The Review step (step 4) shows the full checklist with every answer, remark, and attachment in one place, computes the ESRM risk class (Low, Medium, High, Extreme), and lists any escalation flags. Saving from this step commits the screening as the loan's current ESRM record and returns the officer to the My Work tab."),
  p("The wizard renders read-only when the current officer is not the loan's owner. The lock banner explains why every input is disabled and points to the manager as the path to reassignment (Part 4.6)."),
  h2("5.7  Loan category override"),
  p("The loan category is derived automatically from the borrower's NRB sector, and it determines which screening path applies. Where the derived category is wrong for a particular facility, the officer can override it on the wizard. The override is persisted against the loan, so it survives a refresh and remains in force for subsequent sessions and for the manager's view, rather than reverting to the derived value."),
];

// ---------- Part 6 ----------
const taxColorsRows = [
  new TableRow({ tableHeader: true, children: [
    cell("Colour", { widthDxa: 1800, bold: true, fill: CELL_HEAD }),
    cell("Meaning under NRB GFT (Oct 2024)", { widthDxa: 7560, bold: true, fill: CELL_HEAD }),
  ] }),
  new TableRow({ children: [
    cell("Green (Transformative)", { widthDxa: 1800, bold: true, color: GREEN }),
    cell("Use of proceeds is explicitly listed in the NRB green taxonomy and passes the activity-specific technical thresholds. Examples: hydropower that meets the run-of-river, power-density, or lifecycle GHG gates; solar utility-scale generation; energy efficiency retrofits in commercial buildings.", { widthDxa: 7560 }),
  ] }),
  new TableRow({ children: [
    cell("Amber (Transitional)", { widthDxa: 1800, bold: true, color: AMBER }),
    cell("The borrower's primary sector is on a credible decarbonisation pathway but is not currently green. Example: cement plants investing in waste heat recovery or alternative fuels (dry-kiln plus clinker substitution).", { widthDxa: 7560 }),
  ] }),
  new TableRow({ children: [
    cell("Red (Not aligned)", { widthDxa: 1800, bold: true, color: RED }),
    cell("Use of proceeds is explicitly excluded by the NRB taxonomy, or the activity fails a red-bullet criterion. Examples: new coal-fired generation; hydropower in a protected area, biodiversity hotspot, or disaster-prone zone; loans associated with deforestation in protected areas.", { widthDxa: 7560 }),
  ] }),
  new TableRow({ children: [
    cell("Unclassified", { widthDxa: 1800, bold: true, color: GREY }),
    cell("Use of proceeds is unclear or the borrower's documentation does not yet support classification. Unclassified loans should be reviewed during the next renewal.", { widthDxa: 7560 }),
  ] }),
];

const part6 = [
  h1("Part 6  |  Green Finance Taxonomy tab and wizard"),
  ...figure("09-taxonomy-wizard.png", 'The Taxonomy wizard: activity selection from the NRB 2024 catalogue, with DNSH checks called out separately.'),
  h2("6.1  Purpose and regulatory context"),
  p("The Taxonomy tab classifies the bank's portfolio against the NRB Green Finance Taxonomy (October 2024). The classification supports the bank's reporting on green lending share, its green bond eligibility analysis, and the alignment view that NFRS disclosure requires. The annual filing to NRBSIS is exported from the NFRS tab (Part 11) using Annex 4b of the taxonomy."),
  p("Per the October 2024 NRB update, all hydropower is classified in the taxonomy regardless of installed capacity; classification depends on the lifecycle GHG emissions per kWh (below 100 gCO2e/kWh for Green, 100 to 425 gCO2e/kWh for Amber) plus a set of environmental and social gates (EIA/IEE current; site avoids protected areas, biodiversity hotspots, and disaster-prone zones). The earlier \"under 10 MW\" rule of thumb is no longer used."),
  h2("6.2  Taxonomy colour codes"),
  p("Every loan in the portfolio is assigned one of four taxonomy colours. The (i) tooltip on each colour in the dashboard explains the classification rule for that colour in the context of the borrower's sector and the use of proceeds. The summary is:"),
  twoColTable([1800, 7560], taxColorsRows),
  p(""),
  h2("6.3  Distribution by count and value"),
  p("The taxonomy summary cards report the portfolio split by both loan count and outstanding NPR balance. The two views can differ materially: a portfolio with many small green retail mortgages may look greener by count than by NPR balance. Both numbers are presented so that disclosure can use whichever view is required."),
  h2("6.4  Sector view"),
  p("Below the headline cards the dashboard breaks down each NRB sector by taxonomy colour. This view is the operating tool for the green finance team when they are deciding which sectors to prioritise for taxonomy-aligned origination. The (i) tooltips on individual cells explain why a given loan landed in the colour it did, so the green finance team can address misclassifications directly with the originating branch."),
  h2("6.5  Taxonomy wizard (per loan)"),
  p("Selecting a loan opens the classification wizard at /taxonomy/[loanId]. The wizard has four steps:"),
  bulletRuns([
    new TextRun({ text: "Step 1  Basics: ", font: FONT, size: BODY_SIZE, bold: true }),
    new TextRun({ text: "loan and borrower information (prefilled from the loan record).", font: FONT, size: BODY_SIZE }),
  ]),
  bulletRuns([
    new TextRun({ text: "Step 2  Activity picker: ", font: FONT, size: BODY_SIZE, bold: true }),
    new TextRun({ text: "choose the taxonomy activity that best matches the use of proceeds. The dashboard encodes the activities NRB spells out in the October 2024 taxonomy across the seventeen SIS sectors: hydroelectricity, wind, solar utility, cement transitional, green buildings, organic agriculture, dairy and animal husbandry, poultry, aquaculture, food processing, textiles and garments, personal electric vehicles, commercial electric vehicles and mass transit, fossil-fuel generation (red-listed), high-efficiency irrigation, waste management, hotels and tourism, residential home loan, and green financial intermediation. Sector-suggested activities appear first; the full list is available below.", font: FONT, size: BODY_SIZE }),
  ]),
  bulletRuns([
    new TextRun({ text: "Step 3  DNSH and criteria: ", font: FONT, size: BODY_SIZE, bold: true }),
    new TextRun({ text: "answer the activity's technical criteria (capacity, efficiency, permits) and the Do No Significant Harm (DNSH) checks that apply (environmental flow, resettlement discharge, biodiversity offset, seismic assessment, and so on).", font: FONT, size: BODY_SIZE }),
  ]),
  bulletRuns([
    new TextRun({ text: "Step 4  Review and save: ", font: FONT, size: BODY_SIZE, bold: true }),
    new TextRun({ text: "the wizard runs the classifier, shows the resulting colour with a written rationale and a page-anchored NRB citation, and lists any DNSH failures. Saving commits the classification as the loan's current taxonomy record.", font: FONT, size: BODY_SIZE }),
  ]),
  p("As with every wizard on the platform, taxonomy runs read-only when the current officer is not the loan's owner (Part 4.6). The saved classification feeds both the Taxonomy tab distribution and the NRBSIS Annex 4b export on the NFRS tab."),
];

// ---------- Part 7 ----------
const psRows = [
  new TableRow({ tableHeader: true, children: [
    cell("Performance Standard", { widthDxa: 2600, bold: true, fill: CELL_HEAD }),
    cell("Coverage", { widthDxa: 6760, bold: true, fill: CELL_HEAD }),
  ] }),
  new TableRow({ children: [
    cell("PS1  Assessment and Management of E&S Risks and Impacts", { widthDxa: 2600, bold: true }),
    cell("Sponsor's E&S policy, management system, impact assessment scope, stakeholder engagement, grievance mechanism, and monitoring.", { widthDxa: 6760 }),
  ] }),
  new TableRow({ children: [
    cell("PS2  Labour and Working Conditions", { widthDxa: 2600, bold: true }),
    cell("HR policy, working conditions, freedom of association, non-discrimination, child and forced labour, worker OHS, and contracted workers. Carries red-line flags for child labour and forced labour, cited to IFC PS2.", { widthDxa: 6760 }),
  ] }),
  new TableRow({ children: [
    cell("PS3  Resource Efficiency and Pollution Prevention", { widthDxa: 2600, bold: true }),
    cell("Resource efficiency, GHG emissions, water use, waste, hazardous materials, and pesticides.", { widthDxa: 6760 }),
  ] }),
  new TableRow({ children: [
    cell("PS4  Community Health, Safety and Security", { widthDxa: 2600, bold: true }),
    cell("Design safety, hazardous materials near communities, ecosystem services, community exposure, disaster prevention, and security personnel.", { widthDxa: 6760 }),
  ] }),
  new TableRow({ children: [
    cell("PS5  Land Acquisition and Involuntary Resettlement", { widthDxa: 2600, bold: true }),
    cell("Physical and economic displacement, compensation, livelihood restoration, and consultation with affected people.", { widthDxa: 6760 }),
  ] }),
  new TableRow({ children: [
    cell("PS6  Biodiversity Conservation and Sustainable Management of Living Natural Resources", { widthDxa: 2600, bold: true }),
    cell("Modified, natural, and critical habitat; protected areas; invasive species; primary production; and supply-chain risk.", { widthDxa: 6760 }),
  ] }),
  new TableRow({ children: [
    cell("PS7  Indigenous Peoples", { widthDxa: 2600, bold: true }),
    cell("Identification of Indigenous Peoples, Free Prior and Informed Consent circumstances, impacts on lands and natural resources, and cultural heritage.", { widthDxa: 6760 }),
  ] }),
  new TableRow({ children: [
    cell("PS8  Cultural Heritage", { widthDxa: 2600, bold: true }),
    cell("Tangible and intangible cultural heritage protection, use of cultural heritage, chance-find procedures, and consultation with affected communities.", { widthDxa: 6760 }),
  ] }),
];

const part7 = [
  h1("Part 7  |  Project Finance screening wizard"),
  ...figure("10-pf-screening.png", 'Annex 5b project finance screening, mapped to the eight IFC Performance Standards.'),
  h2("7.1  When it applies"),
  p("The PF screening wizard applies only to loans in the Project Finance category. It is shown as a CTA on My Work loan cards and as a workbench sub-tab only when the loan is a project-finance transaction; otherwise it is hidden."),
  p("The wizard implements the Annex 5b of the NRB ESRM Guideline (2022) Project Finance Screening Questionnaire, which is aligned with the eight IFC Performance Standards on Environmental and Social Sustainability (2012). It captures 148 items across the eight standards, plus the aggregate risk classification."),
  h2("7.2  The eight Performance Standards"),
  twoColTable([2600, 6760], psRows),
  p(""),
  h2("7.3  Structure"),
  p("The wizard has nine steps: one step per Performance Standard (PS1 through PS8), plus a Review step. Each item is answered on a four-option scale similar to the ESDD wizard, with an accompanying Remarks textarea and evidence attachments panel."),
  p("Twelve items are flagged as red lines, each citing the specific paragraph of the underlying IFC Performance Standard. This escalation layer is Jana's own synthesis of the IFC Performance Standards text: NRB does not publish an escalation or termination grid for Annex 5b, and the platform does not present one as if it did. A flag that fires does not decline the loan; it surfaces the item so the manager and the credit approval authority can read the cited paragraph."),
  h2("7.4  Review and saved screening"),
  p("The Review step surfaces:"),
  bullet("Per-PS breakdown: how many items were answered, and how many triggered flags."),
  bullet("Aggregate flag count across all eight standards."),
  bullet("Computed PF risk classification (Low, Medium, High, Critical)."),
  bullet("A list of every red-line flag with the IFC Performance Standard paragraph it cites."),
  p(""),
  p("Saving commits the PF screening as the loan's current record. As with the ESDD and Taxonomy wizards, PF screening runs read-only when the current officer is not the loan's owner (Part 4.6)."),
];

// ---------- Part 8 ----------
const pcafFlagsRows = [
  new TableRow({ tableHeader: true, children: [
    cell("Flag row", { widthDxa: 3400, bold: true, fill: CELL_HEAD }),
    cell("Score", { widthDxa: 1000, bold: true, fill: CELL_HEAD }),
    cell("Meaning", { widthDxa: 4960, bold: true, fill: CELL_HEAD }),
  ] }),
  new TableRow({ children: [
    cell("Verified reported", { widthDxa: 3400, bold: true }),
    cell("1", { widthDxa: 1000, bold: true, alignment: AlignmentType.CENTER, color: GREEN }),
    cell("Borrower's annual report includes scope 1/2/3 emissions with a third-party assurance opinion (ISO 14064 or equivalent). Highest PCAF score achievable. PCAF Part A 3rd Edition §5.2 Option 1a.", { widthDxa: 4960 }),
  ] }),
  new TableRow({ children: [
    cell("Unverified reported", { widthDxa: 3400, bold: true }),
    cell("2", { widthDxa: 1000, bold: true, alignment: AlignmentType.CENTER, color: GREEN }),
    cell("Borrower's annual report includes scope 1/2/3 emissions but the figures are self-reported (no assurance statement). Common step-up for NEPSE-listed corporates. Option 1b.", { widthDxa: 4960 }),
  ] }),
  new TableRow({ children: [
    cell("Physical activity data available", { widthDxa: 3400, bold: true }),
    cell("3", { widthDxa: 1000, bold: true, alignment: AlignmentType.CENTER, color: AMBER }),
    cell("Bank has the borrower's own physical output (tonnes of cement, MWh generated, MW installed) or a facility-level match via Climate TRACE / GCCT / GEM. Score 3 is the honest ceiling for most Nepal facilities today. Option 2b.", { widthDxa: 4960 }),
  ] }),
  new TableRow({ children: [
    cell("Revenue-only knowable", { widthDxa: 3400, bold: true }),
    cell("4", { widthDxa: 1000, bold: true, alignment: AlignmentType.CENTER, color: AMBER }),
    cell("Borrower is publicly-listed or otherwise publishes revenue that can be multiplied by a sector-average emission factor per unit of revenue. Option 3a.", { widthDxa: 4960 }),
  ] }),
];

const part8 = [
  h1("Part 8  |  PCAF availability wizard"),
  ...figure("11-pcaf-availability.png", 'The PCAF availability panel: the answer (Exists / Does not exist) recorded separately from its source (AUTO / MANUAL).'),
  h2("8.1  Purpose"),
  p("PCAF (Partnership for Carbon Accounting Financials) requires every attributed emission to be reported with a Data Quality Score from 1 (best) to 5 (weakest). The PCAF availability wizard is the officer-facing surface for confirming or overriding, per borrower, the four flags that drive the PCAF Part A §5 decision tree. The result feeds the loan's Data Quality Score directly and, in aggregate, the data quality distribution shown on the NFRS tab (Part 11)."),
  p("The wizard lives at /pcaf/[loanId] and is required on every loan under NFRS. It appears as a CTA on My Work loan cards and as a workbench PCAF sub-tab on the Manager tab. The Manager sub-tab is a read-only mirror of the wizard; edits are always made from the wizard itself."),
  h2("8.2  The four flag rows"),
  p("The wizard collects four flag rows, in decreasing order of data quality. Each row asks one question and records two separate things about it."),
  bullet("The answer, stated in words: Exists or Does not exist."),
  bullet("The source of that answer, shown as a badge: AUTO where the platform inferred it, MANUAL where an officer set it."),
  p("Keeping the two apart matters. A bare toggle with an AUTO badge underneath could not distinguish \u201cwe checked and the answer is no\u201d from \u201cnobody has looked at this yet\u201d, because both displayed identically. The answer and its provenance are now recorded and displayed independently."),
  twoColTable([3400, 1000, 4960], pcafFlagsRows),
  p(""),
  p("The PCAF Score 5 row (Revenue-only using sector averages) is not exposed as a toggle: PCAF requires it as the always-available fallback, so it is always on. The physical activity data row is the most common outcome for Nepal borrowers; Score 3 is the honest ceiling most facilities can reach without direct borrower emissions reporting."),
  h2("8.3  What each flag may rest on"),
  p("Not every flag is inferable. Whether a borrower publishes an assured GHG inventory cannot be derived from a facility match; somebody has to open the annual report and read it. The evidence document matrix records, per flag, the class of document that can legitimately support it \u2014 an assured inventory or verification statement for the verified-emissions flag, a Climate TRACE facility match or production record for the physical activity flag, audited financials for revenue. The wizard uses the matrix to decide which flags may pre-fill automatically and which must be set by an officer against a named document."),
  p("This is what an auditor asks for immediately after the Score: not the flag, but the basis for it."),
  h2("8.4  Evidence per flag"),
  p("Each flag row has its own evidence textarea plus an Attachments panel that accepts source PDFs, screenshots of borrower reports, or Excel files of Climate TRACE / GCCT lookups. What the officer writes here is what an auditor asks for immediately after the Score, so the wizard makes it easy to attach the specific document that supports the flag."),
  h2("8.5  Save and computed score"),
  p("Saving the wizard writes the flag bundle and evidence to the borrower record and returns the computed PCAF Score with a citation into the specific PCAF §5 paragraph the flag choice mapped to. The Manager workbench PCAF panel and the NFRS tab data quality distribution refresh from the new value without a page reload."),
  p("As with every wizard on the platform, the PCAF wizard renders read-only when the current officer is not the loan's owner (Part 4.6)."),
];

// ---------- Part 9 ----------
const covenantTypesRows = [
  new TableRow({ tableHeader: true, children: [
    cell("Type", { widthDxa: 2600, bold: true, fill: CELL_HEAD }),
    cell("Meaning", { widthDxa: 6760, bold: true, fill: CELL_HEAD }),
  ] }),
  new TableRow({ children: [cell("Positive", { widthDxa: 2600, bold: true }), cell("Actions the borrower agrees to take (obtain a permit, install an ETP, join a green working group).", { widthDxa: 6760 })] }),
  new TableRow({ children: [cell("Negative", { widthDxa: 2600, bold: true }), cell("Actions the borrower agrees to refrain from (no new exposure to a red-listed sector; no discharge to unauthorised locations).", { widthDxa: 6760 })] }),
  new TableRow({ children: [cell("Condition precedent", { widthDxa: 2600, bold: true }), cell("Conditions the borrower must satisfy before disbursement or a specific tranche is released.", { widthDxa: 6760 })] }),
  new TableRow({ children: [cell("Event of default", { widthDxa: 2600, bold: true }), cell("Named E&S events (fatal incident, criminal environmental prosecution) that entitle the bank to accelerate the loan.", { widthDxa: 6760 })] }),
  new TableRow({ children: [cell("CAP covenant", { widthDxa: 2600, bold: true }), cell("A covenant that mirrors a specific CAP item, so the covenant status and the CAP item status move together.", { widthDxa: 6760 })] }),
];

const part9 = [
  h1("Part 9  |  CAP, Covenants, and Monitoring"),
  ...figure("12-cap-wizard.png", 'The corrective action plan wizard at /cap/[loanId]: time-bound items, covenants, and periodic monitoring.'),
  h2("9.1  Purpose and regulatory context"),
  p("the NRB ESRM Guideline (2022) §7.3.5 requires a time-bound Corrective Action Plan (CAP) plus E&S covenants (Annex 8 and Annex 9) for every loan rated Medium or High. §7.3.7 requires periodic monitoring using the Annex 10 checklist. The CAP + Covenants sub-tab on the Manager workbench is the officer-facing capture surface for all three."),
  p("The sub-tab is hidden for Low-risk loans, because the Guideline does not require a CAP or covenants for them. It also bails out to a \"not required\" note if the API says the same, as a defence-in-depth check."),
  p("The CAP workflow also has its own full-page route at /cap/[loanId], reached from the CTA on a My Work loan card. It follows the same pattern as the ESDD, Taxonomy, Project Finance and PCAF wizards, so an officer working through a loan moves between the five surfaces consistently instead of having to return to the Manager workbench for corrective actions."),
  h2("9.2  Corrective Action Plan items"),
  p("Each CAP item captures a description of the required action, an owner, a deadline date, a current status (Not started, In progress, Completed, Overdue), and evidence attachments. Overdue status is projected automatically once the deadline has passed (plus any grace days the bank has configured on the Settings page). Overdue items surface in three places:"),
  bullet("The Follow-ups panel on the responsible officer's My Work tab (Part 2)."),
  bullet("The overdue-CAP portfolio banner on the Manager tab (Part 4)."),
  bullet("The loan card in the officer queue, with an \"Overdue CAP\" flag next to the borrower name."),
  h2("9.3  E&S covenants"),
  p("Covenants are written obligations that live in the facility agreement. The panel captures each covenant's type, wording, status (Active, Breached, Waived, Expired), and review date. The five covenant types the panel supports are:"),
  twoColTable([2600, 6760], covenantTypesRows),
  p(""),
  h2("9.4  Periodic monitoring reports"),
  p("Each monitoring cycle produces a Monitoring Report against the Annex 10 checklist. The cadence is driven off the loan's ESRR risk class per the bank's setting (default: Extreme 1 month, High 3 months, Medium 6 months, Low 12 months)."),
  p("Each report captures the reviewer's compliance answer per checklist item (Fully implemented, Partially implemented, Not implemented, Delayed), the site-visit observations, and the evidence that supports the finding. Overdue reports appear alongside overdue CAP items in the Follow-ups panel on My Work."),
];

// ---------- Part 10 ----------
const part10 = [
  h1("Part 10  |  Evidence attachments"),
  h2("10.1  Where they appear"),
  p("Every remarks-style textarea in the platform is paired with an Attachments panel. The panel accepts the source PDF, image, or Word doc that justifies whatever the officer wrote in the remarks. This covers the ESDD wizard (per question), the PF screening wizard (per item), the PCAF wizard (per flag row), CAP items, covenants, and monitoring reports."),
  h2("10.2  What can be attached"),
  bullet("File size: up to 10 MB per file."),
  bullet("File count: multiple files per field (no fixed cap)."),
  bullet("Accepted types: any file type the browser can upload. In practice this is PDFs, images (JPEG, PNG), Word docs, spreadsheets, and text files."),
  h2("10.3  Where they live and who can see them"),
  p("Attachments are stored per tenant and are scoped to the entity they are attached to. Any officer at the same bank tenant can download an attachment (subject to the loan lock: a locked loan is read-only for anyone other than the owner). Attachments are never shared across tenants. The uploader's name and timestamp are stored on every file for audit."),
  h2("10.4  Removing an attachment"),
  p("The uploader (and the manager) can delete an attachment from the panel. Deletions are hard: the file is removed from storage and no longer counted against the field. For that reason, the panel asks for a one-click confirmation before deleting."),
];

// ---------- Part 11 ----------
const pcafScoresRows = [
  new TableRow({ tableHeader: true, children: [
    cell("Score", { widthDxa: 1000, bold: true, fill: CELL_HEAD, alignment: AlignmentType.CENTER }),
    cell("Meaning", { widthDxa: 8360, bold: true, fill: CELL_HEAD }),
  ] }),
  new TableRow({ children: [cell("1", { widthDxa: 1000, bold: true, alignment: AlignmentType.CENTER }), cell("Verified emissions, reported directly by the borrower.", { widthDxa: 8360 })] }),
  new TableRow({ children: [cell("2", { widthDxa: 1000, bold: true, alignment: AlignmentType.CENTER }), cell("Unverified emissions reported by the borrower (self-reported).", { widthDxa: 8360 })] }),
  new TableRow({ children: [cell("3", { widthDxa: 1000, bold: true, alignment: AlignmentType.CENTER }), cell("Facility-attributed: Climate TRACE facility data or borrower's own physical output combined with a sector emission factor.", { widthDxa: 8360 })] }),
  new TableRow({ children: [cell("4", { widthDxa: 1000, bold: true, alignment: AlignmentType.CENTER }), cell("Sector benchmark: borrower assigned the EDGAR sector intensity average for Nepal.", { widthDxa: 8360 })] }),
  new TableRow({ children: [cell("5", { widthDxa: 1000, bold: true, alignment: AlignmentType.CENTER }), cell("Revenue-based estimate using national sector averages.", { widthDxa: 8360 })] }),
];

const part11 = [
  h1("Part 11  |  NFRS tab"),
  h2("11.1  Purpose and regulatory context"),
  p("The NFRS tab is structured for the bank's climate-related financial disclosure under NFRS S1 (General Requirements) and NFRS S2 (Climate-related Disclosures). NFRS S1/S2 are Nepal's IFRS S1/S2-aligned climate disclosure standards, published in exposure draft by the Accounting Standards Board of Nepal (ASB Nepal) in April 2026 with a public comment window that closed in June 2026. The standards are now being finalised for pronouncement by the Institute of Chartered Accountants of Nepal (ICAN); the effective reporting cycle is to be determined once the finalised standards are pronounced."),
  p("The tab follows the PCAF Global GHG Accounting and Reporting Standard, Part A (3rd Edition), Category 15 (Financed Emissions). All figures are presented in NPR, consistent with the IFRS S1 presentation-currency requirement that NFRS S1 inherits. Where USD appears it is for the underlying PCAF attribution calculation, which is conventionally performed in USD because borrower enterprise values from public sources are denominated that way."),
  h2("11.2  Headline KPIs"),
  ...figure("13-nfrs-headline.png", 'The disclosure surface: total financed emissions, disclosure year, weighted PCAF score, and in-scope exposure.'),
  p("The KPI row at the top reports total financed emissions for the current reporting period with a year-on-year change (labelled with the years compared, e.g. \"2023 to 2024\"), the most recent fully-reported year, the facility-verified share of the portfolio, and the number of unique borrowers with facility-level data. Partial years (Climate TRACE coverage through October only for 2025) are labelled as partial rather than reported as if complete."),
  h2("11.3  NRBSIS Green Finance Statement (Annex 4b filing export)"),
  ...figure("14-nrbsis-annex4b.png", 'The NRBSIS Annex 4b Green Finance Statement, generated from the portfolio in one click.'),
  p("The NRBSIS Green Finance Statement panel exports the annual aggregate seventeen-sector Green Finance Statement per NRB Green Finance Taxonomy 2024 Annex 4b. This is the file submitted into the NRB Supervisory Information System (SIS), not just supporting evidence. Three formats are available from the panel:"),
  bulletRuns([
    new TextRun({ text: "Excel: ", font: FONT, size: BODY_SIZE, bold: true }),
    new TextRun({ text: "the SIS keying template, bank-branded (logo, colours, letterhead).", font: FONT, size: BODY_SIZE }),
  ]),
  bulletRuns([
    new TextRun({ text: "PDF: ", font: FONT, size: BODY_SIZE, bold: true }),
    new TextRun({ text: "signable filing document, bank-branded.", font: FONT, size: BODY_SIZE }),
  ]),
  bulletRuns([
    new TextRun({ text: "JSON: ", font: FONT, size: BODY_SIZE, bold: true }),
    new TextRun({ text: "structured data in the seventeen-sector shape, for downstream integrations.", font: FONT, size: BODY_SIZE }),
  ]),
  p("The Regulatory exports panel below the filing exports a per-loan NRB Green Finance Taxonomy classification report. This is supporting evidence for the Annex 4b submission: the auditor drills into it to verify each Green / Amber / Red allocation feeding the aggregate."),
  h2("11.4  Data quality distribution"),
  p("The Data quality distribution panel reports the share of the portfolio attributed at each PCAF Score, weighted by outstanding NPR balance. The score is computed per loan from the PCAF availability flags captured in the wizard (Part 8); it is not hardcoded."),
  twoColTable([1000, 8360], pcafScoresRows),
  p(""),
  h2("11.5  Multi-year trend"),
  p("The multi-year trend chart shows the bank's total attributed CO2e by reporting year, with a stacked breakdown by taxonomy colour so the reader can see whether emissions reductions are coming from genuine green growth or from declining red exposure. The most recent year in the chart is marked as partial when the underlying upstream data is not yet complete for that year."),
  h2("11.6  Emissions by sector"),
  p("The sector emissions chart shows the disclosure year's attributed CO2e broken down by NRB sector. This is the natural anchor for the sector engagement priorities section of the bank's NFRS narrative."),
  h2("11.7  Top contributors"),
  p("The Top contributors panel lists the loans that account for the largest share of the bank's attributed CO2e in the current reporting period, sorted in descending order. Each row reports the borrower, the outstanding NPR balance, the attributed CO2e in tonnes, and the PCAF data quality score. Clicking a row opens the borrower detail panel described in Part 3.4."),
  h2("11.8  Disclosure preview and taxonomy portfolio breakdown"),
  p("Two additional panels sit below the charts. Annual report disclosure preview shows an NFRS S2 / IFRS S2 aligned excerpt built from the current portfolio state, suitable as a starting point for the bank's disclosure narrative. Taxonomy portfolio breakdown reads the latest saved NRB Green Finance Taxonomy classifications per loan and reports the aggregate green / amber / red / unclassified split alongside the Annex 4b figures."),
];

// ---------- Part 12 ----------
const settingsRows = [
  new TableRow({ tableHeader: true, children: [
    cell("Category", { widthDxa: 2200, bold: true, fill: CELL_HEAD }),
    cell("Status", { widthDxa: 1600, bold: true, fill: CELL_HEAD }),
    cell("Description", { widthDxa: 5560, bold: true, fill: CELL_HEAD }),
  ] }),
  new TableRow({ children: [
    cell("ESRM", { widthDxa: 2200, bold: true }),
    cell("Wired", { widthDxa: 1600, bold: true, color: GREEN }),
    cell("Per-section remarks-required toggles for the ESDD wizard (General, EHS, Social). When on, the wizard requires a non-empty remarks textarea on every answered question in that section before Continue advances.", { widthDxa: 5560 }),
  ] }),
  new TableRow({ children: [
    cell("ESRM (other)", { widthDxa: 2200, bold: true }),
    cell("Coming soon", { widthDxa: 1600, bold: true, color: AMBER }),
    cell("Escalation trigger rule, Q2.5 climate required, auto-assignment rule. Values persist; the wiring to app behaviour is landing in a future build.", { widthDxa: 5560 }),
  ] }),
  new TableRow({ children: [
    cell("My Work", { widthDxa: 2200, bold: true }),
    cell("Coming soon", { widthDxa: 1600, bold: true, color: AMBER }),
    cell("Officer queue routing and reminders.", { widthDxa: 5560 }),
  ] }),
  new TableRow({ children: [
    cell("Loan Book", { widthDxa: 2200, bold: true }),
    cell("Coming soon", { widthDxa: 1600, bold: true, color: AMBER }),
    cell("NPR display format (plain / millions / crores) and fiscal year mode (calendar or Nepali fiscal).", { widthDxa: 5560 }),
  ] }),
  new TableRow({ children: [
    cell("Taxonomy", { widthDxa: 2200, bold: true }),
    cell("Coming soon", { widthDxa: 1600, bold: true, color: AMBER }),
    cell("ESRM gate mode (hard-enforce or warn-and-allow), hidden activity IDs, and escalation of missing classifications to the manager review lane.", { widthDxa: 5560 }),
  ] }),
  new TableRow({ children: [
    cell("NFRS", { widthDxa: 2200, bold: true }),
    cell("Coming soon", { widthDxa: 1600, bold: true, color: AMBER }),
    cell("PCAF dual sign-off requirement, reporting frequency, and whether Unclassified exposures are included in the disclosure aggregate.", { widthDxa: 5560 }),
  ] }),
  new TableRow({ children: [
    cell("CAP & Monitoring", { widthDxa: 2200, bold: true }),
    cell("Coming soon", { widthDxa: 1600, bold: true, color: AMBER }),
    cell("Monitoring cadence in months by ESRR risk class and grace days before overdue.", { widthDxa: 5560 }),
  ] }),
  new TableRow({ children: [
    cell("Notifications", { widthDxa: 2200, bold: true }),
    cell("Coming soon", { widthDxa: 1600, bold: true, color: AMBER }),
    cell("Email, SMS, push, and digest cadence.", { widthDxa: 5560 }),
  ] }),
  new TableRow({ children: [
    cell("Bank", { widthDxa: 2200, bold: true }),
    cell("Coming soon", { widthDxa: 1600, bold: true, color: AMBER }),
    cell("Display name override for header and email templates.", { widthDxa: 5560 }),
  ] }),
];

const part12 = [
  h1("Part 12  |  Settings"),
  h2("12.1  Opening settings"),
  p("The gear icon in the top-right of the header (next to the officer picker) opens the per-bank settings page. Any signed-in officer can edit settings in this demonstration; production deployments will gate this by role."),
  h2("12.2  Categories and current wiring"),
  p("Settings are grouped into nine categories that mirror the tab structure plus cross-cutting concerns. One category is fully wired end-to-end in the current build; the others show their controls, persist any change the officer makes, and display a \"Coming soon\" pill next to the value."),
  twoColTable([2200, 1600, 5560], settingsRows),
  p(""),
  p("This transparent split is deliberate: the settings screen is worth showing to a counterparty even though most levers are not yet acting on the app, because it makes the shape of the eventual per-bank configuration concrete. The one wired setting (ESRM remarks-required per section) demonstrates how each of the others will behave once wired."),
];

// ---------- Part 13 ----------
const toursRows = [
  new TableRow({ tableHeader: true, children: [
    cell("Tour", { widthDxa: 2200, bold: true, fill: CELL_HEAD }),
    cell("Audience", { widthDxa: 2500, bold: true, fill: CELL_HEAD }),
    cell("What it covers", { widthDxa: 4660, bold: true, fill: CELL_HEAD }),
  ] }),
  new TableRow({ children: [
    cell("Dashboard", { widthDxa: 2200, bold: true }),
    cell("Any first-time user", { widthDxa: 2500 }),
    cell("The five tabs, header controls, and the general shape of the app.", { widthDxa: 4660 }),
  ] }),
  new TableRow({ children: [
    cell("Loan officer", { widthDxa: 2200, bold: true }),
    cell("Loan officers", { widthDxa: 2500 }),
    cell("A day in the life of an officer: My Work, claim a loan, walk through ESDD, taxonomy, and PCAF wizards, save the screening.", { widthDxa: 4660 }),
  ] }),
  new TableRow({ children: [
    cell("Manager", { widthDxa: 2200, bold: true }),
    cell("Compliance / credit committee", { widthDxa: 2500 }),
    cell("Escalation banner, overdue-CAP banner, application queue, workbench sub-tabs, assignment and lock model.", { widthDxa: 4660 }),
  ] }),
  new TableRow({ children: [
    cell("PF screening", { widthDxa: 2200, bold: true }),
    cell("Project-finance officers", { widthDxa: 2500 }),
    cell("The 148-item Annex 5b questionnaire, the eight IFC Performance Standards, the twelve red-line flags (Jana's synthesis of the IFC PS text), and the aggregate risk classification.", { widthDxa: 4660 }),
  ] }),
  new TableRow({ children: [
    cell("PCAF scoring", { widthDxa: 2200, bold: true }),
    cell("ESG officers, disclosure teams", { widthDxa: 2500 }),
    cell("The four flag rows, AUTO vs OVERRIDE, evidence per flag, and how the flag choice becomes the Score.", { widthDxa: 4660 }),
  ] }),
  new TableRow({ children: [
    cell("NFRS", { widthDxa: 2200, bold: true }),
    cell("Disclosure teams, senior management", { widthDxa: 2500 }),
    cell("The disclosure-ready view, Annex 4b filing export, multi-year trend, PCAF distribution, top contributors, and disclosure preview.", { widthDxa: 4660 }),
  ] }),
];

const part13 = [
  h1("Part 13  |  Guided tour mode"),
  h2("13.1  Six tours in the selector"),
  p("The dashboard ships with six audio-narrated guided tours, each between five and eight minutes long. They auto-advance through the interface, with narration synchronised to spotlights that highlight the control being discussed. The tours are intended for first-time orientation and for internal training sessions; they do not perform any actions on the underlying data."),
  twoColTable([2200, 2500, 4660], toursRows),
  p(""),
  h2("13.2  Controls"),
  p("The tour selector is in the top-right of the header. Select a tour from the dropdown to open it. Play / pause, previous step, and next step controls are available throughout. A tour automatically selects a representative borrower and loan where it needs to, so the narration and the visible figures stay in sync."),
  p("Each bank tenant has its own recorded audio (so branding-sensitive language and pronunciations match the tenant). Adding a new tenant is a matter of dropping a set of tour scripts and audio files into the platform's data folder and adding the tenant to the tour registry."),
];

// ---------- Part 14 ----------
function glossRow(term, def) {
  return new TableRow({
    children: [
      cell(term, { widthDxa: 2200, bold: true }),
      cell(def, { widthDxa: 7160 }),
    ],
  });
}

const glossRows = [
  new TableRow({ tableHeader: true, children: [
    cell("Term", { widthDxa: 2200, bold: true, fill: CELL_HEAD }),
    cell("Definition", { widthDxa: 7160, bold: true, fill: CELL_HEAD }),
  ] }),
  glossRow("Annex 4b", "NRB Green Finance Taxonomy (October 2024), Annex 4b: the seventeen-sector Green Finance Statement aggregate that the bank keys into NRBSIS annually."),
  glossRow("Annex 5", "NRB ESRM Guideline (Second Edition, February 2022), Annex 5: the sector-agnostic thirteen-question ESDD checklist."),
  glossRow("Annex 5b", "Annex 5b of the NRB ESRM Guideline (2022): the Project Finance Screening Questionnaire, 148 items aligned to the eight IFC Performance Standards."),
  glossRow("Attribution factor", "The fraction of a borrower's total emissions allocated to a specific loan, calculated as outstanding loan balance divided by borrower enterprise value (PCAF convention). Capped at 100% in this demonstration."),
  glossRow("EIA / IEE", "Environmental Impact Assessment and Initial Environmental Examination: the two levels of environmental study under Nepal's Environment Protection Act and Rules. Which one applies depends on project scale. Currency of the approved study is one of the gates in the taxonomy hydropower screen and in the Annex 2 hydropower document matrix."),
  glossRow("EV (enterprise value)", "Enterprise value: the denominator in the PCAF attribution factor (outstanding amount divided by enterprise value). In this manual EV always means enterprise value, never electric vehicle; the taxonomy activity list spells out electric vehicles in full."),
  glossRow("CTA", "Call to action: the buttons on a My Work loan card that open the per-loan wizards (ESDD, Taxonomy, Project Finance screening, CAP, PCAF)."),
  glossRow("CAP", "Corrective Action Plan: the time-bound remediation plan ESRM Guideline §7.3.5 requires on every loan rated Medium or High."),
  glossRow("Circular 22", "NRB Directive 22 (FY 2074/75, 2018), the circular that first required environmental and social due diligence and attached the 2018 edition of the ESRM Guideline. The operative text today is the Second Edition of February 2022, which superseded it; this manual cites the Guideline, not the circular, for all Annex content. Annex 5b does not appear in the 2018 attachment."),
  glossRow("Climate TRACE", "Global facility-level emissions inventory used as the facility-tier data source. The 2024 v5.6 release is the snapshot referenced throughout the demonstration."),
  glossRow("Covenant", "A written obligation in the facility agreement. See Part 9.3 for the five types the platform captures."),
  glossRow("DNSH", "Do No Significant Harm: the set of environmental and social checks the NRB Green Finance Taxonomy requires alongside each activity's technical criteria, e.g. environmental flow, resettlement discharge, biodiversity offset, seismic assessment."),
  glossRow("EDGAR", "Emissions Database for Global Atmospheric Research, produced by the European Commission Joint Research Centre. The v8.1 gridded release, polygon-clipped to Nepal, supports the national denominator and sector benchmarks."),
  glossRow("Escalation trigger", "The rule that flags a screening for review by the next-higher credit approval authority. Per NRB ESRM Guideline \u00a77.3.6 the flag is raised on any risk class above Low, so both (b) and (c) answers escalate."),
  glossRow("ESDD", "Environmental and Social Due Diligence: the structured screening the NRB ESRM Guideline (2022) requires on applicable loan applications."),
  glossRow("ESRM", "Environmental and Social Risk Management. In Nepal the term refers to the NRB ESRM Guideline, Second Edition, February 2022."),
  glossRow("Follow-up", "A CAP item or monitoring report with a deadline in the next 30 days (or already past). Surfaced on the Follow-ups panel on My Work."),
  glossRow("GCCT", "Global Cement and Concrete Tracker, published by Global Energy Monitor. The July 2025 release supplies cement plant capacity and ownership metadata."),
  glossRow("GEM", "Global Energy Monitor, the publisher of the cement, coal, oil, gas, and wind trackers used to enrich borrower data."),
  glossRow("IFC Performance Standard (PS)", "One of the eight standards in the IFC Performance Standards on Environmental and Social Sustainability (2012). PS1 to PS8 anchor the NRB Annex 5b Project Finance Screening Questionnaire."),
  glossRow("Loan lock", "The platform's assignment model: only the officer who owns a loan can edit its wizards and workbench. Non-owners see the same surface read-only with a rose lock banner."),
  glossRow("Monitoring report", "The ESRM Guideline §7.3.7 periodic monitoring report against the Annex 10 checklist. Cadence is set by ESRR risk class."),
  glossRow("NFRS", "Nepal Financial Reporting Standards. NFRS S1 and S2 are Nepal's IFRS S1 / S2 aligned sustainability standards, in exposure-draft form as of April 2026 and being finalised for pronouncement by ICAN."),
  glossRow("NRB", "Nepal Rastra Bank, the central bank of Nepal and the prudential regulator for commercial banks."),
  glossRow("NRBSIS", "NRB Supervisory Information System: the reporting channel through which the Annex 4b Green Finance Statement is submitted."),
  glossRow("OpenAQ", "Open air quality data network. Nepal coverage is sparse and irregular; the dashboard surfaces a reading only where a station is in operating range of the facility."),
  glossRow("PCAF", "Partnership for Carbon Accounting Financials, publisher of the Global GHG Accounting and Reporting Standard. Part A, 3rd Edition, Category 15 Financed Emissions is the methodology used throughout."),
  glossRow("PCAF Data Quality Score", "A 1 to 5 score where 1 represents verified borrower-reported emissions and 5 represents a revenue-based estimate using sector averages."),
  glossRow("Retail loan pool", "A synthetic borrower used to aggregate retail loans (mortgages, vehicle, personal, education) for PCAF attribution."),
  glossRow("Taxonomy colour", "Green, amber, red, or unclassified categorisation of a loan under the NRB Green Finance Taxonomy (October 2024)."),
];

const part14 = [
  h1("Part 14  |  Glossary"),
  twoColTable([2200, 7160], glossRows),
];

// ---------- Part 15 ----------
const regRows = [
  new TableRow({ tableHeader: true, children: [
    cell("Reference document", { widthDxa: 3600, bold: true, fill: CELL_HEAD }),
    cell("Role in the dashboard", { widthDxa: 5760, bold: true, fill: CELL_HEAD }),
  ] }),
  new TableRow({ children: [
    cell("NRB ESRM Guideline, Second Edition, February 2022", { widthDxa: 3600, bold: true }),
    cell("Annex 5 (12-question ESDD checklist) drives the ESDD wizard. Annex 5b (148-item Project Finance Screening Questionnaire, IFC PS1-PS8 aligned) drives the PF screening wizard. §7.3.5 (CAP + covenants) and §7.3.7 (periodic monitoring) drive the CAP + Covenants sub-tab on the Manager workbench. §4.3 climate reporting threshold (25,000 tCO2e/yr) drives the climate flag on the loan card.", { widthDxa: 5760 }),
  ] }),
  new TableRow({ children: [
    cell("NRB Green Finance Taxonomy (October 2024)", { widthDxa: 3600, bold: true }),
    cell("Drives the Taxonomy tab, the per-loan taxonomy wizard, and the NRBSIS Green Finance Statement (Annex 4b) filing export on the NFRS tab. The seventeen SIS sectors and the activities they contain are encoded in the platform.", { widthDxa: 5760 }),
  ] }),
  new TableRow({ children: [
    cell("NFRS S1 and S2 (April 2026 exposure drafts, ASB Nepal)", { widthDxa: 3600, bold: true }),
    cell("Nepal's IFRS S1 / S2 aligned sustainability disclosure standards. NFRS S1 covers general requirements, NFRS S2 covers climate-related disclosures. Published in exposure draft by ASB Nepal in April 2026, public comment window closed in June 2026, being finalised for pronouncement by ICAN. The NFRS tab is structured for the bank's disclosure once the standards are pronounced.", { widthDxa: 5760 }),
  ] }),
  new TableRow({ children: [
    cell("PCAF Global GHG Accounting and Reporting Standard, Part A (3rd Edition)", { widthDxa: 3600, bold: true }),
    cell("Category 15 Financed Emissions methodology and Data Quality scoring drive the NFRS tab and the PCAF availability wizard. §5.2 and §5.3 define the four Options (1a, 1b, 2b, 3a) that the wizard captures via its four flag rows.", { widthDxa: 5760 }),
  ] }),
  new TableRow({ children: [
    cell("IFC Performance Standards on Environmental and Social Sustainability (2012)", { widthDxa: 3600, bold: true }),
    cell("PS1 through PS8 anchor the Annex 5b Project Finance Screening Questionnaire. The twelve red-line flags are Jana's synthesis of the IFC PS text and cite the specific paragraph; NRB publishes no escalation grid for Annex 5b.", { widthDxa: 5760 }),
  ] }),
];

const part15 = [
  h1("Part 15  |  Regulatory frameworks and methodology"),
  p("The dashboard is built against the regulatory frameworks and accounting methodology that apply to commercial banks in Nepal. Five reference documents anchor the design of the five tabs and the per-loan wizards:"),
  twoColTable([3600, 5760], regRows),
  p(""),
  noticeBox("Replacing demonstration data with bank source-of-record data", [
    p("When this dashboard moves from demonstration to production for a specific commercial bank, the synthesized loan book and borrower catalog are replaced by a direct integration with that bank's core banking system. The regulatory references above continue to anchor the design unchanged. The integration approach is described in detail in the companion document Jana Integration with Bank Systems, included in the same documentation set as this manual.", { spacing: { after: 0 } }),
  ]),
  noticeBox("Thank you", [
    p("Thank you for taking the time to review this demonstration. Questions and feedback during the evaluation period are welcome and should be directed to the Jana Earth Data team.", { spacing: { after: 0 } }),
  ]),
];

// ---------- Document ----------
const doc = new Document({
  creator: "Jana Earth Data",
  title: "Financed Emissions Dashboard User's Manual v0.3",
  description: "v0.3 draft for review",
  features: { updateFields: true },
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [
          {
            level: 0,
            format: LevelFormat.BULLET,
            text: "•",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 480, hanging: 240 } } },
          },
        ],
      },
    ],
  },
  styles: {
    default: { document: { run: { font: FONT, size: BODY_SIZE } } },
  },
  sections: [
    {
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1080, bottom: 1080, left: 1440, right: 1440 },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              alignment: AlignmentType.LEFT,
              spacing: { after: 0 },
              children: [
                new TextRun({
                  text: "Financed Emissions Dashboard",
                  font: FONT, size: TINY_SIZE, color: HEADER_TEXT,
                }),
                new TextRun({
                  children: [
                    new PositionalTab({
                      alignment: PositionalTabAlignment.RIGHT,
                      leader: PositionalTabLeader.NONE,
                      relativeTo: "margin",
                    }),
                  ],
                }),
                new TextRun({
                  text: "User's Manual | v0.3 (Draft)",
                  font: FONT, size: TINY_SIZE, color: HEADER_TEXT,
                }),
              ],
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              spacing: { before: 0, after: 0 },
              children: [
                new TextRun({
                  text: "Jana Earth Data",
                  font: FONT, size: TINY_SIZE, color: HEADER_TEXT,
                }),
                new TextRun({
                  children: [
                    new PositionalTab({
                      alignment: PositionalTabAlignment.RIGHT,
                      leader: PositionalTabLeader.NONE,
                      relativeTo: "margin",
                    }),
                  ],
                }),
                new TextRun({ text: "Page ", font: FONT, size: TINY_SIZE, color: HEADER_TEXT }),
                new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: TINY_SIZE, color: HEADER_TEXT }),
                new TextRun({ text: " | September 2026", font: FONT, size: TINY_SIZE, color: HEADER_TEXT }),
              ],
            }),
          ],
        }),
      },
      children: [
        ...cover,
        ...importantNotice,
        ...contents,
        ...part1,
        ...part2,
        ...part3,
        ...part4,
        ...part5,
        ...part6,
        ...part7,
        ...part8,
        ...part9,
        ...part10,
        ...part11,
        ...part12,
        ...part13,
        ...part14,
        ...part15,
      ],
    },
  ],
});

Packer.toBuffer(doc).then((buffer) => {
  const outPath = process.argv[2];
  fs.writeFileSync(outPath, buffer);
  console.log("Wrote", outPath, "bytes:", buffer.length);
  console.log(FIG_DIR ? `figures: ${FIG_N} embedded from ${FIG_DIR}` : "figures: none (docs/manual-screenshots not found)");
  if (FIG_MISSING.length) console.warn("missing figures:", FIG_MISSING.join(", "));
});
