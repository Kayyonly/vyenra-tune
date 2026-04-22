import { ReactNode } from 'react';

type AuthFrameProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

export function AuthFrame({ title, description, children }: AuthFrameProps) {
  return (
    <main className="min-h-screen bg-[#0b0b0f] px-6 py-10 text-white">
      <div className="mx-auto flex min-h-[80vh] w-full max-w-md flex-col items-center justify-center">
        <section className="w-full animate-[authFade_.45s_ease-out] rounded-[2rem] border border-white/10 bg-zinc-900/80 p-7 shadow-2xl shadow-black/40 backdrop-blur-xl">
          <div className="mx-auto mb-8 flex w-fit flex-col items-center gap-4 text-center">
            <div className="grid h-16 w-16 place-content-center rounded-2xl bg-white/10 text-xs font-semibold tracking-[0.18em] text-zinc-200">
              VT
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
              {description ? <p className="mt-2 text-sm text-zinc-400">{description}</p> : null}
            </div>
          </div>

          {children}
        </section>
      </div>
    </main>
  );
}
