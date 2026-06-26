import React from 'react';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { ActiveShiftWidget } from './ActiveShiftWidget';
import { db } from '../database/client';
import { settings } from '../database/schema';
import { eq } from 'drizzle-orm';

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  let isActive = false;
  let platform = null;
  let elapsedSeconds = 0;
  let mileage = 0;

  try {
    if (db) {
      const result = await db.select().from(settings).where(eq(settings.key, "active_shift_state")).limit(1);
      if (result.length > 0 && result[0].value) {
        const parsed = JSON.parse(result[0].value);
        isActive = !!parsed.isActive;
        platform = parsed.platform || null;
        elapsedSeconds = parsed.elapsedSeconds || 0;
        mileage = (parsed.activeMileage || 0) + (parsed.deadMileage || 0);
      }
    }
  } catch (e) {
    console.error("Failed to load database active_shift_state in widget task handler:", e);
  }

  const render = () => {
    props.renderWidget(
      <ActiveShiftWidget
        isActive={isActive}
        platform={platform}
        elapsedSeconds={elapsedSeconds}
        mileage={mileage}
      />
    );
  };

  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_RESIZED':
    case 'WIDGET_UPDATE':
      render();
      break;
    case 'WIDGET_CLICK':
      render();
      break;
    case 'WIDGET_DELETED':
      break;
  }
}
