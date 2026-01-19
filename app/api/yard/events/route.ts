// ============================================
// FILE: app/api/yard/events/route.ts
// ============================================
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const containerId = searchParams.get('container_id');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const where: any = {};
    if (status) where.status = status;
    if (containerId) where.container_id = containerId;

    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where,
        include: {
          simulation_results: true,
        },
        orderBy: {
          created_at: 'desc',
        },
        take: limit,
        skip: offset,
      }),
      prisma.event.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: events,
      pagination: {
        total,
        limit,
        offset,
        has_more: offset + limit < total,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to fetch events',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}