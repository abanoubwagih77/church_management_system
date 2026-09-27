export type RoleType =
  | 'super_admin'
  | 'church_admin'
  | 'priest'
  | 'general_secretary'
  | 'stage_coordinator'
  | 'servant'
  | 'captain'
  | 'manager'
  | 'viewer';

export type ChurchStatus = 'active' | 'inactive' | 'suspended' | 'trial';

export type PaymentStatus = 'paid' | 'unpaid' | 'overdue' | 'trial';

export interface RenewalNotice {
  sent_at: string;
  sent_by_name: string;
  message: string;
  acknowledged?: boolean;
}

export interface ChurchSubscription {
  plan: 'free' | 'basic' | 'pro' | 'enterprise';
  status: 'active' | 'expired' | 'trial' | 'past_due';
  payment_status?: PaymentStatus;
  fee?: number;
  currency?: string;
  start_date: string;
  end_date?: string;
  last_payment_date?: string;
  next_due_date?: string;
  max_servants?: number;
  max_users?: number;
  notes?: string;
  features?: string[];
  renewal_notice?: RenewalNotice;
}

export interface ChurchSocialLinks {
  facebook?: string;
  youtube?: string;
  instagram?: string;
  whatsapp?: string;
  telegram?: string;
}

export interface ChurchBranding {
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
  cover_url?: string;
  social_links?: ChurchSocialLinks;
}

export interface Church {
  id: string;
  name: string;
  code?: string;
  slug?: string;
  diocese?: string;
  bishop_name?: string;
  address?: string;
  phone?: string;
  email?: string;
  verse?: string;
  logo_url?: string;
  branding?: ChurchBranding;
  social_links?: ChurchSocialLinks;
  status: ChurchStatus;
  subscription?: ChurchSubscription;
  primary_admin_id?: string;
  created_at: string;
  updated_at: string;
}

export type PermissionKey =
  | 'view_servants'
  | 'add_servant'
  | 'edit_servant'
  | 'delete_servant'
  | 'view_servant_details'
  | 'view_users'
  | 'add_user'
  | 'edit_user'
  | 'disable_user'
  | 'delete_user'
  | 'view_services'
  | 'add_service'
  | 'edit_service'
  | 'delete_service'
  | 'view_attendance'
  | 'add_attendance'
  | 'edit_attendance'
  | 'delete_attendance'
  | 'view_reports'
  | 'export_reports'
  | 'view_history'
  | 'manage_permissions'
  | 'manage_roles'
  | 'manage_scanner'
  | 'manage_church_settings'
  | 'full_access';

export interface User {
  id: string;
  username: string;
  name: string;
  email?: string;
  role: RoleType;
  church_id?: string | null; // null for platform super_admin, string for church accounts
  church_role_title?: string; // e.g. "أب كاهن", "أمين خدمة ثانوي", "أمين الخدمة العام", "خادم"
  scope: 'all' | string; // 'all' or specific service_id
  permissions: PermissionKey[];
  linked_servant_id?: string;
  status: 'active' | 'disabled';
  must_change_password?: boolean;
  last_login?: string;
  created_at: string;
  updated_at: string;
  password_hash?: string;
  plain_password_hint?: string;
  face_biometric_data?: string;
  face_enrolled_at?: string;
  recovery_pin?: string;
}

