/**
 * Ionic Core wiring — standalone custom elements, bundled statically by esbuild.
 * No lazy loading, no framework: each import below registers a plain custom element
 * (and its internal children) and adds its own weight to bundle.js, so register ONLY
 * what the app actually renders. Theming comes from css/ionic-theme.css, which points
 * every --ion-* variable at comma's own tokens.
 */

import { initialize } from '@ionic/core/components';
import { defineCustomElement as defineList } from '@ionic/core/components/ion-list.js';
import { defineCustomElement as defineItem } from '@ionic/core/components/ion-item.js';
import { defineCustomElement as defineItemSliding } from '@ionic/core/components/ion-item-sliding.js';
import { defineCustomElement as defineItemOptions } from '@ionic/core/components/ion-item-options.js';
import { defineCustomElement as defineItemOption } from '@ionic/core/components/ion-item-option.js';
import { defineCustomElement as defineLabel } from '@ionic/core/components/ion-label.js';
import { defineCustomElement as defineNote } from '@ionic/core/components/ion-note.js';
import { defineCustomElement as defineBadge } from '@ionic/core/components/ion-badge.js';
import { defineCustomElement as defineButton } from '@ionic/core/components/ion-button.js';
import { defineCustomElement as defineSegment } from '@ionic/core/components/ion-segment.js';
import { defineCustomElement as defineSegmentButton } from '@ionic/core/components/ion-segment-button.js';
import { defineCustomElement as defineRefresher } from '@ionic/core/components/ion-refresher.js';
import { defineCustomElement as defineRefresherContent } from '@ionic/core/components/ion-refresher-content.js';
import { defineCustomElement as defineSpinner } from '@ionic/core/components/ion-spinner.js';
import { defineCustomElement as defineModal } from '@ionic/core/components/ion-modal.js';
import { defineCustomElement as defineSkeletonText } from '@ionic/core/components/ion-skeleton-text.js';
import { defineCustomElement as defineActionSheet } from '@ionic/core/components/ion-action-sheet.js';
import { defineCustomElement as defineAlert } from '@ionic/core/components/ion-alert.js';
import { defineCustomElement as defineToast } from '@ionic/core/components/ion-toast.js';
import { defineCustomElement as defineFab } from '@ionic/core/components/ion-fab.js';
import { defineCustomElement as defineFabButton } from '@ionic/core/components/ion-fab-button.js';
import { defineCustomElement as defineFabList } from '@ionic/core/components/ion-fab-list.js';
import { defineCustomElement as defineSearchbar } from '@ionic/core/components/ion-searchbar.js';
import { defineCustomElement as defineToggle } from '@ionic/core/components/ion-toggle.js';
import { defineCustomElement as defineChip } from '@ionic/core/components/ion-chip.js';
import { defineCustomElement as defineProgressBar } from '@ionic/core/components/ion-progress-bar.js';

/** Registers every Ionic element the app uses. Call once at boot, before first render. */
export function initIonic() {
  initialize();
  defineList();
  defineItem();
  defineItemSliding();
  defineItemOptions();
  defineItemOption();
  defineLabel();
  defineNote();
  defineBadge();
  defineButton();
  defineSegment();
  defineSegmentButton();
  defineRefresher();
  defineRefresherContent();
  defineSpinner();
  defineModal();
  defineSkeletonText();
  defineActionSheet();
  defineAlert();
  defineToast();
  defineFab();
  defineFabButton();
  defineFabList();
  defineSearchbar();
  defineToggle();
  defineChip();
  defineProgressBar();
}
