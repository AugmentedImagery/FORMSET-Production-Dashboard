'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Overview', href: '/dashboard' },
  { name: 'Schedule', href: '/dashboard/schedule' },
  { name: 'Orders', href: '/dashboard/orders' },
  { name: 'Inventory', href: '/dashboard/inventory' },
  { name: 'Parts', href: '/dashboard/parts' },
  { name: 'Printers', href: '/dashboard/printers' },
  { name: 'Analytics', href: '/dashboard/analytics' },
  { name: 'Settings', href: '/dashboard/settings' },
];

interface SidebarProps {
  onNavigate?: () => void;
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const pathname = usePathname();

  return (
    <div className="flex h-full w-48 flex-col bg-[#1a1a1a]">
      {/* Logo */}
      <div className="flex h-16 items-center justify-center gap-2.5 border-b border-white/10">
        <Image
          src="/formseticonlogo.png"
          alt="FORMSET"
          width={24}
          height={24}
          className="h-6 w-auto object-contain"
        />
        <span className="text-white text-xl font-light tracking-wide">Objects</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-6">
        {navigation.map((item) => {
          const isActive = pathname === item.href ||
                          (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                'block px-3 py-2.5 text-sm font-medium transition-colors rounded-lg',
                isActive
                  ? 'text-white bg-white/10'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              )}
            >
              {item.name}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
