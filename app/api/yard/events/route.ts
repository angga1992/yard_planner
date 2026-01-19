// ============================================
// FILE: app/api/yard/events/route.ts
// ============================================
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

// --- FIX PENTING ---
// Baris ini memberitahu Next.js: "Jangan jalankan ini saat Build Time!
// Jalankan hanya saat ada request asli dari user (Runtime)."
export const dynamic = 'force-dynamic'; 
// -------------------

export async function GET(request: NextRequest) {
  try {
    // Ambil parameter limit dari URL (default 20)
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '20');

    // Ambil data event dari database
    const events = await prisma.event.findMany({
      orderBy: {
        created_at: 'desc', // Urutkan dari yang terbaru
      },
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