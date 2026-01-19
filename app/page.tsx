// ============================================
// FILE: app/simulator/page.tsx
// ============================================
"use client";

import React, { useState, useEffect } from 'react';

// --- TIPE DATA ---
interface YardSlot {
  id: number;
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

interface EventData {
  id: number;
  truck_id: string;
  container_id: string;
  status: string;
  move_type?: string;
}

interface SimulationStats {
  total_slots: number;
  occupied_slots: number;
  containers_by_type: {
    reefer: number;
    hazard: number;
    dry: number;
  };
}

// Tipe untuk animasi pergerakan (Visual State)
interface ActiveMovement {
  id: number; // Unique ID dari Event Database
  truck_id: string;
  container_id: string;
  status: 'entering' | 'processing' | 'exiting';
  type: 'drop_off' | 'pick_up';
  targetBlock?: string;
  targetBay?: number;
  targetRow?: number;
}

export default function SimulatorPage() {
  const [slots, setSlots] = useState<YardSlot[]>([]);
  const [events, setEvents] = useState<EventData[]>([]);
  const [stats, setStats] = useState<SimulationStats | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [activeMovements, setActiveMovements] = useState<ActiveMovement[]>([]);

  // 1. POLLING DATA (Database Driven)
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [eventsRes, slotsRes, statusRes] = await Promise.all([
             fetch('/api/yard/events?limit=20'),
             fetch('/api/yard/update-environment'),
             fetch('/api/yard/status')
        ]);
        
        const eventsData = await eventsRes.json();
        const slotsData = await slotsRes.json();
        const statusData = await statusRes.json();

        if (eventsData.success) {
          setEvents(eventsData.data);
        }
        if (slotsData.success) {
          setSlots(slotsData.data);
        }
        if (statusData.success) {
          setStats(statusData.statistics);
        }
      } catch (error) {
        console.error("Gagal polling data:", error);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 1000); 
    return () => clearInterval(interval);
  }, []);

  // 2. LOGIC MAPPING (API Data -> Visual Animation)
  useEffect(() => {
    const movements: ActiveMovement[] = [];
    
    events.forEach(event => {
      if (event.status === 'pending') {
        movements.push({
          id: event.id, 
          truck_id: event.truck_id,
          container_id: event.container_id,
          status: 'entering',
          type: event.move_type === 'pick_up' ? 'pick_up' : 'drop_off',
        });
      } else if (event.status === 'processing') {
        const targetSlot = slots.find(s => s.container_id === event.container_id);
        movements.push({
          id: event.id,
          truck_id: event.truck_id,
          container_id: event.container_id,
          status: 'processing',
          type: event.move_type === 'pick_up' ? 'pick_up' : 'drop_off',
          targetBlock: targetSlot?.block,
          targetBay: targetSlot?.bay,
          targetRow: targetSlot?.row,
        });
      } else if (event.status === 'completed') {
         movements.push({
          id: event.id,
          truck_id: event.truck_id,
          container_id: event.container_id,
          status: 'exiting',
          type: event.move_type === 'pick_up' ? 'pick_up' : 'drop_off',
        });
      }
    });
    
    setActiveMovements(movements);
  }, [events, slots]);


  // 3. HANDLER TRIGGER MANUAL
  const handleSpawnTruck = async (type: 'drop_off' | 'pick_up') => {
    setIsSimulating(true);
    const truckId = `T-${Math.floor(Math.random() * 1000)}`;
    const containerId = type === 'drop_off' ? `CONT-${Math.floor(Math.random() * 9000)}` : `CONT-REQ-${Math.floor(Math.random() * 100)}`;
    
    try {
      await fetch('/api/yard/get-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: {
            truck_id: truckId,
            container_id: containerId,
            is_import: type === 'pick_up' ? 1 : 0, 
            is_export: type === 'drop_off' ? 1 : 0,
            is_inter_transhipment: 0,
            is_intra_transhipment: 0,
            weight_kg: 20000,
            size_ft: 40,
            is_reefer: Math.random() > 0.8 ? 1 : 0,
            is_hazard: 0,
            is_dry: 1,
            is_pick_up: type === 'pick_up' ? 1 : 0,
            is_drop_off: type === 'drop_off' ? 1 : 0,
            time: new Date().toISOString()
          }
        })
      });
    } catch (e) {
      alert("Gagal mengirim truk");
    } finally {
      setIsSimulating(false);
    }
  };

  const getBlockData = (blockName: string) => {
    return slots.filter(s => s.block === blockName);
  };

  const getSlotColor = (slot: YardSlot) => {
    if (!slot.container_id) return 'bg-slate-700 border-slate-600'; 
    if (slot.is_reefer) return 'bg-purple-500 border-purple-700 shadow-[0_0_10px_rgba(168,85,247,0.5)]';
    if (slot.is_import) return 'bg-blue-500 border-blue-700';
    if (slot.is_export) return 'bg-emerald-500 border-emerald-700';
    return 'bg-orange-500 border-orange-700';
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 font-mono selection:bg-cyan-500 selection:text-white">
      {/* CSS Animations */}
      <style>{`
        @keyframes truck-enter {
          0% { transform: translateX(-50px); opacity: 0; }
          100% { transform: translateX(0); opacity: 1; }
        }
        @keyframes truck-move {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(5px); }
        }
        @keyframes container-pulse {
          0%, 100% { box-shadow: 0 0 0 rgba(255,255,255,0); }
          50% { box-shadow: 0 0 10px rgba(255,255,255,0.5); }
        }
        @keyframes ship-float {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-4px) rotate(0.5deg); }
        }
        @keyframes wave-move {
          0% { transform: translateX(0); }
          100% { transform: translateX(-20px); }
        }
        
        .animate-truck-enter { animation: truck-enter 0.5s ease-out forwards; }
        .animate-truck-idle { animation: truck-move 2s ease-in-out infinite; }
        .animate-ship { animation: ship-float 6s ease-in-out infinite; }
        .animate-wave { animation: wave-move 3s linear infinite; }
        .container-glow { animation: container-pulse 2s infinite; }
        
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #1e293b; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #475569; border-radius: 3px; }
      `}</style>

      {/* HEADER */}
      <header className="flex justify-between items-end mb-8 border-b border-slate-700 pb-4">
        <div>
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <span className="text-2xl">🏗️</span>
             </div>
             <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">YARD OS <span className="text-cyan-400">PRO</span></h1>
                <p className="text-xs text-slate-400 font-medium">AI-POWERED TERMINAL OPERATING SYSTEM</p>
             </div>
          </div>
        </div>
        <div className="flex gap-6 text-right">
          <div className="bg-slate-800 px-4 py-2 rounded-lg border border-slate-700">
            <span className="block text-[10px] uppercase text-slate-500 font-bold tracking-wider">Yard Density</span>
            <div className="flex items-end justify-end gap-1">
               <span className="text-xl font-black text-white">{stats ? Math.round((stats.occupied_slots / stats.total_slots) * 100) : 0}</span>
               <span className="text-sm text-slate-400 mb-1">%</span>
            </div>
          </div>
          <div className="bg-slate-800 px-4 py-2 rounded-lg border border-slate-700">
            <span className="block text-[10px] uppercase text-slate-500 font-bold tracking-wider">Active Jobs</span>
            <div className="flex items-end justify-end gap-1">
               <span className={`text-xl font-black ${activeMovements.length > 0 ? 'text-orange-400 animate-pulse' : 'text-slate-400'}`}>
                  {activeMovements.length}
               </span>
            </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-6">
        
        {/* --- MAIN VISUALIZATION --- */}
        <div className="col-span-9 space-y-6">
          
          {/* 1. SEA SIDE / BERTH (Visual Only) */}
          <div className="bg-gradient-to-b from-slate-800 to-slate-900 rounded-xl border border-slate-700 overflow-hidden relative h-32 group">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5"></div>
            
            {/* Water Animation */}
            <div className="absolute bottom-0 w-full h-12 overflow-hidden opacity-30">
                <div className="flex w-[200%] animate-wave text-blue-400 text-4xl">
                   ~~~~~~~~~~~~~~~
                </div>
            </div>

            {/* Ship */}
            <div className="absolute left-1/2 -translate-x-1/2 top-6 animate-ship">
               <div className="w-96 h-16 bg-gradient-to-r from-slate-700 via-slate-600 to-slate-700 rounded-b-xl relative shadow-2xl border-t border-slate-500">
                  <div className="absolute bottom-full right-10 w-24 h-10 bg-slate-200 rounded-t-lg border-b-4 border-orange-500 flex items-center justify-center">
                     <div className="w-16 h-4 bg-slate-800 rounded-full opacity-50"></div>
                  </div>
                  <div className="absolute top-4 left-6 text-[10px] font-black tracking-[0.3em] text-white/30">MV. PRISMA VOYAGER</div>
                  <div className="absolute bottom-full left-10 flex gap-1">
                     <div className="w-8 h-8 bg-blue-600 rounded-sm"></div>
                     <div className="w-8 h-8 bg-green-600 rounded-sm"></div>
                     <div className="w-8 h-8 bg-red-600 rounded-sm"></div>
                  </div>
               </div>
            </div>
            
            {/* Quay Cranes */}
            <div className="absolute bottom-0 left-20 w-4 h-24 bg-yellow-600 -skew-x-6 border-r border-yellow-500 z-10"></div>
            <div className="absolute bottom-0 right-20 w-4 h-24 bg-yellow-600 skew-x-6 border-l border-yellow-500 z-10"></div>
            <div className="absolute top-2 left-2 px-2 py-1 bg-black/50 rounded text-[10px] font-bold text-blue-300 border border-blue-500/30">
               ⚓ SEA SIDE / BERTH
            </div>
          </div>

          {/* 2. YARD BLOCKS AREA (DYNAMIC RENDERING) */}
          {/* Ini akan otomatis mendeteksi semua Block yang ada di database (A, B, C, D, dst) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative">
            {Array.from(new Set(slots.map(s => s.block))).sort().map(blockName => (
              <YardBlockView 
                key={blockName}
                blockName={blockName} 
                slots={getBlockData(blockName)} 
                getSlotColor={getSlotColor} 
                activeMovements={activeMovements} 
              />
            ))}
          </div>

          {/* 3. GATE AREA */}
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 via-transparent to-red-500 opacity-50"></div>
            <div className="flex justify-between items-end">
               
               {/* IN GATE (Queue) */}
               <div className="relative z-10 pl-4">
                  <div className="text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">In Gate Queue</div>
                  <div className="flex gap-2 min-h-[40px] items-end">
                     {activeMovements.filter(m => m.status === 'entering').map((m, i) => (
                        <div key={m.id} className="animate-truck-enter relative group" style={{animationDelay: `${i*0.2}s`}}>
                           <div className="w-12 h-8 bg-emerald-700 rounded-md shadow-lg border border-emerald-500 flex items-center justify-center text-xs">
                              🚛
                           </div>
                           <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-black text-white text-[9px] px-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap transition-opacity">
                              {m.truck_id}
                           </div>
                        </div>
                     ))}
                     {activeMovements.filter(m => m.status === 'entering').length === 0 && (
                        <div className="text-[10px] text-slate-600 italic py-2">No trucks in queue</div>
                     )}
                  </div>
               </div>

               {/* ROAD MARKINGS */}
               <div className="flex-1 mx-8 border-b-2 border-dashed border-slate-600 h-8"></div>

               {/* OUT GATE */}
               <div className="relative z-10 pr-4 text-right">
                  <div className="text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Out Gate</div>
                  <div className="flex gap-2 justify-end min-h-[40px] items-end">
                     {activeMovements.filter(m => m.status === 'exiting').map((m) => (
                        <div key={m.id} className="animate-truck-enter">
                           <div className="w-12 h-8 bg-slate-600 rounded-md shadow-lg border border-slate-500 flex items-center justify-center opacity-50">
                              🚛
                           </div>
                        </div>
                     ))}
                  </div>
               </div>

            </div>
          </div>

        </div>

        {/* --- SIDEBAR CONTROLS --- */}
        <div className="col-span-3 flex flex-col gap-6">
          
          {/* Control Panel */}
          <div className="bg-slate-800 p-1 rounded-xl border border-slate-700 shadow-xl">
            <div className="bg-slate-900/50 p-4 rounded-lg">
                <h3 className="text-xs font-bold text-slate-400 mb-4 uppercase tracking-wider flex items-center gap-2">
                    🎮 Operations
                </h3>
                <div className="flex flex-col gap-3">
                <button 
                    onClick={() => handleSpawnTruck('drop_off')}
                    disabled={isSimulating}
                    className="group relative overflow-hidden bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white py-3 px-4 rounded-lg shadow-lg transition-all font-bold text-sm text-left"
                >
                    <div className="relative z-10 flex justify-between items-center">
                        <span>Import Container</span>
                        <span className="text-xl group-hover:translate-x-1 transition-transform">📥</span>
                    </div>
                </button>
                <button 
                    onClick={() => handleSpawnTruck('pick_up')}
                    disabled={isSimulating}
                    className="group relative overflow-hidden bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-3 px-4 rounded-lg shadow-lg transition-all font-bold text-sm text-left"
                >
                    <div className="relative z-10 flex justify-between items-center">
                        <span>Export Container</span>
                        <span className="text-xl group-hover:translate-x-1 transition-transform">📤</span>
                    </div>
                </button>
                </div>
            </div>
          </div>

          {/* Stats Detail */}
          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
            <h3 className="text-xs font-bold text-slate-500 mb-3 uppercase tracking-wider">Inventory Breakdown</h3>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center p-2 bg-slate-900/50 rounded">
                <span className="text-slate-400 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-purple-500"></div> Reefer</span>
                <span className="font-bold text-white">{stats?.containers_by_type.reefer || 0}</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-slate-900/50 rounded">
                <span className="text-slate-400 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-500"></div> Dry</span>
                <span className="font-bold text-white">{stats?.containers_by_type.dry || 0}</span>
              </div>
            </div>
          </div>

          {/* Activity Log */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 flex-1 overflow-hidden flex flex-col min-h-[300px]">
            <div className="p-4 border-b border-slate-700 bg-slate-800">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                📡 Live Feed
                {events.some(e => e.status === 'processing') && <span className="w-2 h-2 bg-red-500 rounded-full animate-ping"></span>}
                </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar bg-slate-900/30">
              {events.length === 0 && (
                <div className="text-center py-10 text-slate-600 text-xs">
                   Waiting for incoming stream...
                </div>
              )}
              {events.map((event) => (
                <div key={event.id} className="bg-slate-800 p-3 rounded border border-slate-700 text-xs hover:border-slate-500 transition-colors group">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-bold text-cyan-400 group-hover:text-cyan-300 transition-colors">{event.truck_id}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider ${
                      event.status === 'completed' ? 'bg-green-500/10 text-green-400 border border-green-500/30' :
                      event.status === 'processing' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30 animate-pulse' :
                      'bg-slate-700 text-slate-400'
                    }`}>{event.status}</span>
                  </div>
                  <div className="text-slate-400 font-mono text-[10px] flex items-center gap-1">
                     <span>📦</span> {event.container_id}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// --- SUB KOMPONEN: YARD BLOCK VIEW ---
function YardBlockView({ 
  blockName, 
  slots, 
  getSlotColor,
  activeMovements 
}: { 
  blockName: string;
  slots: YardSlot[];
  getSlotColor: (s: YardSlot) => string;
  activeMovements: ActiveMovement[];
}) {
  const maxBay = 5;
  const maxRow = 4;
  
  // Cek apakah ada truk yang sedang bekerja di block ini
  const activeOp = activeMovements.find(m => m.targetBlock === blockName && m.status === 'processing');

  // Hitung posisi crane (visual)
  const cranePosition = activeOp?.targetBay 
     ? (activeOp.targetBay - 1) * 20 
     : 0;

  return (
    <div className={`bg-slate-800 p-5 rounded-xl border-2 transition-all duration-500 relative ${
      activeOp ? 'border-yellow-500/50 shadow-[0_0_20px_rgba(234,179,8,0.1)]' : 'border-slate-700'
    }`}>
      
      {/* Label Block */}
      <div className="flex justify-between items-center mb-4">
        <h4 className="text-sm font-bold text-slate-300 flex items-center gap-2">
          <span className="w-2 h-6 bg-cyan-500 rounded-full"></span>
          BLOCK {blockName}
        </h4>
        {activeOp && (
            <span className="text-[9px] bg-yellow-500/20 text-yellow-300 px-2 py-1 rounded border border-yellow-500/30 animate-pulse flex items-center gap-1">
                ⚙️ CRANE ACTIVE
            </span>
        )}
      </div>

      {/* RTG Crane Rail */}
      <div className="absolute top-12 left-4 right-4 h-1 bg-slate-600 rounded-full opacity-30"></div>

      {/* RTG Crane (Visual) */}
      {activeOp && (
          <div 
             className="absolute top-10 w-1/5 h-full pointer-events-none z-20 transition-all duration-[2000ms] ease-in-out border-x-2 border-yellow-500/30 bg-yellow-500/5"
             style={{ left: `calc(1.25rem + ${cranePosition}%)` }} 
          >
             {/* Crane Head */}
             <div className="absolute top-0 w-full h-4 bg-yellow-500 rounded-sm shadow-lg flex items-center justify-center">
                <div className="w-1/2 h-1 bg-black/20 rounded-full"></div>
             </div>
             {/* Spreader */}
             <div className="absolute top-4 w-full flex justify-center animate-bounce">
                <div className="w-0.5 h-8 bg-black/50"></div>
                <div className="absolute top-8 w-3/4 h-1 bg-black/80"></div>
             </div>
          </div>
      )}

      {/* Grid Container */}
      <div className="grid grid-cols-5 gap-3 relative z-10"> 
        {Array.from({ length: maxBay }, (_, i) => i + 1).map(bay => (
          <div key={bay} className="flex flex-col gap-2">
             {Array.from({ length: maxRow }, (_, j) => j + 1).map(row => {
                const stackSlots = slots.filter(s => s.bay === bay && s.row === row).sort((a,b) => b.tier - a.tier);
                const topSlot = stackSlots.find(s => s.container_id) || stackSlots[0];
                
                if (!topSlot) return <div key={`${bay}-${row}`} className="h-10 bg-slate-900/50 rounded-md border border-slate-800"></div>;

                // Cek apakah slot ini target dari truk yang sedang aktif
                const isTarget = activeOp && activeOp.targetBay === bay && activeOp.targetRow === row;

                return (
                  <div 
                    key={`${bay}-${row}`}
                    className={`h-10 w-full rounded-md border relative group transition-all duration-300 overflow-hidden ${getSlotColor(topSlot)} ${
                        isTarget ? 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-slate-800 z-30 container-glow' : 'hover:scale-105 hover:z-20'
                    }`}
                  >
                    {/* Tooltip */}
                    <div className="opacity-0 group-hover:opacity-100 absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] p-2 rounded-lg border border-slate-600 shadow-2xl z-50 pointer-events-none w-max">
                      <div className="font-bold text-cyan-400">{topSlot.container_id || "Empty Slot"}</div>
                      <div className="text-slate-400">Bay {bay} • Row {row} • Tier {topSlot.tier}</div>
                    </div>
                    
                    {/* Visual Tumpukan */}
                    {topSlot.container_id && (
                        <>
                           <div className="absolute inset-0 flex flex-col justify-end opacity-30 pointer-events-none">
                              {Array.from({length: topSlot.tier - 1}).map((_, k) => (
                                 <div key={k} className="w-full border-t border-black/50 h-[25%]"></div>
                              ))}
                           </div>
                           <div className="absolute top-0.5 right-0.5 bg-black/40 text-[8px] text-white px-1 rounded-sm font-bold backdrop-blur-sm">
                              {topSlot.tier}
                           </div>
                        </>
                    )}

                    {!topSlot.container_id && (
                       <div className="w-full h-full flex items-center justify-center text-[8px] text-slate-500 opacity-0 group-hover:opacity-100">
                          EMPTY
                       </div>
                    )}
                  </div>
                )
             })}
             <span className="text-[8px] text-center text-slate-500 font-bold tracking-wider">BAY {bay}</span>
          </div>
        ))}
      </div>
    </div>
  )
}