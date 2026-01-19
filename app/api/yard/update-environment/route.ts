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

    // Upsert (Update jika ada, Create jika belum ada)
    const updatedSlot = await prisma.yardSlot.upsert({
      where: {
        // Asumsi kita punya unique constraint compound atau kita cari manual
        // Prisma butuh unique identifier untuk 'where' di upsert.
        // Jika schema Anda memakai ID auto-increment, upsert agak tricky tanpa ID.
        // Kita pakai findFirst + update/create logic manual agar aman.
        id: -1 // Dummy, kita akan override logic di bawah
      },
      update: {}, 
      create: { 
         yard: 'Y1', block: 'A', bay: 1, row: 1, tier: 1, size_ft: 40, is_dry: 1, time: new Date() 
      } 
    }).catch(async () => {
        // Fallback manual jika upsert ID error
        const existing = await prisma.yardSlot.findFirst({
            where: {
                yard: body.yard || 'Y1',
                block: body.block,
                bay: body.bay,
                row: body.row,
                tier: body.tier
            }
        });

        if (existing) {
            return prisma.yardSlot.update({
                where: { id: existing.id },
                data: {
                    container_id: body.container_id,
                    is_import: body.is_import,
                    is_export: body.is_export,
                    is_reefer: body.is_reefer,
                    weight_kg: body.weight_kg,
                    time: new Date()
                }
            });
        } else {
            return prisma.yardSlot.create({
                data: {
                    yard: body.yard || 'Y1',
                    block: body.block,
                    bay: body.bay,
                    row: body.row,
                    tier: body.tier,
                    size_ft: body.size_ft || 40,
                    container_id: body.container_id,
                    is_import: body.is_import,
                    is_export: body.is_export,
                    is_reefer: body.is_reefer,
                    weight_kg: body.weight_kg,
                    is_dry: 1,
                    is_hazard: 0,
                    is_inter_transhipment: 0,
                    is_intra_transhipment: 0,
                    is_pick_up: 0,
                    is_drop_off: 0,
                    time: new Date()
                }
            });
        }
    });

    return NextResponse.json({
      success: true,
      data: updatedSlot
    });

  } catch (error) {
    console.error('Error updating environment:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update environment' },
      { status: 500 }
    );
  }
}