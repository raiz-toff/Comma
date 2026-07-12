import * as React from "react";
import { View } from "react-native";
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "@/src/theme/colors";

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

const SURFACE_03 = COLORS.surface03;
const BORDER_SUBTLE = COLORS.lineSubtle;
const HANDLE = COLORS.lineStrong; // Border/Strong — visible grabber

export const AppBottomSheet = React.forwardRef<AppBottomSheetRef, AppBottomSheetProps>(
  function AppBottomSheet({ children, snapPoints, onDismiss, enableDismiss = true }, ref) {
    const sheetRef = React.useRef<BottomSheetModal>(null);
    const insets = useSafeAreaInsets();

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
        handleIndicatorStyle={{ backgroundColor: HANDLE, width: 36, height: 4 }}
        backgroundStyle={{
          backgroundColor: SURFACE_03,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          borderWidth: 1,
          borderColor: BORDER_SUBTLE,
        }}
      >
        <BottomSheetView style={{ paddingBottom: insets.bottom + 16, paddingHorizontal: 16 }}>
          <View>{children}</View>
        </BottomSheetView>
      </BottomSheetModal>
    );
  }
);
