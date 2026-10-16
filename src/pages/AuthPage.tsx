import { useState } from 'react';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';

function CatlystLogo() {
  const logoSvg = String.raw`<svg width="170" height="38" viewBox="0 0 170 38" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M28.5227 11.3068H20.625C20.6818 10.6345 20.6439 10.0284 20.5114 9.48865C20.3788 8.94887 20.1515 8.48486 19.8296 8.0966C19.5076 7.69887 19.0862 7.39584 18.5653 7.18751C18.0445 6.97918 17.4242 6.87501 16.7046 6.87501C15.322 6.87501 14.0862 7.22065 12.9972 7.91194C11.9081 8.59376 11.0038 9.57387 10.2841 10.8523C9.5644 12.1212 9.05303 13.6364 8.75 15.3977C8.48485 17.1023 8.47538 18.518 8.7216 19.6449C8.97728 20.7718 9.47444 21.6146 10.2131 22.1733C10.9612 22.732 11.9318 23.0114 13.125 23.0114C13.9205 23.0114 14.6496 22.9167 15.3125 22.7273C15.9849 22.5379 16.5814 22.268 17.1023 21.9176C17.6326 21.5578 18.0824 21.1316 18.4517 20.6392C18.8305 20.1373 19.1193 19.5833 19.3182 18.9773H27.2727C26.9697 20.2083 26.4299 21.4678 25.6534 22.7557C24.8769 24.0341 23.8731 25.2131 22.6421 26.2926C21.411 27.3627 19.9621 28.2292 18.2955 28.8921C16.6288 29.5549 14.7538 29.8864 12.6705 29.8864C9.94319 29.8864 7.58997 29.2898 5.6108 28.0966C3.6411 26.9034 2.21118 25.161 1.32103 22.8693C0.440345 20.5777 0.265156 17.7841 0.795459 14.4886C1.32576 11.3068 2.37216 8.64111 3.93466 6.49149C5.49716 4.34187 7.39584 2.72255 9.63069 1.63353C11.8655 0.544518 14.2424 1.00136e-05 16.7614 1.00136e-05C18.6648 1.00136e-05 20.3693 0.250957 21.875 0.75285C23.3902 1.25475 24.6638 1.98865 25.696 2.95456C26.7377 3.911 27.5047 5.08997 27.9972 6.49149C28.4896 7.893 28.6648 9.49812 28.5227 11.3068ZM39.2592 29.8296C37.8767 29.8296 36.6882 29.6023 35.6939 29.1477C34.709 28.6837 33.9894 27.983 33.5348 27.0455C33.0897 26.0985 32.9903 24.9053 33.2365 23.4659C33.4354 22.2727 33.8094 21.2547 34.3587 20.4119C34.9079 19.5691 35.5897 18.8779 36.4041 18.3381C37.2185 17.7983 38.1323 17.3864 39.1456 17.1023C40.1683 16.8087 41.2479 16.6193 42.3842 16.5341C43.6153 16.4394 44.6144 16.321 45.3814 16.179C46.1484 16.0369 46.7214 15.8428 47.1001 15.5966C47.4789 15.3504 47.7062 15.019 47.782 14.6023V14.5455C47.8672 13.9773 47.7157 13.5417 47.3274 13.2386C46.9486 12.9356 46.4183 12.7841 45.7365 12.7841C44.9979 12.7841 44.3587 12.9451 43.8189 13.2671C43.2886 13.589 42.924 14.0909 42.7251 14.7727H35.5092C35.8123 13.447 36.4325 12.2254 37.37 11.108C38.317 9.98107 39.5717 9.08145 41.1342 8.4091C42.7062 7.72728 44.5812 7.38637 46.7592 7.38637C48.3123 7.38637 49.6759 7.57103 50.8501 7.94035C52.0244 8.3002 52.995 8.80683 53.7621 9.46024C54.5386 10.1042 55.0831 10.8618 55.3956 11.733C55.7176 12.5947 55.7933 13.5322 55.6229 14.5455L53.1229 29.4886H45.7933L46.3047 26.4205H46.1342C45.5661 27.2349 44.9269 27.893 44.2166 28.3949C43.5159 28.8968 42.7488 29.2614 41.9155 29.4886C41.0916 29.7159 40.2062 29.8296 39.2592 29.8296ZM42.6683 24.8864C43.2554 24.8864 43.8331 24.7633 44.4013 24.5171C44.9695 24.2708 45.4572 23.9157 45.8644 23.4517C46.2715 22.9877 46.532 22.4243 46.6456 21.7614L46.9297 19.9432C46.7214 20.0284 46.4894 20.1089 46.2337 20.1847C45.9875 20.251 45.727 20.3172 45.4524 20.3835C45.1873 20.4498 44.9032 20.5114 44.6001 20.5682C44.3066 20.625 44.0036 20.6818 43.6911 20.7386C43.0661 20.8333 42.5405 20.9896 42.1144 21.2074C41.6882 21.4157 41.3568 21.6761 41.12 21.9886C40.8833 22.2917 40.7365 22.6326 40.6797 23.0114C40.5945 23.608 40.7318 24.072 41.0916 24.4034C41.4609 24.7254 41.9865 24.8864 42.6683 24.8864ZM77.5171 7.67046L76.5511 13.3523H62.1761L63.142 7.67046H77.5171ZM66.7784 2.44319H74.6193L71.2955 22.4716C71.2481 22.7746 71.2576 23.0303 71.3239 23.2386C71.3902 23.4375 71.5227 23.589 71.7216 23.6932C71.9299 23.7879 72.2045 23.8352 72.5455 23.8352C72.7727 23.8352 73.0521 23.8068 73.3835 23.75C73.715 23.6837 73.9659 23.6364 74.1364 23.608L74.3636 29.1193C73.9659 29.233 73.4309 29.3608 72.7585 29.5029C72.0956 29.6544 71.3239 29.7538 70.4432 29.8011C68.6061 29.8864 67.1099 29.6922 65.9545 29.2188C64.8087 28.7453 64.0133 28.0066 63.5682 27.0029C63.1326 25.9896 63.0568 24.7254 63.3409 23.2102L66.7784 2.44319ZM94.2195 0.397738L89.3899 29.4886H81.549L86.3786 0.397738H94.2195ZM100.822 37.6705C99.9134 37.6705 99.0658 37.5994 98.2798 37.4574C97.4938 37.3248 96.8073 37.1402 96.2202 36.9034L98.8622 31.3352C99.4683 31.5625 100.027 31.7093 100.538 31.7756C101.059 31.8419 101.518 31.804 101.916 31.6619C102.314 31.5199 102.641 31.25 102.896 30.8523L103.152 30.4546L99.2599 7.67046H107.158L108.152 22.7841H108.379L114.487 7.67046H123.01L111.135 31.3068C110.529 32.5095 109.771 33.589 108.862 34.5455C107.963 35.5114 106.855 36.2737 105.538 36.8324C104.222 37.3911 102.65 37.6705 100.822 37.6705ZM147.933 14.7727H140.888C140.926 14.3182 140.845 13.9299 140.646 13.608C140.447 13.286 140.168 13.0398 139.808 12.8693C139.458 12.6989 139.06 12.6136 138.615 12.6136C137.839 12.6136 137.133 12.7888 136.499 13.1392C135.864 13.4801 135.509 13.9299 135.433 14.4886C135.386 14.7064 135.457 14.91 135.646 15.0994C135.836 15.2888 136.333 15.464 137.138 15.625L141.456 16.4205C143.615 16.8182 145.187 17.5426 146.172 18.5938C147.166 19.6354 147.526 21.0133 147.251 22.7273C146.996 24.214 146.342 25.4924 145.291 26.5625C144.24 27.6326 142.905 28.4565 141.286 29.0341C139.676 29.6023 137.895 29.8864 135.945 29.8864C132.507 29.8864 129.931 29.1998 128.217 27.8267C126.513 26.4536 125.736 24.6591 125.888 22.4432H133.501C133.52 23.1534 133.757 23.6885 134.212 24.0483C134.676 24.3987 135.291 24.5833 136.058 24.6023C136.892 24.6307 137.621 24.465 138.246 24.1051C138.871 23.7358 139.221 23.2765 139.297 22.7273C139.325 22.4148 139.188 22.178 138.885 22.0171C138.591 21.8561 138.028 21.6951 137.195 21.5341L133.445 20.8523C131.286 20.464 129.714 19.6875 128.729 18.5227C127.744 17.3485 127.403 15.8523 127.706 14.0341C127.952 12.5852 128.539 11.3684 129.467 10.3835C130.405 9.39868 131.636 8.65531 133.161 8.15342C134.685 7.64206 136.447 7.38637 138.445 7.38637C141.712 7.38637 144.183 8.04452 145.859 9.36081C147.545 10.6676 148.236 12.4716 147.933 14.7727ZM169.767 7.67046L168.801 13.3523H154.426L155.392 7.67046H169.767ZM159.028 2.44319H166.869L163.545 22.4716C163.498 22.7746 163.508 23.0303 163.574 23.2386C163.64 23.4375 163.773 23.589 163.972 23.6932C164.18 23.7879 164.455 23.8352 164.795 23.8352C165.023 23.8352 165.302 23.8068 165.634 23.75C165.965 23.6837 166.216 23.6364 166.386 23.608L166.614 29.1193C166.216 29.233 165.681 29.3608 165.009 29.5029C164.346 29.6544 163.574 29.7538 162.693 29.8011C160.856 29.8864 159.36 29.6922 158.205 29.2188C157.059 28.7453 156.263 28.0066 155.818 27.0029C155.383 25.9896 155.307 24.7254 155.591 23.2102L159.028 2.44319Z" fill="url(#paint0_linear_2001_15)"/>
<defs>
<linearGradient id="paint0_linear_2001_15" x1="-1.67613" y1="15.9886" x2="177.324" y2="15.9886" gradientUnits="userSpaceOnUse">
<stop offset="0.701923"/>
</linearGradient>
</defs>
</svg>`;

  return (
    <div
      aria-label="Catlyst"
      role="img"
      className="h-10 w-auto [&>svg]:h-full [&>svg]:w-auto"
      dangerouslySetInnerHTML={{ __html: logoSvg }}
    />
  );
}

