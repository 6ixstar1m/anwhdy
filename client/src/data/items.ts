import { ItemDefinition, ItemId } from '../types/game';

export const MAX_HEARTS = 3;
export const MAX_INVENTORY_SLOTS = 4;

export const ITEM_CATALOG: Record<ItemId, ItemDefinition> = {
  kevlar: {
    id: 'kevlar',
    nameTh: 'แผ่นเกราะเคฟลาร์',
    nameEn: 'Kevlar Plate',
    category: 'defense',
    description: 'ป้องกันดาเมจจากกระสุนจริงได้ 1 นัดเต็ม ๆ (ดาเมจกลายเป็น 0 แล้วเกราะแตก)',
    color: '#3b82f6',
  },
  ricochet: {
    id: 'ricochet',
    nameTh: 'โล่สะท้อนกระสุน',
    nameEn: 'Ricochet Shield',
    category: 'defense',
    description: 'กางโล่ 1 เทิร์น หากคู่แข่งยิงกระสุนจริงใส่เรา กระสุนจะเด้งกลับไปลดหัวใจคนยิงแทน!',
    color: '#a855f7',
  },
  charm: {
    id: 'charm',
    nameTh: 'เครื่องรางกันตาย',
    nameEn: 'Last Stand Charm',
    category: 'defense',
    description: 'ติดตั้งติดตัว: หากโดนยิงจนหัวใจเหลือ 0 จะรอดตายหวุดหวิดและเหลือ 1 หัวใจทันที',
    color: '#f59e0b',
  },
  adrenaline: {
    id: 'adrenaline',
    nameTh: 'เข็มฉีดยาอะดรีนาลีน',
    nameEn: 'Adrenaline Shot',
    category: 'recovery',
    description: 'ฟื้นฟู +1 หัวใจ ทันที (สูงสุดไม่เกิน 3 หัวใจ)',
    color: '#10b981',
  },
  smoke: {
    id: 'smoke',
    nameTh: 'ระเบิดควัน',
    nameEn: 'Smoke Bomb',
    category: 'recovery',
    description: 'บังคับข้ามเทิร์นของคู่แข่ง 1 เทิร์นทันที คู่แข่งเสียสิทธิ์ยิงในรอบนั้น',
    color: '#94a3b8',
  },
  visor: {
    id: 'visor',
    nameTh: 'แว่นเบี่ยงวิถี',
    nameEn: 'Glitch Visor',
    category: 'recovery',
    description: 'ทำให้การยิงนัดถัดไปของคู่แข่งพลาดเป้าอัตโนมัติ 1 นัด (กระสุนถูกยิงทิ้งออกนอกเป้า)',
    color: '#06b6d4',
  },
  scanner: {
    id: 'scanner',
    nameTh: 'เครื่องสแกนรังเพลิง',
    nameEn: 'Chamber Scanner',
    category: 'tactical',
    description: 'แอบดูลูกกระสุนนัดปัจจุบันในรังเพลิงได้ทันทีว่าเป็น กระสุนจริง หรือ กระสุนเปล่า',
    color: '#eab308',
  },
  ejector: {
    id: 'ejector',
    nameTh: 'คีมดีดปลอกกระสุน',
    nameEn: 'Shell Ejector',
    category: 'tactical',
    description: 'เปิดโม่แล้วดีดกระสุนนัดปัจจุบันทิ้งออกจากปืนทันทีโดยไม่ต้องลั่นไก',
    color: '#f97316',
  },
};

export const ALL_ITEM_IDS: ItemId[] = Object.keys(ITEM_CATALOG) as ItemId[];

export function rollRandomDefensiveItem(): ItemId {
  const index = Math.floor(Math.random() * ALL_ITEM_IDS.length);
  return ALL_ITEM_IDS[index];
}
