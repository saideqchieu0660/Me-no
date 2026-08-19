import React, { useState, useEffect, useRef } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  updateProfile,
  sendEmailVerification,
  signOut,
  signInAnonymously,
  EmailAuthProvider,
  linkWithCredential,
  linkWithPopup,
  fetchSignInMethodsForEmail
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { Mail, Lock, Key, User, Loader2, AlertCircle, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Role } from '../lib/store';

export default function AuthScreen() {
  useEffect(() => {
    document.title = "Henosis Web";
    // Proactively clean up heavy non-critical caches to prevent QuotaExceededError during Firebase Auth
    try {
        const keysToRemove = [
            'henosis-importer-pipeline',
            'henosis-failed-chunks',
            'local_global_activity_feed',
            'henosis_provider_config'
        ];
        
        let totalLen = 0;
        for (let i = 0; i < localStorage.length; i++) {
           const k = localStorage.key(i);
           if (k) {
               totalLen += (localStorage.getItem(k)?.length || 0);
               // If item is very large or is one of the known cache, clean it
               if (keysToRemove.includes(k) || k.startsWith('study_scratchpad_')) {
                   localStorage.removeItem(k);
               }
           }
        }
        
        // If still large (> 4MB out of 5MB), clear more aggressive
        if (totalLen > 4 * 1024 * 1024) {
             for (let i = 0; i < localStorage.length; i++) {
                 const k = localStorage.key(i);
                 if (k && !k.startsWith('firebase:')) {
                     localStorage.removeItem(k);
                 }
             }
        }
    } catch(err) {
        console.warn("Error cleaning local storage", err);
    }
  }, []);

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [adminKey, setAdminKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showAdminKey, setShowAdminKey] = useState(false);
  const navigate = useNavigate();
  const isExecutingAuth = useRef(false);

  useEffect(() => {
    // Rely on App.tsx and manual navigation handles after login, 
    // instead of racing with global onAuthStateChanged which causes a redirect loop
  }, []);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || (!isLogin && !username.trim())) {
      setError("Vui lòng điền đầy đủ các thông tin bắt buộc.");
      return;
    }

    setIsLoading(true);
    setError(null);
    isExecutingAuth.current = true;

    try {
      // 1. MULTI-PROVIDER SCANNING VIA fetchSignInMethodsForEmail
      const methods = await fetchSignInMethodsForEmail(auth, email);
      
      if (isLogin) {
        if (methods.length > 0 && !methods.includes('password') && methods.includes('google.com')) {
           setError(`Tài khoản ${email} đã được đăng ký bằng Google. Vui lòng chọn "Đăng nhập với Google".`);
           setIsLoading(false);
           isExecutingAuth.current = false;
           return;
        }

        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        
        if (userCredential.user && userCredential.user.emailVerified) {
          const { dbService } = await import('../lib/firebase');
          const profile = await dbService.getUserProfile(userCredential.user.uid);
          let assignedRole = profile?.role || "student";
          let isProUser = !!profile?.isPro;

          if (adminKey) {
              try {
                  const verifyRes = await fetch('/api/auth/escalate-role', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ uid: userCredential.user.uid, providedKey: adminKey })
                  }).then(res => {
                      if (!res.ok) throw new Error(`HTTP ${res.status}`);
                      return res.json();
                  });

                  if (verifyRes.success) {
                      if (verifyRes.role) {
                          assignedRole = verifyRes.role;
                          sessionStorage.setItem('adminToken', 'true');
                      }
                      if (verifyRes.isPro) isProUser = true;
                  } else {
                      throw new Error(verifyRes.error || "Mã phân quyền không hợp lệ.");
                  }
              } catch(e: any) {
                  console.error('Role escalation failed', e);
                  throw new Error(e.message || "Lỗi kiểm tra mã phân quyền.");
              }
          }

          if (assignedRole === "Admin" || assignedRole === "admin" || assignedRole === "teacher") {
              sessionStorage.setItem('adminToken', 'true');
          } else {
              sessionStorage.removeItem('adminToken');
          }

          const { store } = await import('../lib/store');
          const currentUser = store.getCurrentUser();
          if (currentUser) {
              currentUser.role = assignedRole as any;
              currentUser.isPro = isProUser;
          }

          const isTeacher = assignedRole === 'teacher' || assignedRole === 'admin' || assignedRole === 'Admin';
          const isExplicitlyStudentMode = sessionStorage.getItem('isAdminMode') === 'false';
          navigate(isTeacher && !isExplicitlyStudentMode ? '/teacher' : '/dashboard');
        }
      } else {
        if (methods.length > 0) {
           setError(`Email ${email} đã tồn tại trong hệ thống với phương thức: ${methods.join(', ')}. Đi tới màn hình Đăng nhập để tiếp tục hoặc sử dụng Google.`);
           setIsLoading(false);
           isExecutingAuth.current = false;
           return;
        }

        let userCredential;
        const currentUser = auth.currentUser;
        
        if (currentUser && currentUser.isAnonymous) {
           const credential = EmailAuthProvider.credential(email, password);
           try {
              userCredential = await linkWithCredential(currentUser, credential);
           } catch (e: any) {
              if (e.code === 'auth/credential-already-in-use' || e.code === 'auth/email-already-in-use') {
                 throw e; // Handled in catch block
              }
              userCredential = await createUserWithEmailAndPassword(auth, email, password);
           }
        } else {
           userCredential = await createUserWithEmailAndPassword(auth, email, password);
        }

        if (userCredential.user) {
          await updateProfile(userCredential.user, { displayName: username.trim() });
          
          const { dbService } = await import('../lib/firebase');
          await dbService.updateUserProfile(userCredential.user.uid, { 
              name: username.trim(),
              role: "student",
              email: email,
              isPro: false,
              isSchoolLover: false
          });

          if (adminKey) {
             try {
                const verifyRes = await fetch('/api/auth/escalate-role', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ uid: userCredential.user.uid, providedKey: adminKey })
                }).then(res => {
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    return res.json();
                });
                if (!verifyRes.success) {
                    throw new Error(verifyRes.error || "Mã phân quyền không hợp lệ.");
                }
             } catch(e: any) {
                 console.error('Role escalation failed', e);
                 throw new Error(e.message || "Lỗi kiểm tra mã phân quyền.");
             }
          }

          await sendEmailVerification(userCredential.user);
          await signOut(auth);
          navigate(`/verify?email=${encodeURIComponent(email)}`);
          return;
        }
      }
    } catch (err: any) {
      let errorMessage = "Đã xảy ra lỗi hệ thống";
      if (err.code === 'auth/wrong-password') {
        errorMessage = "Mật khẩu không chính xác, vui lòng kiểm tra lại!";
      } else if (err.code === 'auth/user-not-found') {
        errorMessage = "Tài khoản Gmail này chưa được đăng ký hệ thống!";
      } else if (err.code === 'auth/invalid-credential') {
        errorMessage = "Thông tin đăng nhập không hợp lệ!";
      } else if (err.code === 'auth/invalid-email') {
        errorMessage = "Định dạng email không hợp lệ!";
      } else if (err.code === 'auth/email-already-in-use') {
        errorMessage = "Email này đã được sử dụng. Vui lòng đăng nhập!";
      } else if (err.message) {
        errorMessage = err.message;
      }
      setError(errorMessage);
    } finally {
      setIsLoading(false);
      isExecutingAuth.current = false;
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError(null);
    isExecutingAuth.current = true;
    const provider = new GoogleAuthProvider();
    
    try {
      let userCredential;
      const authCurrentUser = auth.currentUser;
      
      if (authCurrentUser && authCurrentUser.isAnonymous) {
         try {
             userCredential = await linkWithPopup(authCurrentUser, provider);
         } catch (e: any) {
             if (e.code === 'auth/credential-already-in-use' || e.code === 'auth/email-already-in-use') {
                 console.warn("Tài khoản đã tồn tại, tiến hành đăng nhập đè...");
                 alert("Tài khoản này đã được liên kết trước đó. Đang tải dữ liệu đám mây của bạn (Dữ liệu khách tạm thời sẽ bị hủy).");
                 userCredential = await signInWithPopup(auth, provider);
             } else {
                 throw e;
             }
         }
      } else {
         userCredential = await signInWithPopup(auth, provider);
      }
      
      const { dbService } = await import('../lib/firebase');
      const profile = await dbService.getUserProfile(userCredential.user.uid);
      
      if (!profile) {
        navigate('/setup-profile');
        return;
      }

      let assignedRole = profile.role || "student";
      let isProUser = !!profile.isPro;

      if (adminKey) {
          try {
              const verifyRes = await fetch('/api/auth/escalate-role', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ uid: userCredential.user.uid, providedKey: adminKey })
              }).then(res => {
                  if (!res.ok) throw new Error(`HTTP ${res.status}`);
                  return res.json();
              });

              if (verifyRes.success) {
                  if (verifyRes.role) assignedRole = verifyRes.role;
                  if (verifyRes.isPro) isProUser = true;
              } else {
                  throw new Error(verifyRes.error || "Mã phân quyền không hợp lệ.");
              }
          } catch(e: any) {
              console.error('Role escalation failed', e);
              throw new Error(e.message || "Lỗi kiểm tra mã phân quyền.");
          }
      }

      if (assignedRole === "Admin" || assignedRole === "admin" || assignedRole === "teacher") {
          sessionStorage.setItem('adminToken', 'true');
      } else {
          sessionStorage.removeItem('adminToken');
      }
      
      const { store } = await import('../lib/store');
      const currentUser = store.getCurrentUser();
      if (currentUser) {
          currentUser.role = assignedRole as any;
          currentUser.isPro = isProUser;
          currentUser.isSchoolLover = isProUser || !!profile.isSchoolLover;
      }

      const isTeacher = assignedRole === 'teacher' || assignedRole === 'admin' || assignedRole === 'Admin';
      const isExplicitlyStudentMode = sessionStorage.getItem('isAdminMode') === 'false';
      navigate(isTeacher && !isExplicitlyStudentMode ? '/teacher' : '/dashboard');
    } catch (err: any) {
      console.error(err);
      let errorMessage = "Đã xảy ra lỗi hệ thống";

      if (err.code === 'auth/account-exists-with-different-credential') {
        const email = err.customData?.email;
        const pendingCred = GoogleAuthProvider.credentialFromError(err);
        if (email && pendingCred) {
          try {
            const methods = await fetchSignInMethodsForEmail(auth, email);
            errorMessage = `Provider mismatch cho ${email}: [${methods.join(', ')}]. Đang yêu cầu hợp nhất...`;
            setError(errorMessage);
            
            if (methods.includes('password')) {
               const password = window.prompt(`Tài khoản ${email} đã tồn tại với Mật khẩu.\nVui lòng nhập mật khẩu tài khoản của bạn để liên kết đăng nhập Google:`);
               if (password) {
                  const signInResult = await signInWithEmailAndPassword(auth, email, password);
                  await linkWithCredential(signInResult.user, pendingCred);
                  // Refresh the page or continue auth to make sure dashboard loads
                  window.location.href = "/dashboard";
                  return;
               } else {
                  errorMessage = "Đã hủy tiến trình liên kết tài khoản.";
               }
            } else {
               errorMessage = `Tài khoản ${email} đã tồn tại qua phương thức khác: ${methods.join(', ')}. Hãy đăng nhập bằng phương thức cũ, sau đó liên kết Google.`;
            }
          } catch (fetchErr: any) {
             errorMessage = `Lỗi hệ thống khi kiểm tra liên kết: ${fetchErr.message}`;
          }
        } else {
          errorMessage = "Tài khoản đã tồn tại dưới một nền tảng đăng nhập khác.";
        }
      } else if (err.code === 'auth/popup-closed-by-user') {
        errorMessage = "Đã hủy đăng nhập vì cửa sổ bị đóng!";
      } else if (err.code === 'auth/cancelled-popup-request') {
        errorMessage = "Đang có một yêu cầu đăng nhập khác đang xử lý!";
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
      isExecutingAuth.current = false;
    }
  };

  const handleGuestLogin = async () => {
    setIsLoading(true);
    setError(null);
    isExecutingAuth.current = true;
    try {
      if (import.meta.env.VITE_FIREBASE_API_KEY === undefined || import.meta.env.VITE_FIREBASE_API_KEY === "DUMMY_KEY_FOR_INIT") {
        throw new Error("auth/network-request-failed");
      }
      const userCredential = await signInAnonymously(auth);
      
      let assignedRole = "student";
      let displayName = "Guest Student";
      let isProUser = false;

      if (adminKey) {
          try {
              const verifyRes = await fetch('/api/auth/escalate-role', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ uid: userCredential.user.uid, providedKey: adminKey })
              }).then(res => {
                  if (!res.ok) throw new Error(`HTTP ${res.status}`);
                  return res.json();
              });

              if (verifyRes.success) {
                  if (verifyRes.role === "Admin") {
                      assignedRole = "teacher";
                      displayName = "Guest Teacher";
                      sessionStorage.setItem('adminToken', 'true');
                  }
                  if (verifyRes.isPro) {
                      isProUser = true;
                      if (assignedRole !== "teacher") displayName = "Guest Pro Player";
                  }
              } else {
                  throw new Error(verifyRes.error || "Mã phân quyền không hợp lệ.");
              }
          } catch(e: any) {
              console.error('Role escalation failed', e);
              throw new Error(e.message || "Lỗi kiểm tra mã phân quyền.");
          }
      }

      if (assignedRole !== "teacher") {
          sessionStorage.removeItem('adminToken');
      }

      const { store } = await import('../lib/store');
      const currentUser = store.getCurrentUser();
      if (currentUser) {
          currentUser.role = assignedRole as Role;
          currentUser.name = displayName;
          currentUser.isPro = isProUser;
          currentUser.isSchoolLover = isProUser;
      }

      if (assignedRole === "teacher") {
        navigate('/teacher');
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      if (err?.code === 'auth/api-key-not-valid' || err?.message?.includes('auth/api-key-not-valid')) {
        const fallbackRole = "student";
        sessionStorage.removeItem('adminToken');
        
        const { store } = await import('../lib/store');
        const mockUser = { uid: "local_anon_" + Math.random().toString(36).substr(2, 9), isAnonymous: true, email: "anonymous@local" };
        await store.setFirebaseUser(mockUser);
        
        navigate('/dashboard');
      } else {
        let errorMessage = "Đã xảy ra lỗi hệ thống";
        if (err.message) {
          errorMessage = err.message;
        }
        setError(errorMessage);
      }
    } finally {
      setIsLoading(false);
      isExecutingAuth.current = false;
    }
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-4 relative overflow-y-auto">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-orange-500/20 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-orange-500/20 blur-[120px]" />
      </div>

      <div className="w-full max-w-md glass p-8 sm:p-10 rounded-[12px] relative z-10 shadow-2xl border border-orange-600/30 dark:border-white/10 transition-all duration-300">
        
        <div className="text-center mb-8">
          <h2 className="text-3xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-700 via-orange-500 to-orange-600 dark:from-orange-200 dark:via-orange-400 dark:to-orange-500">
            {isLogin ? "Đăng Nhập" : "Đăng Ký"}
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 mt-2 text-sm">
            {isLogin ? (
              <>Chào mừng bạn quay trở lại <span className="italic font-serif tracking-wide font-light text-orange-500">HENOSIS</span>!</>
            ) : "Tạo tài khoản mới để bắt đầu trải nghiệm."}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-600 dark:text-red-400 font-medium">
              {error}
            </p>
          </div>
        )}

        <form onSubmit={handleEmailAuth} className="space-y-4">
          {!isLogin && (
            <div className="space-y-1 animate-in slide-in-from-top-2 fade-in duration-300">
              <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-widest pl-1">Tên đăng nhập</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-zinc-500" />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isLoading}
                  className="w-full pl-10 pr-4 py-3 bg-white/50 dark:bg-black/30 border border-orange-500/30 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-zinc-900 dark:text-zinc-100 transition-all placeholder:text-zinc-400"
                  placeholder="Tên hoặc biệt danh của bạn"
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-widest pl-1">Email</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-zinc-500" />
              </div>
              <input
                type="email"
                required
                name="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                className="w-full pl-10 pr-4 py-3 bg-white/50 dark:bg-black/30 border border-orange-500/30 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-zinc-900 dark:text-zinc-100 transition-all placeholder:text-zinc-400"
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-widest pl-1">Mật khẩu</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-zinc-500" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                required
                name="password"
                autoComplete={isLogin ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                className="w-full pl-10 pr-10 py-3 bg-white/50 dark:bg-black/30 border border-orange-500/30 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-zinc-900 dark:text-zinc-100 transition-all placeholder:text-zinc-400"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100 transition focus:outline-none"
              >
                {showPassword ? <EyeOff className="w-5 h-5 text-zinc-500" /> : <Eye className="w-5 h-5 text-zinc-500" />}
              </button>
            </div>
          </div>

          <div className="space-y-1 animate-in slide-in-from-top-2 fade-in duration-300">
            <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-widest pl-1">Admin Key (Optional)</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Key className="h-5 w-5 text-zinc-500" />
              </div>
              <input
                type="text"
                name="custom_role_key"
                autoComplete="off"
                style={{ WebkitTextSecurity: showAdminKey ? 'none' : 'disc' } as React.CSSProperties}
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                disabled={isLoading}
                className="w-full pl-10 pr-10 py-3 bg-white/50 dark:bg-black/30 border border-orange-500/30 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-zinc-900 dark:text-zinc-100 transition-all placeholder:text-zinc-400"
                placeholder="Mã phân quyền Teacher"
              />
              <button
                type="button"
                onClick={() => setShowAdminKey(!showAdminKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100 transition focus:outline-none"
              >
                {showAdminKey ? <EyeOff className="w-5 h-5 text-zinc-500" /> : <Eye className="w-5 h-5 text-zinc-500" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white dark:text-black font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:pointer-events-none shadow-lg shadow-orange-500/25"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                {isLogin ? "Đăng Nhập" : "Đăng Ký"}
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 flex items-center gap-4">
          <div className="flex-1 h-px bg-orange-600/20 dark:bg-white/10"></div>
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Hoặc</span>
          <div className="flex-1 h-px bg-orange-600/20 dark:bg-white/10"></div>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="w-full bg-white dark:bg-zinc-900 border border-orange-500/20 dark:border-white/10 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-3 transition-all hover:shadow-md disabled:opacity-70 disabled:pointer-events-none"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Tiếp tục với Google
          </button>

          <button
            type="button"
            onClick={handleGuestLogin}
            disabled={isLoading}
            className="w-full bg-zinc-200 dark:bg-zinc-800 border-none hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-all hover:shadow-md disabled:opacity-70 disabled:pointer-events-none mt-1"
          >
            <User className="w-5 h-5 opacity-70" />
            Vào xem thử (Chế độ khách)
          </button>
        </div>

        <div className="mt-8 text-center">
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError(null);
              setEmail('');
              setPassword('');
              setUsername('');
              setAdminKey('');
            }}
            disabled={isLoading}
            className="text-sm font-medium text-orange-600 dark:text-orange-500 hover:text-orange-700 dark:hover:text-orange-400 transition-colors"
          >
            {isLogin ? "Chưa có tài khoản? Đăng ký ngay" : "Đã có tài khoản? Đăng nhập"}
          </button>
        </div>
      </div>
    </div>
  );
}
