import type { Metadata } from "next";
import Link from "next/link";

import { ParallaxBackground } from "@/components/job-board/parallax-background";
import { SiteFooter, Topbar } from "@/components/job-board/topbar";
import feedData from "@/data/jobs.json";
import type { JobsFeed } from "@/types/job";

import { PRIVACY_POLICY_VERSION } from "./version";
import "./privacy.css";

export { PRIVACY_POLICY_VERSION };

const feed = feedData as JobsFeed;

export const metadata: Metadata = {
  title: "Privacy policy",
  description:
    "What Endpoint Jobs stores when you sign in with Google or GitHub, why it is stored, and how signed-out visits are handled.",
  alternates: { canonical: "/privacy" },
  robots: { index: true, follow: true }
};

export default function PrivacyPage() {
  return (
    <main className="site-frame job-detail-frame">
      <ParallaxBackground />
      <div className="site-content">
        <Topbar updatedAt={feed.updatedAt} />
        <article className="privacy-policy">
          <header>
            <p className="privacy-kicker">Endpoint Jobs</p>
            <h1>Privacy policy</h1>
            <p className="privacy-version">Version {PRIVACY_POLICY_VERSION}</p>
            <p className="privacy-note">
              This page describes, in plain language, what the site stores when you sign in.
              It is not legal advice.
            </p>
          </header>

          <section>
            <h2>What we collect</h2>
            <p>When you sign in with Google or GitHub, the account stores:</p>
            <ul>
              <li>Your email address.</li>
              <li>Your OAuth identity: the provider (Google or GitHub) and that provider&apos;s user id. Supabase Auth keeps this with the sign-in session.</li>
              <li>Filter preferences you choose to save.</li>
              <li>Jobs you save, including a snapshot of the title, company, location, and source URL at the time you save them.</li>
              <li>Which listings you opened, when you opened them, and how many times.</li>
            </ul>
            <p>Nothing else is stored on the account.</p>
          </section>

          <section>
            <h2>Why</h2>
            <p>
              This information is used to sign you in, restore your filters, keep your saved list,
              and mark listings you have already seen. There are no ads. This information is not sold.
              It is not shared beyond the processors listed below.
            </p>
          </section>

          <section>
            <h2>What we don&apos;t collect</h2>
            <p>
              Passwords. Endpoint Jobs never sees your Google or GitHub password. You sign in on
              that provider&apos;s site, and Supabase returns a session to this site.
            </p>
          </section>

          <section>
            <h2>Processors</h2>
            <ul>
              <li>Supabase, for the database and sign-in.</li>
              <li>Vercel, for hosting and the existing Vercel Analytics.</li>
              <li>Google and GitHub, for sign-in.</li>
            </ul>
          </section>

          <section>
            <h2>Retention and control</h2>
            <p>
              Account data is kept until you delete the account. The{" "}
              <Link href="/account">account page</Link> is where you export your data, delete the
              account, and clear view history. Deleting the account removes the profile, saved
              filters, saved jobs, and view history.
            </p>
          </section>

          <section>
            <h2>Signed-out visitors</h2>
            <p>
              If you do not sign in, no account data is stored. Filters keep working in the page
              address, the same as they do today. Vercel Analytics still measures traffic for
              signed-out and signed-in visits. That measurement is not attached to an account here.
            </p>
          </section>

          <section>
            <h2>Contact</h2>
            <p>
              Questions about this policy go through the{" "}
              <a href="https://github.com/jorgeasaurus/EndpointJobs/issues/new?template=report-or-request.yml">
                GitHub feedback form
              </a>
              . The project is maintained by Jorgeasaurus.
            </p>
          </section>

          <section>
            <h2>Last updated</h2>
            <p>
              October 24, 2026. Version {PRIVACY_POLICY_VERSION}. Signing in records that you
              accepted this version of the policy.
            </p>
            <p>
              <Link href="/">Back to Endpoint Jobs</Link>
            </p>
          </section>
        </article>
        <SiteFooter updatedAt={feed.updatedAt} />
      </div>
    </main>
  );
}
