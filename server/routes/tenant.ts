import { Router, Response } from 'express';
import { getDb, saveDatabase } from '../db.js';
import { authenticateJwt, getEffectiveChurchId, AuthenticatedRequest } from '../auth.js';
import { logAudit } from '../audit.js';

export const tenantRouter = Router();

// GET /api/tenant/public-info - Get church public branding by slug or default
tenantRouter.get('/public-info', (req, res: Response) => {
  try {
    const slug = req.query.slug as string;
    const churchId = req.query.church_id as string;
    const db = getDb();
    const churches = db.churches || [];

    let targetChurch = churches[0]; // default to first church if any
    if (slug) {
      targetChurch = churches.find((c) => c.slug === slug) || targetChurch;
    } else if (churchId) {
      targetChurch = churches.find((c) => c.id === churchId) || targetChurch;
    }

    if (!targetChurch) {
      // Fallback default info
      res.json({
        name: 'كنيسة الشهيد العظيم مارجرجس',
        diocese: 'إيبارشية شبين القناطر وتوابعها',
        verse: 'أَمَّا أَنَا وَبَيْتِي فَنَعْبُدُ الرَّبَّ (يش 24: 15)',
        logo_url: '',
        social_links: {},
        status: 'active',
      });
      return;
    }

    res.json({
      id: targetChurch.id,
      name: targetChurch.name,
      slug: targetChurch.slug,
      diocese: targetChurch.diocese,
      bishop_name: targetChurch.bishop_name,
      address: targetChurch.address,
      phone: targetChurch.phone,
      verse: targetChurch.verse,
      logo_url: targetChurch.logo_url || '',
      social_links: targetChurch.social_links || {},
      status: targetChurch.status,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'فشل جلب بيانات الكنيسة' });
  }
});

// GET /api/tenant/current - Authenticated tenant info
tenantRouter.get('/current', authenticateJwt, (req: AuthenticatedRequest, res: Response) => {
  try {
    const churchId = getEffectiveChurchId(req);
    const db = getDb();
    const churches = db.churches || [];

    if (!churchId) {
      // If super admin without selected church
      res.json({
        is_platform_admin: true,
        name: 'المنظومة المركزية لإدارة الكنائس',
        logo_url: '',
      });
      return;
    }

    const church = churches.find((c) => c.id === churchId);
    if (!church) {
      res.status(404).json({ error: 'الكنيسة غير موجودة' });
      return;
    }

    res.json({
      church,
      servants_count: (db.servants || []).filter((s) => s.church_id === church.id).length,
      services_count: (db.services || []).filter((s) => s.church_id === church.id).length,
      meetings_count: (db.general_meetings || []).filter((m) => m.church_id === church.id).length,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'فشل جلب بيانات الكنيسة الحالية' });
  }
});

// GET /api/tenant/settings - Fetch current church settings and branding
tenantRouter.get('/settings', authenticateJwt, (req: AuthenticatedRequest, res: Response) => {
  try {
    const churchId = getEffectiveChurchId(req);
    if (!churchId) {
      res.status(400).json({ error: 'لم يتم تحديد الكنيسة' });
      return;
    }

    const db = getDb();
    const church = db.churches?.find((c) => c.id === churchId);
    if (!church) {
      res.status(404).json({ error: 'الكنيسة غير موجودة' });
      return;
    }

    res.json({
      success: true,
      church,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'فشل جلب إعدادات الكنيسة' });
  }
});

// POST /api/tenant/acknowledge-renewal-notice - Acknowledge renewal notice by church
tenantRouter.post('/acknowledge-renewal-notice', authenticateJwt, (req: AuthenticatedRequest, res: Response) => {
  try {
    const churchId = getEffectiveChurchId(req);
    if (!churchId) {
      res.status(400).json({ error: 'لم يتم تحديد الكنيسة' });
      return;
    }

    const db = getDb();
    const church = db.churches?.find((c) => c.id === churchId);
    if (!church) {
      res.status(404).json({ error: 'الكنيسة غير موجودة' });
      return;
    }

    if (church.subscription?.renewal_notice) {
      church.subscription.renewal_notice.acknowledged = true;
      church.updated_at = new Date().toISOString();
      saveDatabase();
    }

    res.json({ success: true, message: 'تم تأكيد قراءة إشعار التجديد' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'فشل تأكيد قراءة الإشعار' });
  }
});

// PUT /api/tenant/settings - Update church branding & details (Church Admin, Priest or Super Admin)
tenantRouter.put('/settings', authenticateJwt, (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const churchId = getEffectiveChurchId(req);

    if (
      user.role !== 'super_admin' &&
      user.role !== 'church_admin' &&
      user.role !== 'priest' &&
      !user.permissions?.includes('manage_church_settings') &&
      !user.permissions?.includes('full_access')
    ) {
      res.status(403).json({ error: 'صلاحية تعديل إعدادات وهوية الكنيسة مقتصرة على مسؤولي الكنيسة' });
      return;
    }

    if (!churchId) {
      res.status(400).json({ error: 'لم يتم تحديد الكنيسة' });
      return;
    }

    const db = getDb();
    const church = db.churches?.find((c) => c.id === churchId);
    if (!church) {
      res.status(404).json({ error: 'الكنيسة غير موجودة' });
      return;
    }

    const {
      name,
      diocese,
      bishop_name,
      address,
      phone,
      email,
      verse,
      logo_url,
      social_links,
      branding,
    } = req.body || {};

    if (name) church.name = name.trim();
    if (diocese !== undefined) church.diocese = diocese.trim();
    if (bishop_name !== undefined) church.bishop_name = bishop_name.trim();
    if (address !== undefined) church.address = address.trim();
    if (phone !== undefined) church.phone = phone.trim();
    if (email !== undefined) church.email = email.trim();
    if (verse !== undefined) church.verse = verse.trim();

    // Handle logo from top-level or branding
    const effectiveLogo = logo_url !== undefined ? logo_url : branding?.logo_url;
    if (effectiveLogo !== undefined) {
      church.logo_url = effectiveLogo;
      if (!church.branding) church.branding = {};
      church.branding.logo_url = effectiveLogo;
    }

    // Handle social links
    const effectiveSocial = social_links || branding?.social_links;
    if (effectiveSocial !== undefined) {
      church.social_links = {
        ...(church.social_links || {}),
        ...effectiveSocial,
      };
      if (!church.branding) church.branding = {};
      church.branding.social_links = {
        ...(church.branding.social_links || {}),
        ...effectiveSocial,
      };
    }

    if (branding?.primary_color) {
      if (!church.branding) church.branding = {};
      church.branding.primary_color = branding.primary_color;
    }
    if (branding?.secondary_color) {
      if (!church.branding) church.branding = {};
      church.branding.secondary_color = branding.secondary_color;
    }

    church.updated_at = new Date().toISOString();
    saveDatabase();

    logAudit({
      userId: user.id,
      username: user.name,
      action: 'UPDATE_CHURCH_SETTINGS',
      targetType: 'CHURCH',
      targetId: church.id,
      targetName: church.name,
      description: `قام (${user.name}) بتحديث هوية وإعدادات الكنيسة (${church.name})`,
    });

    res.json({
      success: true,
      church,
      message: 'تم حفظ إعدادات وهوية الكنيسة بنجاح',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'فشل تحديث إعدادات الكنيسة' });
  }
});
