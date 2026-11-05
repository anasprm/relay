'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Check,
  FileText,
  Ghost,
  Lock,
  MessageSquareText,
  Mic,
  MonitorSmartphone,
  Phone,
  Plus,
  ShieldCheck,
  Users,
  Video,
} from 'lucide-react';

import { Avatar } from '@/components/ui/Avatar';
import { Logo } from '@/components/ui/Logo';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { UiStyleToggle } from '@/components/ui/UiStyleToggle';
import { useAuth } from '@/lib/AuthProvider';
import { DEVELOPER } from '@/lib/developer';

const FAQ = [
  {
    q: 'How do I create an account?',
    a: 'Choose a username and a password. No email address or phone number is needed. Accounts are kept inside the workspace they were created in.',
  },
  {
    q: 'How do I start a call?',
    a: 'Open a conversation or a group and choose the audio or video button. Allow camera and microphone access when the browser asks. Group calls connect every participant directly to the others.',
  },
  {
    q: 'Why can’t my browser use the camera or microphone?',
    a: 'The site needs camera and microphone permission. Open the site controls next to the address bar, allow both, then reload. Messages and uploads keep working without them.',
  },
  {
    q: 'Can I use Relay on my phone?',
    a: 'Yes. Relay runs in a mobile browser, so there is nothing to install. Sign in with the same account and your conversations are there.',
  },
  {
    q: 'What happens in vanish mode?',
    a: 'Messages sent while vanish mode is on are removed for both sides when you leave the thread. The server deletes them; they are not just hidden in the browser.',
  },
  {
    q: 'Who can see my status?',
    a: 'You choose Everyone in the workspace or Close friends when you post. Statuses expire after 24 hours, and the server filters who receives them.',
  },
];

const MESSAGE_FEATURES = [
  {
    icon: MessageSquareText,
    title: 'Replies and reactions',
    copy: 'Reply to a specific message, react with an emoji, star it, or forward it to another conversation.',
  },
  {
    icon: FileText,
    title: 'Files, photos, and voice notes',
    copy: 'Send images, documents, video clips, and recorded voice notes up to 30 MB, with previews in the thread.',
  },
  {
    icon: Users,
    title: 'Groups',
    copy: 'Create a group, add members by username, and start a call with everyone from the group header.',
  },
  {
    icon: MonitorSmartphone,
    title: 'Stories that expire',
    copy: 'Post a text or photo status for everyone or close friends. It disappears after 24 hours.',
  },
];

function StoreBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-panel px-3 py-1 text-[12px] text-muted">
      <Check size={12} className="text-accent" />
      {children}
    </span>
  );
}

export function WelcomeScreen() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) router.replace('/chat');
  }, [loading, router, user]);

  return (
    <div className="flex min-h-dvh flex-col bg-panel">
      <header className="sticky top-0 z-40 border-b border-line bg-panel">
        <div className="mx-auto flex h-[59px] w-full max-w-6xl items-center gap-3 px-4 sm:px-6">
          <Link href="/" aria-label="Relay home">
            <Logo />
          </Link>

          <nav className="ml-8 hidden items-center gap-7 text-[13px] text-muted lg:flex">
            <a href="#features" className="transition-colors hover:text-ink">
              Features
            </a>
            <a href="#calls" className="transition-colors hover:text-ink">
              Calls
            </a>
            <a href="#privacy" className="transition-colors hover:text-ink">
              Privacy
            </a>
            <a href="#faq" className="transition-colors hover:text-ink">
              FAQ
            </a>
          </nav>

          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <UiStyleToggle compact />
            <ThemeToggle compact />
            <Link
              href="/login"
              className="hidden h-9 items-center rounded-full px-3 text-[13px] text-ink transition-colors hover:bg-panel-2 sm:inline-flex"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="inline-flex h-9 items-center rounded-full bg-accent px-4 text-[13px] text-accent-ink transition-colors hover:bg-accent-hover"
            >
              Create account
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="border-b border-line bg-accent-soft">
          <div className="mx-auto w-full max-w-6xl px-4 pb-12 pt-14 text-center sm:px-6 sm:pt-16">
            <h1 className="mx-auto max-w-3xl text-[38px] font-normal leading-[1.08] tracking-[-0.02em] text-ink sm:text-[52px]">
              Connection is a call away
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-[15px] leading-[23px] text-muted">
              Message, call, and share with the people in your workspace. Relay runs in the
              browser — no download, no phone number, no third-party login.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
              <Link
                href="/register"
                className="inline-flex h-10 items-center gap-2 rounded-full bg-accent px-5 text-[13.5px] text-accent-ink transition-colors hover:bg-accent-hover"
              >
                Create account
                <ArrowRight size={15} />
              </Link>
              <Link
                href="/login"
                className="inline-flex h-10 items-center rounded-full border border-line bg-panel px-5 text-[13.5px] text-ink transition-colors hover:bg-panel-2"
              >
                Sign in
              </Link>
            </div>
            <p className="mt-3 text-[11.5px] text-faint">
              Audio and video calls need camera and microphone permission.
            </p>

            <div className="relative mx-auto mt-10 max-w-4xl text-left">
              <div className="overflow-hidden rounded-2xl border border-line bg-panel shadow-[0_24px_70px_-40px_rgba(11,20,26,0.5)]">
                <div className="flex items-center gap-3 border-b border-line bg-header px-4 py-2.5">
                  <Avatar
                    user={{ displayName: 'Alice Morgan', accent: 'indigo' }}
                    size="md"
                    online
                  />
                  <div className="min-w-0">
                    <p className="truncate text-[14px] text-ink">Alice Morgan</p>
                    <p className="text-[12px] text-muted">online</p>
                  </div>
                  <div className="ml-auto flex items-center gap-2 text-muted" aria-hidden="true">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full border border-line">
                      <Phone size={16} />
                    </span>
                    <span className="flex h-9 w-9 items-center justify-center rounded-full border border-line">
                      <Video size={17} />
                    </span>
                  </div>
                </div>

                <div className="grid sm:grid-cols-[1fr_236px]">
                  <div className="space-y-2 bg-wallpaper p-4">
                    <div className="max-w-[78%] rounded-lg rounded-tl-none bg-bubble px-2.5 py-1.5 text-[13.5px] leading-[19px] text-ink shadow-sm">
                      Are you free for a quick call?
                      <span className="ml-2 align-bottom text-[11px] text-faint">9:42</span>
                    </div>
                    <div className="ml-auto max-w-[78%] rounded-lg rounded-tr-none bg-bubble-sent px-2.5 py-1.5 text-[13.5px] leading-[19px] text-bubble-sent-ink shadow-sm">
                      Yes — give me a minute.
                      <span className="ml-2 align-bottom text-[11px] text-muted">9:43</span>
                    </div>
                    <div className="flex items-center gap-2 pt-1 text-[11.5px] text-muted">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-panel text-accent">
                        <Phone size={13} />
                      </span>
                      Audio call · 12:04
                    </div>
                  </div>

                  <div className="hidden border-l border-line p-4 sm:block">
                    <p className="text-[12px] text-muted">In this call</p>
                    <div className="mt-3 space-y-2.5">
                      {[
                        { name: 'Alice Morgan', accent: 'indigo' as const },
                        { name: 'You', accent: 'emerald' as const },
                      ].map((person) => (
                        <div key={person.name} className="flex items-center gap-2.5">
                          <Avatar
                            user={{ displayName: person.name, accent: person.accent }}
                            size="sm"
                          />
                          <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">
                            {person.name}
                          </span>
                          <Mic size={13} className="text-muted" />
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 flex items-center gap-1.5 rounded-lg bg-panel-2 px-2.5 py-2 text-[11px] text-muted">
                      <Lock size={11} />
                      Encrypted in transit
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Calls */}
        <section id="calls" className="border-b border-line">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:items-center lg:gap-16 lg:py-20">
            <div>
              <h2 className="text-[28px] font-normal leading-[1.15] tracking-[-0.015em] text-ink sm:text-[34px]">
                Call easily and privately
              </h2>
              <p className="mt-3 max-w-lg text-[14px] leading-[21px] text-muted">
                Start a voice or video call from any conversation. Call media travels directly
                between the devices and is encrypted in transit.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <StoreBadge>One-to-one and group calls</StoreBadge>
                <StoreBadge>Mute and camera controls</StoreBadge>
                <StoreBadge>Ringtones and missed-call notices</StoreBadge>
              </div>
              <Link
                href="/register"
                className="mt-7 inline-flex h-10 items-center gap-2 rounded-full bg-accent px-5 text-[13.5px] text-accent-ink transition-colors hover:bg-accent-hover"
              >
                Try a call
                <ArrowRight size={15} />
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-2" aria-hidden="true">
              {[
                { name: 'Alice', accent: 'indigo' as const, video: true },
                { name: 'Bob', accent: 'emerald' as const, video: true },
                { name: 'Carol', accent: 'amber' as const, video: false },
                { name: 'Dev', accent: 'violet' as const, video: true },
              ].map((person) => (
                <div
                  key={person.name}
                  className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-xl border border-line bg-panel-2"
                >
                  <Avatar
                    user={{ displayName: person.name, accent: person.accent }}
                    size="lg"
                  />
                  <span className="text-[12.5px] text-ink">{person.name}</span>
                  <span className="flex items-center gap-1 text-[11px] text-muted">
                    {person.video ? <Video size={11} /> : <Mic size={11} />}
                    {person.video ? 'Video on' : 'Audio'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Across devices */}
        <section className="border-b border-line bg-panel-2/50">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:items-center lg:gap-16 lg:py-20">
            <div className="order-2 lg:order-1">
              <div className="rounded-2xl border border-line bg-panel p-6">
                <div className="flex items-center gap-2 border-b border-line pb-3">
                  <span className="h-2 w-2 rounded-full bg-line-strong" />
                  <span className="h-2 w-2 rounded-full bg-line-strong" />
                  <span className="h-2 w-2 rounded-full bg-line-strong" />
                  <span className="ml-2 text-[11.5px] text-faint">relay · chat</span>
                </div>
                <div className="mt-4 space-y-2.5">
                  {[
                    { name: 'Bob Chen', preview: 'Deploying the staging build now.', time: '12:18' },
                    { name: 'Alice Morgan', preview: 'Appreciated. See you at 2.', time: '12:02' },
                    { name: 'Carol Diaz', preview: 'I’ll bring the privacy checklist.', time: 'Yesterday' },
                  ].map((row) => (
                    <div key={row.name} className="flex items-center gap-3 rounded-lg px-1 py-1.5">
                      <Avatar user={{ displayName: row.name, accent: 'slate' }} size="md" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13.5px] text-ink">{row.name}</p>
                        <p className="truncate text-[12px] text-muted">{row.preview}</p>
                      </div>
                      <span className="shrink-0 text-[11px] text-faint">{row.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="order-1 lg:order-2">
              <h2 className="text-[28px] font-normal leading-[1.15] tracking-[-0.015em] text-ink sm:text-[34px]">
                Connect across devices
              </h2>
              <p className="mt-3 max-w-lg text-[14px] leading-[21px] text-muted">
                Relay is a web app. Sign in from a laptop, tablet, or phone browser and the same
                conversations, statuses, and groups are there.
              </p>
              <ul className="mt-5 grid gap-2.5">
                {[
                  'No install or app store',
                  'One account on every device',
                  'Uploads up to 30 MB',
                  'Light and dark themes',
                ].map((point) => (
                  <li key={point} className="flex items-center gap-2.5 text-[13.5px] text-muted">
                    <Check size={14} className="shrink-0 text-accent" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Privacy */}
        <section id="privacy" className="border-b border-line">
          <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
            <div className="max-w-2xl">
              <h2 className="text-[28px] font-normal leading-[1.15] tracking-[-0.015em] text-ink sm:text-[34px]">
                Keep things private
              </h2>
              <p className="mt-3 text-[14px] leading-[21px] text-muted">
                Privacy controls are per person and per conversation. The server applies them
                before anything is delivered, so the other side never receives what you hid.
              </p>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {[
                {
                  icon: ShieldCheck,
                  title: 'Anonymity',
                  copy: 'Your name and photo are replaced with Anonymous Operator for the other person.',
                },
                {
                  icon: Ghost,
                  title: 'Vanish mode',
                  copy: 'Messages sent while it is on are deleted for both sides when you leave the thread.',
                },
                {
                  icon: Lock,
                  title: 'Directory visibility',
                  copy: 'Hide yourself from the directory. People can still reach you by exact username.',
                },
              ].map(({ icon: Icon, title, copy }) => (
                <div key={title} className="rounded-xl border border-line bg-panel p-5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent">
                    <Icon size={18} />
                  </span>
                  <h3 className="mt-4 text-[14.5px] text-ink">{title}</h3>
                  <p className="mt-1.5 text-[12.5px] leading-[18px] text-muted">{copy}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Groups */}
        <section className="border-b border-line bg-panel-2/50">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:items-center lg:gap-16 lg:py-20">
            <div>
              <h2 className="text-[28px] font-normal leading-[1.15] tracking-[-0.015em] text-ink sm:text-[34px]">
                Calling for groups
              </h2>
              <p className="mt-3 max-w-lg text-[14px] leading-[21px] text-muted">
                Start a call from any group chat. Everyone in the group can join, and each device
                connects directly to the others instead of through a calling provider.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <StoreBadge>Audio or video</StoreBadge>
                <StoreBadge>Join from the group header</StoreBadge>
                <StoreBadge>Leave without ending it for others</StoreBadge>
              </div>
            </div>

            <div className="rounded-2xl border border-line bg-panel p-5" aria-hidden="true">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-accent">
                    <Users size={16} />
                  </span>
                  <div>
                    <p className="text-[13.5px] text-ink">Lunch Club</p>
                    <p className="text-[11.5px] text-muted">4 on the call</p>
                  </div>
                </div>
                <span className="flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-[11px] text-accent-strong">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                  Live
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {['Alice', 'Bob', 'Carol', 'Dev'].map((name, index) => (
                  <div
                    key={name}
                    className="flex flex-col items-center justify-center gap-1.5 rounded-lg bg-panel-2 py-4"
                  >
                    <Avatar
                      user={{
                        displayName: name,
                        accent: (['indigo', 'emerald', 'amber', 'violet'] as const)[index],
                      }}
                      size="md"
                    />
                    <span className="text-[11.5px] text-muted">{name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* More features */}
        <section id="features" className="border-b border-line">
          <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
            <div className="max-w-2xl">
              <h2 className="text-[28px] font-normal leading-[1.15] tracking-[-0.015em] text-ink sm:text-[34px]">
                More than messages
              </h2>
              <p className="mt-3 text-[14px] leading-[21px] text-muted">
                The everyday pieces of a conversation, kept in the same thread.
              </p>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {MESSAGE_FEATURES.map(({ icon: Icon, title, copy }) => (
                <div key={title} className="flex gap-4 rounded-xl border border-line bg-panel p-5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                    <Icon size={18} />
                  </span>
                  <div>
                    <h3 className="text-[14.5px] text-ink">{title}</h3>
                    <p className="mt-1.5 text-[12.5px] leading-[18px] text-muted">{copy}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="border-b border-line bg-panel-2/50">
          <div className="mx-auto w-full max-w-4xl px-4 py-14 sm:px-6 lg:py-20">
            <h2 className="text-[28px] font-normal leading-[1.15] tracking-[-0.015em] text-ink sm:text-[34px]">
              Questions
            </h2>
            <div className="mt-6 divide-y divide-line border-y border-line">
              {FAQ.map((item) => (
                <details key={item.q} className="group py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[14px] text-ink [&::-webkit-details-marker]:hidden">
                    {item.q}
                    <Plus
                      size={16}
                      className="shrink-0 text-muted transition-transform group-open:rotate-45"
                    />
                  </summary>
                  <p className="mt-2 max-w-2xl pr-8 text-[13px] leading-[19px] text-muted">
                    {item.a}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="bg-accent-soft">
          <div className="mx-auto w-full max-w-6xl px-4 py-14 text-center sm:px-6 lg:py-20">
            <h2 className="mx-auto max-w-2xl text-[30px] font-normal leading-[1.15] tracking-[-0.015em] text-ink sm:text-[38px]">
              Keep the conversation going
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-[14px] leading-[21px] text-muted">
              Create an account and start a conversation, a group, or a call from the browser you
              are already using.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
              <Link
                href="/register"
                className="inline-flex h-10 items-center gap-2 rounded-full bg-accent px-5 text-[13.5px] text-accent-ink transition-colors hover:bg-accent-hover"
              >
                Create account
                <ArrowRight size={15} />
              </Link>
              <Link
                href="/login"
                className="inline-flex h-10 items-center rounded-full border border-line bg-panel px-5 text-[13.5px] text-ink transition-colors hover:bg-panel-2"
              >
                Sign in
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-panel">
        <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Logo />
              <p className="mt-3 max-w-[220px] text-[12px] leading-[18px] text-muted">
                Browser messaging, calls, and statuses for a private workspace.
              </p>
            </div>

            <div>
              <p className="text-[12px] text-muted">Relay</p>
              <ul className="mt-2.5 space-y-2 text-[12.5px] text-ink">
                <li>
                  <a href="#features" className="hover:underline">
                    Features
                  </a>
                </li>
                <li>
                  <a href="#calls" className="hover:underline">
                    Calls
                  </a>
                </li>
                <li>
                  <a href="#privacy" className="hover:underline">
                    Privacy
                  </a>
                </li>
                <li>
                  <a href="#faq" className="hover:underline">
                    FAQ
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <p className="text-[12px] text-muted">Use Relay</p>
              <ul className="mt-2.5 space-y-2 text-[12.5px] text-ink">
                <li>
                  <Link href="/login" className="hover:underline">
                    Sign in
                  </Link>
                </li>
                <li>
                  <Link href="/register" className="hover:underline">
                    Create account
                  </Link>
                </li>
                <li>
                  <a href="#calls" className="hover:underline">
                    Audio and video calls
                  </a>
                </li>
                <li>
                  <a href="#privacy" className="hover:underline">
                    Anonymity and vanish mode
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <p className="text-[12px] text-muted">Developer</p>
              <p className="mt-2.5 text-[12.5px] text-ink">{DEVELOPER.name}</p>
              <p className="mt-0.5 text-[12px] text-muted">{DEVELOPER.bio}</p>
              <p className="mt-0.5 text-[12px] text-muted">{DEVELOPER.location}</p>
              <ul className="mt-2.5 space-y-2 text-[12.5px] text-ink">
                <li>
                  <a href={`mailto:${DEVELOPER.email}`} className="hover:underline">
                    {DEVELOPER.email}
                  </a>
                </li>
                <li>
                  <a
                    href={DEVELOPER.instagram}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:underline"
                  >
                    Instagram
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-9 flex flex-col gap-3 border-t border-line pt-5 text-[11.5px] text-faint sm:flex-row sm:items-center sm:justify-between">
            <p>© 2026 Relay</p>
            <p>Developed by Muhammed Anas.v</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
