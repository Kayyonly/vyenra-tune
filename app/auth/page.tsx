import AuthWelcomeClient from './AuthWelcomeClient';

type AuthPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AuthPage({ searchParams }: AuthPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const nextParam = resolvedSearchParams.next;
  const nextPath = typeof nextParam === 'string' && nextParam.startsWith('/') ? nextParam : undefined;

  return <AuthWelcomeClient nextPath={nextPath} />;
}