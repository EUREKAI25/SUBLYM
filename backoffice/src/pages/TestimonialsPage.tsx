import { useState, useEffect } from 'react';
import { Check, X, Play, FileText, Video, Loader2, Star } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const API_URL = 'http://localhost:8000/api/v1';

interface Testimonial {
  id: number;
  userId: number;
  text: string;
  rating: number | null;
  proofPath: string | null;
  videoPath: string | null;
  status: string;
  rejectionReason: string | null;
  consentDisplay: boolean;
  consentMarketing: boolean;
  createdAt: string;
  approvedAt: string | null;
  user: {
    id: number;
    email: string;
    firstName: string;
    lastName: string;
  };
}

export function TestimonialsPage() {
  const { token } = useAuth();
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchTestimonials();
  }, [token, filter]);

  async function fetchTestimonials() {
    if (!token) return;

    try {
      setLoading(true);
      const params = filter !== 'all' ? `?status=${filter}` : '';
      const response = await fetch(`${API_URL}/admin/testimonials${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setTestimonials(data.testimonials || []);
      }
    } catch (err) {
      console.error('Error fetching testimonials:', err);
    } finally {
      setLoading(false);
    }
  }

  const updateStatus = async (id: number, action: 'approve' | 'reject', reason?: string) => {
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/admin/testimonials/${id}/${action}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason }),
      });

      if (response.ok) {
        fetchTestimonials();
      }
    } catch (err) {
      console.error('Error updating testimonial:', err);
    }
  };

  const handleReject = (id: number) => {
    const reason = prompt('Raison du rejet (optionnel):');
    updateStatus(id, 'reject', reason || undefined);
  };

  const pendingCount = testimonials.filter(t => t.status === 'pending').length;
  const approvedCount = testimonials.filter(t => t.status === 'approved').length;
  const rejectedCount = testimonials.filter(t => t.status === 'rejected').length;

  if (loading && testimonials.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Témoignages</h1>
        <p className="text-gray-600 mt-1">Modérez les témoignages utilisateurs</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card text-center">
          <p className="text-3xl font-bold text-orange-600">{pendingCount}</p>
          <p className="text-sm text-gray-600">En attente</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-green-600">{approvedCount}</p>
          <p className="text-sm text-gray-600">Approuvés</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-red-600">{rejectedCount}</p>
          <p className="text-sm text-gray-600">Rejetés</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {['all', 'pending', 'approved', 'rejected'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-primary-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            {f === 'all' ? 'Tous' : f === 'pending' ? 'En attente' : f === 'approved' ? 'Approuvés' : 'Rejetés'}
          </button>
        ))}
      </div>

      {/* List */}
      {testimonials.length === 0 ? (
        <div className="card text-center py-8 text-gray-500">
          Aucun témoignage trouvé
        </div>
      ) : (
        <div className="space-y-4">
          {testimonials.map((testimonial) => (
            <div key={testimonial.id} className="card">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-medium text-gray-900">
                      {testimonial.user.firstName} {testimonial.user.lastName}
                    </span>
                    <span className="text-sm text-gray-500">{testimonial.user.email}</span>
                    {testimonial.rating && (
                      <span className="inline-flex items-center gap-1 text-yellow-500">
                        <Star className="w-4 h-4 fill-current" />
                        {testimonial.rating}/5
                      </span>
                    )}
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      testimonial.status === 'pending'
                        ? 'bg-orange-100 text-orange-700'
                        : testimonial.status === 'approved'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {testimonial.status === 'pending' ? 'En attente' : testimonial.status === 'approved' ? 'Approuvé' : 'Rejeté'}
                    </span>
                    <span className="text-sm text-gray-500">
                      {new Date(testimonial.createdAt).toLocaleDateString('fr-FR')}
                    </span>
                  </div>

                  <p className="text-gray-700 mb-2">{testimonial.text}</p>

                  {(testimonial.proofPath || testimonial.videoPath) && (
                    <div className="flex items-center gap-4 mt-2">
                      {testimonial.proofPath && (
                        <a 
                          href={`/storage/${testimonial.proofPath}`} 
                          target="_blank" 
                          rel="noopener"
                          className="inline-flex items-center gap-1 text-sm text-primary-600 hover:underline"
                        >
                          <FileText className="w-4 h-4" />
                          Voir la preuve
                        </a>
                      )}
                      {testimonial.videoPath && (
                        <a 
                          href={`/storage/${testimonial.videoPath}`} 
                          target="_blank" 
                          rel="noopener"
                          className="inline-flex items-center gap-1 text-sm text-primary-600 hover:underline"
                        >
                          <Video className="w-4 h-4" />
                          Voir la vidéo
                        </a>
                      )}
                    </div>
                  )}

                  {testimonial.rejectionReason && (
                    <p className="text-sm text-red-600 mt-2">
                      Raison du rejet: {testimonial.rejectionReason}
                    </p>
                  )}

                  <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                    {testimonial.consentDisplay && <span>✓ Consent affichage</span>}
                    {testimonial.consentMarketing && <span>✓ Consent marketing</span>}
                  </div>
                </div>

                {testimonial.status === 'pending' && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateStatus(testimonial.id, 'approve')}
                      className="p-2 bg-green-100 text-green-700 hover:bg-green-200 rounded-lg transition-colors"
                      title="Approuver"
                    >
                      <Check className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleReject(testimonial.id)}
                      className="p-2 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg transition-colors"
                      title="Rejeter"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
