// ============================================
// FILE: app/api/yard/update-environment/route.ts
// ============================================
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

// --- FIX PENTING ---
// Mencegah error saat npm run build
export const dynamic = 'force-dynamic';
// -------------------

// GET: Dipanggil oleh Frontend untuk menggambar Map
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

// POST: Dipanggil oleh Postman (Manual Update) atau Script
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validasi basic
    if (!body.block || !body.bay || !body.row || !body.tier) {
      return NextResponse.json(
        { error: 'Missing coordinates (block, bay, row, tier)' }, 
        { status: 400 }
      );
    }

    // LOGIKA PERBAIKAN: Find First -> Update / Create
    // Ini menggantikan upsert yang error tadi
    
    // 1. Cari apakah slot sudah ada?
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
        // 2. JIKA ADA: Update Data Slot Tersebut
        result = await prisma.yardSlot.update({
            where: { id: existingSlot.id },
            data: {
                container_id: body.container_id,
                // Gunakan value dari body, atau fallback ke existing jika undefined
                is_import: body.is_import !== undefined ? body.is_import : existingSlot.is_import,
                is_export: body.is_export !== undefined ? body.is_export : existingSlot.is_export,
                is_reefer: body.is_reefer !== undefined ? body.is_reefer : existingSlot.is_reefer,
                is_hazard: body.is_hazard !== undefined ? body.is_hazard : existingSlot.is_hazard,
                is_dry: body.is_dry !== undefined ? body.is_dry : existingSlot.is_dry,
                weight_kg: body.weight_kg !== undefined ? body.weight_kg : existingSlot.weight_kg,
                time: new Date()
            }
        });
    } else {
        // 3. JIKA TIDAK ADA: Create Baru (Isi SEMUA field wajib dengan default value 0)
        result = await prisma.yardSlot.create({
            data: {
                yard: body.yard || 'Y1',
                block: body.block,
                bay: body.bay,
                row: body.row,
                tier: body.tier,
                size_ft: body.size_ft || 40,
                
                container_id: body.container_id || null, // Boleh null
                
                // --- FIX: ISI SEMUA FIELD WAJIB DENGAN DEFAULT 0 ---
                is_import: body.is_import || 0,
                is_export: body.is_export || 0,
                is_reefer: body.is_reefer || 0,
                is_hazard: body.is_hazard || 0,
                is_dry: body.is_dry !== undefined ? body.is_dry : 1, // Default dry = 1
                
                // Field lain yang wajib di Prisma Schema tapi jarang dipakai
                is_inter_transhipment: 0,
                is_intra_transhipment: 0,
                is_pick_up: 0,
                is_drop_off: 0,
                weight_kg: body.weight_kg || 0,
                
                time: new Date()
            }
        });
    }

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Error updating environment:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update environment', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}