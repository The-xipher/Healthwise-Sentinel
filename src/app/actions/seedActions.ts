
'use server';

import { seedDatabase } from '@/lib/seed-db';

export async function seedDatabaseAction(): Promise<{ success: boolean; message: string; error?: string }> {
  console.log('Seed database action initiated...');
  try {
    const result = await seedDatabase();
    if (result.success) {
      console.log('Seed database action successful:', result.message);
      return { success: true, message: result.message };
    } else {
      console.error('Seed database action failed:', result.message, result.error);
      return { success: false, message: result.message, error: result.error };
    }
  } catch (error: any) {
    console.error('Exception in seed database action:', error);
    return {
      success: false,
      message: 'An unexpected error occurred during seeding.',
      error: error.message || String(error),
    };
  }
}
