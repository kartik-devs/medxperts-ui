import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../../components/Header';

const services = [
  { id: 'quick_projection', label: 'Quick Cost Projection' },
  { id: 'record_review', label: 'Medical Record Review' },
  { id: 'cost_projection', label: 'Medical Cost Projection' },
  { id: 'lcp_review', label: 'LCP Review' },
  { id: 'lcp', label: 'Life Care Plan' },
];

const urgencyLevels = [
  { id: 'low', label: 'Low (5+ days)' },
  { id: 'medium', label: 'Medium (2-4 days)' },
  { id: 'high', label: 'High (within 48 hours)' },
  { id: 'critical', label: 'Critical (same day)' },
];

export default function QuickCostProjectionPage() {
  const [selectedService, setSelectedService] = useState('');
  const [timeline, setTimeline] = useState('');
  const [urgency, setUrgency] = useState('');
  const [budget, setBudget] = useState('');
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [files, setFiles] = useState(null);

  const summary = useMemo(
    () => ({
      service: services.find((service) => service.id === selectedService)?.label || 'Not selected',
      timeline: timeline || 'Not provided',
      urgency: urgencyLevels.find((level) => level.id === urgency)?.label || 'Not provided',
      budget: budget ? `$${budget}` : 'Not provided',
      notes: notes || 'Not provided',
      contactName: contactName || 'Not provided',
      contactEmail: contactEmail || 'Not provided',
      contactPhone: contactPhone || 'Not provided',
      attachments:
        files && files.length
          ? `${files.length} file${files.length > 1 ? 's' : ''} selected`
          : 'No attachments',
    }),
    [selectedService, timeline, urgency, budget, notes, contactName, contactEmail, contactPhone, files]
  );

  function handleSubmit(event) {
    event.preventDefault();
    setSubmitted(true);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50/40 flex flex-col">
      <Header />
      <main className="flex-1 px-4 py-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <form
              onSubmit={handleSubmit}
              className="lg:col-span-2 bg-white border border-gray-200 rounded-lg p-6 space-y-6"
            >
              <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-900">Cost Projection</h1>
                <Link
                  to="/"
                  className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50"
                >
                  ← Back to Home
                </Link>
              </div>

              {/* HIPAA notice */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <span className="text-blue-600 text-xl">🛡️</span>
                  <div>
                    <h4 className="font-semibold text-blue-900 text-sm mb-1">
                      ✓ HIPAA Compliant Platform
                    </h4>
                    <p className="text-xs text-blue-700">
                      Your data and patient information are secured with enterprise-grade encryption
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Service Selection <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedService}
                  onChange={(event) => setSelectedService(event.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Choose a service</option>
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Projected Timeline <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g., Complete within 3 business days"
                  value={timeline}
                  onChange={(event) => setTimeline(event.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Urgency <span className="text-red-500">*</span>
                </label>
                <select
                  value={urgency}
                  onChange={(event) => setUrgency(event.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select urgency level</option>
                  {urgencyLevels.map((level) => (
                    <option key={level.id} value={level.id}>
                      {level.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Budget Estimate (USD) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="e.g., 1500"
                  value={budget}
                  onChange={(event) => setBudget(event.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Notes <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={4}
                  placeholder="Provide additional context, case specifics, or attachments list."
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Identity / Contact Section */}
              <div className="border-t border-gray-200 pt-4 mt-2 space-y-4">
                <h2 className="text-lg font-semibold text-gray-900">Identity &amp; Contact</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Contact Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={contactName}
                      onChange={(event) => setContactName(event.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Contact Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={contactEmail}
                      onChange={(event) => setContactEmail(event.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Contact Phone <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g., (555) 123-4567"
                    value={contactPhone}
                    onChange={(event) => setContactPhone(event.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="flex items-start gap-2">
                  <input
                    id="attestation"
                    type="checkbox"
                    required
                    className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded"
                  />
                  <label htmlFor="attestation" className="text-xs text-gray-700">
                    {selectedService === 'lcp' && (
                      <Link
                        to="/lifecareplan"
                        className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
                      >
                        Go to Life Care Plan Progress
                      </Link>
                    )}
                    I confirm I am authorized to submit this patient and case information and that all PHI is shared in
                    compliance with applicable laws.
                  </label>
                </div>
              </div>

              {/* Attachments Section */}
              <div className="border-t border-gray-200 pt-4 mt-2 space-y-3">
                <h2 className="text-lg font-semibold text-gray-900">Attachments</h2>
                <p className="text-xs text-gray-600">
                  Optionally attach key documents (intake sheets, police reports, prior projections, etc.).
                </p>

                <label className="block">
                  <span className="block text-sm font-semibold text-gray-700 mb-2">Upload Documents</span>
                  <input
                    type="file"
                    multiple
                    onChange={(event) => setFiles(event.target.files)}
                    className="block w-full text-sm text-gray-700
                               file:mr-4 file:py-2 file:px-4
                               file:rounded-lg file:border-0
                               file:text-sm file:font-semibold
                               file:bg-blue-50 file:text-blue-700
                               hover:file:bg-blue-100"
                  />
                </label>

                {files && files.length > 0 && (
                  <ul className="mt-2 text-xs text-gray-600 list-disc list-inside">
                    {Array.from(files).map((file) => (
                      <li key={file.name}>
                        {file.name} ({Math.round(file.size / 1024)} KB)
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <button
                type="submit"
                className="w-full md:w-auto px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
              >
                Submit
              </button>

              {submitted && (
                <p className="text-sm text-green-600">Form submitted. OPS will review the details shortly.</p>
              )}
            </form>

            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Summary</h2>

              <dl className="space-y-4 text-sm text-gray-700">
                <div>
                  <dt className="font-semibold text-gray-900">Service</dt>
                  <dd>{summary.service}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-gray-900">Timeline</dt>
                  <dd>{summary.timeline}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-gray-900">Urgency</dt>
                  <dd>{summary.urgency}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-gray-900">Budget Estimate</dt>
                  <dd>{summary.budget}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-gray-900">Notes</dt>
                  <dd className="whitespace-pre-wrap">{summary.notes}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-gray-900">Contact Name</dt>
                  <dd>{summary.contactName}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-gray-900">Contact Email</dt>
                  <dd>{summary.contactEmail}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-gray-900">Contact Phone</dt>
                  <dd>{summary.contactPhone}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-gray-900">Attachments</dt>
                  <dd>{summary.attachments}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}