import React from 'react';
import {
  Shield,
  RefreshCw,
  Sparkles,
  Syringe,
  CloudFog,
  EyeOff,
  ScanSearch,
  Wrench,
} from 'lucide-react';
import { ActiveBuffs, InventoryItem, ItemId } from '../types/game';
import { ITEM_CATALOG, MAX_INVENTORY_SLOTS } from '../data/items';

interface ItemBarProps {
  inventory: InventoryItem[];
  buffs: ActiveBuffs;
  disabled: boolean;
  onUseItem: (uid: string) => void;
}

export function renderItemIcon(itemId: ItemId, size = 18) {
  switch (itemId) {
    case 'kevlar':
      return <Shield size={size} className="text-blue-400" />;
    case 'ricochet':
      return <RefreshCw size={size} className="text-purple-400" />;
    case 'charm':
      return <Sparkles size={size} className="text-amber-400" />;
    case 'adrenaline':
      return <Syringe size={size} className="text-emerald-400" />;
    case 'smoke':
      return <CloudFog size={size} className="text-slate-300" />;
    case 'visor':
      return <EyeOff size={size} className="text-cyan-400" />;
    case 'scanner':
      return <ScanSearch size={size} className="text-yellow-400" />;
    case 'ejector':
      return <Wrench size={size} className="text-orange-400" />;
  }
}

export const ItemBar: React.FC<ItemBarProps> = ({
  inventory,
  buffs,
  disabled,
  onUseItem,
}) => {
  const slots = Array.from({ length: MAX_INVENTORY_SLOTS }, (_, i) => inventory[i] || null);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex flex-wrap items-center justify-center gap-1.5 min-h-[26px]">
        {buffs.kevlar && (
          <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-blue-500/20 border border-blue-400/50 text-blue-200 flex items-center gap-1">
            <Shield size={12} /> เกราะเคฟลาร์พร้อมรับดาเมจ
          </span>
        )}
        {buffs.ricochet && (
          <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-purple-500/20 border border-purple-400/50 text-purple-200 flex items-center gap-1">
            <RefreshCw size={12} /> โล่สะท้อนกระสุนทำงาน
          </span>
        )}
        {buffs.charm && (
          <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-amber-500/20 border border-amber-400/50 text-amber-200 flex items-center gap-1">
            <Sparkles size={12} /> เครื่องรางกันตายติดตั้งแล้ว
          </span>
        )}
        {buffs.visor && (
          <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-cyan-500/20 border border-cyan-400/50 text-cyan-200 flex items-center gap-1">
            <EyeOff size={12} /> แว่นเบี่ยงวิถีทำงาน (นัดหน้าพลาดเป้า)
          </span>
        )}
      </div>

      <div className="grid grid-cols-4 gap-2.5 bg-zinc-950/85 border border-zinc-800/90 p-2.5 rounded-xl backdrop-blur-md shadow-2xl">
        {slots.map((slot, index) => {
          if (!slot) {
            return (
              <div
                key={`empty-${index}`}
                className="w-36 h-20 rounded-lg border border-dashed border-zinc-800 bg-zinc-900/40 flex flex-col items-center justify-center text-zinc-600 text-xs"
              >
                <span>ช่องว่าง {index + 1}</span>
                <span className="text-[10px] text-zinc-700">รอดชีวิตเพื่อสุ่มรับ</span>
              </div>
            );
          }

          const def = ITEM_CATALOG[slot.itemId];
          return (
            <button
              key={slot.uid}
              disabled={disabled}
              onClick={() => onUseItem(slot.uid)}
              title={def.description}
              className={`group relative w-36 h-20 rounded-lg border p-2 text-left transition-all flex flex-col justify-between ${
                disabled
                  ? 'border-zinc-800 bg-zinc-900/60 opacity-55 cursor-not-allowed'
                  : 'border-zinc-700 bg-zinc-900/90 hover:border-amber-400/80 hover:bg-zinc-800/95 hover:-translate-y-0.5 cursor-pointer shadow-lg'
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <div className="p-1.5 rounded-md bg-zinc-950/90 border border-zinc-800">
                  {renderItemIcon(slot.itemId, 16)}
                </div>
                <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 group-hover:bg-amber-500/20 group-hover:text-amber-300">
                  กดใช้
                </span>
              </div>
              <div>
                <div className="text-xs font-bold text-zinc-100 truncate">{def.nameTh}</div>
                <div className="text-[10px] text-zinc-400 line-clamp-1">{def.description}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
