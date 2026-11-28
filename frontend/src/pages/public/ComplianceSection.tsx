import React, { useState } from 'react';

export type ComplianceSlug =
  | 'privacy-policy'
  | 'terms'
  | 'refund-policy'
  | 'pricing'
  | 'about'
  | 'contact'
  | 'delete-account';

interface CompliancePageProps {
  slug: ComplianceSlug;
  onNavigate: (slug: ComplianceSlug) => void;
  onBackHome: () => void;
}

const COMPLIANCE_META: Record<
  ComplianceSlug,
  { title: string; subtitle: string; badge: string; icon: string }
> = {
  'privacy-policy': {
    title: 'Privacy Policy',
    subtitle: 'How StayNest collects, uses, secures, and protects your data',
    badge: 'Play Store & Razorpay Compliant',
    icon: 'fa-shield-halved',
  },
  terms: {
    title: 'Terms & Conditions',
    subtitle: 'Platform usage terms for PG owners, landlords, and residents',
    badge: 'Service Agreement',
    icon: 'fa-file-contract',
  },
  'refund-policy': {
    title: 'Refund & Cancellation Policy',
    subtitle: 'UPI AutoPay cancellation, free trial, and booking refund guidelines',
    badge: 'Zero Lock-In',
    icon: 'fa-rotate-left',
  },
  pricing: {
    title: 'Pricing & Billing Transparency',
    subtitle: 'Clear ₹ plans for StayNest Owner App & resident bookings',
    badge: 'Transparent Pricing',
    icon: 'fa-indian-rupee-sign',
  },
  about: {
    title: 'About StayNest',
    subtitle: 'Smart PG, Hostel & Rental Property Management Platform',
    badge: 'India',
    icon: 'fa-building',
  },
  contact: {
    title: 'Contact Us & Grievance Support',
    subtitle: 'Reach our support team for billing, KYC, or account help',
    badge: 'Mon–Sat • 9 AM – 7 PM IST',
    icon: 'fa-headset',
  },
  'delete-account': {
    title: 'Delete Account & Personal Data',
    subtitle: 'Request permanent deletion of your StayNest account and profile data',
    badge: 'Data Safety',
    icon: 'fa-user-xmark',
  },
};

