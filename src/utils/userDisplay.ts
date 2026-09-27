import { User, ChurchService } from '../types/index';

/**
 * Removes technical suffixes like "(Super Admin)" or generic developer names.
 */
export function getCleanUserName(name?: string): string {
  if (!name) return 'الخادم المبارك';
  let clean = name
    .replace(/\(Super Admin\)/gi, '')
    .replace(/\(Admin\)/gi, '')
    .replace(/Super Admin/gi, '')
    .trim();

  if (clean === 'المدير العام' || clean === 'admin' || clean === '') {
    return 'الخادم المسؤول';
  }
  return clean;
}

/**
 * Derives the canonical church title (e.g. أب كاهن، أمين خدمة ثانوي، أمين الخدمة العام)
 * Never returns generic developer roles like "سوبر أدمن" or "المدير العام".
 */
export function getUserChurchRoleTitle(user?: User | null, services: ChurchService[] = []): string {
  if (!user) return 'خادم';

  if (user.role === 'super_admin') {
    return 'مدير عام المنظومة';
  }

  if (user.church_role_title && user.church_role_title.trim()) {
    return user.church_role_title.trim();
  }

  if (
    user.role === 'priest' ||
    user.name?.startsWith('أبونا') ||
    user.name?.startsWith('القمص') ||
    user.name?.startsWith('القس')
  ) {
    return 'أب كاهن';
  }

  // If user has a specific service scope, e.g. "ثانوي", role is "أمين خدمة ثانوي"
  if (user.scope && user.scope !== 'all') {
    const srv = services.find((s) => s.id === user.scope);
    if (srv) {
      const srvClean = srv.name_ar.startsWith('خدمة ') ? srv.name_ar.replace('خدمة ', '') : srv.name_ar;
      return `أمين خدمة ${srvClean}`;
    }
    return 'أمين خدمة';
  }

  switch (user.role) {
    case 'general_secretary':
      return 'أمين عام الخدمة';
    case 'stage_coordinator':
      return 'منسق مرحلة كنسية';
    case 'captain':
      return 'أمين أسرة';
    case 'manager':
      return 'أمين خدمة';
    case 'servant':
      return 'خادم';
    case 'viewer':
      return 'خادم متابع';
    default:
      return 'خادم';
  }
}

/**
 * Returns formatted greeting as requested: "أهلاً بك يا [الاسم] ([الرتبة الكنسية])"
 */
export function formatUserGreeting(user?: User | null, services: ChurchService[] = []): string {
  if (!user) return 'أهلاً بك في نظام خدمة الكنيسة';
  const cleanName = getCleanUserName(user.name);
  const roleTitle = getUserChurchRoleTitle(user, services);

  return `أهلاً بك يا ${cleanName} (${roleTitle})`;
}