export interface Servant {
  id: string;
  church_id?: string;
  full_name: string;
  national_id: string; // 14-digit Egyptian National ID
  date_of_birth: string;
  gender: 'male' | 'female';
  phone: string;
  email?: string;
  address?: string;
  profile_photo?: string;
  id_card_photo?: string; // Protected media
  joining_date?: string;
  service_start_date?: string;
  current_service_id?: string;
  current_role: string;
  status: 'active' | 'inactive';
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ChurchService {
  id: string;
  church_id?: string;
  name: string;
  name_ar: string;
  code: string;
  description?: string;
  meeting_day?: string;
  meeting_time?: string;
  status: 'active' | 'inactive';
  created_at: string;
}

export interface ServiceAssignment {
  id: string;
  church_id?: string;
  servant_id: string;
  service_id: string;
  role: string;
  coptic_year?: string; // e.g. "1741-1742 ق" (2024-2025 م)
  start_date: string;
  end_date?: string;
  status: 'active' | 'past';
  notes?: string;
  created_at: string;
}

export interface DeviceRegistrationCode {
  code: string; // 8 digits (e.g. "48291045")
  church_id?: string;
  created_by_user_id: string;
  created_by_name: string;
  expires_at: string; // 10 minutes from creation
  used: boolean;
  used_at?: string;
  used_by_device_name?: string;
}

export interface ScannerDevice {
  id: string;
  church_id?: string;
  name: string; // e.g. "موبايل مينا"
  device_token: string; // cryptographically secure token
  is_active: boolean; // can be revoked
  registered_at: string;
  last_used_at?: string;
  total_scans: number;
  registered_with_code: string;
}

export interface GeneralMeeting {
  id: string;
  church_id?: string;
  title: string; // e.g. "اجتماع الخدام الأسبوعي - تدبير الخدمة"
  speaker: string; // e.g. "أبونا أنجيلوس" أو "د. مجدي"
  date: string; // YYYY-MM-DD
  start_time: string; // e.g. "12:00"
  end_time: string; // e.g. "14:00"
  late_cutoff_time: string; // e.g. "13:00" (آخر موعد مسموح به لتسجيل الحضور، وبعده يُسجل غياب)
  notes?: string;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  created_by_user_id: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface GeneralMeetingRecord {
  id: string;
  church_id?: string;
  meeting_id?: string;
  meeting_title?: string;
  meeting_speaker?: string;
  servant_id: string;
  servant_name: string;
  servant_phone: string;
  servant_national_id?: string;
  service_id?: string;
  service_name?: string;
  date: string; // YYYY-MM-DD
  check_in_time?: string; // ISO string
  check_out_time?: string; // ISO string
  duration_minutes?: number; // Calculated elapsed duration in minutes
  status: 'present' | 'checked_in' | 'completed' | 'late_absent' | 'absent';
  is_late?: boolean; // true if scanned after late_cutoff_time
  is_priest?: boolean; // true if exempted priest
  scanner_device_id?: string;
  scanner_device_name?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export type AttendanceStatus = 'present' | 'absent' | 'excused';

export interface AttendanceRecord {
  id: string;
  church_id?: string;
  servant_id: string;
  service_id: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  notes?: string;
  recorded_by_user_id: string;
  recorded_by_name?: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  church_id?: string | null;
  user_id?: string;
  username: string;
  action: string;
  target_type: string;
  target_id?: string;
  target_name?: string;
  description: string;
  ip_address?: string;
  metadata?: Record<string, any>;
  changes?: {
    before?: Record<string, any>;
    after?: Record<string, any>;
  };
  timestamp: string;
}

export interface ServantPortalData {
  church?: {
    id: string;
    name: string;
    diocese?: string;
    logo_url?: string;
    verse?: string;
  } | null;
  servant: {
    id: string;
    full_name: string;
    profile_photo?: string;
    current_service_name?: string;
    current_role?: string;
    service_start_date?: string;
    joining_date?: string;
    status: string;
    masked_national_id: string;
    phone?: string;
    gender: 'male' | 'female';
  };
  attendance_stats: {
    total_meetings: number;
    present: number;
    absent: number;
    excused: number;
    percentage: number;
  };
  recent_attendance: {
    id: string;
    date: string;
    service_name: string;
    status: 'present' | 'absent' | 'excused';
    notes?: string;
  }[];
  assignments_history: {
    service_name: string;
    role: string;
    start_date: string;
    end_date?: string;
    status: string;
  }[];
}

export interface DashboardStats {
  total_servants: number;
  active_servants: number;
  inactive_servants: number;
  total_services: number;
  total_management_users: number;
  average_attendance: number;
  recent_activities: AuditLog[];
}
