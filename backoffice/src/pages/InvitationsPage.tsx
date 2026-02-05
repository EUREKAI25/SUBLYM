import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Plus, Copy, Check, Link, Eye, UserCheck, X, Send, Mail, Phone, TrendingUp } from 'lucide-react';
import { PhoneInput } from '@/components/PhoneInput';

const API_URL = import.meta.env.VITE_API_URL || '/api/v1';
const FRONTEND_URL = 'http://localhost:5173';

const DEFAULT_MESSAGE_FR = `Bonjour,

Je vous offre un accès gratuit à SUBLYM, une application qui transforme vos rêves en vidéos personnalisées grâce à l'intelligence artificielle.

Cliquez sur le lien ci-dessous pour découvrir cette expérience unique !`;

const DEFAULT_MESSAGE_EN = `Hello,

I'm offering you free access to SUBLYM, an app that transforms your dreams into personalized videos using artificial intelligence.

Click the link below to discover this unique experience!`;

const PREDEFINED_MESSAGES: Record<string, { label: string; message: string }> = {
  standard_fr: { label: 'Standard (FR)', message: DEFAULT_MESSAGE_FR },
  standard_en: { label: 'Standard (EN)', message: DEFAULT_MESSAGE_EN },
  beta_fr: {
    label: 'Beta testeur (FR)',
    message: `Bonjour,

Merci d'avoir accepté de tester SUBLYM ! En tant que beta testeur, vous bénéficiez d'un accès gratuit avec des générations offertes.

N'hésitez pas à me faire vos retours, ils sont précieux pour améliorer l'expérience.`,
  },
  promo_fr: {
    label: 'Promo / Cadeau (FR)',
    message: `Bonjour,

Vous avez été sélectionné(e) pour recevoir un accès offert à SUBLYM !

Décrivez votre rêve le plus cher, uploadez quelques photos de vous, et laissez l'IA créer une vidéo personnalisée de votre rêve qui prend vie. C'est magique !`,
  },
};

interface Contact {
  id: number;
  email: string | null;
  phone: string | null;
  name: string | null;
  invitationId: number;
  source: string;
  userId: number | null;
  convertedAt: string | null;
  createdAt: string;
  invitation: { code: string; description: string | null };
}

interface ContactStats {
  total: number;
  converted: number;
  pending: number;
  conversionRate: number;
}

interface Invitation {
  id: number;
  code: string;
  description: string | null;
  maxUses: number;
  currentUses: number;
  freeGenerations: number;
  expiresAt: string | null;
  enabled: boolean;
  viewCount: number;
  targetEmail: string | null;
  sentAt: string | null;
  sentVia: string | null;
  createdAt: string;
  users: { id: number; email: string; firstName: string }[];
}

