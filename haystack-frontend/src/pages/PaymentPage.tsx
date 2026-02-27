import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
    CheckCircle, ArrowLeft, Globe, Shield, Zap, Lock,
    CreditCard, Smartphone, Star, Check, AlertCircle
} from 'lucide-react';

const PLAN_CONFIG = {
    starter: {
        name: 'Starter',
        price: { USD: 5, EUR: 4.5, INR: 420 },
        builds: 5,
        color: 'from-blue-600 to-blue-700',
        features: [
            '5 AI-tailored resume builds',
            'Industry-specific tailoring (Tech, Finance, Healthcare & more)',
            'ATS score + 1-click regeneration until you pass',
            'Cover letter auto-generation for every application',
            'Professional PDF with clickable hyperlinks',
            'Credits never expire — use at your pace',
        ],
    },
    premium: {
        name: 'Premium',
        price: { USD: 20, EUR: 18, INR: 1699 },
        builds: 20,
        color: 'from-purple-600 to-indigo-700',
        features: [
            '20 AI-tailored resume builds',
            'Industry-specific tailoring + advanced tone control',
            'Unlimited Gini Chat AI mentor sessions',
            'Hyper-personalised global job search (150+ countries)',
            'Learning Hub — curated skills, courses & career roadmap',
            'ATS score + unlimited 1-click regeneration',
            'Credits never expire — use at your pace',
        ],
    },
};

type Currency = 'USD' | 'EUR' | 'INR';
type Gateway = 'paypal' | 'razorpay' | 'stripe';

const CURRENCY_SYMBOLS: Record<Currency, string> = { USD: '$', EUR: '€', INR: '₹' };
const CURRENCY_LABELS: Record<Currency, string> = { USD: 'USD — US Dollar', EUR: 'EUR — Euro', INR: 'INR — Indian Rupee' };

const PaymentPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const initialPlan = (searchParams.get('plan') || 'starter') as 'starter' | 'premium';
    const [selectedPlan, setSelectedPlan] = React.useState<'starter' | 'premium'>(initialPlan);
    const planKey = selectedPlan;
    const plan = PLAN_CONFIG[planKey] || PLAN_CONFIG.starter;

    const [currency, setCurrency] = useState<Currency>('USD');
    const [gateway, setGateway] = useState<Gateway>('paypal');
    const [loading, setLoading] = useState(false);
    const [paymentStatus, setPaymentStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [errorMsg, setErrorMsg] = useState('');

    const { user, refreshUser } = useAuth();
    const { showToast } = useToast();
    const navigate = useNavigate();
    const token = localStorage.getItem('auth_token');

    // Auto-detect currency from locale
    useEffect(() => {
        const lang = navigator.language || '';
        if (lang.includes('en-IN') || lang.includes('hi')) setCurrency('INR');
        else if (lang.startsWith('en-GB') || lang.includes('-DE') || lang.includes('-FR')) setCurrency('EUR');
        else setCurrency('USD');
    }, []);

    const price = plan.price[currency];
    const symbol = CURRENCY_SYMBOLS[currency];

    const handlePayPal = async () => {
        setLoading(true);
        setErrorMsg('');
        try {
            // Create PayPal order
            const res = await fetch('/api/profile/payments/paypal/create-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ plan: planKey, currency, amount: price }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to create PayPal order');

            // Redirect to PayPal approval URL
            window.location.href = data.approvalUrl;
        } catch (err: any) {
            setErrorMsg(err.message);
            setLoading(false);
        }
    };

    const handleRazorpay = async () => {
        setLoading(true);
        setErrorMsg('');
        try {
            const res = await fetch('/api/profile/payments/razorpay/create-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ plan: planKey, currency: 'INR', amount: plan.price.INR }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to create Razorpay order');

            // Load Razorpay checkout
            const script = document.createElement('script');
            script.src = 'https://checkout.razorpay.com/v1/checkout.js';
            document.body.appendChild(script);
            script.onload = () => {
                const options = {
                    key: data.keyId,
                    amount: data.amount,
                    currency: 'INR',
                    name: 'CareerGini',
                    description: `${plan.name} Plan`,
                    image: '/favicon.png',
                    order_id: data.orderId,
                    handler: async (response: any) => {
                        // Verify payment
                        const vRes = await fetch('/api/profile/payments/razorpay/verify', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                            body: JSON.stringify({
                                plan: planKey,
                                razorpay_order_id: response.razorpay_order_id,
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_signature: response.razorpay_signature,
                            }),
                        });
                        const vData = await vRes.json();
                        if (vRes.ok && vData.success) {
                            await refreshUser();
                            setPaymentStatus('success');
                            showToast(`${plan.name} plan activated! 🎉`, 'success');
                        } else {
                            setErrorMsg('Payment verification failed. Please contact support.');
                        }
                    },
                    prefill: { email: user?.email, name: user?.full_name },
                    theme: { color: '#6366f1' },
                    modal: { ondismiss: () => setLoading(false) },
                };
                const rzp = new (window as any).Razorpay(options);
                rzp.on('payment.failed', (resp: any) => {
                    setErrorMsg(resp.error.description || 'Payment failed');
                    setLoading(false);
                });
                rzp.open();
            };
        } catch (err: any) {
            setErrorMsg(err.message);
            setLoading(false);
        }
    };

    const handleStripe = async () => {
        setLoading(true);
        setErrorMsg('');
        try {
            const res = await fetch('/api/profile/payments/stripe/create-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ plan: planKey, currency, amount: price }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to start Stripe checkout');
            // Redirect to Stripe hosted checkout
            window.location.href = data.checkoutUrl;
        } catch (err: any) {
            setErrorMsg(err.message);
            setLoading(false);
        }
    };

    const handlePay = () => {
        if (gateway === 'paypal') handlePayPal();
        else if (gateway === 'razorpay') handleRazorpay();
        else handleStripe();
    };

    if (paymentStatus === 'success') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 dark:from-slate-900 dark:to-slate-800 px-4">
                <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-10 max-w-md w-full text-center">
                    <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-6">
                        <CheckCircle className="w-10 h-10 text-green-600" />
                    </div>
                    <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-3">
                        {plan.name} Plan Activated! 🎉
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mb-8">
                        Your account has been upgraded. Your new builds and features are ready to use immediately.
                    </p>
                    <button
                        onClick={() => navigate('/resume-builder')}
                        className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-2xl hover:-translate-y-0.5 transition-all shadow-lg"
                    >
                        Start Building Now →
                    </button>
                    <button onClick={() => navigate('/home')} className="w-full py-3 mt-3 text-gray-400 hover:text-gray-600 text-sm">
                        Go to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 px-4 py-10">
            <div className="max-w-5xl mx-auto">
                {/* Back */}
                <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-500 hover:text-gray-900 dark:hover:text-white mb-6 transition-colors text-sm font-medium">
                    <ArrowLeft className="w-4 h-4" /> Back
                </button>

                {/* Plan Switcher */}
                <div className="flex justify-center gap-3 mb-8">
                    {(['starter', 'premium'] as const).map(pk => (
                        <button
                            key={pk}
                            onClick={() => setSelectedPlan(pk)}
                            className={`px-6 py-2.5 rounded-xl font-bold text-sm border-2 transition-all ${selectedPlan === pk
                                    ? pk === 'premium'
                                        ? 'border-purple-600 bg-purple-600 text-white shadow-md'
                                        : 'border-blue-600 bg-blue-600 text-white shadow-md'
                                    : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-blue-400'
                                }`}
                        >
                            {PLAN_CONFIG[pk].name} — {CURRENCY_SYMBOLS['USD']}{PLAN_CONFIG[pk].price['USD']}
                        </button>
                    ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                    {/* Left: Plan Summary */}
                    <div className={`rounded-3xl bg-gradient-to-br ${plan.color} p-8 text-white shadow-2xl`}>
                        <div className="flex items-center gap-3 mb-6">
                            <Star className="w-7 h-7" />
                            <div>
                                <p className="text-sm font-semibold opacity-80">Upgrading to</p>
                                <h2 className="text-3xl font-extrabold">{plan.name} Plan</h2>
                            </div>
                        </div>

                        {/* Price display */}
                        <div className="bg-white/10 rounded-2xl p-5 mb-7">
                            <div className="flex items-baseline gap-2 mb-1">
                                <span className="text-5xl font-black">{symbol}{price}</span>
                                <span className="text-sm opacity-70">one-time · never expires</span>
                            </div>
                            <p className="text-sm opacity-80">{plan.builds} resume builds included</p>
                        </div>

                        {/* Features */}
                        <ul className="space-y-3">
                            {plan.features.map((f, i) => (
                                <li key={i} className="flex items-start gap-3 text-sm">
                                    <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <Check className="w-3 h-3" />
                                    </div>
                                    {f}
                                </li>
                            ))}
                        </ul>

                        {/* Trust badges */}
                        <div className="mt-8 flex flex-wrap gap-4 text-xs opacity-80">
                            <span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" /> SSL Encrypted</span>
                            <span className="flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> PCI DSS Compliant</span>
                            <span className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" /> 150+ Countries</span>
                        </div>
                    </div>

                    {/* Right: Checkout Form */}
                    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-lg p-8 border border-gray-100 dark:border-gray-700">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Payment Details</h3>

                        {/* Currency Selector */}
                        <div className="mb-6">
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Currency</label>
                            <div className="grid grid-cols-3 gap-2">
                                {(Object.keys(CURRENCY_LABELS) as Currency[]).map(c => (
                                    <button
                                        key={c}
                                        onClick={() => setCurrency(c)}
                                        className={`py-2.5 px-3 rounded-xl border-2 text-sm font-bold transition-all ${currency === c
                                            ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                                            : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-blue-300'
                                            }`}
                                    >
                                        {CURRENCY_SYMBOLS[c]} {c}
                                    </button>
                                ))}
                            </div>
                            <p className="text-xs text-gray-400 mt-2">{CURRENCY_LABELS[currency]}</p>
                        </div>

                        {/* Payment Method */}
                        <div className="mb-6">
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Payment Method</label>
                            <div className="space-y-3">
                                {/* PayPal */}
                                <button
                                    onClick={() => setGateway('paypal')}
                                    className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${gateway === 'paypal'
                                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                                        : 'border-gray-200 dark:border-gray-600 hover:border-blue-300'
                                        }`}
                                >
                                    <div className="w-10 h-10 rounded-lg bg-[#003087] flex items-center justify-center text-white font-bold text-xs flex-shrink-0">PP</div>
                                    <div className="text-left">
                                        <p className="text-sm font-bold text-gray-900 dark:text-white">PayPal</p>
                                        <p className="text-xs text-gray-400">PayPal wallet · Debit/Credit cards · USD, EUR</p>
                                    </div>
                                    {gateway === 'paypal' && <div className="ml-auto w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center"><Check className="w-3 h-3 text-white" /></div>}
                                </button>

                                {/* Razorpay (UPI) */}
                                <button
                                    onClick={() => { setGateway('razorpay'); setCurrency('INR'); }}
                                    className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${gateway === 'razorpay'
                                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                                        : 'border-gray-200 dark:border-gray-600 hover:border-blue-300'
                                        }`}
                                >
                                    <div className="w-10 h-10 rounded-lg bg-[#072654] flex items-center justify-center text-white font-bold text-xs flex-shrink-0">RZP</div>
                                    <div className="text-left">
                                        <p className="text-sm font-bold text-gray-900 dark:text-white">UPI / Indian Payments</p>
                                        <p className="text-xs text-gray-400">UPI · NetBanking · Indian Debit/Credit · INR</p>
                                    </div>
                                    {gateway === 'razorpay' && <div className="ml-auto w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center"><Check className="w-3 h-3 text-white" /></div>}
                                </button>

                                {/* Stripe (Apple Pay / Cards) */}
                                <button
                                    onClick={() => setGateway('stripe')}
                                    className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${gateway === 'stripe'
                                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                                        : 'border-gray-200 dark:border-gray-600 hover:border-blue-300'
                                        }`}
                                >
                                    <div className="w-10 h-10 rounded-lg bg-[#635BFF] flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                                        <CreditCard className="w-5 h-5" />
                                    </div>
                                    <div className="text-left">
                                        <p className="text-sm font-bold text-gray-900 dark:text-white">Card / Apple Pay / Google Pay</p>
                                        <p className="text-xs text-gray-400">International cards · Apple Pay · Google Pay · USD, EUR, INR</p>
                                    </div>
                                    {gateway === 'stripe' && <div className="ml-auto w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center"><Check className="w-3 h-3 text-white" /></div>}
                                </button>
                            </div>
                        </div>

                        {/* Error */}
                        {errorMsg && (
                            <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                                <p className="text-sm text-red-700 dark:text-red-400">{errorMsg}</p>
                            </div>
                        )}

                        {/* Pay Button */}
                        <button
                            onClick={handlePay}
                            disabled={loading}
                            className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold rounded-2xl shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0 flex items-center justify-center gap-3 text-base"
                        >
                            {loading ? (
                                <><div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Processing…</>
                            ) : (
                                <><Zap className="w-5 h-5" /> Pay {symbol}{price} — Activate {plan.name}</>
                            )}
                        </button>

                        <p className="text-center text-xs text-gray-400 mt-4 flex items-center justify-center gap-2">
                            <Lock className="w-3.5 h-3.5" />
                            Payments are fully encrypted and processed by {gateway === 'razorpay' ? 'Razorpay' : gateway === 'stripe' ? 'Stripe' : 'PayPal'}. CareerGini does not store your card details.
                        </p>

                        {/* Info about phone-based UPI if Razorpay */}
                        {gateway === 'razorpay' && (
                            <div className="mt-4 p-3 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 flex items-start gap-2">
                                <Smartphone className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
                                <p className="text-xs text-indigo-700 dark:text-indigo-400">UPI checkout will open a secure Razorpay popup where you can pay via any UPI app (PhonePe, GPay, Paytm, etc.), NetBanking, or Indian debit/credit card.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PaymentPage;
