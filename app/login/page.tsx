import { LoginButton } from "@/components/login-button";
import { safeInternalPath } from "@/lib/safe-redirect";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-border bg-surface p-8 text-center">
      <h1 className="font-display text-3xl font-semibold uppercase">
        Sign in
      </h1>
      <p className="mt-3 text-sm text-muted">
        Use Discord to submit one playoff bracket.
      </p>
      {error ? (
        <p className="mt-4 text-sm text-error">
          Discord sign-in failed. Confirm Discord is enabled in Supabase Auth
          and that redirect URLs match this site.
        </p>
      ) : null}
      <div className="mt-6 flex justify-center">
        <LoginButton next={safeInternalPath(next)} />
      </div>
    </div>
  );
}
