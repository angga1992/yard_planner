// ============================================
// FILE: app/api/yard/get-action/route.ts
// ============================================
import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { writeFile, readFile, mkdir } from 'fs/promises';
import path from 'path';
import prisma from '@/lib/db';
import { createAuditLog } from '@/lib/audit';

// --- INTERFACES ---
interface EventData {
  truck_id: string;
  container_id: string;
  is_import: number;
  is_export: number;
  is_inter_transhipment: number;
  is_intra_transhipment: number;
  weight_kg: number;
  size_ft: number;
  is_reefer: number;
  is_hazard: number;
  is_dry: number;
  is_pick_up: number;
  is_drop_off: number;
  time: string;
}

interface PreplanningData {
  container_id: string;
  yard: string;
  block: string;
  bay: number;
  row: number;
  tier: number;
  time: string;
}

interface RequestBody {
  event: EventData;
  preplanning?: PreplanningData;
}

// --- POST METHOD (TRIGGER SIMULATION) ---
export async function POST(request: NextRequest) {
  // Deklarasi variabel di luar try-catch agar bisa diakses di catch block
  let eventRecord: { 
    id: number; 
    status: string; 
    truck_id: string; 
    container_id: string; 
    time: Date; 
    // ... properti lain jika perlu
  } | null = null;
  
  try {
    const body: RequestBody = await request.json();
    const { event, preplanning } = body;

    // Validate event data
    if (!event || !event.truck_id || !event.container_id) {
      return NextResponse.json(
        { error: 'Missing required event fields: truck_id, container_id' },
        { status: 400 }
      );
    }

    // 1. Save event to database
    eventRecord = await prisma.event.create({
      data: {
        truck_id: event.truck_id,
        container_id: event.container_id,
        is_import: event.is_import,
        is_export: event.is_export,
        is_inter_transhipment: event.is_inter_transhipment,
        is_intra_transhipment: event.is_intra_transhipment,
        weight_kg: event.weight_kg,
        size_ft: event.size_ft,
        is_reefer: event.is_reefer,
        is_hazard: event.is_hazard,
        is_dry: event.is_dry,
        is_pick_up: event.is_pick_up,
        is_drop_off: event.is_drop_off,
        time: new Date(event.time),
        status: 'processing',
      },
    });

    // --- [FIX] TYPE GUARD PENTING ---
    // Kita pastikan eventRecord ada isinya sebelum lanjut.
    // Ini menghilangkan error 'possibly null' di baris-baris selanjutnya.
    if (!eventRecord) {
        throw new Error("Failed to create event record in database");
    }

    // 2. Save preplanning if provided
    if (preplanning) {
      await prisma.preplanning.create({
        data: {
          container_id: preplanning.container_id,
          yard: preplanning.yard,
          block: preplanning.block,
          bay: preplanning.bay,
          row: preplanning.row,
          tier: preplanning.tier,
          time: new Date(preplanning.time),
          status: 'active',
        },
      });
    }

    // 3. Prepare Data for Simulation Script
    // Ambil snapshot yard saat ini
    const yardSlots = await prisma.yardSlot.findMany();
    const yardStateJson = yardSlots.map(slot => ({
      yard: slot.yard,
      block: slot.block,
      bay: slot.bay,
      row: slot.row,
      tier: slot.tier,
      size_ft: slot.size_ft,
      container_id: slot.container_id,
      is_import: slot.is_import,
      is_export: slot.is_export,
      is_reefer: slot.is_reefer,
      time: slot.time.toISOString(),
    }));

    // 4. Create Temp Files
    // Kita simpan JSON input untuk script Python/TS
    const tempDir = path.join(process.cwd(), 'temp');
    try { await mkdir(tempDir, { recursive: true }); } catch (e) {}

    const planningStatePath = path.join(tempDir, `planning_state_${eventRecord.id}.json`);
    const eventPath = path.join(tempDir, `event_${eventRecord.id}.json`);
    
    await writeFile(planningStatePath, JSON.stringify(yardStateJson, null, 2));
    await writeFile(eventPath, JSON.stringify(event, null, 2));

    let preplanningPath;
    if (preplanning) {
      preplanningPath = path.join(tempDir, `preplanning_${eventRecord.id}.json`);
      await writeFile(preplanningPath, JSON.stringify(preplanning, null, 2));
    }

    // 5. EXECUTE TYPESCRIPT SIMULATION
    // Menggunakan 'tsx' untuk menjalankan script algoritma
    const scriptPath = path.join(process.cwd(), 'scripts', 'run_rl_des_inference_single.ts');
    
    const args = [
      'tsx', 
      scriptPath,
      '--event_json', eventPath,
      '--planning_state_json', planningStatePath
    ];

    if (preplanningPath) {
      args.push('--preplanning_json', preplanningPath);
    }

    // Deteksi OS (Windows pakai npx.cmd, Linux/Mac pakai npx)
    const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';

    console.log(`Executing: ${command} ${args.join(' ')}`); 

    const executionResult = await executeScript(command, args);

    // 6. Read Results
    // Script akan menghasilkan file output JSON
    const resultsPath = path.join(
      process.cwd(), 
      'ReinforcementLearningStrategyDES_DES_simulated_tasks.json'
    );
    
    let simulationResults;
    try {
      const resultsContent = await readFile(resultsPath, 'utf-8');
      simulationResults = JSON.parse(resultsContent);
    } catch (error) {
      console.error('Simulation script failed/no output:', executionResult.stderr);
      
      // Update DB jadi failed
      await prisma.event.update({
        where: { id: eventRecord.id },
        data: { status: 'failed' },
      });
      
      return NextResponse.json({ 
        error: 'Simulation failed or produced no output',
        script_log: executionResult.stderr 
      }, { status: 500 });
    }

    // 7. Save Results to Database
    // Simpan hasil "Action Plan" ke tabel SimulationResult
    const savedResults = await prisma.$transaction(
      simulationResults.map((simResult: any) =>
        prisma.simulationResult.create({
          data: {
            event_id: eventRecord!.id, // Aman menggunakan ! karena sudah dicek di atas
            event_time: new Date(simResult.event_time),
            start_time: simResult.start_time,
            end_time: simResult.end_time,
            container_id: simResult.container_id,
            move_type: simResult.move_type,
            from_sid: simResult.from_sid,
            from_tier: simResult.from_tier,
            to_sid: simResult.to_sid,
            to_tier: simResult.to_tier,
            distance_crane: simResult.distance_crane,
            crane_id: simResult.crane_id,
            from_truck_zone_id: simResult.from_truck_zone_id,
            to_truck_zone_id: simResult.to_truck_zone_id,
            truck_id: simResult.truck_id,
            distance_internal_truck: simResult.distance_internal_truck,
            distance_external_truck: simResult.distance_external_truck,
          },
        })
      )
    );

    // 8. Update Event Status -> Completed
    await prisma.event.update({
      where: { id: eventRecord.id },
      data: { status: 'completed' },
    });

    // Audit Log
    await createAuditLog('PROCESS_EVENT', 'event', eventRecord.id, { results: savedResults.length }, request);

    return NextResponse.json({
      success: true,
      event_id: eventRecord.id,
      results: simulationResults
    });

  } catch (error) {
    console.error('API Error:', error);
    // Jika eventRecord sempat dibuat tapi proses gagal di tengah jalan, tandai sebagai failed
    if (eventRecord) {
      await prisma.event.update({ where: { id: eventRecord.id }, data: { status: 'failed' } });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// --- GET METHOD (CHECK RESULT) ---
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const eventId = searchParams.get('event_id');
    const truckId = searchParams.get('truck_id');
    const containerId = searchParams.get('container_id');

    // 1. Validasi Input
    if (!eventId && !truckId && !containerId) {
      return NextResponse.json(
        { error: 'Please provide event_id, truck_id, or container_id' },
        { status: 400 }
      );
    }

    // 2. Build Query
    const whereClause: any = {};
    if (eventId) whereClause.id = parseInt(eventId);
    if (truckId) whereClause.truck_id = truckId;
    if (containerId) whereClause.container_id = containerId;

    // 3. Ambil Event + Hasil Simulasi
    const eventRecord = await prisma.event.findFirst({
      where: whereClause,
      include: {
        simulation_results: true,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    if (!eventRecord) {
      return NextResponse.json(
        { error: 'Event not found', details: 'No simulation record matches your query' },
        { status: 404 }
      );
    }

    // 4. Return Data
    return NextResponse.json({
      success: true,
      event_id: eventRecord.id,
      status: eventRecord.status,
      truck_id: eventRecord.truck_id,
      container_id: eventRecord.container_id,
      request_time: eventRecord.time,
      action_plan: eventRecord.simulation_results.length > 0 ? eventRecord.simulation_results[0] : null,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error fetching action:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch action', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

// --- HELPER FUNCTION: EXECUTE SCRIPT ---
function executeScript(command: string, args: string[]): Promise<{stdout: string, stderr: string}> {
  return new Promise((resolve, reject) => {
    // shell: true sangat penting agar command dikenali di Windows
    const process = spawn(command, args, { shell: true }); 
    
    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => stdout += data.toString());
    process.stderr.on('data', (data) => stderr += data.toString());

    process.on('close', (code) => {
      console.log('--- SCRIPT LOGS ---');
      console.log('STDOUT:', stdout);
      if (stderr) console.log('STDERR:', stderr);
      console.log('EXIT CODE:', code);
      console.log('-------------------');

      // Kita resolve object stdout/stderr apapun exit codenya
      // Error handling logic ada di pemanggil fungsi
      resolve({ stdout, stderr });
    });

    process.on('error', (err) => {
      console.error('SPAWN ERROR:', err);
      reject(err);
    });
  });
}