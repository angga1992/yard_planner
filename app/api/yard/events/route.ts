// ============================================
// FILE: app/api/yard/events/route.ts
// ============================================
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

// --- KONFIGURASI ANTI-BUILD ERROR ---
export const dynamic = 'force-dynamic';      // Wajib: Render saat runtime
export const revalidate = 0;                 // Wajib: Jangan cache data ini
export const fetchCache = 'force-no-store';  // Wajib: Selalu ambil data baru
// ------------------------------------

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '20');

    // Pastikan prisma terhubung
    if (!prisma) {
      throw new Error("Database client not initialized");
    }

    const events = await prisma.event.findMany({
      orderBy: { created_at: 'desc' },
      take: limit,
    });

    return NextResponse.json({
      success: true,
      count: events.length,
      data: events,
    });

  } catch (error) {
    console.error("Error fetching events:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch events',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}