// ============================================
// FILE: app/api/yard/health/route.ts
// ============================================
import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

// --- FIX PENTING ---
// Mencegah Next.js menjalankan health check saat build time
export const dynamic = 'force-dynamic';
// -------------------

export async function GET() {
  try {
    // Coba ping database sederhana
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({
      status: 'UP',
      database: 'Connected',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV
    });
  } catch (error) {
    console.error('Health Check Failed:', error);
    return NextResponse.json(
      { 
        status: 'DOWN', 
        database: 'Disconnected', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 503 } // Service Unavailable
    );
  }
}