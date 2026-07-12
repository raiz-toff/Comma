import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';

export function ActiveShiftWidget({
  isActive,
  platform,
  elapsedSeconds,
  mileage,
}: {
  isActive: boolean;
  platform: string | null;
  elapsedSeconds: number;
  mileage: number;
}) {
  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: '#000000',
        borderRadius: 16,
        padding: 12,
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <FlexWidget
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: 'match_parent',
        }}
      >
        <TextWidget
          text="COMMA"
          style={{
            color: '#F6F6F7',
            fontSize: 13,
            fontWeight: 'bold',
            fontFamily: 'sans-serif-medium',
          }}
        />
        <FlexWidget
          style={{
            backgroundColor: isActive ? 'rgba(34, 197, 94, 0.2)' : 'rgba(101, 101, 110, 0.2)',
            borderRadius: 8,
            paddingHorizontal: 8,
            paddingVertical: 3,
          }}
        >
          <TextWidget
            text={isActive ? 'TRACKING' : 'OFFLINE'}
            style={{
              color: isActive ? '#22c55e' : '#9B9BA4',
              fontSize: 9,
              fontWeight: 'bold',
            }}
          />
        </FlexWidget>
      </FlexWidget>

      {isActive ? (
        <FlexWidget style={{ flexDirection: 'column', marginTop: 4 }}>
          <TextWidget
            text={platform ? platform.toUpperCase() : 'ACTIVE SHIFT'}
            style={{ color: '#9B9BA4', fontSize: 10, fontWeight: 'bold' }}
          />
          <TextWidget
            text={formatTime(elapsedSeconds)}
            style={{
              color: '#F6F6F7',
              fontSize: 26,
              fontWeight: 'bold',
              fontFamily: 'sans-serif-condensed',
              marginTop: 2,
            }}
          />
          <TextWidget
            text={`${mileage.toFixed(1)} miles tracked`}
            style={{ color: '#65656E', fontSize: 10, marginTop: 4 }}
          />
        </FlexWidget>
      ) : (
        <FlexWidget style={{ flexDirection: 'column', marginTop: 8 }}>
          <TextWidget
            text="No active shift"
            style={{ color: '#9B9BA4', fontSize: 12, fontWeight: '500' }}
          />
          <TextWidget
            text="Tap to log dynamic metrics"
            style={{ color: '#65656E', fontSize: 10, marginTop: 4 }}
          />
        </FlexWidget>
      )}
    </FlexWidget>
  );
}
