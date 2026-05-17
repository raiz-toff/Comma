/**
 * Report section registry (Category B).
 * @see docs/feature_modularity.md
 */

import chart from './chart.report-section.js';
import expenses from './expenses.report-section.js';
import notes from './notes.report-section.js';
import overview from './overview.report-section.js';
import placeholder from './placeholder.report-section.js';
import qr from './qr.report-section.js';
import shifts from './shifts.report-section.js';
import platform_breakdown from './platform_breakdown.report-section.js';

/** @typedef {typeof placeholder} ReportSectionDefinition */

/** @type {ReportSectionDefinition[]} */
const SECTIONS = [overview, platform_breakdown, shifts, expenses, chart, qr, notes, placeholder];

// In index.js at load time (Bug I):
for (const section of SECTIONS) {
  const missing = ['renderHTML', 'renderText', 'renderCSV'].filter(
    (m) => typeof section[m] !== 'function',
  );
  if (missing.length) {
    console.error(`Section ${section.id} missing: ${missing.join(', ')}`);
  }
}

/**
 * @param {ReportSectionDefinition} def
 * @returns {boolean}
 */
function validateReportSectionDefinition(def) {
  const required = ['id', 'label', 'defaultIncluded', 'renderHTML', 'renderText', 'renderCSV'];
  const missing = required.filter((k) => def[k] == null);
  if (missing.length) throw new Error(`Report section definition missing: ${missing.join(', ')}`);
  if (typeof def.renderHTML !== 'function' || typeof def.renderText !== 'function' || typeof def.renderCSV !== 'function') {
    throw new Error(`Report section ${def.id} missing renderHTML/renderText/renderCSV`);
  }

  // Contract testing for Shifts CSV (Bug F)
  if (def.id === 'shifts') {
    const mockReport = { shifts: [], expenses: [] };
    const csv = def.renderCSV(mockReport);
    const header = csv[0] || [];
    const requiredShiftCols = [
      'id',
      'date',
      'provinceId',
      'platformId',
      'startTime',
      'endTime',
      'durationMinutes',
      'gross',
      'tips',
      'bonus',
      'orders',
      'distanceKm',
      'deadMilesKm',
      'notes',
    ];
    const missingCols = requiredShiftCols.filter(col => !header.includes(col));
    if (missingCols.length) {
      throw new Error(`Report section 'shifts' renderCSV missing columns: ${missingCols.join(', ')}`);
    }
  }

  return true;
}

export const ReportRegistry = {
  /** @returns {readonly ReportSectionDefinition[]} */
  getAll: () => SECTIONS,

  /**
   * @param {string | null | undefined} id
   * @returns {ReportSectionDefinition | undefined}
   */
  getById: (id) => {
    const key = String(id || '').toLowerCase();
    return byId.get(key);
  },

  /** @param {ReportSectionDefinition} def */
  validate: (def) => validateReportSectionDefinition(def),
};

const byId = new Map(SECTIONS.map((s) => [String(s.id).toLowerCase(), s]));

export function assertReportRegistryValid() {
  for (const s of SECTIONS) validateReportSectionDefinition(s);
}
