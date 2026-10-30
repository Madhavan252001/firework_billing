import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn, Mail } from 'lucide-react';
import { authService, getShopName } from '../services';
import logoImg from '../assets/images/favicon.png';
import './login.css';

function Particles() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;
    let particles = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const colors = ['rgba(91,79,245,', 'rgba(139,92,246,', 'rgba(167,139,250,'];

    class Particle {
      constructor() { this.reset(); }
      reset() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.w = Math.random() * 4 + 2;
        this.h = Math.random() * 4 + 2;
        this.sx = (Math.random() - 0.5) * 0.4;
        this.sy = (Math.random() - 0.5) * 0.4 - 0.15;
        this.alpha = Math.random() * 0.5 + 0.15;
        this.color = colors[Math.floor(Math.random() * colors.length)];
        this.rotation = Math.random() * Math.PI * 2;
        this.rotSpeed = (Math.random() - 0.5) * 0.02;
        this.life = 0;
        this.maxLife = Math.random() * 300 + 200;
      }
      update() {
        this.x += this.sx;
        this.y += this.sy;
        this.rotation += this.rotSpeed;
        this.life++;
        if (this.life > this.maxLife) this.reset();
      }
      draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.globalAlpha = this.alpha * (1 - this.life / this.maxLife);
        ctx.fillStyle = this.color + ctx.globalAlpha + ')';
        const w = this.w * (0.8 + Math.sin(this.life * 0.05) * 0.2);
        const h = this.h * (0.8 + Math.cos(this.life * 0.07) * 0.2);
        ctx.beginPath();
        ctx.roundRect(-w / 2, -h / 2, w, h, 2);
        ctx.fill();
        ctx.restore();
      }
    }

    for (let i = 0; i < 80; i++) particles.push(new Particle());

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => { p.update(); p.draw(); });
      animId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="particle-canvas" />;
}

function FireworkSparkle({ index }) {
  const style = {
    '--i': index,
    left: `${15 + (index * 17) % 70}%`,
    top: `${10 + (index * 23) % 80}%`,
    animationDelay: `${index * 0.4}s`,
    animationDuration: `${2.5 + (index % 3) * 0.8}s`,
  };
  return <div className="fw-sparkle" style={style} />;
}

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
    if (localStorage.getItem('bmes_logged_in') === 'true' && localStorage.getItem('auth_token')) {
      navigate('/billing', { replace: true });
    }
  }, [navigate]);

  const validate = () => {
    const errs = {};
    const val = email.trim();
    if (!val) {
      errs.email = 'Email ID is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
      errs.email = 'Enter a valid email ID (e.g. staff@gmail.com)';
    }
    if (!password) {
      errs.password = 'Password is required';
    } else if (password.length < 4) {
      errs.password = 'Password must be at least 4 characters';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoginError('');
    if (!validate()) return;
    setLoading(true);

    try {
      const res = await authService.login({
        email: email.trim(),
        password,
      });

      const isSuccess = res && (res.success === true || res.status === true || res.code === 200) && res.data;

      if (isSuccess) {
        sessionStorage.setItem('billing_entry_loader', 'true');
        setLoading(false);
        navigate('/billing', { replace: true });
      } else {
        setLoading(false);
        setLoginError(res?.message || 'Login failed. Please check your credentials.');
      }
    } catch (err) {
      setLoading(false);
      setLoginError(err.message || 'An error occurred during login. Please try again.');
    }
  };

  return (
    <div className="login-page">
      <Particles />
      {[...Array(6)].map((_, i) => <FireworkSparkle key={i} index={i} />)}

      <div className="login-container">
        <div className="login-brand animate-in">
          <div className="login-logo">
            <img src={logoImg} alt={getShopName()} className="login-logo-img" />
          </div>
          <h1 className="login-title">Pattaz <span>.com</span></h1>
          <p className="login-subtitle">Billing & POS System</p>
        </div>

        <form className="login-form animate-in" onSubmit={handleSubmit} noValidate style={{ animationDelay: '0.15s' }}>
          <div className="form-glow" />

          <h2 className="login-form-title">Welcome Back</h2>
          <p className="login-form-desc">Sign in with Admin or Staff Email ID</p>

          <div className="login-field" style={{ animationDelay: '0.2s' }}>
            <label className="login-label" htmlFor="login-email">
              <Mail size={14} />
              Email ID
            </label>
            <input
              id="login-email"
              type="email"
              className={`clay-input ${errors.email ? 'input-error' : ''}`}
              placeholder="Enter your registered email ID"
              value={email}
              onChange={e => { setEmail(e.target.value); setErrors(p => ({ ...p, email: '' })); }}
              autoComplete="email"
              autoFocus
            />
            {errors.email && <p className="error-text">{errors.email}</p>}
          </div>

          <div className="login-field" style={{ animationDelay: '0.3s' }}>
            <label className="login-label" htmlFor="login-password">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              Password
            </label>
            <div className="pwd-wrap">
              <input
                id="login-password"
                type={showPwd ? 'text' : 'password'}
                className={`clay-input ${errors.password ? 'input-error' : ''}`}
                placeholder="Enter your password"
                value={password}
                onChange={e => { setPassword(e.target.value); setErrors(p => ({ ...p, password: '' })); }}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="pwd-toggle"
                onClick={() => setShowPwd(p => !p)}
                aria-label={showPwd ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.password && <p className="error-text">{errors.password}</p>}
          </div>

          {loginError && <p className="login-error">{loginError}</p>}

          <button
            type="submit"
            className="clay-btn clay-btn-primary login-submit"
            disabled={loading}
            style={{ animationDelay: '0.4s' }}
          >
            {loading ? (
              <>
                <span className="login-spinner" />
                Signing in...
              </>
            ) : (
              <>
                <LogIn size={18} />
                Sign In
              </>
            )}
          </button>

          <p className="login-hint">
            Role-Based Authentication • Min 6 char password
          </p>
        </form>
        <p className="powered-by">Powered By <strong>SDS</strong></p>
      </div>
    </div>
  );
}
