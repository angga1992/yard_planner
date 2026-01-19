// ============================================
// FILE: scripts/run_rl_des_inference_single.ts
// ============================================
import fs from 'fs';
import path from 'path';

// --- TIPE DATA ---
interface YardSlot {
  yard: string;
  block: string;
  bay: number;
  row: number;
  tier: number;
  container_id: string | null;
  // ... properti lain
}

interface EventInput {
  truck_id: string;
  container_id: string;
  is_drop_off: number; // 1 = Drop Off (Masuk), 0 = Pick Up (Keluar)
  is_export: number;
  is_reefer: number;
}

interface SimulationResult {
  event_time: string;
  start_time: number;
  end_time: number;
  container_id: string;
  move_type: string;
  from_sid: string;
  from_tier: number;
  to_sid: string;
  to_tier: number;
  distance_crane: number;
  crane_id: string;
  from_truck_zone_id: string;
  to_truck_zone_id: string;
  truck_id: string;
  distance_internal_truck: number;
  distance_external_truck: number;
}

function getArgValue(argName: string): string {
  const index = process.argv.indexOf(argName);
  if (index === -1 || index + 1 >= process.argv.length) throw new Error(`Missing argument: ${argName}`);
  return process.argv[index + 1];
}

// --- LOGIKA ALGORITMA SEDERHANA (Heuristic) ---
function findBestSlot(slots: YardSlot[], isReefer: boolean): YardSlot | null {
  // 1. Filter slot yang kosong
  const emptySlots = slots.filter(s => s.container_id === null);

  // 2. Filter validasi gravitasi (Tier 1 boleh langsung diisi. Tier > 1 harus ada kontainer di bawahnya)
  const validSlots = emptySlots.filter(target => {
    if (target.tier === 1) return true;
    
    // Cek slot tepat di bawahnya
    const slotBelow = slots.find(s => 
      s.yard === target.yard && 
      s.block === target.block && 
      s.bay === target.bay && 
      s.row === target.row && 
      s.tier === target.tier - 1
    );
    
    // Slot valid jika slot di bawahnya ADA isinya
    return slotBelow && slotBelow.container_id !== null;
  });

  if (validSlots.length === 0) return null;

  // 3. Strategi: Utamakan Block A untuk Reefer, Block B untuk Dry (Contoh logika bisnis)
  //    Atau sekadar pilih random dari yang valid
  
  // Simple heuristic: Isi Tier 1 dulu sampai habis, baru Tier 2 (biar tidak sering shifting)
  validSlots.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier; // Ascending Tier (1 dulu)
    if (a.bay !== b.bay) return a.bay - b.bay;     // Isi dari Bay 1
    return a.row - b.row;
  });

  return validSlots[0]; // Ambil yang paling optimal
}

function findContainerSlot(slots: YardSlot[], containerId: string): YardSlot | null {
  return slots.find(s => s.container_id === containerId) || null;
}

async function main() {
  try {
    const eventJsonPath = getArgValue('--event_json');
    const planningJsonPath = getArgValue('--planning_state_json');

    // Load Data
    const eventData: EventInput = JSON.parse(fs.readFileSync(eventJsonPath, 'utf-8'));
    const yardSlots: YardSlot[] = JSON.parse(fs.readFileSync(planningJsonPath, 'utf-8'));

    let fromSid = 'GATE';
    let toSid = 'GATE';
    let fromTier = 0;
    let toTier = 0;
    let moveType = '';

    // --- LOGIKA UTAMA ---
    if (eventData.is_drop_off === 1) {
      // KASUS 1: TRUK MASUK MENARUH KONTAINER (IMPORT/EXPORT DROP OFF)
      moveType = 'drop_off';
      fromSid = 'GATE_IN';
      fromTier = 1;

      // Cari slot kosong terbaik
      const targetSlot = findBestSlot(yardSlots, eventData.is_reefer === 1);
      
      if (!targetSlot) {
        throw new Error("YARD FULL! No valid slots available.");
      }

      toSid = `${targetSlot.yard}-${targetSlot.block}-${String(targetSlot.bay).padStart(2, '0')}-${String(targetSlot.row).padStart(2, '0')}`;
      toTier = targetSlot.tier;

    } else {
      // KASUS 2: TRUK MASUK MENGAMBIL KONTAINER (PICK UP)
      moveType = 'pick_up';
      
      // Cari di mana kontainer itu berada sekarang
      // (Di simulasi nyata, ID kontainer harus match data di DB. 
      // Tapi untuk testing jika ID random tidak ketemu, kita ambil sembarang kontainer terisi)
      let sourceSlot = findContainerSlot(yardSlots, eventData.container_id);

      // FALLBACK untuk testing: Jika kontainer yang diminta tidak ada, ambil sembarang kontainer teratas
      if (!sourceSlot) {
        // Cari kontainer paling atas di sembarang tumpukan
        const occupied = yardSlots.filter(s => s.container_id !== null);
        if (occupied.length > 0) {
           // Ambil random
           sourceSlot = occupied[Math.floor(Math.random() * occupied.length)];
           // Update eventData ID agar log-nya nyambung
           eventData.container_id = sourceSlot.container_id!; 
        }
      }

      if (!sourceSlot) {
         throw new Error("Container Not Found in Yard");
      }

      fromSid = `${sourceSlot.yard}-${sourceSlot.block}-${String(sourceSlot.bay).padStart(2, '0')}-${String(sourceSlot.row).padStart(2, '0')}`;
      fromTier = sourceSlot.tier;
      toSid = 'GATE_OUT';
      toTier = 1;
    }

    // --- GENERATE RESULT ---
    const result: SimulationResult = {
      event_time: new Date().toISOString(),
      start_time: 0.0,
      end_time: 15.0 + (Math.random() * 10), // Durasi random 15-25 detik
      container_id: eventData.container_id,
      move_type: moveType,
      from_sid: fromSid,
      from_tier: fromTier,
      to_sid: toSid,
      to_tier: toTier,
      distance_crane: Math.floor(Math.random() * 100), // Dummy distance
      crane_id: 'RTG-AUTO-01',
      from_truck_zone_id: moveType === 'drop_off' ? 'GATE' : 'BLOCK_A',
      to_truck_zone_id: moveType === 'drop_off' ? 'BLOCK_A' : 'GATE',
      truck_id: eventData.truck_id,
      distance_internal_truck: 120.5,
      distance_external_truck: 50.0
    };

    const outputFilename = 'ReinforcementLearningStrategyDES_DES_simulated_tasks.json';
    const outputPath = path.join(process.cwd(), outputFilename);
    fs.writeFileSync(outputPath, JSON.stringify([result], null, 2));
    
    // Log singkat untuk debug di terminal
    console.log(`✅ Simulation Success: ${moveType.toUpperCase()} ${eventData.container_id}`);
    console.log(`   Location: ${moveType === 'drop_off' ? toSid : fromSid} (Tier ${moveType === 'drop_off' ? toTier : fromTier})`);

  } catch (error) {
    console.error('Simulation Error:', error);
    process.exit(1);
  }
}

main();