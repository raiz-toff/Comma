/**
 * Comma — responsive layout.
 *
 * The app was built for phones: every screen is a single column that fills the
 * width. On a tablet that means 1000pt-wide cards and text lines nobody can
 * track across. This caps the column and, where a screen is a grid of cards,
 * lets it use the extra room.
 *
 * THE PHONE GUARANTEE
 *   Every style this hook returns is `undefined` below the tablet breakpoint.
 *   So `style={[s.scroll, columnStyle]}` on a phone is `[s.scroll, undefined]`,
 *   which React Native flattens to exactly the `s.scroll` it rendered before any
 *   of this existed. The phone layout cannot regress, because below 600pt there
 *   is nothing here to regress — that is a structural property, not a promise.
 *
 * Width-driven, never device-driven, and reactive via useWindowDimensions. That
 * is what makes it survive rotation, foldables opening and closing, and Android
 * split-screen — all of which change the width of a "phone" at runtime.
 */

import { useMemo } from "react";
import { useWindowDimensions, type ViewStyle } from "react-native";

/**
 * Where a phone stops being a phone. 600pt is Material 3's compact→medium
 * boundary and the conventional Android tablet threshold.
 *
 * A large phone in landscape sits just under it, deliberately: it has the width
 * for a centred column but nothing like the height, so letterboxing it would
 * only waste the little vertical room it has.
 */
export const TABLET_MIN_WIDTH = 600;

/** Two columns only once there is room for two *readable* ones. */
export const TWO_COLUMN_MIN_WIDTH = 900;

/** A comfortable measure for reading. Forms, detail views, settings. */
export const COLUMN_MAX_WIDTH = 640;

/** Card grids may run wider than prose — two 500pt cards beat one 640pt one. */
export const GRID_MAX_WIDTH = 1040;

/** Modals stay hand-sized; a full-bleed dialog on a tablet is just a wall. */
export const DIALOG_MAX_WIDTH = 520;

const COLUMN: ViewStyle = { width: "100%", maxWidth: COLUMN_MAX_WIDTH, alignSelf: "center" };
const GRID: ViewStyle = { width: "100%", maxWidth: GRID_MAX_WIDTH, alignSelf: "center" };
const DIALOG: ViewStyle = { width: "100%", maxWidth: DIALOG_MAX_WIDTH, alignSelf: "center" };

/**
 * Two-up card grid. `space-between` rather than a gap so the two columns pin to
 * the container's edges and the slack falls between them — which keeps the cards
 * flush with the rest of the page's content, gap maths notwithstanding.
 *
 * Cards keep their own marginBottom, so the row rhythm needs nothing from here.
 */
const TWO_UP_ROW: ViewStyle = { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" };
const TWO_UP_ITEM: ViewStyle = { width: "49%" };

export interface Layout {
  /** Current window width in pt. Reactive. */
  width: number;
  /** At or past the tablet breakpoint. */
  isTablet: boolean;
  /** Centred reading column (640). Forms, detail, settings. undefined on phone. */
  columnStyle: ViewStyle | undefined;
  /** Centred wide container (1040) for card grids. undefined on phone. */
  gridStyle: ViewStyle | undefined;
  /** Centred dialog (520) for modals and sheets. undefined on phone. */
  dialogStyle: ViewStyle | undefined;
  /** How many cards fit side by side inside `gridStyle`. 1 on phone. */
  columns: 1 | 2;
  /**
   * Put on the container of a list of cards to lay them out two-up.
   * undefined below 900pt, where they stack as they always have.
   */
  twoUpRow: ViewStyle | undefined;
  /** Put on each card in a `twoUpRow`. undefined below 900pt. */
  twoUpItem: ViewStyle | undefined;
}

export function useLayout(): Layout {
  const { width } = useWindowDimensions();

  return useMemo(() => {
    const isTablet = width >= TABLET_MIN_WIDTH;
    const twoUp = width >= TWO_COLUMN_MIN_WIDTH;
    return {
      width,
      isTablet,
      columnStyle: isTablet ? COLUMN : undefined,
      gridStyle: isTablet ? GRID : undefined,
      dialogStyle: isTablet ? DIALOG : undefined,
      columns: twoUp ? 2 : 1,
      twoUpRow: twoUp ? TWO_UP_ROW : undefined,
      twoUpItem: twoUp ? TWO_UP_ITEM : undefined,
    };
  }, [width]);
}