export const CompliancePage: React.FC<CompliancePageProps> = ({
  slug,
  onNavigate,
  onBackHome,
}) => {
  const meta = COMPLIANCE_META[slug];
  const [deletePhone, setDeletePhone] = useState('');
  const [deleteEmail, setDeleteEmail] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteSubmitted, setDeleteSubmitted] = useState(false);

  const handleDeletionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!deletePhone.trim() && !deleteEmail.trim()) return;
    setDeleteSubmitted(true);
    const subject = encodeURIComponent('StayNest Account Deletion Request');
    const body = encodeURIComponent(
      `Please permanently delete my StayNest account and personal data.\n\nRegistered Phone: ${deletePhone || 'N/A'}\nEmail: ${deleteEmail || 'N/A'}\nReason: ${deleteReason || 'User requested deletion'}`
    );
    window.location.href = `mailto:n.saikrishna@gmail.com?subject=${subject}&body=${body}`;
  };

  return (
    <section className="flex-grow bg-gradient-to-b from-slate-900 via-[#111827] to-slate-950 text-slate-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <button
            onClick={onBackHome}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-bold text-white transition"
          >
            <i className="fa-solid fa-arrow-left"></i> Back to StayNest Home
          </button>
          <span className="text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30">
            {meta.badge}
          </span>
        </div>

        {/* Quick Page Switcher Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {(Object.keys(COMPLIANCE_META) as ComplianceSlug[]).map((key) => {
            const active = key === slug;
            return (
              <button
                key={key}
                onClick={() => onNavigate(key)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                  active
                    ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/25'
                    : 'bg-white/5 text-slate-300 hover:bg-white/10 border border-white/10'
                }`}
              >
                {COMPLIANCE_META[key].title}
              </button>
            );
          })}
        </div>

        <div className="bg-slate-800/70 backdrop-blur-md border border-slate-700/80 rounded-3xl p-6 sm:p-10 shadow-2xl">
          <div className="flex items-start gap-4 border-b border-slate-700 pb-6 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-orange-500/20 border border-orange-400/30 flex items-center justify-center text-orange-400 text-xl shrink-0">
              <i className={`fa-solid ${meta.icon}`}></i>
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-white">{meta.title}</h1>
              <p className="text-sm text-slate-300 mt-1">{meta.subtitle}</p>
              <p className="text-xs text-slate-400 mt-1">
                Last Updated: November 2026 • StayNest India
              </p>
            </div>
          </div>

          {slug === 'privacy-policy' && (
            <div className="space-y-5 text-sm text-slate-200 leading-relaxed">
              <div>
                <h2 className="text-base font-extrabold text-amber-300 mb-1">1. Information We Collect</h2>
                <p>
                  StayNest collects account details (full name, phone number, email address), property listings (property name, address, GPS coordinates, room/bed inventory, rent & deposit amounts), and resident onboarding/KYC records entered by property owners solely to operate StayNest&apos;s PG and rental management services.
                </p>
              </div>
              <div>
                <h2 className="text-base font-extrabold text-amber-300 mb-1">2. How We Use Information</h2>
                <p>
                  Your data is used to authenticate your account via OTP, manage property rooms and resident stays, generate rent invoices and payment receipts, send owner-initiated rent reminders, and process subscription mandates via Razorpay.
                </p>
              </div>
              <div>
                <h2 className="text-base font-extrabold text-amber-300 mb-1">3. Payments & Third-Party Services</h2>
                <p>
                  Online payments and UPI AutoPay mandates are processed securely through <strong>Razorpay</strong>. StayNest does not store raw UPI PINs, bank passwords, or full card numbers on its servers. All network communication uses HTTPS/TLS encryption.
                </p>
              </div>
              <div>
                <h2 className="text-base font-extrabold text-amber-300 mb-1">4. Data Retention & Deletion</h2>
                <p>
                  We do not sell or rent user or tenant data to advertisers. You can permanently delete your account inside the StayNest Owner app (<strong>Profile → Account &amp; Security → Delete Account &amp; Personal Data</strong>) or via our{' '}
                  <button
                    onClick={() => onNavigate('delete-account')}
                    className="text-orange-400 underline font-bold"
                  >
                    Account Deletion Request page
                  </button>
                  .
                </p>
              </div>
            </div>
          )}

          {slug === 'terms' && (
            <div className="space-y-5 text-sm text-slate-200 leading-relaxed">
              <div>
                <h2 className="text-base font-extrabold text-amber-300 mb-1">1. Acceptance of Terms</h2>
                <p>
                  By accessing the StayNest website or StayNest PG Owner mobile application, you agree to be bound by these Terms &amp; Conditions and all applicable Indian laws and local housing regulations.
                </p>
              </div>
              <div>
                <h2 className="text-base font-extrabold text-amber-300 mb-1">2. Owner &amp; Property Accuracy</h2>
                <p>
                  Property owners and managers are solely responsible for ensuring that listed rents, deposits, amenities, availability, and tenant KYC records are accurate and lawfully maintained.
                </p>
              </div>
              <div>
                <h2 className="text-base font-extrabold text-amber-300 mb-1">3. Subscriptions &amp; Billing</h2>
                <p>
                  StayNest offers a Free Starter tier and optional Pro plans (30-day free trial followed by ₹149/month or ₹1,099/year via Razorpay UPI AutoPay). Auto-renewal continues until cancelled by the owner prior to the next billing date.
                </p>
              </div>
              <div>
                <h2 className="text-base font-extrabold text-amber-300 mb-1">4. Limitation of Liability &amp; Governing Law</h2>
                <p>
                  StayNest provides software tools for property management and discovery. Tenancy agreements are strictly between the property owner and resident. These terms are governed by the laws of India.
                </p>
              </div>
            </div>
          )}

          {slug === 'refund-policy' && (
            <div className="space-y-5 text-sm text-slate-200 leading-relaxed">
              <div>
                <h2 className="text-base font-extrabold text-amber-300 mb-1">1. 30-Day Free Trial &amp; AutoPay Cancellation</h2>
                <p>
                  New StayNest Pro subscriptions include a 30-day free trial (₹0 charged upfront). Owners can cancel UPI AutoPay anytime in one tap inside the app under <strong>Profile → StayNest Plan → Cancel AutoPay</strong> with zero cancellation fees.
                </p>
              </div>
              <div>
                <h2 className="text-base font-extrabold text-amber-300 mb-1">2. Subscription Refunds</h2>
                <p>
                  If a recurring charge occurs due to a technical error, duplicate payment, or after a verified cancellation before the renewal timestamp, StayNest will issue a 100% refund within <strong>5–7 business days</strong> to the original payment method.
                </p>
              </div>
              <div>
                <h2 className="text-base font-extrabold text-amber-300 mb-1">3. PG / Rental Booking Cancellations</h2>
                <p>
                  For resident bed holds or bookings made through StayNest, cancellation and refund eligibility follows the specific property&apos;s cancellation policy shown prior to booking confirmation (typically free cancellation up to 48 hours before check-in).
                </p>
              </div>
              <div>
                <h2 className="text-base font-extrabold text-amber-300 mb-1">4. How to Request a Refund</h2>
                <p>
                  Email <strong>n.saikrishna@gmail.com</strong> or call <strong>+91 9515614331</strong> with your registered phone number and Razorpay Payment ID / Transaction reference.
                </p>
              </div>
            </div>
          )}

          {slug === 'pricing' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-sm">
              <div className="rounded-2xl bg-slate-900/80 border border-slate-700 p-5">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Starter</span>
                <div className="text-3xl font-black text-white mt-2">₹0 <span className="text-xs font-semibold text-slate-400">/ month</span></div>
                <p className="text-xs text-slate-300 mt-2">Best for single-building PG owners getting started.</p>
                <ul className="mt-4 space-y-2 text-xs text-slate-300">
                  <li>✓ 1 Property &amp; Floor/Room matrix</li>
                  <li>✓ Tenant onboarding &amp; KYC tracking</li>
                  <li>✓ 5 WhatsApp rent reminders / month</li>
                </ul>
              </div>
              <div className="rounded-2xl bg-gradient-to-br from-orange-500/20 to-amber-500/10 border-2 border-orange-400 p-5">
                <span className="text-xs font-extrabold uppercase tracking-wider text-orange-300">StayNest Pro (Monthly)</span>
                <div className="text-3xl font-black text-white mt-2">₹149 <span className="text-xs font-semibold text-slate-300">/ month</span></div>
                <p className="text-xs text-amber-200 mt-2">₹0 for first 30 days • Cancel anytime via UPI AutoPay.</p>
                <ul className="mt-4 space-y-2 text-xs text-slate-200">
                  <li>✓ Unlimited properties, rooms &amp; beds</li>
                  <li>✓ Unlimited WhatsApp rent reminders</li>
                  <li>✓ Automated monthly rent &amp; utility ledger</li>
                </ul>
              </div>
              <div className="rounded-2xl bg-slate-900/80 border border-slate-700 p-5">
                <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-400">StayNest Pro (Yearly)</span>
                <div className="text-3xl font-black text-white mt-2">₹1,099 <span className="text-xs font-semibold text-slate-400">/ year</span></div>
                <p className="text-xs text-slate-300 mt-2">Save compared to monthly billing (all taxes included).</p>
                <ul className="mt-4 space-y-2 text-xs text-slate-300">
                  <li>✓ All Pro features included</li>
                  <li>✓ Priority WhatsApp &amp; phone support</li>
                  <li>✓ Zero hidden platform fees</li>
                </ul>
              </div>
            </div>
          )}

          {slug === 'about' && (
            <div className="space-y-4 text-sm text-slate-200 leading-relaxed">
              <p>
                <strong>StayNest</strong> is an Indian smart PG, hostel, and rental property management platform built to help owners digitize rooms, beds, resident KYC, rent invoicing, electricity billing, and expense tracking—while giving tenants a transparent discovery experience.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="rounded-2xl bg-slate-900/80 border border-slate-700 p-4">
                  <div className="text-xs font-bold uppercase text-amber-300">Business &amp; Grievance Contact</div>
                  <div className="mt-2 text-white font-bold">StayNest Smart PG Living</div>
                  <div className="text-slate-300 text-xs mt-1">Grievance Officer: Saikrishna Naraharisetti</div>
                  <div className="text-slate-300 text-xs mt-1">Bengaluru, Karnataka, India</div>
                </div>
                <div className="rounded-2xl bg-slate-900/80 border border-slate-700 p-4">
                  <div className="text-xs font-bold uppercase text-amber-300">Official Support Channels</div>
                  <div className="text-slate-200 text-xs mt-2">Phone: +91 9515614331</div>
                  <div className="text-slate-200 text-xs mt-1">Email: n.saikrishna@gmail.com</div>
                  <div className="text-slate-400 text-xs mt-1">Hours: Mon–Sat, 9:00 AM – 7:00 PM IST</div>
                </div>
              </div>
            </div>
          )}

          {slug === 'contact' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-sm">
              <div className="rounded-2xl bg-slate-900/80 border border-slate-700 p-5">
                <div className="text-xs font-bold uppercase text-amber-300">Customer &amp; Owner Support</div>
                <p className="text-slate-300 mt-2 text-xs leading-relaxed">
                  For Razorpay payment queries, subscription cancellations, booking assistance, or data privacy requests:
                </p>
                <div className="mt-4 space-y-2 text-xs">
                  <div><strong className="text-white">Phone:</strong> <a href="tel:9515614331" className="text-orange-400 hover:underline">+91 9515614331</a></div>
                  <div><strong className="text-white">Email:</strong> <a href="mailto:n.saikrishna@gmail.com" className="text-orange-400 hover:underline">n.saikrishna@gmail.com</a></div>
                  <div><strong className="text-white">Location:</strong> <span className="text-slate-300">Bengaluru, Karnataka, India</span></div>
                </div>
              </div>
              <div className="rounded-2xl bg-slate-900/80 border border-slate-700 p-5">
                <div className="text-xs font-bold uppercase text-amber-300">Grievance Redressal</div>
                <p className="text-slate-300 mt-2 text-xs leading-relaxed">
                  In accordance with Indian IT &amp; Payment Aggregator guidelines, grievances are acknowledged within 24 hours and resolved within 5–7 business days.
                </p>
                <div className="mt-4 space-y-1 text-xs text-slate-300">
                  <div><strong className="text-white">Officer:</strong> Saikrishna Naraharisetti</div>
                  <div><strong className="text-white">Hours:</strong> Mon–Sat, 9:00 AM – 7:00 PM IST</div>
                </div>
              </div>
            </div>
          )}

          {slug === 'delete-account' && (
            <div className="space-y-5 text-sm text-slate-200">
              <div className="rounded-2xl bg-rose-500/10 border border-rose-400/30 p-4 text-xs text-rose-200 leading-relaxed">
                <strong>Instant In-App Deletion:</strong> Open the StayNest PG Owner app → go to <strong>Profile → Account &amp; Security → Delete Account &amp; Personal Data</strong> to immediately anonymize your profile and deactivate your account.
              </div>
              <form onSubmit={handleDeletionSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Registered Phone Number</label>
                    <input
                      type="tel"
                      value={deletePhone}
                      onChange={(e) => setDeletePhone(e.target.value)}
                      placeholder="+91 9876543210"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-orange-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Registered Email Address</label>
                    <input
                      type="email"
                      value={deleteEmail}
                      onChange={(e) => setDeleteEmail(e.target.value)}
                      placeholder="owner@example.com"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-orange-400"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Reason (Optional)</label>
                  <input
                    type="text"
                    value={deleteReason}
                    onChange={(e) => setDeleteReason(e.target.value)}
                    placeholder="No longer using StayNest"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-orange-400"
                  />
                </div>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold transition"
                >
                  Submit Account Deletion Request
                </button>
                {deleteSubmitted && (
                  <p className="text-xs text-emerald-300 font-semibold">
                    ✓ Your email client has been opened to complete the deletion request with n.saikrishna@gmail.com.
                  </p>
                )}
              </form>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

interface ComplianceFooterProps {
  onNavigate: (slug: ComplianceSlug) => void;
}

export const ComplianceFooter: React.FC<ComplianceFooterProps> = ({ onNavigate }) => {
  return (
    <footer className="bg-gradient-to-br from-slate-900 via-[#161b33] to-slate-950 text-slate-200 border-t-4 border-orange-500 mt-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand Summary */}
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-orange-500 flex items-center justify-center text-white font-black text-lg shadow-lg shadow-orange-500/30">
                S
              </div>
              <div>
                <div className="text-base font-black text-white tracking-tight">StayNest</div>
                <div className="text-[11px] font-semibold text-amber-300">Smart PG &amp; Rental Living</div>
              </div>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Verified PG accommodations, room inventory management, resident KYC, and automated rent billing across India.
            </p>
          </div>

          {/* Group 1: Policies & Legal */}
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-amber-300 mb-3">
              Policies &amp; Legal
            </h3>
            <ul className="space-y-2 text-xs">
              <li>
                <a
                  href="/privacy-policy"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate('privacy-policy');
                  }}
                  className="text-slate-300 hover:text-orange-400 transition"
                >
                  Privacy Policy
                </a>
              </li>
              <li>
                <a
                  href="/terms"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate('terms');
                  }}
                  className="text-slate-300 hover:text-orange-400 transition"
                >
                  Terms &amp; Conditions
                </a>
              </li>
              <li>
                <a
                  href="/refund-policy"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate('refund-policy');
                  }}
                  className="text-slate-300 hover:text-orange-400 transition"
                >
                  Refund &amp; Cancellation Policy
                </a>
              </li>
              <li>
                <a
                  href="/pricing"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate('pricing');
                  }}
                  className="text-slate-300 hover:text-orange-400 transition"
                >
                  Pricing &amp; Plans
                </a>
              </li>
            </ul>
          </div>

          {/* Group 2: Business & Support */}
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-amber-300 mb-3">
              Business &amp; Support
            </h3>
            <ul className="space-y-2 text-xs">
              <li>
                <a
                  href="/about"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate('about');
                  }}
                  className="text-slate-300 hover:text-orange-400 transition"
                >
                  About StayNest
                </a>
              </li>
              <li>
                <a
                  href="/contact"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate('contact');
                  }}
                  className="text-slate-300 hover:text-orange-400 transition"
                >
                  Contact Us &amp; Grievance
                </a>
              </li>
              <li className="text-slate-400">Phone: +91 9515614331</li>
              <li className="text-slate-400">Email: n.saikrishna@gmail.com</li>
            </ul>
          </div>

          {/* Group 3: Account & Data Safety */}
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-amber-300 mb-3">
              Account &amp; Data Safety
            </h3>
            <ul className="space-y-2 text-xs">
              <li>
                <a
                  href="/delete-account"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate('delete-account');
                  }}
                  className="text-rose-300 hover:text-rose-200 font-semibold transition"
                >
                  Delete Account &amp; Personal Data
                </a>
              </li>
              <li className="text-slate-400 leading-relaxed">
                Payments secured by Razorpay. HTTPS encrypted in transit.
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-800 mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-400">
          <span>© {new Date().getFullYear()} StayNest India. All rights reserved.</span>
          <span>Bengaluru, Karnataka • Support: +91 9515614331</span>
        </div>
      </div>
    </footer>
  );
};
