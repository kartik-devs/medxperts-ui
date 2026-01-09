import React from 'react';
import { 
  CheckCircleIcon,
  ShieldCheckIcon,
  UsersIcon,
  LockClosedIcon,
  BoltIcon,
  ArrowRightIcon,
  DocumentTextIcon,
  CurrencyDollarIcon,
  ClipboardDocumentCheckIcon,
  UserIcon,
  BuildingOfficeIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline';

// Import from lucide-react as fallback
import {
  Shield,
  Zap,
  Brain,
  CheckCircle,
  ArrowRight,
  FileText,
  DollarSign,
  ClipboardCheck,
  User,
  Building,
  Users,
  Workflow,
} from 'lucide-react';

const Icon = ({ name, size = 24, className = '', ...props }) => {
  // Primary icon map using Heroicons
  const heroIconMap = {
    checkCircle: CheckCircleIcon,
    shield: ShieldCheckIcon,
    users: UsersIcon,
    lock: LockClosedIcon,
    zap: BoltIcon,
    arrowRight: ArrowRightIcon,
    fileText: DocumentTextIcon,
    dollarSign: CurrencyDollarIcon,
    clipboardCheck: ClipboardDocumentCheckIcon,
    user: UserIcon,
    building: BuildingOfficeIcon,
    workflow: Cog6ToothIcon,
  };

  // Fallback icon map using Lucide React
  const lucideIconMap = {
    checkCircle: CheckCircle,
    shield: Shield,
    users: Users,
    zap: Zap,
    arrowRight: ArrowRight,
    fileText: FileText,
    dollarSign: DollarSign,
    clipboardCheck: ClipboardCheck,
    user: User,
    building: Building,
    workflow: Workflow,
    brain: Brain,
  };

  // Try Heroicons first, then Lucide as fallback
  const IconComponent = heroIconMap[name] || lucideIconMap[name] || null;
  
  if (!IconComponent) {
    console.warn(`Icon "${name}" not found`);
    return null;
  }

  // Handle size as number (pixels) or Tailwind class
  const iconProps = {
    className,
    size: typeof size === 'number' ? size : undefined,
    ...props
  };

  // If it's a Heroicons component, use className for sizing
  if (heroIconMap[name]) {
    const sizeClass = typeof size === 'number' ? `h-${Math.ceil(size/4)} w-${Math.ceil(size/4)}` : '';
    iconProps.className = `${sizeClass} ${className}`;
    delete iconProps.size;
  }

  return <IconComponent {...iconProps} />;
};

export default Icon;


