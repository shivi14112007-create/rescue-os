import { useState } from "react";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";

import { auth } from "../firebase";

import { Mail, Lock, Eye, EyeOff, User, ArrowLeft } from "lucide-react";

function isPassword(password) {
  return (
    password.length >= 6 && /[a-z]/.test(password) && /[0-9]/.test(password)
  );
}

function getErrorMessage(error) {
  switch (error.code) {
    case "auth/email-already-in-use":
      return "This email is already registered.";

    case "auth/invalid-email":
      return "Please enter a valid email address.";

    case "auth/invalid-credential":
      return "Incorrect email or password.";

    case "auth/popup-closed-by-user":
      return "Google sign-in was cancelled.";

    case "auth/popup-blocked":
      return "Google sign-in popup was blocked by the browser.";

    default:
      return "Something went wrong. Please try again.";
  }
}

export default function LoginPage({ onLogin, onBack, onDemoLogin }) {
  const [mode, setMode] = useState("login");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleGoogleLogin() {
    setLoading(true);
    setError("");

    try {
      const provider = new GoogleAuthProvider();

      const result = await signInWithPopup(auth, provider);

      onLogin(result.user);
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();

    setError("");

    if (!email.trim()) {
      setError("Please enter your email.");
      return;
    }

    if (mode === "signup" && !name.trim()) {
      setError("Please enter your name.");
      return;
    }

    if (!isPassword(password)) {
      setError("Password must contain at least 6 characters.");
      return;
    }

    setLoading(true);

    try {
      let result;

      if (mode === "signup") {
        result = await createUserWithEmailAndPassword(auth, email, password);

        await updateProfile(result.user, {
          displayName: name,
        });
      } else {
        result = await signInWithEmailAndPassword(auth, email, password);
      }

      onLogin(result.user);
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* BACK */}

        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 text-muted text-sm mb-6 hover:text-ink"
        >
          <ArrowLeft size={16} />
          Back
        </button>

        {/* CARD */}

        <div className="bg-panel border border-border rounded-2xl p-7 shadow-sm">
          {/* LOGO */}

          <div className="text-center mb-7">
            <div className="w-12 h-12 mx-auto rounded-xl bg-brand flex items-center justify-center text-white font-bold text-xl mb-4">
              R
            </div>

            <h1 className="text-2xl font-bold text-ink">
              {mode === "login" ? "Welcome back" : "Create your account"}
            </h1>

            <p className="text-muted text-sm mt-2">
              {mode === "login"
                ? "Sign in to continue to RescueOS"
                : "Start rescuing surplus produce today"}
            </p>
          </div>

          {/* GOOGLE */}

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full h-11 border border-border rounded-lg flex items-center justify-center gap-3 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <span className="font-bold text-lg">G</span>

            {loading ? "Please wait..." : "Continue with Google"}
          </button>

          <button
            type="button"
            onClick={onDemoLogin}
            disabled={loading}
            className="w-full h-11 mt-3 rounded-lg bg-brand text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
             Continue as Demo
          </button>
          {/* DIVIDER */}

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-border" />

            <span className="text-xs text-muted">OR</span>

            <div className="flex-1 h-px bg-border" />
          </div>

          {/* FORM */}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* NAME */}

            {mode === "signup" && (
              <div>
                <label className="text-sm font-medium text-ink">
                  Full name
                </label>

                <div className="relative mt-1">
                  <User
                    size={17}
                    className="absolute left-3 top-3 text-muted"
                  />

                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ramesh Yadav"
                    className="w-full h-11 pl-10 pr-3 border border-border rounded-lg outline-none focus:border-brand bg-canvas"
                  />
                </div>
              </div>
            )}

            {/* EMAIL */}

            <div>
              <label className="text-sm font-medium text-ink">Email</label>

              <div className="relative mt-1">
                <Mail size={17} className="absolute left-3 top-3 text-muted" />

                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full h-11 pl-10 pr-3 border border-border rounded-lg outline-none focus:border-brand bg-canvas"
                />
              </div>
            </div>

            {/* PASSWORD */}

            <div>
              <label className="text-sm font-medium text-ink">Password</label>

              <div className="relative mt-1">
                <Lock size={17} className="absolute left-3 top-3 text-muted" />

                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••"
                  className="w-full h-11 pl-10 pr-10 border border-border rounded-lg outline-none focus:border-brand bg-canvas"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-muted"
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>

              {/* PASSWORD RULES */}

              {mode === "signup" && (
                <div className="mt-2 text-xs text-muted space-y-1">
                  <p>• Minimum 6 characters</p>
                  <p>• One number</p>
                  <p>• One small letter</p>
                </div>
              )}
            </div>

            {/* ERROR */}

            {error && (
              <div className="text-sm text-donate bg-donate-light border border-donate/20 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            {/* SUBMIT */}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-brand text-white rounded-lg font-semibold hover:opacity-90 disabled:opacity-50"
            >
              {loading
                ? "Please wait..."
                : mode === "login"
                  ? "Sign In"
                  : "Create Account"}
            </button>
          </form>

          {/* SWITCH */}

          <div className="text-center mt-6 text-sm">
            <span className="text-muted">
              {mode === "login"
                ? "Don't have an account? "
                : "Already have an account? "}
            </span>

            <button
              type="button"
              onClick={() => {
                setMode(mode === "login" ? "signup" : "login");

                setError("");
              }}
              className="text-brand font-semibold"
            >
              {mode === "login" ? "Create account" : "Sign in"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
