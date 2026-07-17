import Link from "next/link";

export const metadata = { title: "Support" };

const SUPPORT_EMAIL = "mtahir@gmail.com";

export default function SupportPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10 sm:py-16">
      <div className="mb-10 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">Progression</p>
          <h1 className="mt-2 font-display text-3xl font-semibold text-text">Support</h1>
        </div>
        <Link href="/" className="text-sm font-medium text-accent">Return to app</Link>
      </div>

      <div className="space-y-8 text-sm leading-7 text-text-2">
        <section>
          <h2 className="text-lg font-semibold text-text">Contact</h2>
          <p className="mt-2">
            Questions, problems, or feedback? Email{" "}
            <a className="font-medium text-accent" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>{" "}
            and you&apos;ll hear back within a couple of days.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-text">Common questions</h2>
          <div className="mt-2 space-y-4">
            <p><span className="font-medium text-text">Getting started —</span> create an account with a username and password, then pick a program: the built-in starter, one designed by the AI coach, or one you build yourself. Your next workout appears on the home screen as soon as a program is active.</p>
            <p><span className="font-medium text-text">Connecting a wearable —</span> WHOOP and Fitbit/Google Health connect from Settings → Connected services. Both are optional and require an account with those services; recovery data then informs your daily coaching.</p>
            <p><span className="font-medium text-text">AI coaching —</span> optional and off by default. Enable it under Settings → Permissions to get the daily brief, in-workout set coaching, and the AI program designer.</p>
            <p><span className="font-medium text-text">Deleting your account —</span> Settings → Privacy and account → Delete account. This permanently removes your account and all stored data, including workouts, measurements, photos, and wearable connections.</p>
          </div>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-text">Privacy</h2>
          <p className="mt-2">
            How your data is handled is described in the{" "}
            <Link className="font-medium text-accent" href="/privacy">Privacy Policy</Link>.
          </p>
        </section>
      </div>
    </main>
  );
}
