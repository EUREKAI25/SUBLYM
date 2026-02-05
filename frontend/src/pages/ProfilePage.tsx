import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Mail, Calendar, LogOut, Globe, Languages, CreditCard, Loader2,
  Camera, Upload, X, Check, Star, MessageSquare, Trash2,
  Image as ImageIcon, Plus, ChevronUp, AlertCircle, Video, Phone, UserCircle,
} from 'lucide-react';
import { Header, CameraCapture } from '@/components';
import { useAuth, useI18n, LocaleSwitcher } from '@/hooks';
import { API_ENDPOINTS, fetchWithAuth, fetchUpload, MAX_PHOTOS_USER } from '@/lib/config';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Photo {
  id: string;
  path: string;
  order: number;
  verified: boolean;
  qualityScore: number | null;
  createdAt: string;
}

interface Testimonial {
  id: number;
  text: string;
  rating: number | null;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason: string | null;
  proofUrl: string | null;
  videoUrl: string | null;
  createdAt: string;
  approvedAt: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const storageUrl = (p: string) => p.startsWith('/storage/') ? p : `/storage/${p}`;

const getStatusStyles = (t: (key: string) => string) => ({
  pending:  { bg: 'bg-blush-100', text: 'text-gray-600', label: t('profile.statusPending') },
  approved: { bg: 'bg-green-100',  text: 'text-green-700',  label: t('profile.statusApproved') },
  rejected: { bg: 'bg-red-100',    text: 'text-red-700',    label: t('profile.statusRejected') },
});

// ---------------------------------------------------------------------------
// Sub-component: Star rating selector
// ---------------------------------------------------------------------------

function StarRating({ value, onChange, readOnly = false }: { value: number; onChange?: (v: number) => void; readOnly?: boolean }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readOnly}
          onMouseEnter={() => !readOnly && setHovered(star)}
          onMouseLeave={() => !readOnly && setHovered(0)}
          onClick={() => onChange?.(star)}
          className={readOnly ? 'cursor-default' : 'cursor-pointer'}
        >
          <Star
            className={`w-5 h-5 transition-colors ${
              star <= (hovered || value) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'
            }`}
          />
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function ProfilePage() {
  const { user, logout } = useAuth();
  const { t, locale } = useI18n();
  const navigate = useNavigate();

  // Profile state
  const [country, setCountry] = useState('');
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState('');
  const [saving, setSaving] = useState(false);

  // Photos state
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [photosTotal, setPhotosTotal] = useState(0);
  const [photosLoading, setPhotosLoading] = useState(true);
  const [photosError, setPhotosError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<Photo | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Testimonials state
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [testimonialsLoading, setTestimonialsLoading] = useState(true);
  const [testimonialsError, setTestimonialsError] = useState<string | null>(null);
  const [showTestimonialForm, setShowTestimonialForm] = useState(false);
  const [expandedTestimonial, setExpandedTestimonial] = useState<number | null>(null);

  // Testimonial form state
  const [tText, setTText] = useState('');
  const [tRating, setTRating] = useState(0);
  const [tConsentDisplay, setTConsentDisplay] = useState(false);
  const [tConsentMarketing, setTConsentMarketing] = useState(false);
  const [tProofFile, setTProofFile] = useState<File | null>(null);
  const [tSubmitting, setTSubmitting] = useState(false);
  const [tError, setTError] = useState<string | null>(null);
  const proofInputRef = useRef<HTMLInputElement>(null);

  // -------------------------------------------------------------------------
  // Effects
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    fetchProfile();
    fetchPhotos();
    fetchTestimonials();
  }, [user, navigate]);

  // -------------------------------------------------------------------------
  // Profile
  // -------------------------------------------------------------------------

  const fetchProfile = async () => {
    try {
      const res = await fetchWithAuth(API_ENDPOINTS.me);
      if (res.ok) {
        const data = await res.json();
        if (data.user?.country) setCountry(data.user.country);
        if (data.user?.phone) setPhone(data.user.phone);
        if (data.user?.birthDate) setBirthDate(data.user.birthDate.split('T')[0]);
        if (data.user?.gender) setGender(data.user.gender);
      }
    } catch {}
  };

