'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  ListTodo,
  Heart,
  BookMarked,
  GraduationCap,
  BarChart3,
  LogOut,
} from 'lucide-react';
import { useSelector } from 'react-redux';
import { RootState } from '@/lib/store';

const navItems = [
  { name: 'Home', href: '/', icon: LayoutDashboard },
  { name: 'Routine', href: '/routine', icon: ListTodo },
  { name: 'Health', href: '/health', icon: Heart },
  { name: 'Books', href: '/books', icon: BookMarked },
  { name: 'Learning', href: '/learning', icon: GraduationCap },
  { name: 'Reports', href: '/reports', icon: BarChart3 },
];

export default function Sidebar() {
  const pathname = usePathname();
  const isSidebarOpen = useSelector((state: RootState) => state.ui.isSidebarOpen);

  if (!isSidebarOpen) return null;

  return (
    <aside className="hidden md:flex flex-col w-64 h-screen fixed left-0 top-0 border-r border-border bg-background/80 backdrop-blur-md z-50">
      <div className="p-6">
        <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary" />
          LifeOS
        </h1>
        <p className="text-xs text-muted-foreground mt-1 pl-4">v1.0.0</p>
      </div>

      <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              )}
            >
              <Icon size={18} strokeWidth={2} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border">
        <button className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors">
          <LogOut size={18} />
          Logout
        </button>
      </div>
    </aside>
  );
}
