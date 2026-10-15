import {
  ShoppingBasket, Utensils, Bus, ReceiptText, Sparkles, Shirt, HeartPulse, Clapperboard, Gift, Sofa, GraduationCap,
  Smartphone, Plane, PawPrint, Coffee, Wallet, Banknote, Briefcase, PiggyBank, TrendingUp, Undo2, Car, Fuel, Baby,
  Music, BookOpen, Dumbbell, Scissors, Pill, Gamepad2, Pizza, CakeSlice, Landmark, CreditCard, Tag, MoreHorizontal,
  Star, Heart, Flower2, Palette, Wrench, Bike, Wifi, Zap, Droplets, Flame, Phone, Home, Sun, Moon, Camera,
} from "lucide-react";

// Kategori/ödeme ikonları — kayıtlarda yalnızca ANAHTAR saklanır; böylece
// ikon kütüphanesi değişse bile veri bozulmaz.
export const ICONS = {
  basket: ShoppingBasket, utensils: Utensils, bus: Bus, receipt: ReceiptText, sparkles: Sparkles, shirt: Shirt,
  "heart-pulse": HeartPulse, clapperboard: Clapperboard, gift: Gift, sofa: Sofa, graduation: GraduationCap,
  smartphone: Smartphone, plane: Plane, paw: PawPrint, coffee: Coffee, wallet: Wallet, cash: Banknote,
  briefcase: Briefcase, piggy: PiggyBank, trending: TrendingUp, undo: Undo2, car: Car, fuel: Fuel, baby: Baby,
  music: Music, book: BookOpen, dumbbell: Dumbbell, scissors: Scissors, pill: Pill, gamepad: Gamepad2, pizza: Pizza,
  cake: CakeSlice, bank: Landmark, card: CreditCard, tag: Tag, dots: MoreHorizontal, star: Star, heart: Heart,
  flower: Flower2, palette: Palette, wrench: Wrench, bike: Bike, wifi: Wifi, zap: Zap, drop: Droplets, flame: Flame,
  phone: Phone, home: Home, sun: Sun, moon: Moon, camera: Camera,
};
export const ICON_KEYS = Object.keys(ICONS).filter((k) => !["sun", "moon", "camera"].includes(k));

// Renk ANAHTARLARI → kesem.css içindeki --kc-<anahtar> (açık/koyu temaya uyar).
export const COLOR_KEYS = ["rose", "coral", "amber", "lime", "mint", "teal", "sky", "blue", "indigo", "violet", "plum", "stone"];

export function Icon({ name, size = 20, strokeWidth = 2, ...rest }) {
  const C = ICONS[name] || Tag;
  return <C size={size} strokeWidth={strokeWidth} aria-hidden="true" {...rest} />;
}

// Renkli ikon baloncuğu (cam çip içinde veya listede).
export function Bubble({ icon, color = "stone", size = 40, className = "" }) {
  return (
    <span className={`k-bubble ${className}`} style={{ "--c": `var(--kc-${color})`, width: size, height: size }}>
      <Icon name={icon} size={Math.round(size * 0.5)} />
    </span>
  );
}
