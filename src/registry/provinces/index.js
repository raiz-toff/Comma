/**
 * Province / territory registry (plan F9).
 * Layout: `{ISO}/*.province.js` under this folder (CA, US, UK, …). Skip `_*.province.js`.
 * Run `npm run rebuild:provinces` to regenerate this file from the folders; US stubs also
 * sync from `WITHHOLDING_PRESETS_US`.
 */

import ON from './CA/ON.province.js';
import pAK from './US/AK.province.js';
import pAL from './US/AL.province.js';
import pAR from './US/AR.province.js';
import pAZ from './US/AZ.province.js';
import pCA from './US/CA.province.js';
import pCO from './US/CO.province.js';
import pCT from './US/CT.province.js';
import pDC from './US/DC.province.js';
import pDE from './US/DE.province.js';
import pFL from './US/FL.province.js';
import pGA from './US/GA.province.js';
import pHI from './US/HI.province.js';
import pIA from './US/IA.province.js';
import pID from './US/ID.province.js';
import pIL from './US/IL.province.js';
import pIN from './US/IN.province.js';
import pKS from './US/KS.province.js';
import pKY from './US/KY.province.js';
import pLA from './US/LA.province.js';
import pMA from './US/MA.province.js';
import pMD from './US/MD.province.js';
import pME from './US/ME.province.js';
import pMI from './US/MI.province.js';
import pMN from './US/MN.province.js';
import pMO from './US/MO.province.js';
import pMS from './US/MS.province.js';
import pMT from './US/MT.province.js';
import pNC from './US/NC.province.js';
import pND from './US/ND.province.js';
import pNE from './US/NE.province.js';
import pNH from './US/NH.province.js';
import pNJ from './US/NJ.province.js';
import pNM from './US/NM.province.js';
import pNV from './US/NV.province.js';
import pNY from './US/NY.province.js';
import pOH from './US/OH.province.js';
import pOK from './US/OK.province.js';
import pOR from './US/OR.province.js';
import pPA from './US/PA.province.js';
import pRI from './US/RI.province.js';
import pSC from './US/SC.province.js';
import pSD from './US/SD.province.js';
import pTN from './US/TN.province.js';
import pTX from './US/TX.province.js';
import pUT from './US/UT.province.js';
import pVA from './US/VA.province.js';
import pVT from './US/VT.province.js';
import pWA from './US/WA.province.js';
import pWI from './US/WI.province.js';
import pWV from './US/WV.province.js';
import pWY from './US/WY.province.js';

/** @type {typeof ON[]} */
const PROVINCES = [ON, pAK, pAL, pAR, pAZ, pCA, pCO, pCT, pDC, pDE, pFL, pGA, pHI, pIA, pID, pIL, pIN, pKS, pKY, pLA, pMA, pMD, pME, pMI, pMN, pMO, pMS, pMT, pNC, pND, pNE, pNH, pNJ, pNM, pNV, pNY, pOH, pOK, pOR, pPA, pRI, pSC, pSD, pTN, pTX, pUT, pVA, pVT, pWA, pWI, pWV, pWY];

/** @type {Map<string, typeof ON>} */
const byId = new Map(PROVINCES.map((p) => [p.id, p]));

const FALLBACK_ID = 'ON';

function validateProvinceDefinition(def) {
  const required = ['id', 'countryId', 'availablePlatforms', 'expenseCategories'];
  const missing = required.filter((k) => def[k] == null);
  if (missing.length) throw new Error(`Province definition missing: ${missing.join(', ')}`);
  if (!Array.isArray(def.availablePlatforms) || def.availablePlatforms.length === 0) {
    throw new Error(`Province ${def.id} needs availablePlatforms`);
  }
  return true;
}

export const ProvinceRegistry = {
  /** @returns {readonly typeof ON[]} */
  getAll: () => PROVINCES,

  /**
   * @param {string | null | undefined} id
   * @returns {typeof ON}
   */
  getById: (id) => {
    const key = String(id || '').toUpperCase();
    return byId.get(key) || byId.get(FALLBACK_ID) || ON;
  },

  /**
   * @param {string} countryId
   * @returns {typeof ON[]}
   */
  getByCountry: (countryId) => {
    const c = String(countryId || '').toUpperCase();
    return PROVINCES.filter((p) => String(p.countryId).toUpperCase() === c);
  },

  /** @param {typeof ON} def */
  validate: (def) => validateProvinceDefinition(def),
};

export function assertProvinceRegistryValid() {
  for (const p of PROVINCES) validateProvinceDefinition(p);
}
