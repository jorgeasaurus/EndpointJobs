import type { Metadata } from "next";
import Link from "next/link";

import { listSavedJobs, type AccountClient } from "@/lib/account/store";
import { ParallaxBackground } from "@/components/job-board/parallax-background";
import { SiteFooter, Topbar } from "@/components/job-board/topbar";
import feedData from "@/data/jobs.json";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { getJobPath } from "@/app/site-metadata";
import type { JobsFeed } from "@/types/job";

import { ClearViewHistoryButton, DeleteAccountForm, ExportAccountButton } from "./account-actions";
import "./account.css";

export const metadata: Metadata = {
  title: "Account",
  description: "Export your Endpoint Jobs data, clear view history, or delete your account.",
  alternates: { canonical: "/account" },
  robots: { index: false, follow: false }
};

const feed = feedData as JobsFeed;

export default async function AccountPage() {
  const session = await loadAccount();

  return (
    <main className="site-frame job-detail-frame">
      <ParallaxBackground />
      <div className="site-content">
        <Topbar updatedAt={feed.updatedAt} />
        <article className="account-page">
          <header>
            <h1>Account</h1>
            {session ? (
              <p>Signed in as {session.email}. Saved jobs, filters, and view history stay on this account.</p>
            ) : (
              <p>Sign in from the header to save jobs, keep filters, and manage this account.</p>
            )}
          </header>

          {session ? (
            <>
              <section className="account-section" aria-labelledby="saved-jobs-heading">
                <h2 id="saved-jobs-heading">Saved jobs</h2>
                {session.saved.length === 0 ? <p>No saved jobs yet. Use Save on a role to keep it here.</p> : null}
                <ul>
                  {session.saved.map((job) => (
                    <li className="saved-job" key={job.jobId}>
                      <Link href={getJobPath(job.jobId)}>
                        {job.snapshot.title}
                        {job.snapshot.company ? ` · ${job.snapshot.company}` : ""}
                      </Link>
                      {job.snapshot.location ? <span>{job.snapshot.location}</span> : null}
                    </li>
                  ))}
                </ul>
              </section>

              <section className="account-section" aria-labelledby="export-heading">
                <h2 id="export-heading">Export</h2>
                <p>Download your profile, saved filters, saved jobs, and view history.</p>
                <ExportAccountButton />
              </section>

              <section className="account-section" aria-labelledby="views-heading">
                <h2 id="views-heading">View history</h2>
                <p>{session.viewCount === 1 ? "1 viewed role." : `${session.viewCount} viewed roles.`}</p>
                <ClearViewHistoryButton />
              </section>

              <section className="account-section" aria-labelledby="delete-heading">
                <h2 id="delete-heading">Delete account</h2>
                <p>This removes the profile, saved filters, saved jobs, and view history.</p>
                <DeleteAccountForm />
              </section>
            </>
          ) : null}

          <p>
            <Link href="/privacy">Privacy policy</Link>
          </p>
        </article>
        <SiteFooter updatedAt={feed.updatedAt} />
      </div>
    </main>
  );
}

async function loadAccount() {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const client = supabase as unknown as AccountClient;
  const [saved, views] = await Promise.all([
    listSavedJobs(client, data.user.id),
    supabase.from("job_views").select("job_id", { count: "exact", head: true }).eq("user_id", data.user.id)
  ]);
  return {
    email: data.user.email ?? "Signed in",
    saved,
    viewCount: views.count ?? 0
  };
}