  const updateProfile = async (field: string, value: string) => {
    setSaving(true);
    try {
      await fetchWithAuth(API_ENDPOINTS.me, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
    } catch (err) { console.error('Update error:', err); }
    finally { setSaving(false); }
  };

  const handleCountryChange = (newCountry: string) => {
    setCountry(newCountry);
    updateProfile('country', newCountry);
  };

  const handlePhoneChange = (newPhone: string) => {
    setPhone(newPhone);
    updateProfile('phone', newPhone);
  };

  const handleBirthDateChange = (newDate: string) => {
    setBirthDate(newDate);
    updateProfile('birthDate', newDate);
  };

  const handleGenderChange = (newGender: string) => {
    setGender(newGender);
    updateProfile('gender', newGender);
  };

  const handleLogout = () => { logout(); navigate('/'); };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(locale, {
      day: 'numeric', month: 'long', year: 'numeric',
    });
  };

  // -------------------------------------------------------------------------
  // Photos
  // -------------------------------------------------------------------------

  const fetchPhotos = async () => {
    setPhotosLoading(true);
    setPhotosError(null);
    try {
      const res = await fetchWithAuth(API_ENDPOINTS.photos);
      if (res.ok) {
        const data = await res.json();
        setPhotos(data.photos || []);
        setPhotosTotal(data.total ?? (data.photos?.length ?? 0));
      } else {
        setPhotosError(t('profile.loadPhotosError'));
      }
    } catch {
      setPhotosError(t('profile.connectionError'));
    } finally {
      setPhotosLoading(false);
    }
  };

  const uploadPhotos = async (files: File[]) => {
    if (files.length === 0) return;
    setUploading(true);
    setPhotosError(null);
    try {
      const formData = new FormData();
      files.forEach((f) => formData.append('photos', f));
      formData.append('consent', 'true');
      const res = await fetchUpload(API_ENDPOINTS.uploadPhoto, formData);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setPhotosError(err.message || t('profile.uploadError'));
      }
      await fetchPhotos();
    } catch {
      setPhotosError(t('profile.connectionError'));
    } finally {
      setUploading(false);
      setShowCamera(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) uploadPhotos(files);
    e.target.value = '';
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (photos.length <= 3) return;
    try {
      const res = await fetchWithAuth(API_ENDPOINTS.photo(photoId), { method: 'DELETE' });
      if (res.ok) {
        await fetchPhotos();
      } else {
        const err = await res.json().catch(() => ({}));
        setPhotosError(err.message || t('profile.deleteError'));
      }
    } catch {
      setPhotosError(t('profile.connectionError'));
    }
  };

  const handleCameraComplete = (capturedFiles: File[]) => {
    uploadPhotos(capturedFiles);
  };

  const handleSwitchToUpload = () => {
    setShowCamera(false);
    fileInputRef.current?.click();
  };

  // -------------------------------------------------------------------------
  // Testimonials
  // -------------------------------------------------------------------------

  const fetchTestimonials = async () => {
    setTestimonialsLoading(true);
    setTestimonialsError(null);
    try {
      const res = await fetchWithAuth(API_ENDPOINTS.myTestimonials);
      if (res.ok) {
        const data = await res.json();
        setTestimonials(data.testimonials || []);
      } else {
        setTestimonialsError(t('profile.loadTestimonialsError'));
      }
    } catch {
      setTestimonialsError(t('profile.connectionError'));
    } finally {
      setTestimonialsLoading(false);
    }
  };

  const hasPending = testimonials.some((t) => t.status === 'pending');

  const resetTestimonialForm = () => {
    setTText('');
    setTRating(0);
    setTConsentDisplay(false);
    setTConsentMarketing(false);
    setTProofFile(null);
    setTError(null);
  };

  const handleSubmitTestimonial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (tText.length < 10) { setTError(t('profile.testimonialTextError')); return; }
    if (!tConsentDisplay) { setTError(t('profile.testimonialConsentError')); return; }

