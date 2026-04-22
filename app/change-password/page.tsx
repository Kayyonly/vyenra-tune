'use client';

import { FormEvent, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export default function ChangePasswordPage() {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (newPassword.length < 6) {
      setError('Password baru minimal 6 karakter.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Konfirmasi password baru tidak sama.');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPassword, newPassword, confirmPassword }),
      });

      const payload = await response.json();
      if (!response.ok) {
        setError(payload?.message ?? 'Gagal mengganti password.');
        return;
      }

      setMessage('Password berhasil diperbarui.');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      setError('Terjadi gangguan jaringan.');
    } finally {
      setLoading(false);
    }
  };

  const PasswordInput = ({
    label,
    value,
    setValue,
    visible,
    setVisible,
    placeholder,
  }: {
    label: string;
    value: string;
    setValue: (value: string) => void;
    visible: boolean;
    setVisible: (visible: boolean) => void;
    placeholder: string;
  }) => (
    <label className="block text-sm text-zinc-300">
      {label}
      <div className="relative mt-2">
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 pr-11 text-sm outline-none ring-blue-400/40 transition focus:ring-2"
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-300 hover:text-white"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </label>
  );

  return (
    <main className="min-h-screen bg-[#0b0b0f] px-6 py-10 text-white">
      <div className="mx-auto w-full max-w-xl rounded-[2rem] border border-white/10 bg-zinc-900/80 p-7 shadow-2xl shadow-black/40 backdrop-blur-xl">
        <h1 className="text-2xl font-semibold">Ganti Password</h1>
        <p className="mt-1 text-sm text-zinc-400">Pastikan password baru kuat dan mudah kamu ingat.</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <PasswordInput
            label="Password Lama"
            value={oldPassword}
            setValue={setOldPassword}
            visible={showOld}
            setVisible={setShowOld}
            placeholder="Masukkan password lama"
          />

          <PasswordInput
            label="Password Baru"
            value={newPassword}
            setValue={setNewPassword}
            visible={showNew}
            setVisible={setShowNew}
            placeholder="Minimal 6 karakter"
          />

          <PasswordInput
            label="Konfirmasi Password Baru"
            value={confirmPassword}
            setValue={setConfirmPassword}
            visible={showConfirm}
            setVisible={setShowConfirm}
            placeholder="Ulangi password baru"
          />

          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          {message ? <p className="text-sm text-emerald-400">{message}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-blue-500 py-3 text-sm font-semibold text-white transition hover:bg-blue-400 disabled:opacity-60"
          >
            {loading ? 'Menyimpan...' : 'Simpan Password Baru'}
          </button>
        </form>
      </div>
    </main>
  );
}
