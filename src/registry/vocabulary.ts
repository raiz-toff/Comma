/**
 * VocabularyKey — represents the UI terminology tokens that change depending on the user's persona or region.
 */
export type VocabularyKey =
  | 'session'            // shift / drive / job
  | 'session_plural'     // shifts / drives / jobs
  | 'platform'           // platform / purpose / client / app
  | 'active_miles'       // active miles / business miles / work miles / fare miles
  | 'dead_miles'         // dead miles / personal miles / deadhead miles
  | 'revenue'            // earnings / reimbursable / revenue
  | 'start_cta'          // Start shift / Start drive / Start job / Go online
  | 'end_cta'            // End shift / End drive / End job / Go offline
  | 'history_tab'        // Shifts / Drives / Jobs
  | 'active_indicator'   // Active shift / On drive / On job / Online
  | 'no_sessions_yet';   // No shifts yet / No drives yet / No jobs yet
