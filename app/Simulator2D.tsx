// ============================================
// FILE: app/simulator/Simulator2D.tsx
// REALISTIC TRUCK MOVEMENT WITH PROPER ROADS
// ============================================
"use client";

import React, { useMemo, useState, useEffect } from "react";

// --- TIPE DATA ---
interface YardSlot {
  yard: string;
  block: string;
  bay: number;
  row: number;
  tier: number;
  container_id: string | null;
  is_import: number;
  is_export: number;
  is_reefer: number;
}

interface ActionPlan {
  move_type: string;
  to_sid: string;
  from_sid: string;
  truck_id: string;
  container_id: string;
  crane_id?: string;
}

// --- KONFIGURASI PETA (Pixel) ---
const SLOT_W = 28;
const SLOT_H = 44;
const GAP = 6;

const MAP_CONFIG = {
  BLOCK_A_X: 80,
  BLOCK_B_X: 520,
  BLOCK_Y: 80,
  BLOCK_WIDTH: 300, // Lebar total block
  
  // Jalan-jalan
  GATE_Y: 580,
  MAIN_ROAD_X: 400, // Jalan utama tengah
  MAIN_ROAD_WIDTH: 80,
  
  // Access road ke block (jalan horizontal di depan block)
  ACCESS_ROAD_Y: 480,
  ACCESS_ROAD_HEIGHT: 60,
};

// Posisi gate
const GATE_POSITIONS = {
  IN: { x: MAP_CONFIG.MAIN_ROAD_X - 100, y: MAP_CONFIG.GATE_Y },
  OUT: { x: MAP_CONFIG.MAIN_ROAD_X + 100, y: MAP_CONFIG.GATE_Y }
};

type AnimationStage = 
  | 'IDLE' 
  | 'LEAVING_GATE'
  | 'ON_MAIN_ROAD'
  | 'TURNING_TO_ACCESS'
  | 'ON_ACCESS_ROAD'
  | 'ARRIVING_SLOT'
  | 'CRANE_OPERATING'
  | 'LEAVING_SLOT'
  | 'RETURN_ACCESS'
  | 'RETURN_MAIN'
  | 'ENTERING_GATE';

