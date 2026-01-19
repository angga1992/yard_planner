// ============================================
// FILE: app/api/yard/status/route.ts
// ============================================
import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

// --- FIX PENTING ---
// Mencegah error saat npm run build
export const dynamic = 'force-dynamic';
// -------------------

export async function GET() {
  try {
    // 1. Hitung Slot
    const totalSlots = await prisma.yardSlot.count();
    const occupiedSlots = await prisma.yardSlot.count({
      where: {
        container_id: { not: null }
      }
    });

    // 2. Hitung Jenis Kontainer (Breakdown)
    const reeferCount = await prisma.yardSlot.count({
      where: { container_id: { not: null }, is_reefer: 1 }
    });
    
    const hazardCount = await prisma.yardSlot.count({
      where: { container_id: { not: null }, is_hazard: 1 }
    });

    // Dry adalah sisanya (Occupied - Reefer - Hazard)
    // Note: Logika ini bisa disesuaikan jika definisi dry di DB Anda berbeda
    const dryCount = await prisma.yardSlot.count({
        where: { 
            container_id: { not: null }, 
            is_reefer: 0, 
            is_hazard: 0 
        }
    });

    // 3. Ambil 5 Event Terakhir (untuk dashboard preview)
    const recentEvents = await prisma.event.findMany({
      take: 5,
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        truck_id: true,
        container_id: true,
        status: true,
        // move_type tidak ada di tabel event standard prisma schema kita sebelumnya,
        // tapi kita bisa infer dari is_pick_up / is_drop_off jika perlu.
        // Untuk sekarang kita ambil field yang pasti ada saja.
      }
    });

    // Format Data agar move_type muncul di frontend
    const formattedEvents = await Promise.all(recentEvents.map(async (e) => {
        // Kita perlu cek detailnya (is_pick_up/drop_off) jika tidak ada kolom move_type
        // Tapi untuk performa, kita kembalikan raw data dulu atau logic sederhana
        return {
            ...e,
            move_type: 'unknown' // Frontend bisa handle ini
        };
    }));

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      statistics: {
        total_slots: totalSlots,
        occupied_slots: occupiedSlots,
        utilization_rate: totalSlots > 0 ? (occupiedSlots / totalSlots * 100).toFixed(2) : 0,
        containers_by_type: {
          reefer: reeferCount,
          hazard: hazardCount,
          dry: dryCount
        }
      },
      recent_events: formattedEvents
    });

  } catch (error) {
    console.error('Error fetching status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch status' },
      { status: 500 }
    );
  }
}