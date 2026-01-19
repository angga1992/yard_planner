// ============================================
// FILE: app/api/yard/status/route.ts
// ============================================
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET() {
  try {
    // Get all containers
    const containers = await prisma.yardSlot.findMany({
      where: {
        container_id: {
          not: null,
        },
      },
    });

    const totalSlots = await prisma.yardSlot.count();
    const occupiedSlots = containers.length;

    const stats = {
      total_slots: totalSlots,
      occupied_slots: occupiedSlots,
      empty_slots: totalSlots - occupiedSlots,
      containers_by_type: {
        reefer: containers.filter(c => c.is_reefer === 1).length,
        hazard: containers.filter(c => c.is_hazard === 1).length,
        dry: containers.filter(c => c.is_dry === 1).length,
      },
      containers_by_size: {
        '20ft': containers.filter(c => c.size_ft === 20).length,
        '40ft': containers.filter(c => c.size_ft === 40).length,
      },
      containers_by_operation: {
        import: containers.filter(c => c.is_import === 1).length,
        export: containers.filter(c => c.is_export === 1).length,
        inter_transhipment: containers.filter(c => c.is_inter_transhipment === 1).length,
        intra_transhipment: containers.filter(c => c.is_intra_transhipment === 1).length,
      },
    };

    // Get recent events
    const recentEvents = await prisma.event.findMany({
      take: 10,
      orderBy: {
        created_at: 'desc',
      },
      select: {
        id: true,
        container_id: true,
        truck_id: true,
        status: true,
        time: true,
        created_at: true,
      },
    });

    // Get event statistics
    const eventStats = await prisma.event.groupBy({
      by: ['status'],
      _count: {
        status: true,
      },
    });

    return NextResponse.json({
      success: true,
      status: 'operational',
      timestamp: new Date().toISOString(),
      statistics: stats,
      recent_events: recentEvents,
      event_statistics: eventStats.reduce((acc, stat) => {
        acc[stat.status] = stat._count.status;
        return acc;
      }, {} as Record<string, number>),
    });

  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to get status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}