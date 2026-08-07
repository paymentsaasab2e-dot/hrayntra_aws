import Link from 'next/link';
import {
  BookOpen,
  CircleHelp,
  Clock3,
  Mail,
  MessageCircle,
  Search,
  ShieldCheck,
  Sparkles,
  LifeBuoy,
  ArrowRight,
} from 'lucide-react';
import { HelpTicketForm } from '../../components/help/HelpTicketForm';

export const metadata = {
  title: 'Help Center',
  description: 'Find support articles, FAQs, and contact details for the HRYANTRA platform.',
};

const faqs = [
  {
    question: 'How do I find a candidate quickly?',
    answer:
      'Use the global search in the top bar to search candidates, clients, jobs, leads, and contacts from anywhere in the app.',
  },
  {
    question: 'Why do some menu items disappear?',
    answer:
      'Sidebar items are permission-based. If your role does not have access, the menu item stays hidden automatically.',
  },
  {
    question: 'How do I open the settings pages?',
    answer:
      'Open Settings from the sidebar, then use the left settings menu to switch between the available sections.',
  },
  {
    question: 'Can I get help from support?',
    answer:
      'Yes. Raise a support ticket on this page, or email the support team. Tickets are reviewed by HQ.',
  },
];

const quickLinks = [
  { title: 'Search the platform', description: 'Find records faster with global search.', icon: Search },
  { title: 'Read the guide', description: 'Browse setup tips and workflow walkthroughs.', icon: BookOpen },
  { title: 'Security tips', description: 'Keep access and data safe with role-based access.', icon: ShieldCheck },
];

export default function HelpCenterPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="relative overflow-hidden bg-[#0F2A44] text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(45,124,255,0.35),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.22),transparent_32%)]" />
        <div className="relative mx-auto max-w-6xl px-6 py-16 lg:px-8 lg:py-20">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/80">
              <LifeBuoy className="h-3.5 w-3.5" />
              Help Center
            </div>
            <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl">
              Answers, guidance, and support in one place.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-200">
              Use this page to learn the platform, understand permissions, and raise a support ticket when you need a
              hand.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#raise-ticket"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-black/10 transition-transform hover:-translate-y-0.5"
              >
                <MessageCircle className="h-4 w-4" />
                Raise a ticket
              </a>
              <a
                href="#faq"
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/8 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/12"
              >
                <CircleHelp className="h-4 w-4" />
                Jump to FAQ
              </a>
              <a
                href="mailto:support@hryantra.com"
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/8 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/12"
              >
                <Mail className="h-4 w-4" />
                Email support
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-10 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {quickLinks.map((item) => (
            <div key={item.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-900">
                <item.icon className="h-5 w-5" />
              </div>
              <h2 className="text-lg font-semibold text-slate-900">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
            </div>
          ))}
        </div>

        <div id="raise-ticket" className="mt-10">
          <HelpTicketForm />
        </div>

        <div id="faq" className="mt-10 grid gap-8 lg:grid-cols-[1.4fr_0.9fr]">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Frequently asked questions</h2>
                <p className="text-sm text-slate-500">Common questions about using the platform.</p>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              {faqs.map((item) => (
                <div key={item.question} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <h3 className="text-sm font-semibold text-slate-900">{item.question}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.answer}</p>
                </div>
              ))}
            </div>
          </section>

          <aside className="space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                  <MessageCircle className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Contact support</h2>
                  <p className="text-sm text-slate-500">We usually reply within one business day.</p>
                </div>
              </div>

              <div className="mt-6 space-y-3 text-sm">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="font-semibold text-slate-900">Email</div>
                  <div className="mt-1 text-slate-600">support@hryantra.com</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="font-semibold text-slate-900">Hours</div>
                  <div className="mt-1 text-slate-600">Mon to Fri, 9:00 AM to 6:00 PM</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="font-semibold text-slate-900">Response time</div>
                  <div className="mt-1 text-slate-600">Usually within 24 hours</div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl bg-[#0F2A44] p-6 text-white shadow-sm">
              <div className="flex items-center gap-3">
                <Clock3 className="h-5 w-5 text-teal-300" />
                <h2 className="text-xl font-bold">Need a quicker answer?</h2>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-200">
                Use the global search bar or jump back to the dashboard to continue working while we help you out.
              </p>
              <Link
                href="/dashboard"
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-teal-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-transform hover:-translate-y-0.5"
              >
                Back to dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
