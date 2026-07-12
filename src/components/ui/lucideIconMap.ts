import type { LucideIcon } from "lucide-react-native";
import {
  BarChart3,
  Calculator,
  Calendar,
  Car,
  Clock,
  Fuel,
  Home,
  Info,
  MoreHorizontal,
  ParkingSquare,
  Phone,
  Receipt,
  Settings,
  Shield,
  ShoppingBag,
  Target,
  Wrench,
} from "lucide-react-native";

// Every lucide icon reachable via string keys in StatCard / EmptyState.
// Named imports keep the rest of the ~1,500-icon lucide set out of the
// JS bundle (a `import * as LucideIcons` namespace import pins all of it).
export const lucideIconMap: Record<string, LucideIcon> = {
  BarChart3,
  Calculator,
  Calendar,
  Car,
  Clock,
  Fuel,
  Home,
  Info,
  MoreHorizontal,
  ParkingSquare,
  Phone,
  Receipt,
  Settings,
  Shield,
  ShoppingBag,
  Target,
  Wrench,
};
