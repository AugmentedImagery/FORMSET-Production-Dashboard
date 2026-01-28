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

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="flex h-full w-64 flex-col bg-[#1a1a1a]">
      {/* Logo */}
      <div className="flex h-20 items-center justify-center border-b border-white/10">
        <Image
          src="/formseticonlogo.png"
          alt="FORMSET"
          width={48}
          height={48}
          className="h-12 w-12"
        />
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-4 py-6">
        {navigation.map((item) => {
          const isActive = pathname === item.href ||
                          (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'block px-4 py-2.5 text-sm font-medium transition-colors rounded-lg',
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
