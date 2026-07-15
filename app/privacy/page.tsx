import Link from "next/link";

export const metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10 sm:py-16">
      <div className="mb-10 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">Progression</p>
          <h1 className="mt-2 font-display text-3xl font-semibold text-text">Privacy Policy</h1>
          <p className="mt-2 text-sm text-text-3">Effective July 15, 2026</p>
        </div>
        <Link href="/" className="text-sm font-medium text-accent">Return to app</Link>
      </div>

      <div className="space-y-8 text-sm leading-7 text-text-2">
        <section>
          <h2 className="text-lg font-semibold text-text">Information we process</h2>
          <p className="mt-2">Progression stores the account name and credentials you provide, along with workout plans and logs, exercise preferences, goals, body measurements, nutrition entries, recovery entries, progress photos, notification preferences, and device push tokens.</p>
          <p className="mt-2">If you connect WHOOP or Google Health, we process the authorization tokens and the fitness, activity, sleep, strain, recovery, and health measurements you authorize those services to provide.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-text">How information is used</h2>
          <p className="mt-2">We use this information only to operate Progression: authenticate your account, display and analyze your training, synchronize connected services, generate coaching, store progress photos, and deliver notifications you enable. We do not sell personal information or use health and fitness information for advertising.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-text">AI processing</h2>
          <p className="mt-2">AI coaching is optional. When you explicitly enable it, relevant workout details and connected recovery or sleep metrics are sent to MiniMax to generate coaching responses. MiniMax does not receive your Progression username, password, progress photos, or wearable authorization tokens. Disabling AI processing stops future disclosures and uses Progression&apos;s on-server calculations instead.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-text">Service providers</h2>
          <p className="mt-2">Information is shared only as needed with infrastructure providers that host Progression, Apple for push notification delivery, MiniMax when AI processing is enabled, and WHOOP or Google when you choose to connect or revoke those integrations. Their handling of information is also governed by their respective privacy terms.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-text">Retention and deletion</h2>
          <p className="mt-2">Account information and user content remain in the active service while your account exists. You can disconnect wearable integrations, disable notifications or AI processing, delete individual progress photos, or permanently delete your account from Settings. Account deletion removes active account data and revokes connected-service access where supported. Encrypted operational backups are retained for no more than 30 days before rotation.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-text">Security and choices</h2>
          <p className="mt-2">Progression uses HTTPS in transit, access controls, private photo delivery, and encrypted wearable tokens. No system can guarantee absolute security. You may withdraw optional permissions in Settings or iOS Settings and may revoke WHOOP or Google access from those providers at any time.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-text">Contact</h2>
          <p className="mt-2">For privacy questions or requests, email <a className="text-accent" href="mailto:privacy@progression.fit">privacy@progression.fit</a>.</p>
        </section>
      </div>
    </main>
  );
}
