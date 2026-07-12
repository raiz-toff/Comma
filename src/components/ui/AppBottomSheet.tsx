import * as React from "react";
import { View } from "react-native";
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/src/theme/useColors";
import { useLayout, DIALOG_MAX_WIDTH } from "@/src/hooks/useLayout";

/**
 * AppBottomSheet — the single, consistent sheet surface for Comma.
 *
 * Comma DS: radius-2xl (28px) top corners, Surface/03 background, hairline
 * handle, dimmed backdrop, bottom safe-area padding. Every quick-action sheet
 * (Start Shift, quick Add Expense, period selector, badge detail, celebration)
 * renders through this so they all look identical.
 *
 * Imperative API matches BottomSheetModal — drive it with a ref:
 *   const ref = useRef<AppBottomSheetRef>(null);
 *   ref.current?.present();  ref.current?.dismiss();
 */

export interface AppBottomSheetRef {
  present: () => void;
  dismiss: () => void;
}

export interface AppBottomSheetProps {
  children: React.ReactNode;
  /** Snap points, e.g. ['50%'] or [320, '80%']. Omit for content-height sizing. */
  snapPoints?: (string | number)[];
  /** Called when the sheet is fully dismissed. */
  onDismiss?: () => void;
  /** Allow swipe-down / backdrop tap to close. Default true. */
  enableDismiss?: boolean;
}

export const AppBottomSheet = React.forwardRef<AppBottomSheetRef, AppBottomSheetProps>(
  function AppBottomSheet({ children, snapPoints, onDismiss, enableDismiss = true }, ref) {
    const C = useColors();
    const sheetRef = React.useRef<BottomSheetModal>(null);
    const insets = useSafeAreaInsets();
    const { width, isTablet } = useLayout();

    /*
      Tablet: cap the sheet at dialog width and centre it. Full-bleed, a sheet is
      1024pt of nothing with Share at one end and Done at the other.

      It is a margin and not `dialogStyle` because the sheet body is the one
      surface `dialogStyle` cannot describe: @gorhom applies its own
      `position: absolute; left: 0; right: 0` *after* this prop, so a `maxWidth`
      would survive but `alignSelf` would not — Yoga would pin a 520pt sheet to
      the left screen edge. A symmetric margin is the only thing that both
      narrows and centres it. (It is the library's own `detached` pattern.)

      undefined below 600pt — the phone renders the sheet it rendered before.
    */
    const sheetStyle = React.useMemo(
      () => (isTablet ? { marginHorizontal: Math.max(0, (width - DIALOG_MAX_WIDTH) / 2) } : undefined),
      [isTablet, width]
    );

    React.useImperativeHandle(ref, () => ({
      present: () => sheetRef.current?.present(),
      dismiss: () => sheetRef.current?.dismiss(),
    }));

    const renderBackdrop = React.useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          opacity={0.6}
          pressBehavior={enableDismiss ? "close" : "none"}
        />
      ),
      [enableDismiss]
    );

    return (
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={snapPoints}
        enableDynamicSizing={!snapPoints}
        onDismiss={onDismiss}
        enablePanDownToClose={enableDismiss}
        backdropComponent={renderBackdrop}
        style={sheetStyle}
        handleIndicatorStyle={{ backgroundColor: C.lineStrong, width: 36, height: 4 }} // Border/Strong — visible grabber
        backgroundStyle={{
          backgroundColor: C.surface03,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          borderWidth: 1,
          borderColor: C.lineSubtle,
        }}
      >
        <BottomSheetView style={{ paddingBottom: insets.bottom + 16, paddingHorizontal: 16 }}>
          <View>{children}</View>
        </BottomSheetView>
      </BottomSheetModal>
    );
  }
);
