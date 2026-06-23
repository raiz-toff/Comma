import { openDatabaseSync } from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { useDrizzleStudio } from 'expo-drizzle-studio-plugin';
import { Platform } from 'react-native';
import * as schema from './schema';
import migrations from '../../drizzle/migrations';

export const DATABASE_NAME = 'comma.db';

const isWeb = Platform.OS === 'web';

const expoDb = isWeb ? null : openDatabaseSync(DATABASE_NAME);
export const db = isWeb ? null as any : drizzle(expoDb!, { schema });

export function useDatabaseMigrations() {
  if (isWeb) {
    return { success: true, error: null };
  }
  return useMigrations(db, migrations);
}

export function useStudio() {
  if (isWeb) return;
  return useDrizzleStudio(expoDb!);
}