export function InvitationsPage() {
  const { fetchWithAuth } = useAuth();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactStats, setContactStats] = useState<ContactStats>({ total: 0, converted: 0, pending: 0, conversionRate: 0 });
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Create form
  const [description, setDescription] = useState('');
  const [freeGenerations, setFreeGenerations] = useState(1);
  const [maxUses, setMaxUses] = useState(1);
  const [expiresInDays, setExpiresInDays] = useState(30);
  const [targetEmail, setTargetEmail] = useState('');

  // Send form
  const [sendingInvId, setSendingInvId] = useState<number | null>(null);
  const [sendMethod, setSendMethod] = useState<'email' | 'sms'>('email');
  const [sendEmail, setSendEmail] = useState('');
  const [sendPhone, setSendPhone] = useState('');
  const [sendMessage, setSendMessage] = useState(DEFAULT_MESSAGE_FR);
  const [sendLang, setSendLang] = useState<string>('fr');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchData();
  }, [fetchWithAuth]);

  async function fetchData() {
    try {
      setLoading(true);
      const [invRes, contactsRes] = await Promise.all([
        fetchWithAuth(`${API_URL}/admin/invitations`),
        fetchWithAuth(`${API_URL}/admin/contacts`),
      ]);
      if (invRes.ok) {
        const data = await invRes.json();
        setInvitations(data.invitations || []);
      }
      if (contactsRes.ok) {
        const data = await contactsRes.json();
        setContacts(data.contacts || []);
        setContactStats(data.stats || { total: 0, converted: 0, pending: 0, conversionRate: 0 });
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchInvitations() {
    await fetchData();
  }

  async function createInvitation() {
    try {
      setCreating(true);
      const body: Record<string, unknown> = {
        freeGenerations,
        maxUses,
      };
      if (description.trim()) body.description = description.trim();
      if (expiresInDays > 0) body.expiresInDays = expiresInDays;
      if (targetEmail.trim()) body.targetEmail = targetEmail.trim();

      const res = await fetchWithAuth(`${API_URL}/admin/invitations`, {
        method: 'POST',
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setShowCreate(false);
        setDescription('');
        setFreeGenerations(1);
        setMaxUses(1);
        setExpiresInDays(30);
        setTargetEmail('');
        await fetchInvitations();
      } else {
        const err = await res.json();
        alert(err.error || 'Erreur lors de la création');
      }
    } catch (err) {
      console.error('Error creating invitation:', err);
      alert('Erreur lors de la création');
    } finally {
      setCreating(false);
    }
  }

  function openSendModal(inv: Invitation) {
    setSendingInvId(inv.id);
    setSendMethod('email');
    setSendEmail(inv.targetEmail || '');
    setSendPhone('');
    setSendMessage(DEFAULT_MESSAGE_FR);
    setSendLang('fr');
  }

  async function handleSend() {
    if (!sendingInvId) return;
    if (sendMethod === 'email' && !sendEmail.trim()) return;
    if (sendMethod === 'sms' && !sendPhone.trim()) return;

    try {
      setSending(true);
      const body: Record<string, unknown> = {
        method: sendMethod,
        message: sendMessage.trim(),
        lang: sendLang,
      };
      if (sendMethod === 'email') {
        body.email = sendEmail.trim();
      } else {
        body.phone = sendPhone.trim();
      }

      const res = await fetchWithAuth(`${API_URL}/admin/invitations/${sendingInvId}/send`, {
        method: 'POST',
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (data.success) {
        setSendingInvId(null);
        await fetchInvitations();
        alert(sendMethod === 'email' ? 'Invitation envoyée par email !' : 'Invitation envoyée par SMS !');
      } else {
        alert(data.message || 'Erreur lors de l\'envoi');
      }
    } catch (err) {
      console.error('Error sending invitation:', err);
      alert('Erreur lors de l\'envoi');
    } finally {
      setSending(false);
    }
  }

  function copyLink(code: string) {
    const link = `${FRONTEND_URL}/invite/${code}`;
    navigator.clipboard.writeText(link);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invitations</h1>
          <p className="text-gray-600 mt-1">
            Liens d'accès gratuit avec générations offertes
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Nouvelle invitation
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="card border-2 border-primary-200 bg-primary-50/30">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Nouvelle invitation</h2>
            <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-gray-200 rounded">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="label">Générations offertes</label>
              <input
                type="number"
                value={freeGenerations}
                onChange={(e) => setFreeGenerations(parseInt(e.target.value) || 1)}
                className="input"
                min={1}
                max={100}
              />
            </div>
            <div>
              <label className="label">Utilisations max</label>
              <input
                type="number"
                value={maxUses}
                onChange={(e) => setMaxUses(parseInt(e.target.value) || 1)}
                className="input"
                min={1}
                max={10000}
              />
              <p className="text-xs text-gray-500 mt-1">1 = lien personnel</p>
            </div>
            <div>
              <label className="label">Expire dans (jours)</label>
              <input
                type="number"
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(parseInt(e.target.value) || 0)}
                className="input"
                min={0}
                max={365}
              />
              <p className="text-xs text-gray-500 mt-1">0 = jamais</p>
            </div>
            <div>
              <label className="label">Email destinataire</label>
              <input
                type="email"
                value={targetEmail}
                onChange={(e) => setTargetEmail(e.target.value)}
                className="input"
                placeholder="optionnel"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="label">Description (interne)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input"
              placeholder="ex: Test beta Julien, Campagne YouTube..."
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowCreate(false)}
              className="btn-secondary"
            >
              Annuler
            </button>
            <button
              onClick={createInvitation}
              disabled={creating}
              className="btn-primary flex items-center gap-2"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Créer le lien
            </button>
          </div>
        </div>
      )}

      {/* Send Modal */}
      {sendingInvId !== null && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  {sendMethod === 'sms' ? (
                    <Phone className="w-5 h-5 text-primary-600" />
                  ) : (
                    <Mail className="w-5 h-5 text-primary-600" />
                  )}
                  <h2 className="text-lg font-semibold text-gray-900">Envoyer l'invitation</h2>
                </div>
                <button onClick={() => setSendingInvId(null)} className="p-1 hover:bg-gray-100 rounded">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Email / SMS toggle */}
                <div>
                  <label className="label">Mode d'envoi</label>
                  <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                    <button
                      onClick={() => setSendMethod('email')}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                        sendMethod === 'email'
                          ? 'bg-primary-600 text-white'
                          : 'bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <Mail className="w-4 h-4" />
                      Email
                    </button>
                    <button
                      onClick={() => setSendMethod('sms')}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                        sendMethod === 'sms'
                          ? 'bg-primary-600 text-white'
                          : 'bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <Phone className="w-4 h-4" />
                      SMS
                    </button>
                  </div>
                </div>

                {/* Email or Phone field */}
                {sendMethod === 'email' ? (
                  <div>
                    <label className="label">Email du destinataire</label>
                    <input
                      type="email"
                      value={sendEmail}
                      onChange={(e) => setSendEmail(e.target.value)}
                      className="input"
                      placeholder="prenom@email.com"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="label">Numéro de téléphone</label>
                    <PhoneInput
                      value={sendPhone}
                      onChange={setSendPhone}
                    />
                  </div>
                )}

                <div>
                  <label className="label">Langue</label>
                  <select
                    value={sendLang}
                    onChange={(e) => setSendLang(e.target.value)}
                    className="input"
                  >
                    <option value="fr">Français</option>
                    <option value="en">English</option>
                    <option value="de">Deutsch</option>
                    <option value="es">Español</option>
                    <option value="it">Italiano</option>
                  </select>
                </div>

                <div>
                  <label className="label">Message prédéfini</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {Object.entries(PREDEFINED_MESSAGES).map(([key, { label }]) => (
                      <button
                        key={key}
                        onClick={() => setSendMessage(PREDEFINED_MESSAGES[key].message)}
                        className="text-xs px-3 py-1.5 rounded-full border border-gray-300 hover:border-primary-400 hover:bg-primary-50 transition-colors"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="label">Message personnalisé</label>
                  <textarea
                    value={sendMessage}
                    onChange={(e) => setSendMessage(e.target.value)}
                    className="input min-h-[150px] resize-y"
                    rows={6}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Le lien d'invitation et le nombre de générations offertes seront ajoutés automatiquement.
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setSendingInvId(null)}
                  className="btn-secondary"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSend}
                  disabled={sending || (sendMethod === 'email' ? !sendEmail.trim() : !sendPhone.trim())}
                  className="btn-primary flex items-center gap-2"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {sendMethod === 'email' ? 'Envoyer par email' : 'Envoyer par SMS'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="card text-center">
          <p className="text-2xl font-bold text-gray-900">{invitations.length}</p>
          <p className="text-sm text-gray-600">Total invitations</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-green-600">
            {invitations.filter(i => i.enabled && (!i.expiresAt || new Date(i.expiresAt) > new Date())).length}
          </p>
          <p className="text-sm text-gray-600">Actives</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-primary-600">
            {invitations.reduce((sum, i) => sum + i.currentUses, 0)}
          </p>
          <p className="text-sm text-gray-600">Utilisations</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-gray-900">{contactStats.total}</p>
          <p className="text-sm text-gray-600">Contacts</p>
        </div>
        <div className="card text-center">
          <div className="flex items-center justify-center gap-1">
            <TrendingUp className="w-4 h-4 text-green-600" />
            <p className="text-2xl font-bold text-green-600">{contactStats.conversionRate}%</p>
          </div>
          <p className="text-sm text-gray-600">Taux conversion</p>
        </div>
      </div>

      {/* Contacts conversion table */}
      {contacts.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Contacts ({contactStats.converted}/{contactStats.total} convertis)
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Contact</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Invitation</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Source</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Statut</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((contact) => (
                  <tr key={contact.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-3">
                      <div>
                        {contact.name && <p className="font-medium text-gray-900">{contact.name}</p>}
                        <p className="text-gray-600">{contact.email || contact.phone || '-'}</p>
                      </div>
                    </td>
                    <td className="py-2 px-3">
                      <code className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded">
                        {contact.invitation.code}
                      </code>
                      {contact.invitation.description && (
                        <p className="text-xs text-gray-400 mt-0.5">{contact.invitation.description}</p>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                        {contact.source}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      {contact.convertedAt ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                          Converti
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">
                          En attente
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-gray-500">
                      {formatDate(contact.convertedAt || contact.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* List */}
      {invitations.length === 0 ? (
        <div className="card text-center py-12">
          <Link className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Aucune invitation</p>
          <p className="text-sm text-gray-400 mt-1">
            Créez un lien pour offrir des générations gratuites
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {invitations.map((inv) => {
            const isExpired = inv.expiresAt && new Date(inv.expiresAt) < new Date();
            const isFull = inv.currentUses >= inv.maxUses;
            const isActive = inv.enabled && !isExpired && !isFull;

            return (
              <div key={inv.id} className={`card ${!isActive ? 'opacity-60' : ''}`}>
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  {/* Code + Link */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <code className="text-lg font-mono font-bold text-primary-600 bg-primary-50 px-3 py-1 rounded">
                        {inv.code}
                      </code>
                      <button
                        onClick={() => copyLink(inv.code)}
                        className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                        title="Copier le lien"
                      >
                        {copiedCode === inv.code ? (
                          <Check className="w-4 h-4 text-green-600" />
                        ) : (
                          <Copy className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                      {isActive && (
                        <button
                          onClick={() => openSendModal(inv)}
                          className="p-1.5 hover:bg-primary-50 rounded transition-colors"
                          title="Envoyer par email ou SMS"
                        >
                          <Send className="w-4 h-4 text-primary-500" />
                        </button>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        isActive
                          ? 'bg-green-100 text-green-700'
                          : isExpired
                            ? 'bg-red-100 text-red-700'
                            : isFull
                              ? 'bg-orange-100 text-orange-700'
                              : 'bg-gray-100 text-gray-600'
                      }`}>
                        {isActive ? 'Actif' : isExpired ? 'Expiré' : isFull ? 'Complet' : 'Inactif'}
                      </span>
                      {inv.sentAt && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium flex items-center gap-1">
                          {inv.sentVia === 'sms' ? <Phone className="w-3 h-3" /> : <Mail className="w-3 h-3" />}
                          {inv.sentVia === 'sms' ? 'SMS envoyé' : 'Email envoyé'}
                        </span>
                      )}
                    </div>
                    {inv.description && (
                      <p className="text-sm text-gray-600 truncate">{inv.description}</p>
                    )}
                    {inv.targetEmail && (
                      <p className="text-xs text-gray-400">{inv.targetEmail}</p>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-center">
                      <p className="font-semibold text-gray-900">{inv.freeGenerations}</p>
                      <p className="text-xs text-gray-500">génération{inv.freeGenerations > 1 ? 's' : ''}</p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center gap-1">
                        <UserCheck className="w-3.5 h-3.5 text-gray-400" />
                        <span className="font-semibold text-gray-900">
                          {inv.currentUses}/{inv.maxUses}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">utilisé</p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center gap-1">
                        <Eye className="w-3.5 h-3.5 text-gray-400" />
                        <span className="font-semibold text-gray-900">{inv.viewCount}</span>
                      </div>
                      <p className="text-xs text-gray-500">vues</p>
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-gray-900">{formatDate(inv.expiresAt)}</p>
                      <p className="text-xs text-gray-500">expire</p>
                    </div>
                  </div>
                </div>

                {/* Users who used this invitation */}
                {inv.users && inv.users.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs text-gray-500 mb-1">Utilisateurs :</p>
                    <div className="flex flex-wrap gap-2">
                      {inv.users.map((u) => (
                        <span key={u.id} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                          {u.firstName} ({u.email})
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
