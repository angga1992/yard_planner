// ============================================
// FILE: app/api/yard/update-environment/route.ts
// ============================================
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { createAuditLog } from '@/lib/audit';

interface YardSlotInput {
  yard: string;
  block: string;
  bay: number;
  row: number;
  tier: number;
  size_ft: number;
  container_id: string | null;
  is_import: number;
  is_export: number;
  is_inter_transhipment: number;
  is_intra_transhipment: number;
  weight_kg: number;
  is_reefer: number;
  is_hazard: number;
  is_dry: number;
  is_pick_up: number;
  is_drop_off: number;
  time: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const updates: YardSlotInput[] = Array.isArray(body) ? body : [body];

    // Validate input
    for (const slot of updates) {
      if (!slot.yard || !slot.block || 
          slot.bay === undefined || slot.row === undefined || slot.tier === undefined) {
        return NextResponse.json(
          { error: 'Missing required fields: yard, block, bay, row, tier' },
          { status: 400 }
        );
      }
    }

    let updatedCount = 0;
    let addedCount = 0;

    // Use transaction for batch updates
    await prisma.$transaction(async (tx) => {
      for (const update of updates) {
        const existingSlot = await tx.yardSlot.findUnique({
          where: {
            yard_block_bay_row_tier: {
              yard: update.yard,
              block: update.block,
              bay: update.bay,
              row: update.row,
              tier: update.tier,
            },
          },
        });

        if (existingSlot) {
          // Update existing slot
          await tx.yardSlot.update({
            where: { id: existingSlot.id },
            data: {
              size_ft: update.size_ft,
              container_id: update.container_id,
              is_import: update.is_import,
              is_export: update.is_export,
              is_inter_transhipment: update.is_inter_transhipment,
              is_intra_transhipment: update.is_intra_transhipment,
              weight_kg: update.weight_kg,
              is_reefer: update.is_reefer,
              is_hazard: update.is_hazard,
              is_dry: update.is_dry,
              is_pick_up: update.is_pick_up,
              is_drop_off: update.is_drop_off,
              time: new Date(update.time),
            },
          });
          updatedCount++;
        } else {
          // Create new slot
          await tx.yardSlot.create({
            data: {
              yard: update.yard,
              block: update.block,
              bay: update.bay,
              row: update.row,
              tier: update.tier,
              size_ft: update.size_ft,
              container_id: update.container_id,
              is_import: update.is_import,
              is_export: update.is_export,
              is_inter_transhipment: update.is_inter_transhipment,
              is_intra_transhipment: update.is_intra_transhipment,
              weight_kg: update.weight_kg,
              is_reefer: update.is_reefer,
              is_hazard: update.is_hazard,
              is_dry: update.is_dry,
              is_pick_up: update.is_pick_up,
              is_drop_off: update.is_drop_off,
              time: new Date(update.time),
            },
          });
          addedCount++;
        }
      }
    });

    // Audit log
    await createAuditLog(
      'UPDATE_ENVIRONMENT',
      'yard_slot',
      undefined,
      { updated: updatedCount, added: addedCount },
      request
    );

    const totalSlots = await prisma.yardSlot.count();

    return NextResponse.json({
      success: true,
      message: 'Environment updated successfully',
      updated_count: updatedCount,
      added_count: addedCount,
      total_slots: totalSlots,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error updating environment:', error);
    return NextResponse.json(
      { 
        error: 'Failed to update environment',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const yardSlots = await prisma.yardSlot.findMany({
      orderBy: [
        { yard: 'asc' },
        { block: 'asc' },
        { bay: 'asc' },
        { row: 'asc' },
        { tier: 'asc' },
      ],
    });

    return NextResponse.json({
      success: true,
      data: yardSlots,
      count: yardSlots.length,
    });
  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to read environment state',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}