    setTSubmitting(true);
    setTError(null);
    try {
      const body: Record<string, unknown> = {
        text: tText,
        consentDisplay: tConsentDisplay,
      };
      if (tRating > 0) body.rating = tRating;
      if (tConsentMarketing) body.consentMarketing = true;

      const res = await fetchWithAuth(API_ENDPOINTS.testimonials, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setTError(err.message || t('profile.testimonialError'));
        setTSubmitting(false);
        return;
      }

      const created = await res.json();
      const testimonialId: number = created.testimonial?.id ?? created.id;

      // Upload proof if selected
      if (tProofFile && testimonialId) {
        const proofForm = new FormData();
        proofForm.append('proof', tProofFile);
        await fetchUpload(API_ENDPOINTS.testimonialProof(testimonialId), proofForm);
      }

      resetTestimonialForm();
      setShowTestimonialForm(false);
      await fetchTestimonials();
    } catch {
      setTError(t('profile.connectionError'));
    } finally {
      setTSubmitting(false);
    }
  };

  const handleDeleteTestimonial = async (id: number) => {
    try {
      const res = await fetchWithAuth(`${API_ENDPOINTS.testimonials}/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchTestimonials();
      }
    } catch {
      setTestimonialsError(t('profile.deleteTestimonialError'));
    }
  };

  // -------------------------------------------------------------------------
  // Render guard
  // -------------------------------------------------------------------------

  if (!user) return null;

  const canAddPhotos = photosTotal < MAX_PHOTOS_USER;

  // -------------------------------------------------------------------------
  // JSX
  // -------------------------------------------------------------------------

  return (
    <div className="min-h-screen">
      <Header />
      <main className="pt-24 sm:pt-28 pb-16 px-4 sm:px-6">
        <div className="max-w-2xl mx-auto space-y-6">

          {/* ============================================================= */}
          {/* Section 1: Profile Card (existing)                            */}
          {/* ============================================================= */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card">
            <div className="flex flex-col items-center mb-8">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-teal flex items-center justify-center mb-4">
                <User className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
              </div>
              <h1 className="font-display text-2xl text-dark">{t('account.myProfile')}</h1>
            </div>

            <div className="space-y-4 mb-8">
              <div className="flex items-center gap-4 p-4 rounded-xl bg-gray-50">
                <Mail className="w-5 h-5 text-teal-600 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="text-dark font-medium truncate">{user.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 rounded-xl bg-gray-50">
                <Calendar className="w-5 h-5 text-teal-600 flex-shrink-0" />
                <div>
                  <p className="text-sm text-gray-500">{t('account.memberSince')}</p>
                  <p className="text-dark font-medium">{user.created_at ? formatDate(user.created_at) : 'N/A'}</p>
                </div>
              </div>

              {/* Phone */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50">
                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-teal-600 flex-shrink-0" />
                  <span className="text-gray-700">{t('profile.phone')}</span>
                </div>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onBlur={(e) => handlePhoneChange(e.target.value)}
                  placeholder="+33..."
                  className="px-2 py-1 rounded border border-gray-200 text-sm bg-white w-40 text-right"
                />
              </div>

              {/* Birth Date */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50">
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-teal-600 flex-shrink-0" />
                  <span className="text-gray-700">{t('profile.birthDate')}</span>
                </div>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => handleBirthDateChange(e.target.value)}
                  className="px-2 py-1 rounded border border-gray-200 text-sm bg-white"
                />
              </div>

              {/* Gender */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50">
                <div className="flex items-center gap-3">
                  <UserCircle className="w-5 h-5 text-teal-600 flex-shrink-0" />
                  <span className="text-gray-700">{t('profile.gender')}</span>
                </div>
                <select
                  value={gender}
                  onChange={(e) => handleGenderChange(e.target.value)}
                  className="px-2 py-1 rounded border border-gray-200 text-sm bg-white"
                >
                  <option value="">--</option>
                  <option value="male">{t('profile.genderMale')}</option>
                  <option value="female">{t('profile.genderFemale')}</option>
                  <option value="other">{t('profile.genderOther')}</option>
                </select>
              </div>

              {/* Country */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50">
                <div className="flex items-center gap-3">
                  <Globe className="w-5 h-5 text-teal-600 flex-shrink-0" />
                  <span className="text-gray-700">{t('account.country')}</span>
                </div>
                <select
                  value={country}
                  onChange={(e) => handleCountryChange(e.target.value)}
                  className="px-2 py-1 rounded border border-gray-200 text-sm bg-white"
                >
                  <option value="">--</option>
                  <option value="FR">France</option>
                  <option value="DE">Deutschland</option>
                  <option value="ES">Espana</option>
                  <option value="IT">Italia</option>
                  <option value="GB">United Kingdom</option>
                  <option value="BE">Belgique</option>
                  <option value="CH">Suisse</option>
                  <option value="LU">Luxembourg</option>
                  <option value="AT">Osterreich</option>
                  <option value="NL">Nederland</option>
                  <option value="PT">Portugal</option>
                  <option value="US">United States</option>
                  <option value="CA">Canada</option>
                </select>
              </div>

              {/* Language */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50">
                <div className="flex items-center gap-3">
                  <Languages className="w-5 h-5 text-teal-600 flex-shrink-0" />
                  <span className="text-gray-700">{t('account.language')}</span>
                </div>
                <LocaleSwitcher />
              </div>
            </div>

            {/* Link to subscription/billing */}
            <Link
              to="/account"
              className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl border-2 border-teal-200 text-teal-700 hover:bg-teal-50 transition-colors font-medium mb-4"
            >
              <CreditCard className="w-5 h-5" />
              {t('account.mySubscription')}
            </Link>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl border-2 border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors font-medium"
            >
              <LogOut className="w-5 h-5" />
              {t('common.logout')}
            </button>
          </motion.div>

          {saving && (
            <div className="text-center text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
              {t('common.saving')}
            </div>
          )}

          {/* ============================================================= */}
          {/* Section 2: My Photos                                          */}
          {/* ============================================================= */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="card"
          >
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
              <Camera className="w-6 h-6 text-teal-600" />
              <h2 className="font-display text-xl text-dark">{t('profile.myPhotos')}</h2>
              <span className="ml-auto inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-700">
                {photosTotal}/{MAX_PHOTOS_USER}
              </span>
            </div>

            {/* Loading */}
            {photosLoading && (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-teal-500" />
              </div>
            )}

            {/* Error */}
            {photosError && (
              <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-red-50 text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {photosError}
              </div>
            )}

            {/* Photo grid */}
            {!photosLoading && photos.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3 mb-6">
                {photos.map((photo) => (
                  <div key={photo.id} className="relative group aspect-square rounded-xl overflow-hidden bg-gray-100">
                    <img
                      src={storageUrl(photo.path)}
                      alt=""
                      className="w-full h-full object-cover cursor-pointer transition-transform group-hover:scale-105"
                      onClick={() => setLightboxPhoto(photo)}
                    />
                    {/* Verified badge */}
                    {photo.verified && (
                      <div className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-teal-500 flex items-center justify-center shadow">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                    {/* Delete button */}
                    {photos.length > 3 && (
                      <button
                        onClick={() => handleDeletePhoto(photo.id)}
                        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/50 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Empty state */}
            {!photosLoading && photos.length === 0 && !photosError && (
              <div className="text-center py-8 mb-4">
                <ImageIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">{t('profile.noPhotos')}</p>
              </div>
            )}

            {/* Upload spinner overlay */}
            {uploading && (
              <div className="flex items-center justify-center gap-3 py-4 mb-4 rounded-lg bg-teal-50">
                <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
                <span className="text-teal-700 text-sm font-medium">{t('profile.uploading')}</span>
              </div>
            )}

            {/* Add photos buttons */}
            {canAddPhotos && !showCamera && (
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-teal-200 text-teal-700 hover:bg-teal-50 transition-colors font-medium text-sm"
                >
                  <Upload className="w-4 h-4" />
                  {t('profile.importPhotos')}
                </button>
                <button
                  onClick={() => setShowCamera(true)}
                  disabled={uploading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-teal-200 text-teal-700 hover:bg-teal-50 transition-colors font-medium text-sm"
                >
                  <Camera className="w-4 h-4" />
                  {t('profile.takePhoto')}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
            )}

            {/* Camera capture modal */}
            <AnimatePresence>
              {showCamera && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
                  onClick={(e) => { if (e.target === e.currentTarget) setShowCamera(false); }}
                >
                  <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto relative"
                  >
                    <button
                      onClick={() => setShowCamera(false)}
                      className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-gray-100 transition-colors"
                    >
                      <X className="w-5 h-5 text-gray-500" />
                    </button>
                    <h3 className="font-display text-lg text-dark mb-4">{t('profile.takePhotos')}</h3>
                    <CameraCapture
                      onPhotosComplete={handleCameraComplete}
                      onSwitchToUpload={handleSwitchToUpload}
                    />
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Lightbox */}
            <AnimatePresence>
              {lightboxPhoto && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
                  onClick={() => setLightboxPhoto(null)}
                >
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="relative max-w-3xl max-h-[85vh]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <img
                      src={storageUrl(lightboxPhoto.path)}
                      alt=""
                      className="max-w-full max-h-[85vh] rounded-xl object-contain"
                    />
                    <button
                      onClick={() => setLightboxPhoto(null)}
                      className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white shadow-lg flex items-center justify-center hover:bg-gray-100 transition-colors"
                    >
                      <X className="w-4 h-4 text-gray-700" />
                    </button>
                    {lightboxPhoto.verified && (
                      <div className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-teal-500 text-white text-xs font-medium shadow">
                        <Check className="w-3 h-3" />
                        {t('profile.photoVerified')}
                      </div>
                    )}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* ============================================================= */}
          {/* Section 3: My Testimonials                                    */}
          {/* ============================================================= */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="card"
          >
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
              <MessageSquare className="w-6 h-6 text-teal-600" />
              <h2 className="font-display text-xl text-dark">{t('profile.myTestimonials')}</h2>
            </div>

            {/* Loading */}
            {testimonialsLoading && (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-teal-500" />
              </div>
            )}

            {/* Error */}
            {testimonialsError && (
              <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-red-50 text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {testimonialsError}
              </div>
            )}

            {/* Testimonials list */}
            {!testimonialsLoading && testimonials.length > 0 && (
              <div className="space-y-4 mb-6">
                {testimonials.map((testimonial) => {
                  const statusStyles = getStatusStyles(t);
                  const status = statusStyles[testimonial.status] || statusStyles.pending;
                  const isExpanded = expandedTestimonial === testimonial.id;
                  const needsTruncation = testimonial.text.length > 200;
                  const displayText = isExpanded || !needsTruncation
                    ? testimonial.text
                    : testimonial.text.slice(0, 200) + '...';

                  return (
                    <motion.div
                      key={testimonial.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 rounded-xl bg-gray-50 space-y-3"
                    >
                      {/* Top row: status + date + delete */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${status.bg} ${status.text}`}>
                            {status.label}
                          </span>
                          <span className="text-xs text-gray-400">
                            {formatDate(testimonial.createdAt)}
                          </span>
                        </div>
                        <button
                          onClick={() => handleDeleteTestimonial(testimonial.id)}
                          className="p-1.5 rounded-lg hover:bg-red-100 text-gray-400 hover:text-red-600 transition-colors"
                          title={t('common.delete')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Rating */}
                      {testimonial.rating && (
                        <StarRating value={testimonial.rating} readOnly />
                      )}

                      {/* Text */}
                      <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-line">
                        {displayText}
                      </p>
                      {needsTruncation && (
                        <button
                          onClick={() => setExpandedTestimonial(isExpanded ? null : testimonial.id)}
                          className="text-teal-600 text-xs font-medium hover:underline"
                        >
                          {isExpanded ? t('profile.seeLess') : t('profile.seeMore')}
                        </button>
                      )}

                      {/* Rejection reason */}
                      {testimonial.status === 'rejected' && testimonial.rejectionReason && (
                        <p className="text-sm italic text-red-600">
                          {t('profile.rejectionReason')} : {testimonial.rejectionReason}
                        </p>
                      )}

                      {/* Proof / video */}
                      <div className="flex items-center gap-3">
                        {testimonial.proofUrl && (
                          <a
                            href={storageUrl(testimonial.proofUrl)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-12 h-12 rounded-lg overflow-hidden bg-gray-200 block"
                          >
                            <img
                              src={storageUrl(testimonial.proofUrl)}
                              alt="Preuve"
                              className="w-full h-full object-cover"
                            />
                          </a>
                        )}
                        {testimonial.videoUrl && (
                          <a
                            href={storageUrl(testimonial.videoUrl)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-12 h-12 rounded-lg bg-gray-200 flex items-center justify-center text-teal-600 hover:bg-gray-300 transition-colors"
                          >
                            <Video className="w-5 h-5" />
                          </a>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* Empty state */}
            {!testimonialsLoading && testimonials.length === 0 && !testimonialsError && (
              <div className="text-center py-8 mb-4">
                <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">{t('profile.noTestimonials')}</p>
              </div>
            )}

            {/* Add testimonial toggle */}
            {!hasPending && !testimonialsLoading && (
              <div>
                <button
                  onClick={() => {
                    setShowTestimonialForm(!showTestimonialForm);
                    if (showTestimonialForm) resetTestimonialForm();
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-teal-200 text-teal-700 hover:bg-teal-50 transition-colors font-medium text-sm"
                >
                  {showTestimonialForm ? (
                    <>
                      <ChevronUp className="w-4 h-4" />
                      {t('common.cancel')}
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      {t('profile.addTestimonial')}
                    </>
                  )}
                </button>

                {/* Testimonial form */}
                <AnimatePresence>
                  {showTestimonialForm && (
                    <motion.form
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                      onSubmit={handleSubmitTestimonial}
                    >
                      <div className="pt-5 space-y-4">
                        {/* Text */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            {t('profile.yourTestimonial')}
                          </label>
                          <textarea
                            value={tText}
                            onChange={(e) => setTText(e.target.value)}
                            placeholder={t('profile.testimonialPlaceholder')}
                            rows={4}
                            maxLength={2000}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-400 focus:ring-2 focus:ring-teal-100 outline-none transition-all resize-none text-sm"
                          />
                          <div className="flex justify-between mt-1">
                            {tText.length < 10 && tText.length > 0 && (
                              <span className="text-xs text-red-500">{t('profile.minChars')}</span>
                            )}
                            <span className="text-xs text-gray-400 ml-auto">
                              {tText.length}/2000
                            </span>
                          </div>
                        </div>

                        {/* Rating */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            {t('profile.ratingOptional')}
                          </label>
                          <StarRating value={tRating} onChange={setTRating} />
                        </div>

                        {/* Consent display */}
                        <label className="flex items-start gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={tConsentDisplay}
                            onChange={(e) => setTConsentDisplay(e.target.checked)}
                            className="mt-0.5 w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-400"
                          />
                          <span className="text-sm text-gray-700">
                            {t('profile.consentDisplay')}
                          </span>
                        </label>

                        {/* Consent marketing */}
                        <label className="flex items-start gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={tConsentMarketing}
                            onChange={(e) => setTConsentMarketing(e.target.checked)}
                            className="mt-0.5 w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-400"
                          />
                          <span className="text-sm text-gray-600">
                            {t('profile.consentMarketing')}
                          </span>
                        </label>

                        {/* Proof file */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            {t('profile.addProof')}
                          </label>
                          <button
                            type="button"
                            onClick={() => proofInputRef.current?.click()}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            <ImageIcon className="w-4 h-4" />
                            {tProofFile ? tProofFile.name : t('profile.photoOrVideo')}
                          </button>
                          <input
                            ref={proofInputRef}
                            type="file"
                            accept="image/*,video/*"
                            onChange={(e) => setTProofFile(e.target.files?.[0] || null)}
                            className="hidden"
                          />
                          {tProofFile && (
                            <button
                              type="button"
                              onClick={() => { setTProofFile(null); if (proofInputRef.current) proofInputRef.current.value = ''; }}
                              className="ml-2 text-xs text-red-500 hover:underline"
                            >
                              {t('profile.remove')}
                            </button>
                          )}
                        </div>

                        {/* Error */}
                        {tError && (
                          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            {tError}
                          </div>
                        )}

                        {/* Submit */}
                        <button
                          type="submit"
                          disabled={tSubmitting || tText.length < 10 || !tConsentDisplay}
                          className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-teal-600 text-white font-medium hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {tSubmitting ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              {t('profile.sending')}
                            </>
                          ) : (
                            <>
                              <Check className="w-4 h-4" />
                              {t('profile.sendTestimonial')}
                            </>
                          )}
                        </button>
                      </div>
                    </motion.form>
                  )}
                </AnimatePresence>
              </div>
            )}
          </motion.div>

          {/* ============================================================= */}
          {/* Footer help link (existing)                                   */}
          {/* ============================================================= */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="text-center">
            <p className="text-sm text-gray-500">
              {t('account.needHelp')}{' '}
              <Link to="/contact" className="text-teal-600 hover:underline">{t('account.contactUs')}</Link>
            </p>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
