// ============================================
// FILE: app/api/yard/health/route.ts
// ============================================
import { NextResponse } from 'next/server';
import { access } from 'fs/promises';
import path from 'path';
import prisma from '@/lib/db';

export async function GET() {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {
      api: true,
      database: false,
      simulation_script: false, // Diganti namanya dari python_environment
      data_directory: false
    }
  };

  // Check 1: Database
  try {
    await prisma.$queryRaw`SELECT 1`;
    health.checks.database = true;
  } catch (error) {
    console.error('Database check failed:', error);
  }

  // Check 2: Simulation Script (TypeScript)
  // Sekarang mengecek file .ts bukan .py
  try {
    await access(path.join(process.cwd(), 'scripts', 'run_rl_des_inference_single.ts'));
    health.checks.simulation_script = true;
  } catch (error) {
    health.checks.simulation_script = false;
  }

  // Check 3: Temp Directory
  try {
    await access(path.join(process.cwd(), 'temp'));
    health.checks.data_directory = true;
  } catch (error) {
    // Jika temp belum ada, dianggap false, tapi nanti API akan membuatnya otomatis
    health.checks.data_directory = false; 
  }

  const allHealthy = Object.values(health.checks).every(check => check === true);
  // Note: Data directory boleh false saat awal karena akan dibuat otomatis
  const isCriticalHealthy = health.checks.database && health.checks.simulation_script;

  health.status = isCriticalHealthy ? 'healthy' : 'degraded';

  return NextResponse.json(health, { 
    status: isCriticalHealthy ? 200 : 503 
  });
}