export default function Simulator2D({ 
  slots, 
  activeAction 
}: { 
  slots: YardSlot[], 
  activeAction: ActionPlan | null 
}) {
  
  const [truckPos, setTruckPos] = useState(GATE_POSITIONS.IN);
  const [containerPos, setContainerPos] = useState({ x: 0, y: 0, visible: false });
  const [animationStage, setAnimationStage] = useState<AnimationStage>('IDLE');
  const [cranePos, setCranePos] = useState({ x: 0, y: 0, visible: false });
  const [rotation, setRotation] = useState(0); // Rotasi truk

  // --- FUNGSI KOORDINAT SLOT ---
  const getSlotCoordinates = (sid: string | undefined) => {
    if (!sid || sid === 'GATE_IN' || sid === 'GATE_OUT' || sid === 'GATE') 
      return GATE_POSITIONS.IN;

    const parts = sid.split('-');
    if (parts.length < 4) return GATE_POSITIONS.IN;

    const block = parts[1];
    const bay = parseInt(parts[2]);
    const row = parseInt(parts[3]);

    const startX = block === 'A' ? MAP_CONFIG.BLOCK_A_X : MAP_CONFIG.BLOCK_B_X;
    const x = startX + ((bay - 1) * (SLOT_W + GAP));

    const maxRow = 6;
    const y = MAP_CONFIG.BLOCK_Y + ((maxRow - row) * (SLOT_H + GAP));

    return { x, y };
  };

  // --- ANIMATION SEQUENCE dengan JALAN ---
  useEffect(() => {
    if (!activeAction) {
      setAnimationStage('IDLE');
      setTruckPos(GATE_POSITIONS.IN);
      setRotation(0);
      setContainerPos({ x: 0, y: 0, visible: false });
      setCranePos({ x: 0, y: 0, visible: false });
      return;
    }

    const isDropOff = activeAction.move_type === 'drop_off';
    const targetSID = isDropOff ? activeAction.to_sid : activeAction.from_sid;
    const slotCoords = getSlotCoordinates(targetSID);
    
    // Tentukan jalan akses berdasarkan block
    const isBlockA = targetSID.includes('-A-');
    const accessRoadX = isBlockA ? slotCoords.x : slotCoords.x;

    let timer = 0;

    // === PERJALANAN KE SLOT ===
    
    // 1. Keluar dari gate ke main road
    setTimeout(() => {
      setAnimationStage('LEAVING_GATE');
      setRotation(0); // Hadap atas
      setTruckPos({ 
        x: GATE_POSITIONS.IN.x, 
        y: MAP_CONFIG.ACCESS_ROAD_Y + MAP_CONFIG.ACCESS_ROAD_HEIGHT 
      });
    }, timer += 0);

    // 2. Di main road (jalan utama)
    setTimeout(() => {
      setAnimationStage('ON_MAIN_ROAD');
      setTruckPos({ 
        x: MAP_CONFIG.MAIN_ROAD_X, 
        y: MAP_CONFIG.ACCESS_ROAD_Y + MAP_CONFIG.ACCESS_ROAD_HEIGHT 
      });
    }, timer += 1000);

    // 3. Naik ke access road level
    setTimeout(() => {
      setAnimationStage('TURNING_TO_ACCESS');
      setTruckPos({ 
        x: MAP_CONFIG.MAIN_ROAD_X, 
        y: MAP_CONFIG.ACCESS_ROAD_Y + 10
      });
    }, timer += 1200);

    // 4. Belok ke arah block (kiri atau kanan)
    setTimeout(() => {
      setAnimationStage('ON_ACCESS_ROAD');
      setRotation(isBlockA ? -90 : 90); // Belok kiri/kanan
      setTruckPos({ 
        x: accessRoadX, 
        y: MAP_CONFIG.ACCESS_ROAD_Y + 10
      });
    }, timer += 1500);

    // 5. Maju ke depan slot
    setTimeout(() => {
      setAnimationStage('ARRIVING_SLOT');
      setRotation(0); // Hadap atas lagi
      setTruckPos({ 
        x: slotCoords.x, 
        y: slotCoords.y + SLOT_H + 20
      });
    }, timer += 1500);

    // === CRANE OPERATION ===
    setTimeout(() => {
      setAnimationStage('CRANE_OPERATING');
      setCranePos({ x: slotCoords.x, y: slotCoords.y, visible: true });

      if (isDropOff) {
        // Container turun dari truk ke slot
        setContainerPos({ 
          x: slotCoords.x, 
          y: slotCoords.y + SLOT_H + 20, 
          visible: true 
        });

        setTimeout(() => {
          setContainerPos({ 
            x: slotCoords.x, 
            y: slotCoords.y, 
            visible: true 
          });
        }, 600);

        setTimeout(() => {
          setContainerPos({ x: 0, y: 0, visible: false });
        }, 1800);

      } else {
        // Container naik dari slot ke truk
        setContainerPos({ 
          x: slotCoords.x, 
          y: slotCoords.y,
          visible: true 
        });

        setTimeout(() => {
          setContainerPos({ 
            x: slotCoords.x, 
            y: slotCoords.y + SLOT_H + 20, 
            visible: true 
          });
        }, 600);
      }
    }, timer += 1000);

    // === PERJALANAN KEMBALI ===
    timer += 2500;

    // 6. Mundur dari slot
    setTimeout(() => {
      setAnimationStage('LEAVING_SLOT');
      setCranePos({ x: 0, y: 0, visible: false });
      setTruckPos({ 
        x: slotCoords.x, 
        y: MAP_CONFIG.ACCESS_ROAD_Y + 10
      });
    }, timer += 0);

    // 7. Balik ke main road
    setTimeout(() => {
      setAnimationStage('RETURN_ACCESS');
      setRotation(isBlockA ? 90 : -90);
      setTruckPos({ 
        x: MAP_CONFIG.MAIN_ROAD_X, 
        y: MAP_CONFIG.ACCESS_ROAD_Y + 10
      });
    }, timer += 1500);

    // 8. Turun ke gate level
    setTimeout(() => {
      setAnimationStage('RETURN_MAIN');
      setRotation(180); // Hadap bawah
      setTruckPos({ 
        x: MAP_CONFIG.MAIN_ROAD_X, 
        y: MAP_CONFIG.ACCESS_ROAD_Y + MAP_CONFIG.ACCESS_ROAD_HEIGHT 
      });
    }, timer += 1200);

    // 9. Masuk gate out
    setTimeout(() => {
      setAnimationStage('ENTERING_GATE');
      setTruckPos(GATE_POSITIONS.OUT);
    }, timer += 1000);

    // 10. Complete
    setTimeout(() => {
      setAnimationStage('IDLE');
      setContainerPos({ x: 0, y: 0, visible: false });
      setRotation(0);
    }, timer += 500);

  }, [activeAction]);

  const blockASlots = useMemo(() => slots.filter(s => s.block === 'A'), [slots]);
  const blockBSlots = useMemo(() => slots.filter(s => s.block === 'B'), [slots]);

  return (
    <div className="w-full h-[700px] bg-gradient-to-b from-slate-900 to-slate-800 rounded-xl overflow-hidden relative shadow-2xl border border-slate-700">
      
      {/* === JALAN-JALAN === */}
      
      {/* Gate Area (Bawah) */}
      <div 
        className="absolute w-full bg-slate-950 border-t-4 border-yellow-500/30"
        style={{ 
          top: MAP_CONFIG.GATE_Y - 10, 
          height: 130 
        }}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-slate-700 font-black text-6xl tracking-widest opacity-20">GATE</div>
        </div>
        
        {/* Gate In */}
        <div 
          className="absolute bg-green-900/30 border-2 border-green-500 rounded"
          style={{ 
            left: GATE_POSITIONS.IN.x - 40, 
            top: 20,
            width: 80,
            height: 90
          }}
        >
          <div className="text-green-400 text-xs font-bold text-center mt-1">GATE IN</div>
        </div>

        {/* Gate Out */}
        <div 
          className="absolute bg-red-900/30 border-2 border-red-500 rounded"
          style={{ 
            left: GATE_POSITIONS.OUT.x - 40, 
            top: 20,
            width: 80,
            height: 90
          }}
        >
          <div className="text-red-400 text-xs font-bold text-center mt-1">GATE OUT</div>
        </div>
      </div>

      {/* Main Road (Vertikal Tengah) */}
      <div 
        className="absolute bg-slate-700/50 border-x-4 border-yellow-400/20"
        style={{ 
          left: MAP_CONFIG.MAIN_ROAD_X - MAP_CONFIG.MAIN_ROAD_WIDTH / 2 + 70,
          top: 0,
          bottom: 120,
          width: MAP_CONFIG.MAIN_ROAD_WIDTH
        }}
      >
        {/* Road markings */}
        <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-1 border-l-4 border-dashed border-yellow-500/30"></div>
      </div>

      {/* Access Road (Horizontal) */}
      <div 
        className="absolute bg-slate-700/50 border-y-4 border-yellow-400/20"
        style={{ 
          left: 0,
          right: 0,
          top: MAP_CONFIG.ACCESS_ROAD_Y,
          height: MAP_CONFIG.ACCESS_ROAD_HEIGHT
        }}
      >
        {/* Road markings */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1 border-t-4 border-dashed border-yellow-500/30"></div>
      </div>

      {/* Block Labels dengan Background */}
      <div 
        className="absolute bg-slate-800/80 border-2 border-slate-600 rounded-lg px-4 py-2"
        style={{ left: MAP_CONFIG.BLOCK_A_X, top: 20 }}
      >
        <div className="text-cyan-400 font-black text-2xl">BLOCK A</div>
      </div>
      <div 
        className="absolute bg-slate-800/80 border-2 border-slate-600 rounded-lg px-4 py-2"
        style={{ left: MAP_CONFIG.BLOCK_B_X, top: 20 }}
      >
        <div className="text-cyan-400 font-black text-2xl">BLOCK B</div>
      </div>

      {/* === SLOTS === */}
      <BlockRenderer 
        slots={blockASlots} 
        startX={MAP_CONFIG.BLOCK_A_X} 
        startY={MAP_CONFIG.BLOCK_Y} 
        label="A" 
        activeTarget={activeAction?.to_sid || activeAction?.from_sid} 
      />
      <BlockRenderer 
        slots={blockBSlots} 
        startX={MAP_CONFIG.BLOCK_B_X} 
        startY={MAP_CONFIG.BLOCK_Y} 
        label="B" 
        activeTarget={activeAction?.to_sid || activeAction?.from_sid} 
      />

      {/* === CRANE === */}
      {cranePos.visible && (
        <div 
          className="absolute z-30 transition-all duration-500"
          style={{ left: cranePos.x - 35, top: cranePos.y - 90 }}
        >
          <div className="relative">
            <div className="w-20 h-24 border-4 border-yellow-500 bg-gradient-to-b from-yellow-600/30 to-yellow-800/30 rounded-t-lg flex flex-col items-center justify-end backdrop-blur">
              <div className="w-2 h-16 bg-yellow-400 animate-pulse shadow-lg"></div>
              <div className="text-[10px] text-yellow-300 font-bold bg-slate-900/70 px-2 py-0.5 rounded mb-1">
                RTG CRANE
              </div>
            </div>
          </div>
        </div>
      )}

      {/* === CONTAINER FLOATING === */}
      {containerPos.visible && (
        <div 
          className="absolute z-40 transition-all duration-1000 ease-in-out"
          style={{ 
            left: containerPos.x - 10, 
            top: containerPos.y - 18,
          }}
        >
          <div className="w-10 h-8 bg-gradient-to-br from-blue-500 to-blue-700 border-2 border-blue-300 rounded shadow-2xl flex items-center justify-center">
            <div className="text-[8px] text-white font-bold">
              {activeAction?.container_id.slice(-4)}
            </div>
          </div>
        </div>
      )}

      {/* === TRUCK === */}
      <div 
        className="absolute z-50 transition-all duration-1000 ease-in-out"
        style={{
          left: truckPos.x - 18,
          top: truckPos.y - 25,
          opacity: animationStage === 'IDLE' ? 0 : 1,
          transform: `rotate(${rotation}deg)`
        }}
      >
        <div className="relative">
          {/* Truck Body */}
          <div className="w-10 h-14 bg-gradient-to-b from-red-500 to-red-700 rounded-lg shadow-xl border-2 border-white/40 relative">
            {/* Cabin */}
            <div className="w-full h-5 bg-red-900 absolute bottom-0 rounded-b-lg border-t-2 border-red-950"></div>
            
            {/* Windshield */}
            <div className="w-6 h-3 bg-cyan-300/50 absolute bottom-5 left-1/2 -translate-x-1/2 rounded-t"></div>
            
            {/* Container on Truck */}
            {activeAction?.move_type === 'pick_up' && 
             !['LEAVING_GATE', 'ON_MAIN_ROAD', 'TURNING_TO_ACCESS', 'ON_ACCESS_ROAD', 'ARRIVING_SLOT', 'CRANE_OPERATING'].includes(animationStage) && (
              <div className="absolute top-1 left-1 right-1 h-7 bg-gradient-to-br from-blue-500 to-blue-700 border border-blue-300 rounded-sm"></div>
            )}
            
            {activeAction?.move_type === 'drop_off' && 
             ['LEAVING_GATE', 'ON_MAIN_ROAD', 'TURNING_TO_ACCESS', 'ON_ACCESS_ROAD', 'ARRIVING_SLOT'].includes(animationStage) && (
              <div className="absolute top-1 left-1 right-1 h-7 bg-gradient-to-br from-blue-500 to-blue-700 border border-blue-300 rounded-sm"></div>
            )}
          </div>

          {/* Truck Label */}
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-black/90 text-white text-[9px] px-2 py-1 rounded-full border border-cyan-400/50 shadow-lg">
            🚛 {activeAction?.truck_id}
          </div>
        </div>
      </div>

      {/* === LEGEND === */}
      <div className="absolute top-4 right-4 bg-slate-900/95 backdrop-blur px-4 py-3 rounded-xl border-2 border-slate-600 shadow-xl">
        <div className="text-[10px] text-slate-400 font-bold mb-2">CONTAINER TYPES</div>
        <div className="space-y-1.5 text-[9px]">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-500 rounded border border-blue-300"></div> 
            <span className="text-white">Import</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-emerald-500 rounded border border-emerald-300"></div> 
            <span className="text-white">Export</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-purple-500 rounded border border-purple-300"></div> 
            <span className="text-white">Reefer</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-slate-700 rounded border border-slate-500"></div> 
            <span className="text-white">Empty</span>
          </div>
        </div>
      </div>

      {/* === STATUS PANEL === */}
      <div className="absolute bottom-4 left-4 bg-slate-900/95 backdrop-blur px-4 py-3 rounded-xl border-2 border-slate-600 shadow-xl min-w-[250px]">
        <div className="text-[10px] text-slate-400 font-bold mb-2">OPERATION STATUS</div>
        <div className="space-y-1 text-[9px]">
          <div className={`flex items-center gap-2 ${animationStage.includes('LEAVING_GATE') || animationStage.includes('ON_MAIN_ROAD') ? 'text-yellow-400 font-bold' : 'text-slate-500'}`}>
            <div className="w-2 h-2 rounded-full bg-current"></div>
            <span>1. Exit Gate → Main Road</span>
          </div>
          <div className={`flex items-center gap-2 ${animationStage.includes('ACCESS') || animationStage.includes('ARRIVING') ? 'text-yellow-400 font-bold' : 'text-slate-500'}`}>
            <div className="w-2 h-2 rounded-full bg-current"></div>
            <span>2. Access Road → Slot</span>
          </div>
          <div className={`flex items-center gap-2 ${animationStage === 'CRANE_OPERATING' ? 'text-yellow-400 font-bold' : 'text-slate-500'}`}>
            <div className="w-2 h-2 rounded-full bg-current"></div>
            <span>3. Crane Operation</span>
          </div>
          <div className={`flex items-center gap-2 ${animationStage.includes('RETURN') || animationStage.includes('ENTERING') ? 'text-yellow-400 font-bold' : 'text-slate-500'}`}>
            <div className="w-2 h-2 rounded-full bg-current"></div>
            <span>4. Return to Gate</span>
          </div>
        </div>
      </div>

    </div>
  );
}

// === BLOCK RENDERER ===
function BlockRenderer({ slots, startX, startY, label, activeTarget }: any) {
    const maxRow = 6;
    const grid = [];
    
    for (let bay = 1; bay <= 10; bay++) {
        for (let row = 1; row <= maxRow; row++) {
            const stack = slots.filter((s: any) => s.bay === bay && s.row === row);
            const topSlot = stack.sort((a: any, b: any) => b.tier - a.tier)[0];
            
            const x = startX + ((bay - 1) * (SLOT_W + GAP));
            const y = startY + ((maxRow - row) * (SLOT_H + GAP));
            
            const isTarget = activeTarget === `Y1-${label}-${String(bay).padStart(2,'0')}-${String(row).padStart(2,'0')}`;

            grid.push(
                <div 
                    key={`${bay}-${row}`}
                    className={`absolute rounded border-2 transition-all duration-300 flex items-center justify-center
                        ${isTarget ? 'z-40 ring-4 ring-yellow-400 ring-offset-4 ring-offset-slate-800 scale-110 shadow-2xl' : 'shadow-lg'}
                    `}
                    style={{
                        left: x,
                        top: y,
                        width: SLOT_W,
                        height: SLOT_H,
                        backgroundColor: getSlotColorBg(topSlot),
                        borderColor: getSlotColorBorder(topSlot)
                    }}
                    title={`${label}${bay}-${row}: ${topSlot?.container_id || 'Empty'}`}
                >
                    {topSlot && topSlot.container_id && (
                        <div className="text-center">
                          <div className="text-[10px] font-bold text-white/90">{topSlot.tier}</div>
                        </div>
                    )}
                </div>
            );
        }
    }

    return <>{grid}</>;
}

function getSlotColorBg(slot: YardSlot | undefined) {
    if (!slot || !slot.container_id) return '#1e293b';
    if (slot.is_import) return '#3b82f6';
    if (slot.is_export) return '#10b981';
    if (slot.is_reefer) return '#a855f7';
    return '#f97316';
}

function getSlotColorBorder(slot: YardSlot | undefined) {
    if (!slot || !slot.container_id) return '#475569';
    if (slot.is_import) return '#1d4ed8'; 
    if (slot.is_export) return '#047857'; 
    if (slot.is_reefer) return '#7e22ce'; 
    return '#c2410c'; 
}