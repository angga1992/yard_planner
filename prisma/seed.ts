// ============================================
// FILE: prisma/seed.ts
// ============================================
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Helper: Generate ID Kontainer Acak (misal: MSCU123456)
function generateContainerId(prefix: string) {
  const num = Math.floor(100000 + Math.random() * 900000);
  return `${prefix}${num}`;
}

async function main() {
  console.log('🧹 Membersihkan database...');
  // Hapus data lama agar bersih
  await prisma.simulationResult.deleteMany();
  await prisma.event.deleteMany();
  await prisma.yardSlot.deleteMany();

  console.log('🌱 Menanam Data Existing (Scenario: 65% Occupancy)...');

  const yardSlots = [];
  const blocks = ['A', 'B']; 
  const maxBay = 5;  // Sesuai visual frontend Anda
  const maxRow = 4;  // Sesuai visual frontend Anda
  const maxTier = 4; // Tinggi tumpukan maksimal

  for (const block of blocks) {
    for (let bay = 1; bay <= maxBay; bay++) {
      for (let row = 1; row <= maxRow; row++) {
        
        // Tentukan tinggi tumpukan di titik ini secara acak
        // 30% Kosong, sisanya terisi 1 s/d 4 tumpuk
        let stackHeight = 0;
        if (Math.random() > 0.3) {
           stackHeight = Math.floor(Math.random() * maxTier) + 1;
        }

        for (let tier = 1; tier <= maxTier; tier++) {
          const isOccupied = tier <= stackHeight;
          
          let containerData = null;
          
          if (isOccupied) {
            // Logika Jenis Kontainer:
            // Block A dominan Import (Biru), Block B dominan Export (Hijau)
            // Ada kemungkinan kecil Reefer (Ungu)
            
            const isReefer = Math.random() > 0.9; // 10% Reefer
            let isImport = 0, isExport = 0;

            if (block === 'A') {
                isImport = Math.random() > 0.2 ? 1 : 0; // 80% Import
                isExport = isImport ? 0 : 1;
            } else {
                isExport = Math.random() > 0.2 ? 1 : 0; // 80% Export
                isImport = isExport ? 0 : 1;
            }

            containerData = {
              id: isReefer ? generateContainerId('REF') : (isImport ? generateContainerId('IMP') : generateContainerId('EXP')),
              is_import: isImport,
              is_export: isExport,
              is_reefer: isReefer ? 1 : 0,
              weight: 20000 + Math.floor(Math.random() * 10000)
            };
          }

          yardSlots.push({
            yard: 'Y1',
            block: block,
            bay: bay,
            row: row,
            tier: tier,
            size_ft: 40,
            
            // Data Kontainer
            container_id: containerData ? containerData.id : null,
            is_import: containerData ? containerData.is_import : 0,
            is_export: containerData ? containerData.is_export : 0,
            is_reefer: containerData ? containerData.is_reefer : 0,
            weight_kg: containerData ? containerData.weight : 0,
            
            // Default values
            is_inter_transhipment: 0,
            is_intra_transhipment: 0,
            is_hazard: 0,
            is_dry: containerData && !containerData.is_reefer ? 1 : 1,
            is_pick_up: 0,
            is_drop_off: 0,
            time: new Date(),
          });
        }
      }
    }
  }

  // Insert ke Database
  await prisma.yardSlot.createMany({
    data: yardSlots,
    skipDuplicates: true,
  });

  console.log(`✅ Berhasil membuat ${yardSlots.length} slot.`);
  console.log(`📦 Jumlah Kontainer: ${yardSlots.filter(s => s.container_id).length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });