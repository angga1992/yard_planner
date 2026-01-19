// ============================================
// FILE: app/api/yard/update-environment/route.ts
// ============================================
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

// --- CONFIG WAJIB ---
export const dynamic = 'force-dynamic';      // Wajib Dinamis
export const revalidate = 0;                 // Jangan di-cache
export const fetchCache = 'force-no-store';  // Jangan simpan fetch data
export const maxDuration = 60;               // Timeout (opsional, untuk Vercel/Serverless)
// --------------------

// GET: Dipanggil oleh Frontend
export async function GET() {
  try {
    const slots = await prisma.yardSlot.findMany({
      orderBy: [
        { yard: 'asc' },
        { block: 'asc' },
        { bay: 'asc' },
        { row: 'asc' },
        { tier: 'asc' }
      ]
    });

    return NextResponse.json({
      success: true,
      count: slots.length,
      data: slots
    });
  } catch (error) {
    console.error('Error fetching environment:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch environment' },
      { status: 500 }
    );
  }
}

// POST: Manual Update
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // 1. Cari dulu (Find)
    const existingSlot = await prisma.yardSlot.findFirst({
        where: {
            yard: body.yard || 'Y1',
            block: body.block,
            bay: body.bay,
            row: body.row,
            tier: body.tier
        }
    });

    let result;

    if (existingSlot) {
        // 2. Update
        result = await prisma.yardSlot.update({
            where: { id: existingSlot.id },
            data: {
                container_id: body.container_id,
                is_import: body.is_import ?? existingSlot.is_import,
                is_export: body.is_export ?? existingSlot.is_export,
                is_reefer: body.is_reefer ?? existingSlot.is_reefer,
                is_hazard: body.is_hazard ?? existingSlot.is_hazard,
                is_dry: body.is_dry ?? existingSlot.is_dry,
                weight_kg: body.weight_kg ?? existingSlot.weight_kg,
                time: new Date()
            }
        });
    } else {
        // 3. Create
        result = await prisma.yardSlot.create({
            data: {
                yard: body.yard || 'Y1',
                block: body.block,
                bay: body.bay,
                row: body.row,
                tier: body.tier,
                size_ft: body.size_ft || 40,
                container_id: body.container_id || null,
                
                // Default Values (0) untuk field mandatory
                is_import: body.is_import || 0,
                is_export: body.is_export || 0,
                is_reefer: body.is_reefer || 0,
                is_hazard: body.is_hazard || 0,
                is_dry: body.is_dry ?? 1,
                
                is_inter_transhipment: 0,
                is_intra_transhipment: 0,
                is_pick_up: 0,
                is_drop_off: 0,
                weight_kg: body.weight_kg || 0,
                
                time: new Date()
            }
        });
    }

    return NextResponse.json({ success: true, data: result });

  } catch (error) {
    console.error('Error updating environment:', error);
    return NextResponse.json(
      { success: false, error: 'Failed update', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}