export function AuthPage() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name } },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'An error occurred';
      if (msg.includes('Invalid login')) {
        setError('Invalid email or password. Please try again.');
      } else if (msg.includes('already registered')) {
        setError('An account with this email already exists. Please sign in instead.');
      } else if (msg.includes('Password should be')) {
        setError('Password must be at least 6 characters long.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const isSignUp = mode === 'signup';

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-violet-50/60 px-4 py-8 sm:px-6" style={{ fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <div className="w-full max-w-md animate-scale-in">
        <div className="mb-6 flex justify-center">
          <CatlystLogo />
        </div>
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.07)]">
          <div className="px-6 pb-8 pt-8 sm:px-10 sm:pt-9">
            <header className="mb-7 text-center">
              <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-[26px]">
                {isSignUp ? 'Create your account' : 'Welcome back'}
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-500 sm:text-[15px]">
                {isSignUp
                  ? 'Welcome! Please fill in the details to get started.'
                  : 'Sign in to continue your CAT preparation.'}
              </p>
            </header>

            <form onSubmit={handleSubmit} className="space-y-5">
              {isSignUp && (
                <div>
                  <label htmlFor="auth-name" className="mb-2 block text-sm font-medium text-slate-900">
                    Full name
                  </label>
                  <input
                    id="auth-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your full name"
                    required
                    autoComplete="name"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-slate-500 focus:ring-4 focus:ring-slate-100"
                  />
                </div>
              )}

              <div>
                <label htmlFor="auth-email" className="mb-2 block text-sm font-medium text-slate-900">
                  Email address
                </label>
                <input
                  id="auth-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address"
                  required
                  autoComplete="email"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-slate-500 focus:ring-4 focus:ring-slate-100"
                />
              </div>

              <div>
                <label htmlFor="auth-password" className="mb-2 block text-sm font-medium text-slate-900">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    minLength={6}
                    autoComplete={isSignUp ? 'new-password' : 'current-password'}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-12 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-slate-500 focus:ring-4 focus:ring-slate-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5" role="alert">
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />
                  <p className="text-sm leading-5 text-red-700">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-3.5 text-sm font-semibold text-white shadow-sm transition duration-200 hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Please wait...' : isSignUp ? 'Create account' : 'Sign in'}
                {!loading && <span className="ml-2" aria-hidden="true">→</span>}
              </button>
            </form>
          </div>

          <footer className="border-t border-slate-100 bg-slate-50/70 px-6 py-5 text-center sm:px-10">
            <p className="text-sm text-slate-500">
              {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
              <button
                type="button"
                onClick={() => { setMode(isSignUp ? 'signin' : 'signup'); setError(null); }}
                className="font-semibold text-slate-900 underline-offset-4 transition hover:text-slate-600 hover:underline focus:outline-none focus:underline"
              >
                {isSignUp ? 'Sign in' : 'Create account'}
              </button>
            </p>
          </footer>
        </section>
      </div>
    </main>
  );
}
