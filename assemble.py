import os, re

base_dir = r'C:/Users/TEJAS/Downloads/tejascanvassing/src/app/components'
target_file = r'C:/Users/TEJAS/antigravity/RiceAggregator-Procurement-Portal-2026-09-10-b0b98/src/views/AboutView.tsx'

def clean_imports(code):
    code = re.sub(r'^import\s+.*?;?\s*$', '', code, flags=re.MULTILINE)
    code = re.sub(r'export\s+default\s+function\s+', 'function ', code)
    return code

components = ['Hero.tsx', 'TrustStrip.tsx', 'ProductShowcase.tsx', 'SupplyChain.tsx', 'WhyChooseUs.tsx', 'GlobalPresence.tsx', 'Testimonials.tsx', 'InquiryForm.tsx']
cleaned_blocks = []

for c in components:
    path = os.path.join(base_dir, c)
    with open(path, 'r', encoding='utf-8') as f:
        cleaned_blocks.append(clean_imports(f.read()))

header = '''import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowRight, ArrowUpRight, CheckCircle2, MapPin, Phone, Mail, Clock, 
  ShieldCheck, Award, Truck, Scale, Building2, Sparkles, MessageSquare, 
  ChevronRight, ChevronLeft, ExternalLink, Check, Star, LogIn, Sprout, 
  Factory, FlaskConical, Package, Ship, Leaf, TrendingDown, Send, MessageCircle, 
  Sun, Moon, PlusSquare, Share
} from 'lucide-react';
'''

about_func = '''
export default function AboutView() {
  const navigate = useNavigate();

  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved ? saved === 'dark' : false;
  });

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  return (
    <div className= min-h-screen bg-[#fafaf9] dark:bg-[#07110c] text-slate-900 dark:text-slate-100 font-sans selection:bg-[#c9a158]/30 selection:text-[#c9a158]>
      <header className=sticky top-0 z-50 bg-[#fafaf9]/90 dark:bg-[#07110c]/90 backdrop-blur-md border-b border-slate-200/80 dark:border-emerald-950/40 px-6 py-3.5 flex items-center justify-between shadow-2xs>
        <div className=flex items-center gap-3 cursor-pointer onClick={() => navigate('/about')}>
          <img src=/logo.png alt=Tejas Logo className=w-8 h-8 object-contain filter drop-shadow-sm />
          <div>
            <h1 className=font-serif text-lg font-bold tracking-tight text-[#1A4731] dark:text-[#E8C97A]>
              TEJAS CANVASSING
            </h1>
            <p className=text-[9px] uppercase tracking-widest text-slate-500 dark:text-slate-400 font-sans font-semibold>
              Premium Rice Dealers · Est. 2010
            </p>
          </div>
        </div>

        <nav className=hidden md:flex items-center gap-6 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300>
          <a href=#products className=hover:text-[#c9a158] transition-colors>Our Brands</a>
          <a href=#process className=hover:text-[#c9a158] transition-colors>Process</a>
          <a href=#why-us className=hover:text-[#c9a158] transition-colors>Why Us</a>
          <a href=#global-presence className=hover:text-[#c9a158] transition-colors>Pan-India Reach</a>
          <a href=#contact className=hover:text-[#c9a158] transition-colors>Get Quote</a>
        </nav>

        <div className=flex items-center gap-2.5>
          <button
            onClick={toggleTheme}
            className=p-2 rounded-xl bg-slate-200/60 dark:bg-neutral-800 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-neutral-700 transition-all cursor-pointer
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDark ? <Sun className=w-4 h-4 text-amber-400 /> : <Moon className=w-4 h-4 text-slate-700 />}
          </button>

          <button
            onClick={() => navigate('/login')}
            className=px-4 py-2 bg-[#1A4731] hover:bg-[#0D2318] dark:bg-[#c9a158] dark:hover:bg-[#b48f49] text-white dark:text-[#0D2318] text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer active:scale-95
          >
            <LogIn className=w-3.5 h-3.5 />
            <span>Portal Login</span>
          </button>
        </div>
      </header>

      <main className=flex flex-col w-full>
        <Hero />
        <TrustStrip />
        <ProductShowcase />
        <SupplyChain />
        <WhyChooseUs />
        <GlobalPresence />
        <Testimonials />
        <InquiryForm />
      </main>

      <footer className=bg-[#07110c] text-slate-400 py-12 border-t border-white/10 text-xs>
        <div className=max-w-[1400px] mx-auto px-6 sm:px-10 flex flex-col sm:flex-row items-center justify-between gap-4>
          <div className=flex items-center gap-3>
            <img src=/logo.png alt=Tejas Logo className=w-6 h-6 object-contain />
            <span className=font-serif text-white font-bold tracking-widest>TEJAS CANVASSING</span>
            <span>© 2010 - 2026. All rights reserved.</span>
          </div>
          <div className=flex items-center gap-6 text-[11px] font-semibold uppercase tracking-wider>
            <span>GSTIN: 29AAGCV7712M1ZP</span>
            <a onClick={() => navigate('/login')} className=text-[#c9a158] hover:underline cursor-pointer flex items-center gap-1>
              <span>Portal Login</span>
              <LogIn className=w-3 h-3 />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
'''

full_code = header + '\n' + '\n'.join(cleaned_blocks) + '\n' + about_func

with open(target_file, 'w', encoding='utf-8') as out_f:
    out_f.write(full_code)

print('Assembled successfully!')
